import { authorized } from "../../../../../lib/auth";
import { sameOrigin } from "../../../../../lib/abacus/http";
import { synthesizeJarvisOfficial } from "../../../../../lib/voice/voicestudio-speech";

export const dynamic = "force-dynamic";

const noStore = { "Cache-Control": "private, no-store" };
const failure = (message: string, status: number) =>
  Response.json({ error: message }, { status, headers: noStore });

/**
 * Opt-in integration gate. Off by default. Requires an authenticated,
 * privately reachable HTTPS VoiceStudio endpoint configured server-side.
 */
export async function POST(request: Request) {
  if (!(await authorized())) return failure("Não autorizado", 401);
  if (!sameOrigin(request)) return failure("Origem inválida", 403);
  if (process.env.JARVIS_VOICESTUDIO_SPEECH_ENABLED !== "true")
    return failure("Voz experimental não habilitada", 503);
  if (!request.headers.get("content-type")?.toLowerCase().startsWith("application/json"))
    return failure("Formato inválido", 415);
  if (Number(request.headers.get("content-length") || 0) > 2048)
    return failure("Texto muito grande", 413);
  let text: unknown;
  try {
    const raw = await request.text();
    if (raw.length > 2048) return failure("Texto muito grande", 413);
    const parsed: unknown = JSON.parse(raw);
    text = parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as { text?: unknown }).text
      : null;
  } catch {
    return failure("JSON inválido", 400);
  }
  if (typeof text !== "string" || !text.trim() || text.length > 350)
    return failure("Texto inválido", 400);
  try {
    const wav = await synthesizeJarvisOfficial(text, process.env, request.signal);
    return new Response(new Uint8Array(wav), {
      status: 200,
      headers: { ...noStore, "Content-Type": "audio/wav", "X-Content-Type-Options": "nosniff" },
    });
  } catch {
    // Never leak internal network details or tokens to clients.
    return failure("VoiceStudio não disponível; mantenha a voz padrão", 503);
  }
}
