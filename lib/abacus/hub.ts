/** Abacus surfaces are distinct: product visibility never implies API entitlement. */
export const ABACUS_SURFACES = [
  {
    id: "conversation",
    name: "Conversa e programação",
    access: "api",
    implemented: true,
    href: "https://api.abacus.ai/help/route-llm/",
  },
  {
    id: "models",
    name: "Modelos e preços publicados",
    access: "api_read",
    implemented: true,
    href: "https://api.abacus.ai/help/route-llm/",
  },
  {
    id: "tools",
    name: "Ferramentas da organização",
    access: "api_read",
    implemented: true,
    href: "https://api.abacus.ai/help/route-llm/chat-completions/#discovering-available-tools",
  },
  {
    id: "image",
    name: "Criação de imagens",
    access: "api_metered",
    implemented: true,
    href: "https://api.abacus.ai/help/route-llm/chat-completions/image-analysis",
  },
  {
    id: "audio",
    name: "Criação de áudio",
    access: "api_metered",
    implemented: true,
    href: "https://api.abacus.ai/help/route-llm/chat-completions/audio",
  },
  {
    id: "vision",
    name: "Análise de imagem",
    access: "api_metered",
    implemented: true,
    href: "https://api.abacus.ai/help/route-llm/chat-completions/image-analysis",
  },
  {
    id: "web",
    name: "Pesquisa web",
    access: "api_metered",
    implemented: true,
    href: "https://api.abacus.ai/help/route-llm/responses",
  },
  {
    id: "studio",
    name: "Studio: imagens e vídeos",
    access: "product",
    implemented: false,
    href: "https://studio.abacus.ai/",
  },
  {
    id: "agents",
    name: "Agentes, Apps e automações",
    access: "product",
    implemented: false,
    href: "https://apps.abacus.ai/chatllm/",
  },
  {
    id: "connectors",
    name: "Conectores e servidores MCP",
    access: "product",
    implemented: false,
    href: "https://apps.abacus.ai/chatllm/admin/connectors-list/",
  },
  {
    id: "brain",
    name: "Brain e projetos da conta",
    access: "product",
    implemented: false,
    href: "https://apps.abacus.ai/chatllm/admin/brain/",
  },
] as const;
export type AccountObservation = {
  plan: "Basic" | "Pro" | "Max" | "unknown";
  remainingCredits: number | null;
  observedAt: string;
  connectedServices: string[];
  connectorCatalogCount: number | null;
  mcpCatalogCount: number | null;
  installedMcpCount: number | null;
  activeTasks: string[];
  personalAgents: string[];
  source: "owner_observation";
};
export function normalizeObservation(value: unknown): AccountObservation {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw Error("INVALID_OBSERVATION");
  const v = value as Record<string, unknown>;
  const count = (n: unknown) =>
    n === null
      ? null
      : typeof n === "number" &&
          Number.isSafeInteger(n) &&
          n >= 0 &&
          n <= 10000000
        ? n
        : (() => {
            throw Error("INVALID_OBSERVATION");
          })();
  if (
    !["Basic", "Pro", "Max", "unknown"].includes(String(v.plan)) ||
    typeof v.observedAt !== "string" ||
    !Number.isFinite(Date.parse(v.observedAt)) ||
    Date.parse(v.observedAt) > Date.now() + 60000 ||
    Date.parse(v.observedAt) < Date.now() - 30 * 86400000 ||
    !Array.isArray(v.connectedServices) ||
    v.connectedServices.length > 50 ||
    !v.connectedServices.every(
      (s) => typeof s === "string" && /^[\p{L}\p{N} ._/-]{1,60}$/u.test(s),
    )
  )
    throw Error("INVALID_OBSERVATION");
  const names = (x: unknown) =>
    x === undefined
      ? []
      : Array.isArray(x) &&
          x.length <= 30 &&
          x.every(
            (s) =>
              typeof s === "string" && /^[\p{L}\p{N} ._()/,-]{1,90}$/u.test(s),
          )
        ? (x as string[])
        : (() => {
            throw Error("INVALID_OBSERVATION");
          })();
  return {
    activeTasks: names(v.activeTasks),
    personalAgents: names(v.personalAgents),
    plan: v.plan as AccountObservation["plan"],
    remainingCredits: count(v.remainingCredits),
    observedAt: v.observedAt,
    connectedServices: v.connectedServices as string[],
    connectorCatalogCount: count(v.connectorCatalogCount),
    mcpCatalogCount: count(v.mcpCatalogCount),
    installedMcpCount: count(v.installedMcpCount),
    source: "owner_observation",
  };
}
export function hubQuestion(message: string) {
  const n = message
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
  return (
    /\b(abacus|routellm|chatllm)\b/.test(n) &&
    /\b(recursos|funcionalidades|ferramentas|modelos|plano|creditos|video|imagem|audio|agentes|estrutura|conectores|conta)\b/.test(
      n,
    ) &&
    !/^\s*(?:jarvis[, ]*)?(?:por favor[, ]*)?(?:(?:crie|gere|execute|envie|apague|publique|conecte|ative)|(?:quero|preciso|gostaria|pode|consegue|poderia).{0,35}(?:criar|gerar|crie|gere))\b/.test(
      n,
    )
  );
}
export type ModelEntry = {
  id: string;
  priceMetadata: Record<string, string | number>;
};
export type ToolEntry = {
  name: string;
  description: string;
  supported: boolean;
  requiresConnectors: string[];
  executionAuthorized: false;
};
const obj = (v: unknown): Record<string, unknown> =>
  v && typeof v === "object" && !Array.isArray(v)
    ? (v as Record<string, unknown>)
    : {};
