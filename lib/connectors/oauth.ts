import "server-only";
import { randomBytes } from "node:crypto";
import { hash } from "./security";
import { boundedResponse } from "./transport";
import {
  ConnectorError,
  type Provider,
  type StateStore,
  type Credentials,
} from "./types";
export type OAuthApps = {
  origin: string;
  github?: { id: string; secret: string };
  supabase?: { id: string; secret: string };
  vercel?: { id: string; secret: string; slug: string };
};
export function oauthApps(): OAuthApps {
  let origin = process.env.JARVIS_CONNECTOR_ORIGIN || "";
  try {
    const u = new URL(origin);
    if (
      u.username ||
      u.password ||
      u.search ||
      u.hash ||
      u.pathname !== "/" ||
      (u.protocol !== "https:" &&
        !(u.protocol === "http:" && u.hostname === "localhost"))
    )
      origin = "";
    else origin = u.origin;
  } catch {
    origin = "";
  }
  const app = (p: string) => {
    const id = process.env["JARVIS_DEV_" + p + "_CLIENT_ID"],
      secret = process.env["JARVIS_DEV_" + p + "_CLIENT_SECRET"];
    return id && secret ? { id, secret } : undefined;
  };
  const vercel = app("VERCEL"),
    slug = process.env.JARVIS_DEV_VERCEL_INTEGRATION_SLUG;
  return {
    origin,
    github: app("GITHUB"),
    supabase: app("SUPABASE"),
    vercel:
      vercel && slug && /^[a-z0-9-]{1,64}$/.test(slug)
        ? { ...vercel, slug }
        : undefined,
  };
}
export class OAuthClient {
  constructor(
    private store: StateStore,
    private apps: OAuthApps,
    private fetcher: typeof fetch = fetch,
    private now = Date.now,
  ) {}
  configured(p: Provider) {
    return !!this.apps.origin && !!this.apps[p];
  }
  private callback(p: Provider) {
    return (
      this.apps.origin + "/api/director/connectors/oauth/" + p + "/callback"
    );
  }
  async start(p: Provider, sessionExpires: number) {
    if (!this.configured(p))
      throw new ConnectorError("APP_NOT_CONFIGURED", 503);
    const state = randomBytes(32).toString("base64url"),
      binding = randomBytes(32).toString("base64url"),
      verifier = randomBytes(48).toString("base64url");
    await this.store.update((s) => {
      s.oauth[hash(state)] = {
        provider: p,
        verifier,
        bindingHash: hash(binding),
        sessionExpires,
        expiresAt: this.now() + 600000,
      };
    });
    const app = this.apps[p]!,
      url = new URL(
        p === "github"
          ? "https://github.com/login/oauth/authorize"
          : p === "supabase"
            ? "https://api.supabase.com/v1/oauth/authorize"
            : "https://vercel.com/integrations/" +
              this.apps.vercel!.slug +
              "/new",
      );
    url.searchParams.set("state", state);
    if (p !== "vercel") {
      url.searchParams.set("client_id", app.id);
      url.searchParams.set("redirect_uri", this.callback(p));
      url.searchParams.set(
        "code_challenge",
        Buffer.from(hash(verifier), "hex").toString("base64url"),
      );
      url.searchParams.set("code_challenge_method", "S256");
      if (p === "supabase") url.searchParams.set("response_type", "code");
    }
    return { authorizationUrl: url.href, binding };
  }
  async finish(p: Provider, state: string, binding: string, code: string) {
    if (
      !/^[A-Za-z0-9_-]{43}$/.test(state) ||
      !binding ||
      !code ||
      code.length > 1024
    )
      throw new ConnectorError("OAUTH_STATE_INVALID", 403);
    const pending = await this.store.update((s) => {
      const key = hash(state),
        pending = s.oauth[key];
      if (
        !pending ||
        pending.provider !== p ||
        pending.bindingHash !== hash(binding) ||
        pending.expiresAt < this.now() ||
        pending.sessionExpires < this.now()
      )
        throw new ConnectorError("OAUTH_STATE_INVALID", 403);
      delete s.oauth[key];
      return pending;
    });
    const app = this.apps[p];
    if (!app) throw new ConnectorError("APP_NOT_CONFIGURED", 503);
    return this.tokens(p, {
      grant_type: "authorization_code",
      code,
      redirect_uri: this.callback(p),
      ...(p === "vercel" ? {} : { code_verifier: pending.verifier }),
    });
  }
  private async tokens(p: Provider, fields: Record<string, string>) {
    const app = this.apps[p];
    if (!app) throw new ConnectorError("APP_NOT_CONFIGURED", 503);
    const body = new URLSearchParams(fields),
      headers: Record<string, string> = {
        "Content-Type": "application/x-www-form-urlencoded",
        Accept: "application/json",
      };
    if (p === "supabase")
      headers.Authorization =
        "Basic " + Buffer.from(app.id + ":" + app.secret).toString("base64");
    else {
      body.set("client_id", app.id);
      body.set("client_secret", app.secret);
    }
    const endpoint =
      p === "github"
        ? "https://github.com/login/oauth/access_token"
        : p === "supabase"
          ? "https://api.supabase.com/v1/oauth/token"
          : "https://api.vercel.com/v2/oauth/access_token";
    const raw = (await boundedResponse(
      await this.fetcher(endpoint, {
        method: "POST",
        headers,
        body: body.toString(),
        cache: "no-store",
        redirect: "error",
        signal: AbortSignal.timeout(12000),
      }),
      100000,
    )) as Record<string, unknown>;
    if (
      typeof raw.access_token !== "string" ||
      raw.access_token.length < 10 ||
      raw.access_token.length > 10000 ||
      raw.error
    )
      throw new ConnectorError("UPSTREAM_AUTH", 403);
    const credentials: Credentials = {
      accessToken: raw.access_token,
      ...(typeof raw.refresh_token === "string"
        ? { refreshToken: raw.refresh_token }
        : {}),
      ...(Number(raw.expires_in) > 0
        ? { expiresAt: this.now() + Number(raw.expires_in) * 1000 }
        : {}),
      ...(typeof raw.configuration_id === "string"
        ? { configurationId: raw.configuration_id }
        : {}),
      ...(typeof raw.team_id === "string" ? { teamId: raw.team_id } : {}),
    };
    return {
      credentials,
      scopes:
        typeof raw.scope === "string"
          ? raw.scope.split(/[ ,]+/).filter(Boolean)
          : [],
    };
  }
  async refresh(p: Provider, c: Credentials) {
    if (!c.refreshToken || p === "vercel")
      throw new ConnectorError("UPSTREAM_AUTH", 403);
    const result = await this.tokens(p, {
      grant_type: "refresh_token",
      refresh_token: c.refreshToken,
    });
    return {
      ...c,
      ...result.credentials,
      refreshToken: result.credentials.refreshToken || c.refreshToken,
    };
  }
  async revoke(p: Provider, c: Credentials) {
    const app = this.apps[p];
    if (!app) throw new ConnectorError("APP_NOT_CONFIGURED", 503);
    let url: string,
      body: Record<string, string>,
      headers: Record<string, string> = {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      method = "POST";
    if (p === "github") {
      url =
        "https://api.github.com/applications/" +
        encodeURIComponent(app.id) +
        "/grant";
      headers.Authorization =
        "Basic " + Buffer.from(app.id + ":" + app.secret).toString("base64");
      body = { access_token: c.accessToken };
      method = "DELETE";
    } else if (p === "supabase") {
      if (!c.refreshToken) throw new ConnectorError("REMOTE_REVOCATION_MANUAL");
      url = "https://api.supabase.com/v1/oauth/revoke";
      body = {
        client_id: app.id,
        client_secret: app.secret,
        refresh_token: c.refreshToken,
      };
    } else {
      if (!c.configurationId)
        throw new ConnectorError("REMOTE_REVOCATION_MANUAL");
      url =
        "https://api.vercel.com/v1/integrations/configuration/" +
        encodeURIComponent(c.configurationId) +
        (c.teamId ? "?teamId=" + encodeURIComponent(c.teamId) : "");
      headers.Authorization = "Bearer " + c.accessToken;
      body = {};
      method = "DELETE";
    }
    await boundedResponse(
      await this.fetcher(url, {
        method,
        headers,
        body: JSON.stringify(body),
        redirect: "error",
        cache: "no-store",
        signal: AbortSignal.timeout(12000),
      }),
      100000,
    );
  }
}
