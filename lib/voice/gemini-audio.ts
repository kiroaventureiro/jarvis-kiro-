/** One local audio owner; microphone capture can pause without destroying playback/session audio. */
export class GeminiAudio {
  private context: AudioContext | null = null;
  private stream: MediaStream | null = null;
  private capture: AudioWorkletNode | null = null;
  private gain: GainNode | null = null;
  private sources = new Set<AudioBufferSourceNode>();
  private playbackQueue: string[] = [];
  private scheduling = false;
  private drainTimer: ReturnType<typeof setTimeout> | null = null;
  private epoch = 0;
  onDrained = () => {};
  onEchoEvidence = (_frames: number, _aec: boolean) => {};
  onMicrophoneEnded = () => {};
  /** Unlock the known-good speaker path directly from the user's activation click. */
  async prepareOutput() {
    let context = this.context;
    if (!context || context.state === "closed") {
      const createdContext = new AudioContext({ sampleRate: 16000 });
      context = createdContext;
      this.context = createdContext;
      this.gain = createdContext.createGain();
      this.gain.connect(createdContext.destination);
      createdContext.addEventListener("statechange", () => {
        if (createdContext.state === "running") this.scheduleNext();
      });
    }
    await context.resume();
  }
  unlockPlayback() { void this.prepareOutput().catch(() => {}); }
  async start(onPCM: (data: string) => void) {
    const epoch = ++this.epoch;
    await this.prepareOutput();
    const context = this.context;
    if (epoch !== this.epoch || !context) return;
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
    if (this.capture) this.gain?.disconnect(this.capture);
    this.capture?.disconnect(); this.capture = null;
    this.stream?.getTracks().forEach(t => { t.onended = null; t.stop(); });
    this.stream = null;
  }
  volume(value: number) { if (this.gain) this.gain.gain.value = Math.max(0, Math.min(1, value)); }
  /**
   * Queue Gemini chunks and schedule one buffer at a time. Scheduling an entire
   * response against AudioContext.currentTime can create a huge future backlog
   * when Chrome suspends/interupts the context, eventually killing the session.
   * A serial queue preserves chunk order and lets playback resume without
   * tearing down the Gemini connection.
   */
  play(data: string) {
    if (!this.context || !this.gain || this.context.state === "closed") return;
    if (this.drainTimer) clearTimeout(this.drainTimer);
    this.drainTimer = null;
    this.playbackQueue.push(data);
    this.scheduleNext();
  }
  private scheduleNext() {
    if (this.scheduling || this.sources.size || !this.playbackQueue.length) return;
    const context = this.context;
    const gain = this.gain;
    if (!context || !gain || context.state === "closed") return;
    if (context.state !== "running") {
      this.scheduling = true;
      void context.resume().then(() => {
        this.scheduling = false;
        this.scheduleNext();
      }).catch(() => {
        this.scheduling = false;
        // Keep queued audio intact; a later chunk or user gesture retries resume.
      });
      return;
    }
    const data = this.playbackQueue.shift();
    if (data === undefined) return;
    this.scheduling = true;
    try {
      const bytes = Uint8Array.from(atob(data), c => c.charCodeAt(0));
      const view = new DataView(bytes.buffer);
      const buffer = context.createBuffer(1, Math.floor(bytes.length / 2), 24000);
      const floats = buffer.getChannelData(0);
      for (let i = 0; i < floats.length; i++) floats[i] = view.getInt16(i * 2, true) / 32768;
      const source = context.createBufferSource(); source.buffer = buffer; source.connect(gain);
      this.sources.add(source);
      source.onended = () => {
        this.sources.delete(source);
        if (this.playbackQueue.length) this.scheduleNext();
        else if (!this.sources.size) {
          if (this.drainTimer) clearTimeout(this.drainTimer);
          this.drainTimer = setTimeout(() => {
            this.drainTimer = null;
            if (!this.sources.size && !this.playbackQueue.length) this.onDrained();
          }, 300);
        }
      };
      source.start(context.currentTime + 0.01);
    } catch (error) {
      this.playbackQueue.unshift(data);
      throw error;
    } finally {
      this.scheduling = false;
    }
  }
  interrupt() {
    if (this.drainTimer) clearTimeout(this.drainTimer);
    this.drainTimer = null;
    this.playbackQueue = [];
    for (const source of this.sources) { source.onended = null; source.stop(); source.disconnect(); }
    this.sources.clear();
  }
  close() {
    this.pauseCapture(); this.interrupt();
    void this.context?.close().catch(() => {}); this.context = null; this.gain = null;
  }
}
