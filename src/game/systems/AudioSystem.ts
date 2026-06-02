type SoundName = "touch" | "regrow" | "upgrade" | "milestone" | "blocked";

export class AudioSystem {
  private context?: AudioContext;
  private master?: GainNode;
  private unlocked = false;

  unlock(): void {
    const AudioContextCtor = window.AudioContext ?? window.webkitAudioContext;
    if (!AudioContextCtor) {
      return;
    }

    if (!this.context) {
      this.context = new AudioContextCtor();
      this.master = this.context.createGain();
      this.master.gain.value = 0.28;
      this.master.connect(this.context.destination);
    }

    if (this.context.state === "suspended") {
      void this.context.resume();
    }

    this.unlocked = true;
  }

  play(name: SoundName): void {
    this.unlock();

    if (!this.context || !this.master || !this.unlocked) {
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
    const noise = this.createNoise(0.12);
    const filter = this.context!.createBiquadFilter();
    const gain = this.context!.createGain();

    filter.type = "bandpass";
    filter.frequency.setValueAtTime(900 + Math.random() * 500, now);
    filter.Q.value = 0.85;
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.14, now + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.13);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.master!);
    noise.start(now);
    noise.stop(now + 0.14);

    this.playTone(230 + Math.random() * 60, 0.035, 0.035, "triangle", now + 0.015);
  }

  private playRegrow(): void {
    const now = this.now();
    this.playTone(420, 0.08, 0.045, "sine", now);
    this.playTone(610, 0.06, 0.03, "sine", now + 0.045);
  }

  private playUpgrade(): void {
    const now = this.now();
    this.playTone(360, 0.09, 0.05, "triangle", now);
    this.playTone(540, 0.11, 0.045, "triangle", now + 0.07);
    this.playTone(720, 0.14, 0.04, "sine", now + 0.14);
  }

  private playMilestone(): void {
    const now = this.now();
    [320, 420, 560, 760].forEach((frequency, index) => {
      this.playTone(frequency, 0.16, 0.052, "triangle", now + index * 0.08);
    });
  }

  private playBlocked(): void {
    const now = this.now();
    this.playTone(160, 0.07, 0.04, "square", now);
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
