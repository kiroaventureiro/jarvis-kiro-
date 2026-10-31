/**
 * Jarvis Kiro voice identity and provider contract.
 * No celebrity/dubber voice imitation or unconsented voice cloning.
 *
 * Intentional non-runtime module: candidate voices must be auditioned and
 * explicitly selected before any paid provider becomes active.
 */
export const JARVIS_VOICE_PROFILE = {
  name: "Jarvis Kiro — voz brasileira cinematográfica",
  locale: "pt-BR",
  presentation: "male",
  timbre: "medium-low",
  pace: "measured-natural",
  delivery: "clear, confident, calm, discreetly witty",
  voiceDirection: [
    "Fale em português brasileiro natural, sem sotaque britânico artificial.",
    "Use voz masculina médio-grave, com dicção precisa e calor humano.",
    "Mantenha pausas curtas e entonação conversacional, nunca monotonia de locutor.",
    "Seja levemente sofisticado e bem-humorado, sem imitar atores ou personagens.",
    "Responda com frases ágeis e permita que o usuário interrompa a qualquer instante.",
  ],
} as const;

export type VoiceBackend = "browser" | "elevenlabs" | "openai-realtime";

export type VoiceProviderCandidate = {
  id: VoiceBackend;
  requiresServerKey: boolean;
  supportsInterruptiblePlayback: boolean;
  isDefault: boolean;
  notes: string;
};

export const JARVIS_VOICE_CANDIDATES: readonly VoiceProviderCandidate[] = [
  {
    id: "browser",
    requiresServerKey: false,
    supportsInterruptiblePlayback: true,
    isDefault: true,
    notes: "Current speechSynthesis fallback. Keep enabled during evaluation.",
  },
  {
    id: "elevenlabs",
    requiresServerKey: true,
    supportsInterruptiblePlayback: true,
    isDefault: false,
    notes: "Evaluate licensed native pt-BR voices with streaming; requires an audio player that supports abort.",
  },
  {
    id: "openai-realtime",
    requiresServerKey: true,
    supportsInterruptiblePlayback: true,
    isDefault: false,
    notes: "Realtime voice conversation; do not use deprecated speech models for new integrations.",
  },
] as const;
