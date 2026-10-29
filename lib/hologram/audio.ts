import type { AudioVisualMode } from "./policy";
export type AudioEnvelope = {
  mode: AudioVisualMode;
  read: () => number | null;
  dispose: () => void;
};
const silent = (): AudioEnvelope => ({
  mode: "representative",
  read: () => null,
  dispose() {},
});
/** Observes an already authorized stream. Never opens a microphone or records audio. */
export function observeAudio(
  stream: MediaStream | null,
  mode: Exclude<AudioVisualMode, "representative">,
): AudioEnvelope {
  if (
    !stream ||
    !stream.getAudioTracks?.().some((t) => t.readyState === "live" && t.enabled)
  )
    return silent();
  const Context = globalThis.AudioContext;
  if (!Context) return silent();
  let context: AudioContext | undefined,
    source: MediaStreamAudioSourceNode | undefined,
    analyser: AnalyserNode | undefined;
  try {
    context = new Context();
    source = context.createMediaStreamSource(stream);
    analyser = context.createAnalyser();
    analyser.fftSize = 256;
    analyser.smoothingTimeConstant = 0.75;
    source.connect(analyser); // Deliberately not connected to destination: no echo or extra playback.
    const bytes = new Uint8Array(analyser.fftSize);
    let disposed = false,
      smooth = 0;
    void context.resume().catch(() => {});
    return {
      get mode() {
        return !disposed &&
          context?.state === "running" &&
          stream
            .getAudioTracks()
            .some((t) => t.readyState === "live" && t.enabled)
          ? mode
          : "representative";
      },
      read() {
        if (
          disposed ||
          context?.state !== "running" ||
          !analyser ||
          !stream
            .getAudioTracks()
            .some((t) => t.readyState === "live" && t.enabled)
        )
          return null;
        analyser.getByteTimeDomainData(bytes);
        let sum = 0;
        for (const value of bytes) sum += ((value - 128) / 128) ** 2;
        smooth +=
          (Math.min(1, Math.sqrt(sum / bytes.length) * 4) - smooth) * 0.3;
        return smooth;
      },
      dispose() {
        if (disposed) return;
        disposed = true;
        source?.disconnect();
        analyser?.disconnect();
        void context?.close().catch(() => {});
      },
    };
  } catch {
    source?.disconnect();
    analyser?.disconnect();
    if (context) void context.close().catch(() => {});
    return silent();
  }
}
