import { randomUUID } from "node:crypto";
import {
  ConnectorError,
  type StateStore,
  type Provider,
  type Credentials,
  type Connection,
  type Grant,
  type Resource,
  type Action,
  type Plan,
  type VaultState,
  type Call,
} from "./types";
import { normalizeAction, mutation } from "./actions";
import { actionDigest, hash, redact, safeText, resourceId } from "./security";
import { operation, OPERATIONS } from "./catalog";
import { createAdapters, discover, record } from "./adapters";
import type { OAuthClient } from "./oauth";
type Options = {
  store: StateStore;
  call: Call;
  oauth: OAuthClient;
  environment: () => string;
  writeResources: () => Partial<Record<Provider, string[]>>;
  kiroIds?: string[];
  now?: () => number;
};
function audit(
  s: VaultState,
  operation: string,
  outcome: string,
  extra: Partial<VaultState["audit"][number]> = {},
) {
  s.audit.push({
    id: randomUUID(),
    at: new Date().toISOString(),
    operation,
    outcome,
    ...extra,
  });
}
export function publicConnection(c: Connection) {
  return {
    id: c.id,
    provider: c.provider,
    mode: c.mode,
    status: c.status,
    revision: c.revision,
    resources: c.resources,
    grants: c.grants,
    providerScopes: c.providerScopes,
    verifiedAt: c.verifiedAt,
    account: c.account,
    lastError: c.lastError || null,
  };
}
export function publicPlan(p: Plan, now = Date.now()) {
  const visible = structuredClone(p);
  visible.steps = visible.steps.map((step) => ({
    ...step,
    action: {
      ...step.action,
      args:
        step.action.operation === "preview_env"
          ? { ...step.action.args, value: "[redacted]" }
          : (redact(step.action.args) as Record<string, unknown>),
    },
  }));
  if (
    visible.status === "running" &&
    visible.steps.some(
      (s) => s.status === "running" && now - (s.startedAt || 0) > 60000,
    )
  )
    visible.status = "uncertain";
  return {
    ...visible,
    approval: visible.approval
      ? { at: visible.approval.at, digest: visible.approval.digest }
      : undefined,
    confirmation: "APROVAR " + p.digest.slice(0, 8),
  };
}
export class ConnectorService {
  private run;
  constructor(public options: Options) {
    this.run = createAdapters(options.call);
  }
  private now() {
    return (this.options.now || Date.now)();
  }
  async overview() {
    const configured = this.options.store.configured(),
      state = configured ? await this.options.store.read() : null;
    return {
      configured,
      environment: this.options.environment(),
      providers: (["github", "supabase", "vercel"] as Provider[]).map(
        (provider) => ({
          provider,
          oauthConfigured: this.options.oauth.configured(provider),
          connection: state?.connections[provider]
            ? publicConnection(state.connections[provider]!)
            : null,
          operations: OPERATIONS.filter((x) => x.provider === provider),
          writeAllowlist: this.options.writeResources()[provider] || [],
          revocationUrl:
            provider === "github"
              ? "https://github.com/settings/installations"
              : provider === "supabase"
                ? "https://supabase.com/dashboard/account/authorizations"
                : "https://vercel.com/dashboard/integrations",
        }),
      ),
      plans: state?.plans.map((p) => publicPlan(p, this.now())).reverse() || [],
      audit: state?.audit.slice(-100).reverse() || [],
      note: "Credenciais da memória não são usadas por estes conectores. Produção e merge permanecem bloqueados.",
    };
  }
  /** Revalidate existing authorizations only. Never creates connections or changes scope. */
  async verifySavedConnections() {
    const state=await this.options.store.read();
    const results: Array<{provider:Provider;state:"verified"|"not_connected"|"failed"}> = [];
    for (const provider of ["github","supabase","vercel"] as const) {
      const saved=state.connections[provider];
      if (!saved?.credentials || saved.status!=="connected") {
        results.push({provider,state:"not_connected"});
        continue;
      }
      try {
        await this.test(provider);
        results.push({provider,state:"verified"});
      } catch {
        // Provider errors may contain private metadata. Persist the existing safe
        // test result, but return only a bounded summary to this batch action.
        results.push({provider,state:"failed"});
      }
    }
    return {results};
  }
  private async connection(p: Provider) {
    let c = (await this.options.store.read()).connections[p];
    if (!c || c.status !== "connected" || !c.credentials)
      throw new ConnectorError("PERMISSION_DENIED", 403);
    if (
      c.credentials.expiresAt &&
      c.credentials.expiresAt < this.now() + 30000
    ) {
      if (c.mode !== "oauth") throw new ConnectorError("UPSTREAM_AUTH", 403);
      const id = c.id,
        revision = c.revision,
        lease = randomUUID() + ":" + this.now();
      await this.options.store.update((s) => {
        const current = s.connections[p];
        if (
          !current ||
          current.id !== id ||
          current.revision !== revision ||
          current.status !== "connected"
        )
          throw new ConnectorError("PERMISSION_DENIED", 403);
        if (
          current.refreshLease &&
          this.now() - Number(current.refreshLease.split(":").at(-1)) < 20000
        )
          throw new ConnectorError("VAULT_CONFLICT", 409);
        current.refreshLease = lease;
      });
      try {
        const credentials = await this.options.oauth.refresh(p, c.credentials);
        c = await this.options.store.update((s) => {
          const current = s.connections[p];
          if (
            !current ||
            current.id !== id ||
            current.status !== "connected" ||
            current.refreshLease !== lease
          )
            throw new ConnectorError("PERMISSION_DENIED", 403);
          current.credentials = credentials;
          delete current.refreshLease;
          return current;
        });
      } catch (e) {
        await this.options.store.update((s) => {
          const current = s.connections[p];
          if (current?.id === id && current.refreshLease === lease) {
            delete current.refreshLease;
            current.verifiedAt = null;
            current.lastError = "UPSTREAM_AUTH";
          }
        });
        throw e;
      }
    }
    return c;
  }
  async connect(
    p: Provider,
    credentials: Credentials,
    mode: "oauth" | "token",
    scopes: string[] = [],
  ) {
    if (
      !credentials.accessToken ||
      credentials.accessToken.length < 10 ||
      credentials.accessToken.length > 10000 ||
      /[\r\n]/.test(credentials.accessToken) ||
      (p === "supabase" &&
        (credentials.accessToken.startsWith("eyJ") ||
          credentials.accessToken.startsWith("sb_secret_")))
    )
      throw new ConnectorError("TOKEN_INVALID");
    const c: Connection = {
      id: randomUUID(),
      provider: p,
      mode,
      status: "connected",
      revision: 1,
      credentials,
      resources: [],
      grants: ["read"],
      providerScopes: scopes,
      verifiedAt: null,
      account: "Autorização pendente de teste",
    };
    await this.options.store.update((s) => {
      s.connections[p] = c;
      audit(s, "connect", "credential_stored", { provider: p });
    });
    try {
      await this.test(p);
    } catch {
      /* Authorized material remains encrypted for retest/revocation. */
    }
    return this.overview();
  }
  async test(p: Provider, page = 1) {
    const c = await this.connection(p);
    try {
      const result = await discover(
        p,
        c.credentials!,
        this.options.call,
        Math.max(1, Math.min(10, Math.floor(page))),
      );
      await this.options.store.update((s) => {
        const current = s.connections[p];
        if (!current || current.id !== c.id || current.status !== "connected")
          throw new ConnectorError("PERMISSION_DENIED", 403);
        current.verifiedAt = new Date(this.now()).toISOString();
        current.lastTestAt = current.verifiedAt;
        current.account = result.account;
        current.providerScopes = [
          ...new Set([...current.providerScopes, ...result.providerScopes]),
        ];
        delete current.lastError;
        audit(s, "connection_test", "verified", { provider: p });
      });
      return result;
    } catch (e) {
      await this.options.store.update((s) => {
        const current = s.connections[p];
        if (current?.id === c.id) {
          current.verifiedAt = null;
          current.lastTestAt = new Date(this.now()).toISOString();
          current.lastError =
            e instanceof ConnectorError ? e.code : "UPSTREAM_UNAVAILABLE";
          audit(s, "connection_test", "failed", { provider: p });
        }
      });
      throw e;
    }
  }
  async scope(p: Provider, selection: unknown, grants: unknown) {
    if (
      !Array.isArray(selection) ||
      selection.length > 20 ||
      !Array.isArray(grants) ||
      !grants.includes("read") ||
      grants.some(
        (g) =>
          ![
            "read",
            ...(p === "vercel" ? ["deploy", "configure"] : ["write"]),
          ].includes(g),
      )
    )
      throw new ConnectorError("SCOPE_INVALID");
    const c = await this.connection(p),
      available = (await this.test(p)).resources;
    const resources: Resource[] = selection.map((x) => {
      const r = record(x),
        found = available.find((a) => a.id === r.id);
      if (!found) throw new ConnectorError("PERMISSION_DENIED", 403);
      if (r.kiroProject && !this.options.kiroIds?.includes(r.kiroProject))
        throw new ConnectorError("PROJECT_INVALID");
      return {
        ...found,
        environment:
          p === "supabase"
            ? r.environment === "development"
              ? "development"
              : "production"
            : found.environment,
        ...(r.kiroProject ? { kiroProject: r.kiroProject } : {}),
      };
    });
    if (new Set(resources.map((r) => r.id)).size !== resources.length)
      throw new ConnectorError("SCOPE_INVALID");
    await this.options.store.update((s) => {
      const current = s.connections[p];
      if (!current || current.id !== c.id || current.status !== "connected")
        throw new ConnectorError("PERMISSION_DENIED", 403);
      current.resources = resources;
      current.grants = [...new Set(grants)] as Grant[];
      current.revision++;
      audit(s, "scope", "updated", { provider: p });
    });
    return this.overview();
  }
  async disconnect(p: Provider, revoke: boolean) {
    const original = (await this.options.store.read()).connections[p];
    if (!original) throw new ConnectorError("PERMISSION_DENIED", 403);
    await this.options.store.update((s) => {
      const c = s.connections[p];
      if (!c || c.id !== original.id)
        throw new ConnectorError("VAULT_CONFLICT", 409);
      c.revision++;
      c.resources = [];
      c.grants = [];
      c.verifiedAt = null;
      c.status = revoke ? "revoking" : "disconnected";
      if (!revoke) delete c.credentials;
      audit(s, revoke ? "revoke" : "disconnect", "local_access_disabled", {
        provider: p,
      });
    });
    let remote = false,
      manual = original.mode !== "oauth" || !original.credentials;
    if (revoke && !manual) {
      try {
        await this.options.oauth.revoke(p, original.credentials!);
        remote = true;
      } catch (e) {
        manual =
          e instanceof ConnectorError && e.code === "REMOTE_REVOCATION_MANUAL";
      }
    }
    if (revoke)
      await this.options.store.update((s) => {
        const c = s.connections[p];
        if (c?.id === original.id && c.status === "revoking") {
          c.status = remote || manual ? "disconnected" : "revocation_pending";
          if (remote || manual) delete c.credentials;
          audit(
            s,
            "revoke",
            remote
              ? "provider_revoked"
              : manual
                ? "provider_manual_required"
                : "provider_revocation_failed",
            { provider: p },
          );
        }
      });
    return {
      remoteRevoked: remote,
      manualRequired: manual,
      localDisabled: true,
      ...(await this.overview()),
    };
  }
  private allow(action: Action, c: Connection) {
    const resource = c.resources.find((r) => r.id === action.resource),
      definition = operation(action.provider, action.operation)!;
    if (
      c.status !== "connected" ||
      !c.credentials ||
      !c.verifiedAt ||
      c.lastError ||
      !resource ||
      !c.grants.includes(definition.grant)
    )
      throw new ConnectorError("PERMISSION_DENIED", 403);
    if (
      mutation(action) &&
      (this.options.environment() === "production" ||
        resource.environment === "production" ||
        !this.options.writeResources()[action.provider]?.includes(resource.id))
    )
      throw new ConnectorError("PRODUCTION_BLOCKED", 403);
    return resource;
  }
  /** Read-only conversational tool. Shares the exact scope and provider checks with the Central. */
  async readAuthorized(
    provider: Provider,
    resourceId: string,
    operationId: string,
    args: Record<string, unknown> = {},
    signal?: AbortSignal,
  ) {
    const definition = operation(provider, operationId);
    if (!definition || definition.grant !== "read")
      throw new ConnectorError("OPERATION_BLOCKED", 403);
    const action = normalizeAction({
      provider,
      resource: resourceId,
      operation: operationId,
      args,
    });
    const connection = await this.connection(provider);
    const resource = this.allow(action, connection);
    let result: unknown;
    let checkedAt: string;
    try {
      if (signal?.aborted) throw new DOMException("Cancelado", "AbortError");
      const run = signal
        ? createAdapters((p, c, path, options) =>
            this.options.call(p, c, path, { ...options, signal }),
          )
        : this.run;
      result = await run(action, connection.credentials!, resource);
      if (signal?.aborted) throw new DOMException("Cancelado", "AbortError");
      checkedAt = new Date(this.now()).toISOString();
      await this.options.store.update((state) => {
        const current = state.connections[provider];
        if (
          current?.id === connection.id &&
          current.revision === connection.revision &&
          current.status === "connected"
        ) {
          current.lastReadAt = checkedAt;
          current.lastReadOperation = operationId;
        }
        return audit(state, "conversation:" + operationId, "done", {
          provider,
          resource: resource.id,
        });
      });
    } catch (error) {
      await this.options.store.update((state) =>
        audit(state, "conversation:" + operationId, "failed", {
          provider,
          resource: resource.id,
        }),
      );
      throw error;
    }
    return {
      provider,
      resource: resource.id,
      operation: operationId,
      checkedAt,
      data: redact(result, [
        connection.credentials!.accessToken,
        connection.credentials!.refreshToken || "",
      ]),
    };
  }
  async plan(title: unknown, rawActions: unknown) {
    if (
      !Array.isArray(rawActions) ||
      !rawActions.length ||
      rawActions.length > 7
    )
      throw new ConnectorError("PLAN_LIMIT");
    const actions = rawActions.map(normalizeAction),
      state = await this.options.store.read(),
      revisions: Plan["connectionRevisions"] = {};
    for (const action of actions) {
      const c = state.connections[action.provider];
      if (!c) throw new ConnectorError("PERMISSION_DENIED", 403);
      this.allow(action, c);
      revisions[action.provider] = c.id + ":" + c.revision;
    }
    const plan: Plan = {
      id: randomUUID(),
      title: safeText(title, 180),
      digest: actionDigest(actions, revisions, this.options.environment()),
      connectionRevisions: revisions,
      createdAt: this.now(),
      expiresAt: this.now() + 1800000,
      status: "draft",
      steps: actions.map((action) => ({ action, status: "pending" })),
    };
    await this.options.store.update((s) => {
      for (const [provider, revision] of Object.entries(revisions)) {
        const c = s.connections[provider as Provider];
        if (!c || c.id + ":" + c.revision !== revision)
          throw new ConnectorError("SCOPE_CHANGED", 409);
      }
      if (
        s.plans.filter(
          (p) =>
            p.expiresAt > this.now() &&
            !["done", "cancelled", "failed"].includes(p.status),
        ).length >= 20
      )
        throw new ConnectorError("PLAN_LIMIT", 429);
      s.plans.push(plan);
      audit(s, "plan", "prepared", { plan: plan.id, digest: plan.digest });
    });
    return publicPlan(plan, this.now());
  }
  async approve(
    id: string,
    digest: string,
    confirmation: string,
    session: string,
  ) {
    return this.options.store.update((s) => {
      const p = s.plans.find((p) => p.id === id);
      if (
        !p ||
        p.status !== "draft" ||
        p.digest !== digest ||
        confirmation !== "APROVAR " + digest.slice(0, 8)
      )
        throw new ConnectorError("APPROVAL_REQUIRED", 403);
      if (p.expiresAt < this.now())
        throw new ConnectorError("PLAN_EXPIRED", 409);
      for (const step of p.steps) {
        const c = s.connections[step.action.provider];
        if (
          !c ||
          c.id + ":" + c.revision !==
            p.connectionRevisions[step.action.provider]
        )
          throw new ConnectorError("SCOPE_CHANGED", 409);
        this.allow(step.action, c);
      }
      p.approval = { at: this.now(), session, digest };
      p.status = "approved";
      audit(s, "approve", "approved", { plan: id, digest });
      return publicPlan(p, this.now());
    });
  }
  async cancel(id: string) {
    await this.options.store.update((s) => {
      const p = s.plans.find((p) => p.id === id);
      if (!p || p.status === "running")
        throw new ConnectorError("PLAN_BUSY", 409);
      p.status = "cancelled";
      audit(s, "cancel", "cancelled", { plan: id });
    });
    return this.overview();
  }
  async execute(id: string, digest: string, session: string) {
    const started = Date.now();
    let plan = await this.options.store.update((s) => {
      const p = s.plans.find((p) => p.id === id);
      if (
        !p ||
        !["draft", "approved", "waiting"].includes(p.status) ||
        p.digest !== digest
      )
        throw new ConnectorError("PLAN_BUSY", 409);
      if (p.expiresAt < this.now())
        throw new ConnectorError("PLAN_EXPIRED", 409);
      const actions = p.steps.map((s) => s.action);
      if (
        actionDigest(
          actions,
          p.connectionRevisions,
          this.options.environment(),
        ) !== digest
      )
        throw new ConnectorError("PLAN_CHANGED", 409);
      if (
        actions.some(mutation) &&
        (!p.approval ||
          p.approval.digest !== digest ||
          p.approval.session !== session)
      )
        throw new ConnectorError("APPROVAL_REQUIRED", 403);
      for (const step of p.steps) {
        const c = s.connections[step.action.provider];
        if (
          !c ||
          c.id + ":" + c.revision !==
            p.connectionRevisions[step.action.provider]
        )
          throw new ConnectorError("SCOPE_CHANGED", 409);
        this.allow(step.action, c);
      }
      p.status = "running";
      audit(s, "execute", "started", { plan: id, digest });
      return p;
    });
    for (let index = 0; index < plan.steps.length; index++) {
      const step = plan.steps[index];
      if (step.status === "done") continue;
      if (index > 0 && Date.now() - started > 20000) {
        return this.options.store.update((s) => {
          const p = s.plans.find((p) => p.id === id)!;
          p.status = "waiting";
          audit(s, "execute", "request_budget_reached", { plan: id, digest });
          return publicPlan(p, this.now());
        });
      }
      let action = structuredClone(step.action);
      try {
        if (mutation(action)) {
          const health = (await this.options.store.read()).connections[
            action.provider
          ];
          if (
            health?.verifiedAt &&
            this.now() - Date.parse(health.verifiedAt) > 300000
          )
            await this.test(action.provider);
        }
        const c = await this.connection(action.provider),
          latest = (await this.options.store.read()).connections[
            action.provider
          ];
        if (
          !latest ||
          latest.id + ":" + latest.revision !==
            plan.connectionRevisions[action.provider]
        )
          throw new ConnectorError("SCOPE_CHANGED", 409);
        const resource = this.allow(action, latest);
        if (action.args.sha === "$commit") {
          const commit = plan.steps
            .slice(0, index)
            .find(
              (s) =>
                s.action.provider === "github" &&
                s.action.operation === "commit" &&
                s.status === "done",
            );
          const result = record(commit?.result);
          if (!/^[a-f0-9]{40}$/.test(result.sha))
            throw new ConnectorError("COMMIT_REFERENCE_INVALID");
          action.args.sha = result.sha;
        }
        await this.options.store.update((s) => {
          const p = s.plans.find((p) => p.id === id)!;
          if (p.status !== "running")
            throw new ConnectorError("PLAN_BUSY", 409);
          const authorizedConnection = s.connections[action.provider];
          if (
            !authorizedConnection ||
            authorizedConnection.id + ":" + authorizedConnection.revision !==
              p.connectionRevisions[action.provider]
          )
            throw new ConnectorError("SCOPE_CHANGED", 409);
          this.allow(action, authorizedConnection);
          p.steps[index].status = "running";
          p.steps[index].startedAt = this.now();
          audit(s, action.operation, "started", {
            plan: id,
            provider: action.provider,
            resource: action.resource,
            digest,
          });
        });
        const data = await this.run(action, c.credentials!, resource),
          safe = redact(data, [
            c.credentials!.accessToken,
            c.credentials!.refreshToken || "",
          ]);
        const waiting =
          action.operation === "checks" &&
          action.args.waitForSuccess === true &&
          record(data).waiting === true;
        if (
          action.operation === "checks" &&
          action.args.waitForSuccess === true &&
          record(data).failed === true
        )
          throw new ConnectorError("TESTS_FAILED", 409);
        plan = await this.options.store.update((s) => {
          const p = s.plans.find((p) => p.id === id)!;
          p.steps[index].result = safe;
          p.steps[index].status = waiting ? "waiting" : "done";
          if (waiting) p.status = "waiting";
          audit(
            s,
            action.operation,
            waiting ? "waiting_for_checks" : "completed",
            { plan: id, provider: action.provider, resource: action.resource },
          );
          return p;
        });
        if (waiting) return publicPlan(plan, this.now());
      } catch (e) {
        const code =
            e instanceof ConnectorError ? e.code : "UPSTREAM_UNAVAILABLE",
          uncertain =
            mutation(action) &&
            [
              "UPSTREAM_UNAVAILABLE",
              "UPSTREAM_INVALID",
              "UPSTREAM_LIMIT",
              "UNCERTAIN_RESULT",
            ].includes(code);
        await this.options.store.update((s) => {
          const p = s.plans.find((p) => p.id === id)!;
          p.steps[index].status = uncertain ? "uncertain" : "failed";
          p.steps[index].error = code;
          p.status = uncertain ? "uncertain" : "failed";
          audit(s, action.operation, p.status, {
            plan: id,
            provider: action.provider,
            resource: action.resource,
          });
        });
        return publicPlan(
          (await this.options.store.read()).plans.find((p) => p.id === id)!,
          this.now(),
        );
      }
    }
    return this.options.store.update((s) => {
      const p = s.plans.find((p) => p.id === id)!;
      p.status = "done";
      audit(s, "execute", "completed", { plan: id, digest });
      return publicPlan(p, this.now());
    });
  }
}
