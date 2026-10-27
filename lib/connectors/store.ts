import "server-only";
import { encrypt, decrypt } from "./security";
import {
  ConnectorError,
  emptyState,
  type VaultState,
  type StateStore,
} from "./types";
export function connectorEnvironment() {
  const value = process.env.VERCEL_ENV;
  return value === "production"
    ? "production"
    : value === "preview"
      ? "preview"
      : "development";
}
function config() {
  const url = process.env.JARVIS_CONNECTOR_STORE_URL,
    key = process.env.JARVIS_CONNECTOR_STORE_KEY,
    raw = process.env.JARVIS_CONNECTOR_ENCRYPTION_KEY,
    namespace = process.env.JARVIS_CONNECTOR_NAMESPACE || "jk";
  if (!url || !key || !raw || !/^[a-zA-Z0-9_-]{1,64}$/.test(namespace))
    return null;
  try {
    const parsed = new URL(url),
      secret = Buffer.from(raw, "base64");
    if (
      parsed.protocol !== "https:" ||
      !/^[a-z0-9-]+\.supabase\.co$/.test(parsed.hostname) ||
      parsed.port ||
      parsed.username ||
      parsed.password ||
      parsed.pathname !== "/" ||
      parsed.search ||
      parsed.hash ||
      secret.length !== 32
    )
      return null;
    return {
      url: parsed.origin,
      key,
      secret,
      id: connectorEnvironment() + ":" + namespace,
    };
  } catch {
    return null;
  }
}
/** Dedicated ciphertext-only store. Never falls back to memory/passkey credentials. */
export class SupabaseConnectorStore implements StateStore {
  configured() {
    return !!config();
  }
  private async request(method: string, query: string, body?: unknown) {
    const c = config();
    if (!c) throw new ConnectorError("VAULT_NOT_CONFIGURED", 503);
    const response = await fetch(
      c.url + "/rest/v1/jarvis_connector_state" + query,
      {
        method,
        headers: {
          apikey: c.key,
          ...(c.key.startsWith("sb_secret_")
            ? {}
            : { Authorization: "Bearer " + c.key }),
          "Content-Type": "application/json",
          Prefer: "return=representation",
        },
        body: body === undefined ? undefined : JSON.stringify(body),
        cache: "no-store",
        redirect: "error",
        signal: AbortSignal.timeout(8000),
      },
    );
    if (response.status === 409) return null;
    if (!response.ok) throw new ConnectorError("VAULT_UNAVAILABLE", 503);
    return (await response.json()) as Array<{
      revision: number;
      ciphertext: string;
    }>;
  }
  private async version() {
    const c = config();
    if (!c) throw new ConnectorError("VAULT_NOT_CONFIGURED", 503);
    const rows = await this.request(
      "GET",
      "?id=eq." +
        encodeURIComponent(c.id) +
        "&select=revision,ciphertext&limit=1",
    );
    if (!rows?.length) return { revision: -1, state: emptyState() };
    const state = decrypt<VaultState>(rows[0].ciphertext, c.secret, c.id);
    if (
      state.version !== 1 ||
      !Array.isArray(state.plans) ||
      !Array.isArray(state.audit) ||
      !state.connections ||
      !state.oauth
    )
      throw new ConnectorError("VAULT_CORRUPT", 503);
    return { revision: rows[0].revision, state };
  }
  async read() {
    return (await this.version()).state;
  }
  async update<T>(fn: (s: VaultState) => T): Promise<T> {
    for (let attempt = 0; attempt < 4; attempt++) {
      const c = config();
      if (!c) throw new ConnectorError("VAULT_NOT_CONFIGURED", 503);
      const { revision, state } = await this.version(),
        result = fn(state);
      state.audit = state.audit.slice(-300);
      state.plans = state.plans
        .filter(
          (p) =>
            p.expiresAt > Date.now() - 86400000 ||
            ["running", "uncertain", "waiting"].includes(p.status),
        )
        .slice(-50);
      for (const [k, pending] of Object.entries(state.oauth))
        if (pending.expiresAt < Date.now()) delete state.oauth[k];
      const ciphertext = encrypt(state, c.secret, c.id);
      if (ciphertext.length > 1800000)
        throw new ConnectorError("VAULT_LIMIT", 413);
      const rows =
        revision < 0
          ? await this.request("POST", "", {
              id: c.id,
              revision: 0,
              ciphertext,
            })
          : await this.request(
              "PATCH",
              "?id=eq." + encodeURIComponent(c.id) + "&revision=eq." + revision,
              {
                revision: revision + 1,
                ciphertext,
                updated_at: new Date().toISOString(),
              },
            );
      if (rows?.length === 1) return structuredClone(result);
    }
    throw new ConnectorError("VAULT_CONFLICT", 409);
  }
}
