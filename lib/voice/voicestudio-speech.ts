import "server-only";
import { studioConfig } from "./voicestudio";

/** Experimental server adapter. Never connects a Vercel function to PC loopback. */
export const JARVIS_OFFICIAL_VOICE = "af5bbbba";
const MAX_TEXT = 350;
const MAX_AUDIO_BYTES = 3_000_000;

export async function synthesizeJarvisOfficial(
  text: string,
  env: Record<string, string | undefined> = process.env,
  signal?: AbortSignal,
): Promise<Uint8Array> {
  if (typeof text !== "string" || !text.trim() || text.length > MAX_TEXT)
    throw Error("VOICESTUDIO_INVALID_TEXT");
  const config = studioConfig(env);
  if (!config) throw Error("VOICESTUDIO_NOT_CONFIGURED");
  // HTTPS with a private service credential only; the local service is never
  // implicitly exposed, proxied, or called from an untrusted public origin.
  const endpoint = new URL(config.base);
  if (endpoint.protocol !== "https:" || !config.key)
    throw Error("VOICESTUDIO_PRIVATE_ENDPOINT_REQUIRED");
  // The measured OmniVoice CPU request took 333.7 seconds. Allow enough time
  // for a private long-running worker; a serverless deployment may impose
  // a shorter independent execution limit.
  const timeout = AbortSignal.timeout(600_000);
  const requestSignal = signal ? AbortSignal.any([signal, timeout]) : timeout;
  const response = await fetch(config.base + "/v1/audio/speech", {
    method: "POST",
    cache: "no-store",
    redirect: "error",
    headers: {
      Authorization: "Bearer " + config.key,
      "Content-Type": "application/json",
      Accept: "audio/wav",
    },
    body: JSON.stringify({
      model: "omnivoice",
      input: text.trim(),
      voice: JARVIS_OFFICIAL_VOICE,
      response_format: "wav",
      language: "pt",
      speed: 1,
    }),
    signal: requestSignal,
  });
  if (!response.ok) throw Error("VOICESTUDIO_SYNTHESIS_FAILED");
  const type = response.headers.get("content-type")?.toLowerCase() ?? "";
  if (!type.startsWith("audio/") && type !== "application/octet-stream")
    throw Error("VOICESTUDIO_UNEXPECTED_CONTENT_TYPE");
  const reader = response.body?.getReader();
  if (!reader) throw Error("VOICESTUDIO_EMPTY_AUDIO");
  const buffers: Uint8Array[] = [];
  let total = 0;
  try {
    for (;;) {
      const next = await reader.read();
      if (next.done) break;
      total += next.value.byteLength;
      if (total > MAX_AUDIO_BYTES) throw Error("VOICESTUDIO_AUDIO_TOO_LARGE");
      buffers.push(next.value);
    }
  } finally {
    await reader.cancel().catch(() => {});
    reader.releaseLock();
  }
  if (total < 44) throw Error("VOICESTUDIO_EMPTY_AUDIO");
  const wav = new Uint8Array(total);
  let offset = 0;
  for (const buffer of buffers) {
    wav.set(buffer, offset);
    offset += buffer.length;
  }
  if (
    String.fromCharCode(...wav.subarray(0, 4)) !== "RIFF" ||
    String.fromCharCode(...wav.subarray(8, 12)) !== "WAVE"
  ) throw Error("VOICESTUDIO_NOT_WAV");
  return wav;
}
