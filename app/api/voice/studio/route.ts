import { authorized } from "../../../../lib/auth";
import { sameOrigin } from "../../../../lib/abacus/http";
import { inspectVoiceStudio } from "../../../../lib/voice/voicestudio";
export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "private, no-store" };
export async function POST(request: Request) {
  if (!(await authorized()))
    return Response.json({ error: "Não autorizado" }, { status: 401, headers });
  if (!sameOrigin(request))
    return Response.json(
      { error: "Origem inválida" },
      { status: 403, headers },
    );
  return Response.json(await inspectVoiceStudio(process.env, request.signal), {
    headers,
  });
}
