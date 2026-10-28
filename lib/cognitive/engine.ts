import {
  requestedProject,
  selectProjectResources,
  type ProjectSelection,
} from "../connectors/project-selection";
import { understand, normalized } from "./intent";
import { ConversationContexts, type ContextStore } from "./context";
import { synthesize } from "./presentation";
import type {
  Availability,
  CognitiveDependencies,
  Evidence,
  Intent,
  QueryRecord,
  ToolCall,
  SemanticProposal,
} from "./types";
const messageReply = (text: string) => ({
  text,
  model: "jk-cognitive",
  provider: "local_operational" as const,
  usage: null,
});
const abort = (signal: AbortSignal) => {
  if (signal.aborted) throw new DOMException("Cancelado", "AbortError");
};
const safeName = (name: string) =>
  name.replace(/[^\p{L}\p{N} ._/-]/gu, "").slice(0, 100);
export function validateProposal(
  value: unknown,
  providers: string[],
): SemanticProposal | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const p = value as Record<string, unknown>;
  if (
    Object.keys(p).some(
      (k) => !["goal", "providers", "depth", "project"].includes(k),
    )
  )
    return null;
  if (
    p.goal &&
    !["query", "diagnose", "recall", "compare", "modify", "explain"].includes(
      String(p.goal),
    )
  )
    return null;
  if (
    p.depth &&
    !["brief", "normal", "detailed", "deep"].includes(String(p.depth))
  )
    return null;
  if (
    p.providers &&
    (!Array.isArray(p.providers) ||
      p.providers.some((x) => typeof x !== "string" || !providers.includes(x)))
  )
    return null;
  if (p.project && (typeof p.project !== "string" || p.project.length > 120))
    return null;
  return p as SemanticProposal;
}
const errorCategory = (e: unknown) => {
  const x = e as { name?: string; code?: string };
  if (x?.name === "TimeoutError") return "timeout";
  if (x?.name === "AbortError") return "cancelled";
  return /AUTH|TOKEN/.test(x?.code || "")
    ? "authentication"
    : /PERMISSION|SCOPE/.test(x?.code || "")
      ? "permission"
      : /RATE/.test(x?.code || "")
        ? "rate_limit"
        : /TIMEOUT/.test(x?.code || "")
          ? "timeout"
          : "unavailable";
};
const categoryText: Record<string, string> = {
  authentication: "A autorização do provedor precisa ser revisada.",
  permission: "A operação não tem permissão neste escopo.",
  rate_limit: "O provedor limitou temporariamente as consultas.",
  timeout: "A consulta excedeu o tempo disponível.",
  unavailable: "A operação está indisponível; não há resultado confirmado.",
  cancelled: "A operação foi interrompida.",
};
export class CognitiveEngine {
  constructor(
    private deps: CognitiveDependencies,
    private contexts: ContextStore = new ConversationContexts(),
  ) {}
  async answer(
    message: string,
    key: string,
    signal: AbortSignal = new AbortController().signal,
    options?: { semantic?: boolean },
  ) {
    abort(signal);
    const preliminary = understand(message, this.deps.catalog.aliases());
    let semantic: SemanticProposal | null = null;
    try {
      semantic =
        options?.semantic !== false && this.deps.semantic
          ? validateProposal(
              await this.deps.semantic(
                message,
                this.deps.catalog.list().map((c) => ({
                  id: c.id,
                  provider: c.provider,
                  operation: c.operation,
                })),
                signal,
              ),
              [...new Set(this.deps.catalog.list().map((c) => c.provider))],
            )
          : null;
    } catch (error) {
      if (signal.aborted) throw error;
    }
    if (
      requestedProject(message, []).kind !== "target" &&
      !preliminary.providers.length &&
      !preliminary.all &&
      !preliminary.followUp &&
      (!semantic ||
        semantic.goal === "explain" ||
        (!semantic.providers?.length && !semantic.project))
    )
      return null;
    let session;
    try {
      session = await this.contexts.begin(key);
    } catch {
      return messageReply(
        "Não consegui recuperar o registro temporário desta sessão. Não vou inventar consultas anteriores; tente novamente quando o armazenamento estiver disponível.",
      );
    }
    const context = session.context;
    let intent = understand(
      message,
      this.deps.catalog.aliases(),
      context.depth,
    );
    const named = requestedProject(message, []);
    if (semantic)
      intent = {
        ...intent,
        ...(semantic.goal
          ? { goal: preliminary.goal === "modify" ? "modify" : semantic.goal }
          : {}),
        ...(semantic.depth ? { depth: semantic.depth } : {}),
        providers: intent.providers.length
          ? intent.providers
          : semantic.providers || [],
        followUp: intent.followUp || semantic.project === "$context",
      };
    const relevant =
      named.kind === "target" ||
      intent.providers.length > 0 ||
      intent.all ||
      (intent.followUp && context.records.length > 0) ||
      !!semantic?.providers?.length;
    if (!relevant) return null;
    if (intent.goal === "modify")
      return messageReply(
        "Esse pedido modifica recursos. Prepare o plano na Central de Conexões, revise cada ação e aprove-o individualmente. Não executei alterações, migrações ou publicação.",
      );
    let available: Record<string, Availability>;
    try {
      available = await this.deps.available();
    } catch {
      return messageReply(
        "Não consegui consultar as permissões dos conectores agora. Não posso afirmar que as contas estejam desconectadas nem confirmar o estado do projeto.",
      );
    }
    abort(signal);
    const resources = Object.values(available).flatMap((a) => a.resources);
    let selection = requestedProject(message, resources);
    // Only explicit conversational continuations inherit the entity; an unknown new name never falls back.
    if (
      selection.kind === "unresolved" &&
      intent.followUp &&
      context.selection &&
      named.kind !== "target" &&
      !/\b(projeto|site)\s+(?:chamado\s+)?[a-z0-9-]+/i.test(
        normalized(message).replace(
          /(?:nesse|neste|desse|deste|esse) projeto/g,
          "",
        ),
      )
    )
      selection = context.selection;
    if (
      selection.kind === "unresolved" &&
      semantic?.project &&
      semantic.project !== "$context"
    ) {
      const proposed = requestedProject(semantic.project, resources);
      const mentioned = normalized(message).replace(/[^a-z0-9]/g, "");
      const target = normalized(semantic.project).replace(/[^a-z0-9]/g, "");
      if (target.length >= 4 && mentioned.includes(target))
        selection = proposed;
    }

    if (selection.kind === "unresolved")
      return messageReply(
        selection.reason + " Nenhuma ferramenta foi executada.",
      );
    let providers = intent.providers.length
      ? intent.providers
      : Object.keys(available);
    if (!providers.length)
      return messageReply(
        "Nenhum adaptador com operações declaradas está disponível neste ambiente.",
      );
    const permitted = (e: Evidence) =>
      available[e.provider]?.connected &&
      available[e.provider].read &&
      available[e.provider].resources.some((r) => r.id === e.resource);
    const same = (r: QueryRecord) =>
      selection.kind === "all"
        ? r.selection.kind === "all"
        : selection.kind === "target" &&
          r.selection.kind === "target" &&
          ((selection.projectId &&
            selection.projectId === r.selection.projectId) ||
            selection.name === r.selection.name);
    const records = context.records
      .filter(same)
      .map((r) => ({ ...r, evidence: r.evidence.filter(permitted) }));
    if (
      (intent.goal === "recall" || intent.goal === "compare") &&
      !intent.refresh
    ) {
      const last = records.at(-1);
      if (!last || !last.evidence.length)
        return messageReply(
          "Não há evidência anterior disponível e autorizada para esse projeto nesta sessão. Peça uma nova consulta; não vou inventar resultados.",
        );
      return synthesize(
        { ...last, intent },
        intent.goal === "compare" ? records.at(-2) : undefined,
        true,
      );
    }
    const now = this.deps.now || Date.now,
      at = new Date(now()).toISOString();
    const record: QueryRecord = {
      id:
        "q-" +
        now().toString(36) +
        "-" +
        Math.random().toString(36).slice(2, 9),
      at,
      intent,
      selection,
      evidence: [],
      limits: [],
    };
    const deadline = AbortSignal.timeout(30000),
      combined = AbortSignal.any([signal, deadline]);
    let calls = 0;
    const perCapability = new Map<string, number>();
    const run = async (call: ToolCall) => {
      abort(combined);
      if (calls >= 8) {
        record.limits.push(
          "Limite de oito operações por consulta atingido; inspeção adicional não executada.",
        );
        return null;
      }
      const c = this.deps.catalog.validate(call, available);
      if ((perCapability.get(c.id) || 0) >= c.maxCalls) {
        record.limits.push(
          "Limite por ferramenta atingido; amostra incompleta.",
        );
        return null;
      }
      calls++;
      perCapability.set(c.id, (perCapability.get(c.id) || 0) + 1);
      const r = available[c.provider].resources.find(
        (r) => r.id === call.resource,
      )!;
      const base = {
        id: record.id + "-e" + calls,
        provider: c.provider,
        resource: r.id,
        resourceName: safeName(r.name),
        ...(r.kiroProject ? { projectId: r.kiroProject } : {}),
        operation: c.operation,
        at: new Date(now()).toISOString(),
      };
      const controller = new AbortController();
      const callSignal = AbortSignal.any([combined, controller.signal]);
      let timer: ReturnType<typeof setTimeout> | undefined;
      let removeAbort = () => {};
      try {
        const interrupted = new Promise<never>((_, reject) => {
          const onAbort = () =>
            reject(
              callSignal.reason || new DOMException("Cancelado", "AbortError"),
            );
          callSignal.addEventListener("abort", onAbort, { once: true });
          removeAbort = () => callSignal.removeEventListener("abort", onAbort);
          timer = setTimeout(
            () =>
              controller.abort(
                new DOMException("Tempo excedido", "TimeoutError"),
              ),
            c.timeoutMs,
          );
        });
        const response = await Promise.race([
          this.deps.execute(
            c.provider,
            r.id,
            c.operation,
            call.args,
            callSignal,
          ),
          interrupted,
        ]);
        abort(combined);
        const observation = c.inspect(response.data);
        const verified =
          observation.facts && Object.keys(observation.facts).length > 0;
        const e: Evidence = {
          ...base,
          status: verified ? "verified" : "unverified",
          observation,
        };
        record.evidence.push(e);
        return e;
      } catch (error) {
        if (signal.aborted) throw new DOMException("Cancelado", "AbortError");
        const category = errorCategory(error);
        record.evidence.push({
          ...base,
          status: "failed",
          category,
          observation: {
            summary: categoryText[category],
            signals: [],
            facts: {},
            limits: [
              "A falha desta operação não comprova defeito no projeto. Nenhuma causa foi confirmada.",
            ],
          },
        });
        return null;
      } finally {
        if (timer) clearTimeout(timer);
        removeAbort();
      }
    };
    try {
      for (const p of providers) {
        const a = available[p];
        if (!a?.connected || !a.read) {
          record.limits.push(
            p +
              ": " +
              (!a?.connected
                ? "sem conexão validada"
                : "leitura não autorizada") +
              ".",
          );
          continue;
        }
        const targets = selectProjectResources(selection, a.resources);
        if (!targets.length) {
          record.limits.push(
            p +
              ": projeto solicitado não está autorizado neste provedor; nenhum substituto foi consultado.",
          );
          continue;
        }
        if (targets.length > 3)
          record.limits.push(
            p + ": apenas três recursos da seleção foram examinados.",
          );
        for (const r of targets.slice(0, 3)) {
          const overview = this.deps.catalog
            .list()
            .find(
              (c) =>
                c.provider === p &&
                c.purpose === "overview" &&
                c.effect === "read",
            );
          if (!overview) {
            record.limits.push(p + ": nenhuma operação de consulta declarada.");
            continue;
          }
          await run({ capability: overview.id, resource: r.id, args: {} });
          if (
            intent.goal === "diagnose" &&
            ["detailed", "deep"].includes(intent.depth)
          ) {
            const inspection = this.deps.catalog
              .list()
              .filter(
                (c) =>
                  c.provider === p &&
                  c.purpose === "inspect" &&
                  c.effect === "read",
              );
            for (const c of inspection) {
              let args: Record<string, unknown> = {};
              if (c.operation === "file")
                args = {
                  path: "package.json",
                  ...(r.defaultBranch ? { ref: r.defaultBranch } : {}),
                };
              if (c.operation === "checks") {
                const sha = record.evidence.find(
                  (e) =>
                    e.provider === p &&
                    e.resource === r.id &&
                    typeof e.observation.facts.latestSha === "string",
                )?.observation.facts.latestSha;
                if (!sha) continue;
                args = { sha };
              }
              if (c.validate(args))
                await run({ capability: c.id, resource: r.id, args });
            }
          }
        }
      }
    } catch (error) {
      if (signal.aborted) throw error;
      record.limits.push(
        "A consulta atingiu seu tempo total; as demais operações não foram executadas.",
      );
    }
    abort(signal);
    if (!record.evidence.length)
      return messageReply(
        record.limits.join(" ") +
          " Nenhuma consulta de dados foi concluída; não há diagnóstico confirmado.",
      );
    if (record.evidence.length > 1)
      record.limits.push(
        "Correlação limitada aos vínculos autorizados do mesmo projeto; sem comprovação de causalidade entre provedores.",
      );
    try {
      await this.contexts.commit(key, session.generation, record);
    } catch {
      record.limits.push(
        "As evidências desta resposta não puderam ser guardadas para acompanhamento.",
      );
    }
    return synthesize(
      record,
      intent.goal === "compare" ? records.at(-1) : undefined,
    );
  }
}
