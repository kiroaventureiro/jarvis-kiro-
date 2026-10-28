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
  const probe = async (method: typeof METHODS[number]): Promise<AbacusPlatformProbe> => {
    const checkedAt = new Date().toISOString();
    try {
      const response = await fetch("https://api.abacus.ai/api/v0/" + method, {
        method: "GET", headers: {apiKey}, cache: "no-store", redirect: "error",
        signal: signal ? AbortSignal.any([signal,AbortSignal.timeout(7000)]) : AbortSignal.timeout(7000),
      });
      if (response.status === 401 || response.status === 403) return {method,state:"unauthorized",checkedAt};
      if (!response.ok) return {method,state:"unavailable",checkedAt};
      const raw = await response.text();
      if (raw.length > 150000) return {method,state:"invalid_response",checkedAt};
      const json: unknown = JSON.parse(raw);
      if (!json || typeof json !== "object" || Array.isArray(json)) return {method,state:"invalid_response",checkedAt};
      const body = json as Record<string,unknown>;
      if (body.success === false || body.error) return {method,state:"unavailable",checkedAt};
      const data = body.result && typeof body.result==="object" ? body.result as Record<string,unknown> : body;
      const names = method==="listProjects" ? ["projects","items","data"] : ["deployments","items","data"];
      const values = names.map(k=>data[k]).find(Array.isArray);
      if (!Array.isArray(values)) return {method,state:"invalid_response",checkedAt};
      return {method,state:"verified",checkedAt,count:values.length};
    } catch {
      return {method,state:"unavailable",checkedAt};
    }
  };
  return Promise.all(METHODS.map(probe));
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
