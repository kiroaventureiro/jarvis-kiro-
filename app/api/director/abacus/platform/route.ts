import {abacusAgentCapabilities} from "../../../../../lib/abacus/agent-capabilities";
import { authorized } from "../../../../../lib/auth";
import { probeAbacusPlatform } from "../../../../../lib/abacus/platform-read";
export const dynamic = "force-dynamic";
const headers = {"Cache-Control":"private, no-store"};
export async function GET(request: Request) {
  if (!(await authorized())) return Response.json({error:"Não autorizado"},{status:401,headers});
  const checks = await probeAbacusPlatform(process.env.ABACUS_PLATFORM_API_KEY || process.env.ABACUS_API_KEY, request.signal);
  return Response.json({
    checks,
    capabilities:abacusAgentCapabilities(checks.every(c=>c.state==="verified")),
    note:"Leitura limitada à API Developer Platform. RouteLLM autenticada não garante acesso a projetos, agentes ou sessões ChatLLM. Nenhuma criação, geração ou tarefa foi executada.",
  },{headers});
}
