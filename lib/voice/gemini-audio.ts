/** Own microphone capture and speaker playback independently.
 * Capture stays at 16 kHz for Gemini input; playback uses the device's native
 * rate so Gemini's 24 kHz PCM is not forced through a 16 kHz output context.
 */
export class GeminiAudio {
  private context: AudioContext | null = null; // speaker/output context
  private captureContext: AudioContext | null = null; // microphone/input context
  private stream: MediaStream | null = null;
  private capture: AudioWorkletNode | null = null;
  private microphoneSource: MediaStreamAudioSourceNode | null = null;
  private referenceSource: MediaStreamAudioSourceNode | null = null;
  private silentGain: GainNode | null = null;
  private referenceDestination: MediaStreamAudioDestinationNode | null = null;
  private gain: GainNode | null = null;
  private sources = new Set<AudioBufferSourceNode>();
  private playbackQueue: string[] = [];
  private scheduling = false;
  private drainTimer: ReturnType<typeof setTimeout> | null = null;
  private epoch = 0;
  private nextPlayTime = 0;
  private readonly lookAheadSeconds = 0.12;
  onDrained = () => {};
  onEchoEvidence = (_frames: number, _aec: boolean) => {};
  onMicrophoneEnded = () => {};

  /** Unlock speaker AudioContext during the user's direct click, before token fetch. */
  unlockPlayback() {
    let output = this.context;
    if (!output || output.state === "closed") {
      output = new AudioContext();
      this.context = output;
      this.gain = output.createGain();
      this.gain.connect(output.destination);
      this.referenceDestination = output.createMediaStreamDestination();
      this.gain.connect(this.referenceDestination);
      output.addEventListener("statechange", () => {
        if (output?.state === "running") this.scheduleNext();
      });
      this.nextPlayTime = 0;
    }
    void output.resume().catch(() => {});
  }

  async start(onPCM: (data: string) => void) {
    const epoch = ++this.epoch;
    let output = this.context;
    if (!output || output.state === "closed") {
      output = new AudioContext();
      this.context = output;
      this.gain = output.createGain();
      this.gain.connect(output.destination);
      this.referenceDestination = output.createMediaStreamDestination();
      this.gain.connect(this.referenceDestination);
      output.addEventListener("statechange", () => {
        if (output?.state === "running") this.scheduleNext();
      });
      this.nextPlayTime = 0;
    }
    let input = this.captureContext;
    if (!input || input.state === "closed") {
      input = new AudioContext({ sampleRate: 16000 });
      this.captureContext = input;
    }
    await Promise.all([output.resume(), input.resume()]);
    const stream = await navigator.mediaDevices.getUserMedia({ audio: {
      channelCount: 1, echoCancellation: true, noiseSuppression: true, autoGainControl: true,
    } });
    if (epoch !== this.epoch) { stream.getTracks().forEach(t => t.stop()); return; }
    this.stream = stream;
    await input.audioWorklet.addModule("/voice/gemini-capture.js");
    if (epoch !== this.epoch) { stream.getTracks().forEach(t => t.stop()); return; }
    const capture = new AudioWorkletNode(input, "gemini-capture", { numberOfInputs: 2, numberOfOutputs: 1 });
    this.capture = capture;
    const aec = stream.getAudioTracks()[0].getSettings?.().echoCancellation === true;
    let lastEchoFrames = 0;
    this.onEchoEvidence(0, aec);
    capture.port.onmessage = (event: MessageEvent<{ pcm: ArrayBuffer; echoFrames: number }>) => {
      if (epoch !== this.epoch) return;
      const { pcm, echoFrames } = event.data;
      if (echoFrames > lastEchoFrames) { lastEchoFrames = echoFrames; this.onEchoEvidence(echoFrames, aec); }
      const bytes = new Uint8Array(pcm);
      const samples = new Int16Array(pcm);
      const view = new DataView(pcm);
      for (let i = 0; i < samples.length; i++) view.setInt16(i * 2, samples[i], true);
      onPCM(btoa(String.fromCharCode(...bytes)));
    };
    this.microphoneSource = input.createMediaStreamSource(stream);
    this.microphoneSource.connect(capture);
    // Route a reference copy of speaker output into the second AudioWorklet input
    // without connecting nodes across AudioContexts.
    if (this.referenceDestination) {
      this.referenceSource = input.createMediaStreamSource(this.referenceDestination.stream);
      this.referenceSource.connect(capture, 0, 1);
    }
    this.silentGain = input.createGain();
    this.silentGain.gain.value = 0;
    capture.connect(this.silentGain).connect(input.destination);
    stream.getAudioTracks()[0].onended = () => {
      if (epoch !== this.epoch) return;
      this.pauseCapture();
      this.onMicrophoneEnded();
    };
  }

  /** Stop only microphone capture; keep speaker playback and both contexts alive. */
  pauseCapture() {
    this.epoch++;
    if (this.capture?.port) this.capture.port.onmessage = null;
    this.microphoneSource?.disconnect(); this.microphoneSource = null;
    this.referenceSource?.disconnect(); this.referenceSource = null;
    this.silentGain?.disconnect(); this.silentGain = null;
    this.capture?.disconnect(); this.capture = null;
    this.stream?.getTracks().forEach(t => { t.onended = null; t.stop(); });
    this.stream = null;
  }

  volume(value: number) { if (this.gain) this.gain.gain.value = Math.max(0, Math.min(1, value)); }

  /** Schedule a small rolling audio window to avoid gaps between PCM chunks. */
  play(data: string) {
    if (!this.context || !this.gain || this.context.state === "closed") return;
    if (this.drainTimer) clearTimeout(this.drainTimer);
    this.drainTimer = null;
    this.playbackQueue.push(data);
    this.scheduleNext();
  }

  private scheduleNext() {
    if (this.scheduling || !this.playbackQueue.length) return;
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
    this.scheduling = true;
    try {
      const horizon = context.currentTime + this.lookAheadSeconds;
      if (this.nextPlayTime < context.currentTime)
        this.nextPlayTime = context.currentTime + 0.015;
      while (this.playbackQueue.length && this.nextPlayTime < horizon) {
        const data = this.playbackQueue.shift();
        if (data === undefined) break;
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
            this.scheduleNext();
            if (!this.sources.size && !this.playbackQueue.length) {
              if (this.drainTimer) clearTimeout(this.drainTimer);
              this.drainTimer = setTimeout(() => {
                this.drainTimer = null;
                if (!this.sources.size && !this.playbackQueue.length) this.onDrained();
              }, 300);
            }
          };
          const startAt = Math.max(this.nextPlayTime, context.currentTime + 0.015);
          source.start(startAt);
          this.nextPlayTime = startAt + buffer.duration;
        } catch (error) {
          this.playbackQueue.unshift(data);
          throw error;
        }
      }
    } finally {
      this.scheduling = false;
    }
  }

  interrupt() {
    if (this.drainTimer) clearTimeout(this.drainTimer);
    this.drainTimer = null;
    this.playbackQueue = [];
    this.nextPlayTime = 0;
    for (const source of this.sources) { source.onended = null; source.stop(); source.disconnect(); }
    this.sources.clear();
  }

  close() {
    this.pauseCapture(); this.interrupt();
    void this.context?.close().catch(() => {});
    void this.captureContext?.close().catch(() => {});
    this.context = null; this.captureContext = null; this.gain = null; this.referenceDestination = null;
  }
}
