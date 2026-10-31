import { NextResponse } from "next/server";
import { authorized } from "../../../../lib/auth";

/**
 * Neural TTS integration gate. Intentionally inactive until a provider,
 * consent, fixed budget and a licensed voice are configured and tested.
 * Do not put provider API keys or audio generation calls here before approval.
 */
export async function POST(request: Request) {
  if (!(await authorized())) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }
  // Reject rather than charge unexpectedly, even when a client tries it.
  return NextResponse.json(
    { error: "Voz neural ainda não habilitada. A voz do navegador permanece disponível." },
    { status: 503, headers: { "Cache-Control": "no-store" } },
  );
}
