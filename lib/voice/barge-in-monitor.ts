/**
 * Lightweight near-end speech detector. It monitors microphone energy only
 * while Jarvis is speaking; no samples are stored or transmitted.
 * Browser echoCancellation is requested but cannot guarantee echo rejection.
 */
export function createBargeInMonitor(onSpeech: () => void) {
  let stream: MediaStream | null = null;
  let context: AudioContext | null = null;
  let source: MediaStreamAudioSourceNode | null = null;
  let analyser: AnalyserNode | null = null;
  let highPass: BiquadFilterNode | null = null;
  let lowPass: BiquadFilterNode | null = null;
  let timer: ReturnType<typeof setInterval> | null = null;
  let active = false;
  let speechFrames = 0;
  let baseline = 0.006;
  let fired = false;
  let session = 0;
  let recentHits = 0;

  async function start() {
    if (active) return;
    active = true;
    const currentSession = ++session;
    fired = false;
    speechFrames = 0;
    recentHits = 0;
    baseline = 0.006;
    try {
      const mic = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      });
      if (!active || currentSession !== session) {
        mic.getTracks().forEach(t => t.stop());
        return;
      }
      stream = mic;
      for (const track of mic.getAudioTracks()) {
        track.addEventListener("ended", () => {
          if (active && currentSession === session) stop();
        }, { once: true });
      }
      context = new AudioContext();
      if (context.state === "suspended") await context.resume();
      if (!active || currentSession !== session) return;
      source = context.createMediaStreamSource(mic);
      analyser = context.createAnalyser();
      analyser.fftSize = 1024;
      // Remove low-frequency hum and high-frequency hiss before detection.
      // Frequency filtering is not speaker identification or full echo cancellation.
      highPass = context.createBiquadFilter();
      highPass.type = "highpass";
      highPass.frequency.value = 120;
      lowPass = context.createBiquadFilter();
      lowPass.type = "lowpass";
      lowPass.frequency.value = 3400;
      source.connect(highPass);
      highPass.connect(lowPass);
      lowPass.connect(analyser);
      const values = new Float32Array(analyser.fftSize);
      timer = setInterval(() => {
        if (!active || currentSession !== session || !analyser || fired) return;
        analyser.getFloatTimeDomainData(values);
        let square = 0;
        for (const v of values) square += v * v;
        const rms = Math.sqrt(square / values.length);
        // Conservative relative threshold: transient noises are not sufficient.
        const threshold = Math.max(0.035, baseline * 3.5);
        if (rms > threshold) {
          speechFrames++;
          recentHits = Math.min(8, recentHits + 2);
        } else {
          speechFrames = 0;
          recentHits = Math.max(0, recentHits - 2);
          baseline = baseline * 0.98 + Math.min(rms, 0.03) * 0.02;
        }
        // Require sustained energy; still not a true voice activity detector.
        if (speechFrames >= 5 && recentHits >= 8) {
          fired = true;
          onSpeech();
        }
      }, 25);
    } catch {
      if (currentSession !== session) return;
      stop();
      // The original recognition flow remains available if access is denied.
    }
  }

  function stop() {
    session++;
    active = false;
    if (timer) clearInterval(timer);
    timer = null;
    source?.disconnect();
    source = null;
    highPass?.disconnect();
    highPass = null;
    lowPass?.disconnect();
    lowPass = null;
    analyser?.disconnect();
    analyser = null;
    stream?.getTracks().forEach(t => t.stop());
    stream = null;
    if (context) void context.close().catch(() => {});
    context = null;
  }
  return { start, stop };
}
