import type { VoicePreferences, VoiceDescriptor } from "./voice-types";
export const VOICE_PREF_KEY = "jarvis.voice.preferences.v1";
export const VOICE_PREF_EVENT = "jarvis:voice-preferences";
export const DEFAULT_VOICE_PREFERENCES: VoicePreferences = {
  version: 1,
  voiceURI: "",
  maleConfirmedURI: "",
  rate: 0.95,
  pitch: 1,
  volume: 1,
  continuous: true,
};
export function sanitizeVoicePreferences(value: unknown): VoicePreferences {
  const raw =
    value && typeof value === "object"
      ? (value as Record<string, unknown>)
      : {};
  const clamp = (key: string, min: number, max: number, fallback: number) =>
    typeof raw[key] === "number" && Number.isFinite(raw[key])
      ? Math.max(min, Math.min(max, raw[key] as number))
      : fallback;
  return {
    version: 1,
    voiceURI:
      typeof raw.voiceURI === "string" ? raw.voiceURI.slice(0, 300) : "",
    maleConfirmedURI:
      typeof raw.maleConfirmedURI === "string"
        ? raw.maleConfirmedURI.slice(0, 300)
        : "",
    rate: clamp("rate", 0.7, 1.3, 0.95),
    pitch: clamp("pitch", 0.6, 1.2, 1),
    volume: clamp("volume", 0, 1, 1),
    continuous: typeof raw.continuous === "boolean" ? raw.continuous : true,
  };
}
let sessionPreferences: VoicePreferences | null = null;
export function readVoicePreferences(): VoicePreferences {
  if (sessionPreferences) return sessionPreferences;
  try {
    return sanitizeVoicePreferences(
      JSON.parse(localStorage.getItem(VOICE_PREF_KEY) || "{}"),
    );
  } catch {
    return { ...DEFAULT_VOICE_PREFERENCES };
  }
}
export function saveVoicePreferences(value: VoicePreferences) {
  const clean = sanitizeVoicePreferences(value);
  sessionPreferences = clean;
  let persisted = true;
  try {
    localStorage.setItem(VOICE_PREF_KEY, JSON.stringify(clean));
  } catch {
    persisted = false;
  }
  window.dispatchEvent(new CustomEvent(VOICE_PREF_EVENT, { detail: clean }));
  return persisted;
}
export function brazilianVoices<T extends VoiceDescriptor>(voices: T[]): T[] {
  return voices.filter(
    (v) => v.lang.toLowerCase().replace("_", "-") === "pt-br",
  );
}
export function selectVoice<T extends VoiceDescriptor>(
  voices: T[],
  prefs: VoicePreferences,
): T | null {
  const available = brazilianVoices(voices);
  return (
    available.find((v) => v.voiceURI === prefs.voiceURI) ||
    available.find((v) => v.voiceURI === prefs.maleConfirmedURI) ||
    available.find((v) => v.localService && v.default) ||
    available.find((v) => v.localService) ||
    available.find((v) => v.default) ||
    available[0] ||
    null
  );
}
