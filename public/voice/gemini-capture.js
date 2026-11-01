/* AudioContext runs at 16 kHz; the browser resamples the microphone before this worklet. */
class GeminiCapture extends AudioWorkletProcessor {
  constructor() { super(); this.pcm = new Int16Array(320); this.index = 0; }
  process(inputs) {
    const channel = inputs[0]?.[0];
    if (channel) for (const value of channel) {
      this.pcm[this.index++] = Math.round(Math.max(-1, Math.min(1, value)) * (value < 0 ? 32768 : 32767));
      if (this.index === 320) {
        this.port.postMessage(this.pcm.buffer, [this.pcm.buffer]);
        this.pcm = new Int16Array(320); this.index = 0;
      }
    }
    return true;
  }
}
registerProcessor("gemini-capture", GeminiCapture);
