/** Optional future capability; no agent, transport, installation or background microphone is enabled. */
export const WINDOWS_WAKE_CONTRACT = {
  version: 1,
  installed: false,
  enabled: false,
  requiresOwnerConsent: true,
  localWakeWord: "Jarvis",
  persistentMicrophoneAccess: false,
  requiresVisibleOffControl: true,
  rawAudioPersistence: false,
  remoteExecution: false,
  eventAuthenticationRequired: true,
  replayProtectionRequired: true,
  backgroundSupportImplemented: false,
} as const;
export type WindowsWakeEvent = {
  version: 1;
  type: "wake_detected" | "listening_stopped";
  eventId: string;
  at: string;
  deviceId: string;
  consentSessionId: string;
};
