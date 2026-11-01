/** Secondary echo-only guard AFTER browser AEC. Never a speaker identity detector.
 * Compare microphone with actual post-volume playback over acoustic delays.
 * Mixed/uncorrelated near-end speech passes to native Live VAD (full duplex).
 */
export class PlaybackEchoGuard {
  constructor() {
    this.reference = new Float32Array(8192);
    this.cursor = 0;
    this.frames = 0;
  }
  process(microphone, reference) {
    const size = microphone.length;
    for (let i = 0; i < size; i++) this.reference[(this.cursor + i) & 8191] = reference[i] || 0;
    this.cursor = (this.cursor + size) & 8191;
    let micEnergy = 0;
    for (const value of microphone) micEnergy += value * value;
    if (micEnergy < 1e-8) return false;
    let best = 0;
    // 0–300ms at 16kHz. Only highly correlated, echo-only frames are suppressed.
    for (let delay = 0; delay <= 4800; delay += 16) {
      let dot = 0, energy = 0;
      for (let i = 0; i < size; i++) {
        const value = this.reference[(this.cursor - size - delay + i) & 8191];
        energy += value * value; dot += microphone[i] * value;
      }
      if (energy > 1e-6) best = Math.max(best, dot * dot / (energy * micEnergy));
    }
    const echoOnly = best > 0.9;
    if (echoOnly) this.frames++;
    return echoOnly;
  }
}
