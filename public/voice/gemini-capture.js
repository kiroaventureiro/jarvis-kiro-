import { PlaybackEchoGuard } from "./gemini-echo-guard.js";
class GeminiCapture extends AudioWorkletProcessor {
  constructor() {
    super(); this.pcm = new Int16Array(320); this.microphone = new Float32Array(320);
    this.reference = new Float32Array(320); this.index = 0; this.echo = new PlaybackEchoGuard();
  }
  process(inputs) {
    const channel = inputs[0]?.[0], reference = inputs[1]?.[0];
    if (channel) for (let i = 0; i < channel.length; i++) {
      this.microphone[this.index] = channel[i]; this.reference[this.index] = reference?.[i] || 0;
      if (++this.index === 320) {
        const suppressed = this.echo.process(this.microphone, this.reference);
        for (let j = 0; j < 320; j++) {
          const value = suppressed ? 0 : Math.max(-1, Math.min(1, this.microphone[j]));
          this.pcm[j] = Math.round(value * (value < 0 ? 32768 : 32767));
        }
        this.port.postMessage({ pcm: this.pcm.buffer, echoFrames: this.echo.frames }, [this.pcm.buffer]);
        this.pcm = new Int16Array(320); this.index = 0;
      }
    }
    return true;
  }
}
registerProcessor("gemini-capture", GeminiCapture);
