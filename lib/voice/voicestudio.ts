/** Independent client of the documented VoiceStudio discovery API. No upstream
 * application code is embedded. Discovery never loads models or starts capture.
 */
type Environment = Record<string, string | undefined>;
export type StudioStatus = {
  state:
    | "not_configured"
    | "invalid_configuration"
    | "unavailable"
    | "authentication_failed"
    | "incompatible"
    | "read_verified";
  checkedAt: string;
  note: string;
  speechVerified: false;
  captureEnabled: false;
  savedProfiles?: number;
  advertisedTranscription?: boolean;
};
export function studioConfig(env: Environment) {
  if (!env.JARVIS_VOICESTUDIO_URL) return null;
  const url = new URL(env.JARVIS_VOICESTUDIO_URL);
  const loopback = ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
  if (
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    !["http:", "https:"].includes(url.protocol) ||
    (loopback &&
      (!!env.VERCEL ||
        ["preview", "production"].includes(env.VERCEL_ENV || ""))) ||
    (!loopback &&
      (url.protocol !== "https:" || !env.JARVIS_VOICESTUDIO_API_KEY?.trim()))
  )
    throw Error("INVALID_STUDIO_CONFIGURATION");
  return {
    base: url.href.replace(/\/+$/, ""),
    key: env.JARVIS_VOICESTUDIO_API_KEY?.trim(),
  };
}
async function jsonBounded(response: Response) {
  const reader = response.body?.getReader();
  if (!reader) throw Error("INVALID_RESPONSE");
  let bytes = 0,
    text = "";
  const decoder = new TextDecoder();
  try {
    for (;;) {
      const part = await reader.read();
      if (part.done) break;
      bytes += part.value.length;
      if (bytes > 65536) throw Error("RESPONSE_LIMIT");
      text += decoder.decode(part.value, { stream: true });
    }
    return JSON.parse(text + decoder.decode());
  } finally {
    await reader.cancel().catch(() => {});
    reader.releaseLock();
  }
}
export async function inspectVoiceStudio(
  env: Environment,
  signal?: AbortSignal,
  fetcher: typeof fetch = fetch,
): Promise<StudioStatus> {
  const base = {
    checkedAt: new Date().toISOString(),
    speechVerified: false as const,
    captureEnabled: false as const,
  };
  let config;
  try {
    config = studioConfig(env);
  } catch {
    return {
      ...base,
      state: "invalid_configuration",
      note: "Configuração inválida. Use loopback somente no JK local; em hospedagem, use um endpoint HTTPS privado autenticado. Não exponha a porta local à internet.",
    };
  }
  if (!config)
    return {
      ...base,
      state: "not_configured",
      note: "VoiceStudio ainda não está configurado neste ambiente do JK. Instalar a skill no Codex não instala o aplicativo nem conecta a voz ao Jarvis.",
    };
  const timeout = AbortSignal.timeout(6000);
  const abort = signal ? AbortSignal.any([signal, timeout]) : timeout;
  const get = (path: string) =>
    fetcher(config.base + path, {
      method: "GET",
      redirect: "error",
      cache: "no-store",
      signal: abort,
      headers: {
        Accept: "application/json",
        ...(config.key ? { Authorization: "Bearer " + config.key } : {}),
      },
    });
  try {
    const discovery = await get("/.well-known/voicestudio-speech");
    if ([401, 403].includes(discovery.status))
      return {
        ...base,
        state: "authentication_failed",
        note: "O serviço recusou o acesso. Nenhuma autenticação foi desativada.",
      };
    if (!discovery.ok) throw Error("UNAVAILABLE");
    const doc = await jsonBounded(discovery);
    if (
      doc?.schema !== "voicestudio.speech-capabilities" ||
      doc?.protocol !== "voicestudio.speech.v1" ||
      doc?.service !== "VoiceStudio"
    )
      return {
        ...base,
        state: "incompatible",
        note: "O endpoint não confirmou o contrato VoiceStudio esperado.",
      };
    // Never follow URLs supplied by discovery or expose profiles/reference audio.
    const response = await get("/v1/audio/voices");
    if ([401, 403].includes(response.status))
      return {
        ...base,
        state: "authentication_failed",
        note: "A descoberta respondeu, mas a leitura de vozes foi recusada.",
      };
    if (!response.ok) throw Error("UNAVAILABLE");
    const voices = await jsonBounded(response);
    if (!Array.isArray(voices?.voices)) throw Error("INVALID_RESPONSE");
    return {
      ...base,
      state: "read_verified",
      savedProfiles: voices.voices.filter(
        (v: { type?: unknown } | null) => v?.type === "profile",
      ).length,
      advertisedTranscription: doc.features?.batch_transcription === true,
      note: "Descoberta e leitura de perfis verificadas agora. Perfis e recursos anunciados não comprovam modelo instalado, português brasileiro, licença adequada ou geração de áudio. A voz atual do JK foi preservada.",
    };
  } catch {
    return {
      ...base,
      state: "unavailable",
      note: signal?.aborted
        ? "Consulta cancelada."
        : "Não foi possível verificar o serviço: indisponibilidade, tempo limite ou resposta inválida. Não foi feita geração de áudio.",
    };
  }
}
export function voiceStudioIntent(text: string) {
  return /\bvoice\s*studio\b/i.test(text);
}
