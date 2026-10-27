export type SpeechProgress = {
  phase: "start" | "boundary" | "end" | "cancel" | "error";
  fraction: number;
  textLength: number;
  charIndex: number;
  at: number;
};
export const SPEECH_PROGRESS_EVENT = "jk-speech-progress";
export function emitSpeechProgress(p: Omit<SpeechProgress, "at">) {
  if (typeof window !== "undefined")
    window.dispatchEvent(
      new CustomEvent<SpeechProgress>(SPEECH_PROGRESS_EVENT, {
        detail: { ...p, at: Date.now() },
      }),
    );
}
