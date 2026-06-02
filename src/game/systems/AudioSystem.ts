type SoundName = "touch" | "regrow" | "upgrade" | "milestone" | "blocked";

export class AudioSystem {
  private context?: AudioContext;
  private master?: GainNode;
  private unlocked = false;
  private resumePromise?: Promise<void>;

  unlock(): void {
    const AudioContextCtor = window.AudioContext ?? window.webkitAudioContext;
    if (!AudioContextCtor) {
      return;
    }

    if (!this.context) {
      this.context = new AudioContextCtor();
      this.master = this.context.createGain();
      this.master.gain.value = 0.58;
      this.master.connect(this.context.destination);
    }

    if (this.context.state === "suspended") {
      this.resumePromise ??= this.context
        .resume()
        .then(() => {
          this.unlocked = true;
        })
        .finally(() => {
          this.resumePromise = undefined;
        });
      return;
    }

    this.unlocked = true;
  }

  play(name: SoundName): void {
    this.unlock();

    if (!this.context || !this.master) {
      return;
    }

    if (this.context.state !== "running" || !this.unlocked) {
      this.resumePromise ??= this.context
        .resume()
        .then(() => {
          this.unlocked = true;
        })
        .finally(() => {
          this.resumePromise = undefined;
        });
      void this.resumePromise.then(() => this.playNow(name));
      return;
    }

    this.playNow(name);
  }

  private playNow(name: SoundName): void {
    if (!this.context || !this.master || this.context.state !== "running") {
      return;
    }

    switch (name) {
      case "touch":
        this.playGrassTouch();
        break;
      case "regrow":
        this.playRegrow();
        break;
      case "upgrade":
        this.playUpgrade();
        break;
      case "milestone":
        this.playMilestone();
        break;
      case "blocked":
        this.playBlocked();
        break;
    }
  }

  private playGrassTouch(): void {
    const now = this.now();
    this.playNoiseSweep(0.18, 720 + Math.random() * 420, 0.23, now);
    this.playNoiseSweep(0.1, 1900 + Math.random() * 900, 0.095, now + 0.018);
    this.playTone(116 + Math.random() * 30, 0.06, 0.09, "sine", now);
    this.playTone(245 + Math.random() * 95, 0.06, 0.055, "triangle", now + 0.018);
  }

  private playRegrow(): void {
    const now = this.now();
    this.playNoiseSweep(0.12, 1250 + Math.random() * 350, 0.06, now);
    this.playTone(390 + Math.random() * 40, 0.09, 0.07, "sine", now);
    this.playTone(610 + Math.random() * 70, 0.075, 0.05, "sine", now + 0.045);
  }

  private playUpgrade(): void {
    const now = this.now();
    this.playTone(360, 0.09, 0.075, "triangle", now);
    this.playTone(540, 0.11, 0.065, "triangle", now + 0.07);
    this.playTone(720, 0.14, 0.06, "sine", now + 0.14);
  }

  private playMilestone(): void {
    const now = this.now();
    [320, 420, 560, 760].forEach((frequency, index) => {
      this.playTone(frequency, 0.16, 0.052, "triangle", now + index * 0.08);
    });
  }

  private playBlocked(): void {
    const now = this.now();
    this.playTone(160, 0.07, 0.075, "square", now);
  }

  private playTone(
    frequency: number,
    duration: number,
    volume: number,
    type: OscillatorType,
    startAt: number,
  ): void {
    const oscillator = this.context!.createOscillator();
    const gain = this.context!.createGain();

    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, startAt);
    gain.gain.setValueAtTime(0.0001, startAt);
    gain.gain.exponentialRampToValueAtTime(volume, startAt + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, startAt + duration);

    oscillator.connect(gain);
    gain.connect(this.master!);
    oscillator.start(startAt);
    oscillator.stop(startAt + duration + 0.02);
  }

  private playNoiseSweep(duration: number, frequency: number, volume: number, startAt: number): void {
    const noise = this.createNoise(duration);
    const filter = this.context!.createBiquadFilter();
    const gain = this.context!.createGain();

    filter.type = "bandpass";
    filter.frequency.setValueAtTime(frequency, startAt);
    filter.frequency.exponentialRampToValueAtTime(Math.max(90, frequency * 0.58), startAt + duration);
    filter.Q.value = 0.9;
    gain.gain.setValueAtTime(0.0001, startAt);
    gain.gain.exponentialRampToValueAtTime(volume, startAt + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, startAt + duration);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.master!);
    noise.start(startAt);
    noise.stop(startAt + duration + 0.01);
  }

  private createNoise(duration: number): AudioBufferSourceNode {
    const sampleRate = this.context!.sampleRate;
    const buffer = this.context!.createBuffer(1, Math.floor(sampleRate * duration), sampleRate);
    const data = buffer.getChannelData(0);

    for (let i = 0; i < data.length; i += 1) {
      data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
    }

    const source = this.context!.createBufferSource();
    source.buffer = buffer;
    return source;
  }

  private now(): number {
    return this.context?.currentTime ?? 0;
  }
}

declare global {
  interface Window {
    webkitAudioContext?: typeof AudioContext;
  }
}
