import { abacusPlatformIntent } from "./platform-intent";
import "server-only";
import { readJsonBounded } from "./hub";
import type { HoloScene } from "../holo/types";
export type PlatformState =
  | "verified"
  | "partial"
  | "unauthorized"
  | "unavailable"
  | "invalid_response";
export type AbacusPlatformProbe = {
  method: "listProjects" | "listDeployments";
  state: PlatformState;
  checkedAt: string;
  count?: number;
};
type Row = Record<string, unknown>;
type ReadResult = { state: PlatformState; items: Row[]; more: boolean };
const idValid = (v: unknown): v is string =>
  typeof v === "string" && /^[a-zA-Z0-9_-]{1,128}$/.test(v);
const displayName = (r: Row, kind: "project" | "deployment") => {
  const value =
    kind === "project" ? r.projectName || r.name : r.deploymentName || r.name;
  return typeof value === "string"
    ? value
        .replace(/[\u0000-\u001f\u007f<>]/g, " ")
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, 120) ||
        (kind === "project" ? "Projeto sem nome" : "Deployment sem nome")
    : kind === "project"
      ? "Projeto sem nome informado"
      : "Deployment sem nome informado";
};
async function read(
  apiKey: string,
  method: "listProjects" | "listDeployments",
  projectId: string | undefined,
  signal: AbortSignal | undefined,
  fetcher: typeof fetch,
): Promise<ReadResult> {
  try {
    const url = new URL("https://api.abacus.ai/api/v0/" + method);
    if (projectId) url.searchParams.set("projectId", projectId);
    if (method === "listProjects") url.searchParams.set("limit", "21");
    const response = await fetcher(url, {
      method: "GET",
      headers: { apiKey },
      cache: "no-store",
      redirect: "error",
      signal: signal
        ? AbortSignal.any([signal, AbortSignal.timeout(8000)])
        : AbortSignal.timeout(8000),
    });
    if (response.status === 401 || response.status === 403)
      return { state: "unauthorized", items: [], more: false };
    if (!response.ok) return { state: "unavailable", items: [], more: false };
    const body = (await readJsonBounded(response, 150000)) as Row;
    if (
      !body ||
      typeof body !== "object" ||
      Array.isArray(body) ||
      body.success !== true ||
      !Array.isArray(body.result) ||
      !body.result.every((r) => r && typeof r === "object" && !Array.isArray(r))
    )
      return { state: "invalid_response", items: [], more: false };
    const more = !!(
      body.nextPageToken ||
      body.nextToken ||
      body.nextCursor ||
      body.hasMore
    );
    return {
      state: more ? "partial" : "verified",
      items: body.result as Row[],
      more,
    };
  } catch {
    return {
      state: signal?.aborted ? "unavailable" : "invalid_response",
      items: [],
      more: false,
    };
  }
}
/** GET-only allowlisted methods; identifiers stay internal to the requests. */
export async function listAbacusResourceNames(
  apiKey: string | undefined,
  signal?: AbortSignal,
  fetcher: typeof fetch = fetch,
) {
  const checkedAt = new Date().toISOString();
  if (!apiKey)
    return {
      state: "unauthorized" as PlatformState,
      projects: [] as string[],
      deployments: [] as string[],
      checkedAt,
      complete: false,
      warnings: ["Credencial de plataforma ausente."],
      chatCandidates: 0,
      projectsVerified: false,
    };
  const deadline = signal
    ? AbortSignal.any([signal, AbortSignal.timeout(18000)])
    : AbortSignal.timeout(18000);
  const p = await read(apiKey, "listProjects", undefined, deadline, fetcher);
  if (!["verified", "partial"].includes(p.state))
    return {
      state: p.state,
      projects: [],
      deployments: [],
      checkedAt,
      complete: false,
      warnings: ["A consulta de projetos não foi confirmada."],
      chatCandidates: 0,
      projectsVerified: false,
    };
  const warnings: string[] = [],
    projects: string[] = [],
    deployments: string[] = [];
  let chatCandidates = 0;
  if (p.more)
    warnings.push("A API indicou outra página; a listagem está incompleta.");
  if (p.items.length > 20)
    warnings.push("Leitura limitada aos primeiros 20 projetos.");
  for (const project of p.items.slice(0, 20)) {
    if (deployments.length >= 60) {
      warnings.push("Listagem limitada a 60 deployments; resultado parcial.");
      break;
    }
    projects.push(displayName(project, "project"));
    if (!idValid(project.projectId)) {
      warnings.push(
        "Projeto sem identificador válido; deployments não consultados.",
      );
      continue;
    }
    const d = await read(
      apiKey,
      "listDeployments",
      project.projectId,
      deadline,
      fetcher,
    );
    if (!["verified", "partial"].includes(d.state)) {
      warnings.push(
        "Não foi possível consultar todos os deployments: " + d.state + ".",
      );
      continue;
    }
    if (d.more || d.items.length > 30)
      warnings.push(
        "Lista de deployments parcial ou limitada a 30 por projeto.",
      );
    for (const deployment of d.items.slice(0, 30)) {
      deployments.push(displayName(deployment, "deployment"));
      if (project.useCase === "CHAT_LLM") chatCandidates++;
    }
  }
  return {
    state: (warnings.length ? "partial" : "verified") as PlatformState,
    projects,
    deployments,
    checkedAt,
    complete: !warnings.length,
    warnings,
    chatCandidates,
    projectsVerified: p.state === "verified" && p.items.length <= 20,
  };
}
export async function probeAbacusPlatform(
  apiKey: string | undefined,
  signal?: AbortSignal,
): Promise<AbacusPlatformProbe[]> {
  const r = await listAbacusResourceNames(apiKey, signal);
  return [
    {
      method: "listProjects",
      state: r.projectsVerified ? "verified" : r.state,
      checkedAt: r.checkedAt,
      ...(r.projectsVerified ? { count: r.projects.length } : {}),
    },
    {
      method: "listDeployments",
      state:
        r.state === "verified" && !r.projects.length ? "unavailable" : r.state,
      checkedAt: r.checkedAt,
      ...(r.complete && r.projects.length
        ? { count: r.deployments.length }
        : {}),
    },
  ];
}

