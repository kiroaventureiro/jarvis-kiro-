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
  // Reject oversized or malformed requests before any future provider integration.
  // The endpoint remains disabled regardless of whether the request is valid.
  const contentLength = Number(request.headers.get("content-length") ?? 0);
  if (contentLength > 8192) {
    return NextResponse.json({ error: "Pedido muito grande" }, { status: 413 });
  }
  if (!request.headers.get("content-type")?.toLowerCase().startsWith("application/json")) {
    return NextResponse.json({ error: "Formato inválido" }, { status: 415 });
  }
  let input: unknown;
  try {
    const raw = await request.text();
    if (raw.length > 8192) throw new Error("Too large");
    input = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }
  if (!input || typeof input !== "object" || Array.isArray(input) ||
      typeof (input as { text?: unknown }).text !== "string" ||
      !(input as { text: string }).text.trim() ||
      (input as { text: string }).text.length > 1500) {
    return NextResponse.json({ error: "Texto inválido" }, { status: 400 });
  }
  // Reject rather than charge unexpectedly, even when a client tries it.
  return NextResponse.json(
    { error: "Voz neural ainda não habilitada. A voz do navegador permanece disponível." },
    { status: 503, headers: { "Cache-Control": "no-store" } },
  );
}