const clean = (v: unknown, n = 180) =>
  typeof v === "string" ? v.replace(/[\x00-\x1f<>]/g, " ").slice(0, n) : "";
export function parseModels(data: unknown): ModelEntry[] {
  const raw = Array.isArray(data) ? data : obj(data).data;
  if (!Array.isArray(raw) || raw.length > 3000)
    throw Error("INVALID_MODEL_CATALOG");
  return raw.flatMap((v) => {
    const r = obj(v);
    if (typeof r.id !== "string" || !/^[-a-zA-Z0-9._/:]{1,120}$/.test(r.id))
      return [];
    const priceMetadata: Record<string, string | number> = {};
    for (const [k, x] of Object.entries(obj(r.pricing)))
      if (
        /^[a-z_]{1,50}$/.test(k) &&
        ((typeof x === "number" && Number.isFinite(x) && x >= 0) ||
          (typeof x === "string" && /^[0-9.eE+-]{1,30}$/.test(x)))
      )
        priceMetadata[k] = x;
    return [{ id: r.id, priceMetadata }];
  });
}
export function parseTools(data: unknown): ToolEntry[] {
  const d = obj(data),
    raw = Array.isArray(data) ? data : (d.tools ?? obj(d.result).tools);
  if (!Array.isArray(raw) || raw.length > 1000)
    throw Error("INVALID_TOOL_CATALOG");
  return raw.flatMap((v) => {
    const r = obj(v);
    if (typeof r.name !== "string" || !/^[-a-zA-Z0-9_.]{1,120}$/.test(r.name))
      return [];
    return [
      {
        name: r.name,
        description: clean(r.description, 260),
        supported: r.supported === true,
        requiresConnectors: Array.isArray(r.requires_connectors)
          ? r.requires_connectors
              .filter(
                (x): x is string =>
                  typeof x === "string" && /^[-a-zA-Z0-9_ .]{1,80}$/.test(x),
              )
              .slice(0, 20)
          : [],
        executionAuthorized: false as const,
      },
    ];
  });
}
export async function readJsonBounded(
  response: Response,
  limit = 1000000,
): Promise<unknown> {
  if (!response.ok) {
    await response.body?.cancel();
    throw Error(
      [401, 403].includes(response.status)
        ? "UPSTREAM_AUTH"
        : response.status === 429
          ? "UPSTREAM_RATE_LIMIT"
          : "UPSTREAM_UNAVAILABLE",
    );
  }
  const reader = response.body?.getReader();
  if (!reader) throw Error("INVALID_RESPONSE");
  let size = 0,
    raw = "";
  const decoder = new TextDecoder();
  try {
    for (;;) {
      const part = await reader.read();
      if (part.done) break;
      size += part.value.length;
      if (size > limit) throw Error("RESPONSE_LIMIT");
      raw += decoder.decode(part.value, { stream: true });
    }
    raw += decoder.decode();
    return JSON.parse(raw);
  } finally {
    await reader.cancel().catch(() => {});
    reader.releaseLock();
  }
}
export class AbacusDiscovery {
  private cache: {
    key: string;
    at: number;
    data: {
      models: ModelEntry[];
      tools: ToolEntry[];
      checkedAt: string;
      toolsState: string;
    };
  } | null = null;
  constructor(private fetcher: typeof fetch = fetch) {}
  async inspect(key: string, signal?: AbortSignal) {
    if (signal?.aborted) throw signal.reason;
    if (this.cache?.key === key && Date.now() - this.cache.at < 60000)
      return this.cache.data;
    const request = (url: string, header: string) =>
      this.fetcher(url, {
        method: "GET",
        headers: {
          [header]: header === "Authorization" ? "Bearer " + key : key,
        },
        redirect: "error",
        cache: "no-store",
        signal: signal
          ? AbortSignal.any([signal, AbortSignal.timeout(7000)])
          : AbortSignal.timeout(7000),
      }).then((r) => readJsonBounded(r));
    const results = await Promise.allSettled([
      request("https://routellm.abacus.ai/v1/models", "Authorization"),
      request("https://api.abacus.ai/api/v0/listRouteLLMTools", "apiKey"),
    ]);
    if (signal?.aborted) throw signal.reason;
    if (results[0].status === "rejected") throw Error("CATALOG_UNAVAILABLE");
    const models = parseModels(results[0].value);
    if (!models.length) throw Error("EMPTY_CATALOG");
    let tools: ToolEntry[] = [],
      toolsState = "unavailable";
    if (results[1].status === "fulfilled") {
      try {
        tools = parseTools(results[1].value);
        toolsState = "verified";
      } catch {}
    }
    const data = {
      models,
      tools,
      toolsState,
      checkedAt: new Date().toISOString(),
    };
    this.cache = { key, at: Date.now(), data };
    return data;
  }
}
