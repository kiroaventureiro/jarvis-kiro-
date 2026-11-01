/** One local audio owner; microphone capture can pause without destroying playback/session audio. */
export class GeminiAudio {
  private context: AudioContext | null = null;
  private stream: MediaStream | null = null;
  private capture: AudioWorkletNode | null = null;
  private gain: GainNode | null = null;
  private sources = new Set<AudioBufferSourceNode>();
  private next = 0;
  private epoch = 0;
  onDrained = () => {};
  onEchoEvidence = (_frames: number, _aec: boolean) => {};
  onMicrophoneEnded = () => {};
  async start(onPCM: (data: string) => void) {
    const epoch = ++this.epoch;
    let context = this.context;
    if (!context || context.state === "closed") {
      context = new AudioContext({ sampleRate: 16000 });
      this.context = context;
      this.gain = context.createGain();
      this.gain.connect(context.destination);
    }
    await context.resume();
    const stream = await navigator.mediaDevices.getUserMedia({ audio: {
      channelCount: 1, echoCancellation: true, noiseSuppression: true, autoGainControl: true,
    } });
    if (epoch !== this.epoch) { stream.getTracks().forEach(t => t.stop()); return; }
    this.stream = stream;
    await context.audioWorklet.addModule("/voice/gemini-capture.js");
    if (epoch !== this.epoch) { stream.getTracks().forEach(t => t.stop()); return; }
    const capture = new AudioWorkletNode(context, "gemini-capture", { numberOfInputs: 2, numberOfOutputs: 1 });
    this.capture = capture;
    const aec = stream.getAudioTracks()[0].getSettings?.().echoCancellation === true;
    let lastEchoFrames = 0;
    this.onEchoEvidence(0, aec);
    capture.port.onmessage = (event: MessageEvent<{ pcm: ArrayBuffer; echoFrames: number }>) => {
      if (epoch !== this.epoch) return;
      const { pcm, echoFrames } = event.data;
      if (echoFrames > lastEchoFrames) { lastEchoFrames = echoFrames; this.onEchoEvidence(echoFrames, aec); }
      const view = new DataView(pcm), bytes = new Uint8Array(pcm);
      const samples = new Int16Array(pcm);
      for (let i = 0; i < samples.length; i++) view.setInt16(i * 2, samples[i], true);
      onPCM(btoa(String.fromCharCode(...bytes)));
    };
    context.createMediaStreamSource(stream).connect(capture);
    const silence = context.createGain(); silence.gain.value = 0;
    capture.connect(silence).connect(context.destination);
    // Playback remains connected while capture is paused.
    if (this.gain) this.gain.connect(capture, 0, 1);
    stream.getAudioTracks()[0].onended = () => {
      if (epoch !== this.epoch) return;
      this.pauseCapture();
      this.onMicrophoneEnded();
    };
  }
  /** Stop only microphone capture; keep AudioContext and output playback alive. */
  pauseCapture() {
    this.epoch++;
    this.capture?.port && (this.capture.port.onmessage = null);
    this.capture?.disconnect(); this.capture = null;
    this.stream?.getTracks().forEach(t => { t.onended = null; t.stop(); });
    this.stream = null;
  }
  volume(value: number) { if (this.gain) this.gain.gain.value = Math.max(0, Math.min(1, value)); }
  play(data: string) {
    const context = this.context;
    if (!context || !this.gain || context.state === "closed") return;
    if (this.next - context.currentTime > 15) throw new Error("A reprodução atrasou. Reinicie a sessão.");
    const bytes = Uint8Array.from(atob(data), c => c.charCodeAt(0));
    const view = new DataView(bytes.buffer);
    const buffer = context.createBuffer(1, Math.floor(bytes.length / 2), 24000);
    const floats = buffer.getChannelData(0);
    for (let i = 0; i < floats.length; i++) floats[i] = view.getInt16(i * 2, true) / 32768;
    const source = context.createBufferSource(); source.buffer = buffer; source.connect(this.gain);
    this.sources.add(source);
    source.onended = () => { this.sources.delete(source); if (!this.sources.size) this.onDrained(); };
    this.next = Math.max(context.currentTime + 0.02, this.next);
    source.start(this.next); this.next += buffer.duration;
  }
  interrupt() {
    for (const source of this.sources) { source.onended = null; source.stop(); source.disconnect(); }
    this.sources.clear(); this.next = 0;
  }
  close() {
    this.pauseCapture(); this.interrupt();
    void this.context?.close().catch(() => {}); this.context = null; this.gain = null;
  }
}
