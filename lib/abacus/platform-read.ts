import "server-only";

/** Read-only Abacus developer-platform probe. RouteLLM access does not imply platform access. */
export type AbacusPlatformProbe = {
  method: "listProjects" | "listDeployments";
  state: "verified" | "unauthorized" | "unavailable" | "invalid_response";
  checkedAt: string;
  count?: number;
};
const METHODS = ["listProjects", "listDeployments"] as const;
export async function probeAbacusPlatform(
  apiKey: string | undefined,
  signal?: AbortSignal,
): Promise<AbacusPlatformProbe[]> {
  if (!apiKey) return METHODS.map(method => ({method,state:"unauthorized",checkedAt:new Date().toISOString()}));
  const checkedAt = () => new Date().toISOString();
  const get = async (method: typeof METHODS[number], projectId?: string): Promise<{state: AbacusPlatformProbe["state"]; items?: unknown[]}> => {
    try {
      const url = new URL("https://api.abacus.ai/api/v0/" + method);
      if (projectId) url.searchParams.set("projectId", projectId);
      const response = await fetch(url, {
        method: "GET", headers: {apiKey}, cache: "no-store", redirect: "error",
        signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(7000)]) : AbortSignal.timeout(7000),
      });
      if (response.status === 401 || response.status === 403) return {state:"unauthorized"};
      if (!response.ok) return {state:"unavailable"};
      const raw = await response.text();
      if (raw.length > 150000) return {state:"invalid_response"};
      const json: unknown = JSON.parse(raw);
      if (!json || typeof json !== "object" || Array.isArray(json)) return {state:"invalid_response"};
      const body = json as Record<string,unknown>;
      if (body.success !== true || !Array.isArray(body.result)) return {state:"invalid_response"};
      return {state:"verified",items:body.result};
    } catch {
      return {state:"unavailable"};
    }
  };
  const projects = await get("listProjects");
  const projectSummary: AbacusPlatformProbe = {
    method:"listProjects", state:projects.state, checkedAt:checkedAt(),
    ...(projects.items ? {count:projects.items.length} : {}),
  };
  if (projects.state !== "verified" || !projects.items) return [
    projectSummary, {method:"listDeployments",state:"unavailable",checkedAt:checkedAt()},
  ];
  if (!projects.items.length) return [
    projectSummary, {method:"listDeployments",state:"verified",checkedAt:checkedAt(),count:0},
  ];
  // listDeployments requires a projectId. Do not expose identifiers in status responses.
  const ids = projects.items.map(item =>
    item && typeof item === "object" && !Array.isArray(item)
      ? (item as Record<string,unknown>).projectId : undefined);
  if (!ids.every(id => typeof id === "string" && /^[a-zA-Z0-9_-]{1,128}$/.test(id)))
    return [projectSummary,{method:"listDeployments",state:"invalid_response",checkedAt:checkedAt()}];
  const results = await Promise.all((ids as string[]).slice(0,20).map(id => get("listDeployments",id)));
  const failed = results.find(x => x.state !== "verified");
  return [
    projectSummary,
    { method:"listDeployments",
      state:failed?.state || (ids.length>20 ? "unavailable" : "verified"),
      checkedAt:checkedAt(),
      ...(!failed && ids.length<=20 ? {count:results.reduce((n,x)=>n+(x.items?.length||0),0)} : {}),
    },
  ];

}

/** Never confuse developer-platform access with ChatLLM sessions. */
export async function answerAbacusPlatformQuestion(message: string, signal?: AbortSignal) {
  const n = message.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  if (!/\b(abacus|abaqus)\b/.test(n) ||
      !/\b(projetos|deployments|implantacoes|acesso|conexao|permissao)\b/.test(n) ||
      !/\b(verifique|verificar|consulte|consultar|liste|listar|quais|status|tenho|conectad[oa])\b/.test(n))
    return null;
  const checks = await probeAbacusPlatform(process.env.ABACUS_PLATFORM_API_KEY || process.env.ABACUS_API_KEY, signal);
  const project = checks.find(c=>c.method==="listProjects")!;
  const deployment = checks.find(c=>c.method==="listDeployments")!;
  const describe = (label: string, c: AbacusPlatformProbe) =>
    label + ": " + (c.state==="verified" ? "consulta autenticada confirmada, "+c.count+" registros na resposta" :
      c.state==="unauthorized" ? "acesso negado ou credencial ausente" :
      c.state==="invalid_response" ? "resposta não reconhecida; não posso confirmar acesso" :
      "consulta não confirmada") + ".";
  return {
    text:"Verifiquei a API principal da Abacus, separada da RouteLLM. "+
      describe("Projetos",project)+" "+describe("Deployments",deployment)+
      " Isso não autoriza acesso às conversas ou aos agentes da interface ChatLLM. Nenhuma operação paga ou alteração foi realizada.",
    model:"jk-abacus-platform",provider:"local_operational" as const,usage:null,
  };
}
