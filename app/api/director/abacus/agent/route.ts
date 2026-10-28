import { authorized } from "../../../../../lib/auth";
import { abacusAgentCapabilities } from "../../../../../lib/abacus/agent-capabilities";
import { probeAgentConversation } from "../../../../../lib/abacus/agent-read";
export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "private, no-store" };
export async function GET(request: Request) {
  if (!(await authorized()))
    return Response.json({ error: "Não autorizado" }, { status: 401, headers });
  const id = new URL(request.url).searchParams.get("conversationId");
  try {
    return Response.json(
      {
        capabilities: abacusAgentCapabilities(false),
        ...(id
          ? {
              probe: await probeAgentConversation(
                id,
                process.env.ABACUS_PLATFORM_API_KEY ||
                  process.env.ABACUS_API_KEY,
                request.signal,
              ),
            }
          : {}),
      },
      { headers },
    );
  } catch {
    return Response.json(
      { error: "Identificador inválido." },
      { status: 400, headers },
    );
  }
}