export async function answerAbacusPlatformQuestion(
  message: string,
  signal?: AbortSignal,
) {
  if (!abacusPlatformIntent(message)) return null;
  const r = await listAbacusResourceNames(
    process.env.ABACUS_PLATFORM_API_KEY || process.env.ABACUS_API_KEY,
    signal,
  );
  const successful = r.state === "verified" || r.state === "partial";
  const text = successful
    ? "Consultei a API Developer Platform da Abacus. " +
      (r.complete ? "" : "O resultado é parcial. ") +
      "Projetos: " +
      (r.projects.join("; ") || "nenhum retornado nesta consulta") +
      ". Deployments: " +
      (r.deployments.join("; ") ||
        (r.complete
          ? "nenhum retornado nesta consulta"
          : "não confirmados integralmente")) +
      ". " +
      r.warnings.join(" ") +
      " Esta leitura não inclui conversas privadas do AI Agent ChatLLM."
    : r.state === "unauthorized"
      ? "A ferramenta de leitura da Developer Platform existe, mas esta consulta recebeu acesso negado ou está sem credencial no servidor. Não posso listar os projetos agora."
      : "A ferramenta de leitura da Developer Platform está implementada, mas a consulta falhou: " +
        r.state +
        ". Não concluo que sua conta esteja desconectada.";
  return {
    text,
    model: "jk-abacus-platform",
    provider: "local_operational" as const,
    usage: null,
    platform: {
      state: r.state,
      complete: r.complete,
      checkedAt: r.checkedAt,
      projects: r.projects,
      deployments: r.deployments,
      warnings: r.warnings,
      chatCandidates: r.chatCandidates,
    },
    visual: {
      version: 1,
      id: "abacus-platform-" + crypto.randomUUID(),
      title: "Recursos Abacus",
      mode: "technical",
      createdAt: r.checkedAt,
      source: {
        kind: "connector",
        label: "Developer Platform · leitura autenticada",
        checkedAt: r.checkedAt,
      },
      modules: [
        {
          id: "resources",
          kind: "report",
          title: "Projetos e deployments",
          summary: r.state === "partial" ? "Consulta parcial" : "",
          items: [
            { label: "Projetos", detail: String(r.projects.length) },
            {
              label: "Deployments retornados",
              detail: String(r.deployments.length),
            },
            ...r.warnings.map((w) => ({ label: "Limitação", detail: w })),
          ],
        },
      ],
    } as HoloScene,
  };
}
