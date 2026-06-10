import type { GrassTierId, TileTrait } from "../types/game-state";

type SoundName = "touch" | "regrow" | "upgrade" | "milestone" | "blocked" | "seed" | "gold" | "crit" | "unlock" | "perfect";

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

  playGrassTouch(tier: GrassTierId = "normal", trait: TileTrait = "normal", isCrit = false, comboCount = 0): void {
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
      void this.resumePromise.then(() => this.playGrassTouchNow(tier, trait, isCrit, comboCount));
      return;
    }

    this.playGrassTouchNow(tier, trait, isCrit, comboCount);
  }

  private playNow(name: SoundName): void {
    if (!this.context || !this.master || this.context.state !== "running") {
      return;
    }

    switch (name) {
      case "touch":
        this.playGrassTouchNow("normal", "normal", false, 0);
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
      case "seed":
        this.playSeed();
        break;
      case "gold":
        this.playGold();
        break;
      case "crit":
        this.playCrit();
        break;
      case "perfect":
        this.playPerfect();
        break;
      case "unlock":
        this.playUnlock();
        break;
    }
  }

  private playGrassTouchNow(tier: GrassTierId, trait: TileTrait, isCrit: boolean, comboCount: number): void {
    const now = this.now();
    const tierProfile = {
      normal: { low: 116, brush: 720, snap: 1900, volume: 1, tone: 245, duration: 1 },
      thick: { low: 92, brush: 560, snap: 1400, volume: 1.16, tone: 190, duration: 1.18 },
      clover: { low: 150, brush: 980, snap: 2500, volume: 0.94, tone: 360, duration: 0.92 },
      golden: { low: 185, brush: 1180, snap: 3100, volume: 1.08, tone: 520, duration: 1 },
    } satisfies Record<GrassTierId, { low: number; brush: number; snap: number; volume: number; tone: number; duration: number }>;
    const traitProfile = {
      normal: { brushOffset: 0, snapOffset: 0, volume: 1, extraPing: 0 },
      dewy: { brushOffset: 260, snapOffset: 480, volume: 0.9, extraPing: 780 },
      lush: { brushOffset: -120, snapOffset: 180, volume: 1.12, extraPing: 440 },
    } satisfies Record<TileTrait, { brushOffset: number; snapOffset: number; volume: number; extraPing: number }>;
    const tierSound = tierProfile[tier];
    const traitSound = traitProfile[trait];
    const critBoost = isCrit ? 1.22 : 1;
    const comboPitch = 1 + Math.min(40, Math.max(0, comboCount)) * 0.006;
    const volume = tierSound.volume * traitSound.volume * critBoost;

    this.playNoiseSweep(0.18 * tierSound.duration, (tierSound.brush + traitSound.brushOffset + Math.random() * 280) * comboPitch, 0.22 * volume, now);
    this.playNoiseSweep(0.09, (tierSound.snap + traitSound.snapOffset + Math.random() * 620) * comboPitch, 0.085 * volume, now + 0.018);
    this.playTone((tierSound.low + Math.random() * 26) * comboPitch, 0.06, 0.075 * volume, "sine", now);
    this.playTone((tierSound.tone + Math.random() * 75) * comboPitch, 0.065, 0.048 * volume, "triangle", now + 0.02);

    if (traitSound.extraPing > 0) {
      this.playTone((traitSound.extraPing + Math.random() * 80) * comboPitch, 0.055, 0.032 * volume, trait === "dewy" ? "sine" : "triangle", now + 0.04);
    }

    if (tier === "golden") {
      this.playTone((880 + Math.random() * 130) * comboPitch, 0.12, 0.04 * critBoost, "sine", now + 0.055);
      this.playTone((1320 + Math.random() * 160) * comboPitch, 0.1, 0.025 * critBoost, "sine", now + 0.1);
    }

    if (isCrit) {
      this.playCritAccent(now + 0.025);
    }
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

  private playUnlock(): void {
    const now = this.now();
    this.playTone(880, 0.055, 0.05, "sine", now);
    this.playTone(1320, 0.08, 0.045, "triangle", now + 0.045);
    this.playTone(1760, 0.1, 0.035, "sine", now + 0.095);
  }

  private playSeed(): void {
    const now = this.now();
    this.playTone(620 + Math.random() * 50, 0.06, 0.05, "sine", now);
    this.playTone(940 + Math.random() * 80, 0.08, 0.045, "triangle", now + 0.045);
  }

  private playGold(): void {
    const now = this.now();
    this.playCoinStrike(1320, 0.12, 0.065, now);
    this.playCoinStrike(1760, 0.1, 0.048, now + 0.055);
    this.playTone(660, 0.06, 0.032, "triangle", now);
    this.playTone(2460, 0.045, 0.018, "sine", now + 0.022);
    this.playTone(2960, 0.05, 0.014, "sine", now + 0.08);
  }

  private playCrit(): void {
    this.playCritAccent(this.now());
  }

  private playPerfect(): void {
    const now = this.now();
    this.playNoiseSweep(0.035, 3600 + Math.random() * 600, 0.055, now);
    this.playTone(1760, 0.045, 0.052, "sine", now);
    this.playTone(2640, 0.055, 0.044, "sine", now + 0.028);
    this.playTone(1320, 0.07, 0.03, "triangle", now + 0.07);
  }

  private playCritAccent(startAt: number): void {
    const now = this.now();
    const start = Math.max(now, startAt);
    this.playNoiseSweep(0.1, 2400 + Math.random() * 800, 0.08, start);
    this.playTone(220, 0.055, 0.07, "triangle", start);
    this.playTone(660, 0.08, 0.075, "triangle", start + 0.035);
    this.playTone(990, 0.1, 0.06, "sine", start + 0.085);
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

  private playCoinStrike(frequency: number, duration: number, volume: number, startAt: number): void {
    const main = this.context!.createOscillator();
    const shimmer = this.context!.createOscillator();
    const gain = this.context!.createGain();

    main.type = "triangle";
    shimmer.type = "sine";
    main.frequency.setValueAtTime(frequency, startAt);
    main.frequency.exponentialRampToValueAtTime(frequency * 0.94, startAt + duration);
    shimmer.frequency.setValueAtTime(frequency * 2.03, startAt);
    shimmer.frequency.exponentialRampToValueAtTime(frequency * 1.82, startAt + duration * 0.85);
    gain.gain.setValueAtTime(0.0001, startAt);
    gain.gain.exponentialRampToValueAtTime(volume, startAt + 0.006);
    gain.gain.exponentialRampToValueAtTime(0.0001, startAt + duration);

    main.connect(gain);
    shimmer.connect(gain);
    gain.connect(this.master!);
    main.start(startAt);
    shimmer.start(startAt);
    main.stop(startAt + duration + 0.02);
    shimmer.stop(startAt + duration + 0.02);
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
