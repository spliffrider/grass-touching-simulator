import type { GrassTierId, TileTrait } from "../types/game-state";

type SoundName = "touch" | "regrow" | "upgrade" | "milestone" | "blocked" | "seed" | "gold" | "crit" | "unlock" | "perfect";

const NOISE_BUFFER_SECONDS = 0.5;
const TOUCH_SOUND_MIN_INTERVAL_MS = 42;
const TOUCH_SOUND_BUSY_INTERVAL_MS = 68;

export class AudioSystem {
  private context?: AudioContext;
  private master?: GainNode;
  private unlocked = false;
  private resumePromise?: Promise<void>;
  private noiseBuffer?: AudioBuffer;
  private noiseBufferSampleRate = 0;
  private lastGrassTouchSoundAt = 0;

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
      void this.resumePromise.then(() => {
        if (this.shouldPlayGrassTouchSound(isCrit, comboCount)) {
          this.playGrassTouchNow(tier, trait, isCrit, comboCount);
        }
      });
      return;
    }

    if (!this.shouldPlayGrassTouchSound(isCrit, comboCount)) {
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
      wildflower: { low: 138, brush: 920, snap: 2350, volume: 1.02, tone: 430, duration: 0.96 },
      moss: { low: 74, brush: 430, snap: 1100, volume: 1.18, tone: 165, duration: 1.25 },
      mushroom: { low: 86, brush: 520, snap: 1250, volume: 1.14, tone: 220, duration: 1.2 },
      crystal: { low: 210, brush: 1350, snap: 3600, volume: 1.04, tone: 720, duration: 0.92 },
      frost: { low: 170, brush: 1550, snap: 3900, volume: 0.98, tone: 820, duration: 0.9 },
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

    if (tier === "crystal" || tier === "frost") {
      this.playTone((1560 + Math.random() * 180) * comboPitch, 0.075, 0.034 * critBoost, "sine", now + 0.045);
      this.playTone((2320 + Math.random() * 220) * comboPitch, 0.055, 0.02 * critBoost, "sine", now + 0.092);
    }

    if (isCrit) {
      this.playCritAccent(now + 0.025);
    }
  }

  private shouldPlayGrassTouchSound(isCrit: boolean, comboCount: number): boolean {
    const now = performance.now();
    const minInterval = isCrit ? TOUCH_SOUND_MIN_INTERVAL_MS : comboCount >= 5 ? TOUCH_SOUND_BUSY_INTERVAL_MS : TOUCH_SOUND_MIN_INTERVAL_MS;
    if (now - this.lastGrassTouchSoundAt < minInterval) {
      return false;
    }

    this.lastGrassTouchSoundAt = now;
    return true;
  }

  private playRegrow(): void {
    const now = this.now();
    this.playNoiseSweep(0.15, 1040 + Math.random() * 420, 0.07, now);
    this.playNoiseSweep(0.07, 2600 + Math.random() * 520, 0.022, now + 0.035);
    this.playTone(330 + Math.random() * 32, 0.1, 0.058, "sine", now);
    this.playTone(510 + Math.random() * 65, 0.08, 0.048, "triangle", now + 0.045);
    this.playTone(760 + Math.random() * 80, 0.065, 0.028, "sine", now + 0.09);
  }

  private playUpgrade(): void {
    const now = this.now();
    this.playNoiseSweep(0.08, 1750 + Math.random() * 450, 0.035, now);
    this.playArp([320, 420, 560, 760], now, 0.052, 0.075, "triangle");
    this.playTone(1140, 0.08, 0.028, "sine", now + 0.18);
  }

  private playUnlock(): void {
    const now = this.now();
    this.playNoiseSweep(0.11, 3100 + Math.random() * 700, 0.04, now);
    this.playArp([660, 880, 1320, 1760], now, 0.044, 0.065, "sine");
    this.playTone(440, 0.15, 0.03, "triangle", now + 0.03);
    this.playTone(2200, 0.075, 0.018, "sine", now + 0.16);
  }

  private playSeed(): void {
    const now = this.now();
    this.playNoiseSweep(0.08, 1450 + Math.random() * 380, 0.026, now);
    this.playTone(620 + Math.random() * 50, 0.06, 0.052, "sine", now);
    this.playTone(940 + Math.random() * 80, 0.08, 0.045, "triangle", now + 0.045);
    this.playTone(1240 + Math.random() * 90, 0.05, 0.022, "sine", now + 0.094);
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
    this.playNoiseSweep(0.16, 2600 + Math.random() * 700, 0.045, now + 0.08);
    this.playArp([260, 330, 440, 660, 880], now, 0.065, 0.092, "triangle");
    this.playTone(1320, 0.16, 0.032, "sine", now + 0.24);
    this.playCoinStrike(1760, 0.14, 0.03, now + 0.3);
  }

  private playBlocked(): void {
    const now = this.now();
    this.playTone(210, 0.045, 0.06, "square", now);
    this.playTone(150, 0.06, 0.052, "square", now + 0.04);
    this.playNoiseSweep(0.055, 520, 0.02, now + 0.012);
  }

  private playArp(frequencies: number[], startAt: number, step: number, volume: number, type: OscillatorType): void {
    frequencies.forEach((frequency, index) => {
      const accent = index === frequencies.length - 1 ? 1.08 : 1;
      this.playTone(frequency, step * 2.2, volume * accent, type, startAt + index * step);
    });
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
    const noise = this.createNoiseSource();
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

  private createNoiseSource(): AudioBufferSourceNode {
    const source = this.context!.createBufferSource();
    source.buffer = this.getNoiseBuffer();
    return source;
  }

  private getNoiseBuffer(): AudioBuffer {
    const sampleRate = this.context!.sampleRate;
    if (this.noiseBuffer && this.noiseBufferSampleRate === sampleRate) {
      return this.noiseBuffer;
    }

    const buffer = this.context!.createBuffer(1, Math.floor(sampleRate * NOISE_BUFFER_SECONDS), sampleRate);
    const data = buffer.getChannelData(0);

    for (let i = 0; i < data.length; i += 1) {
      data[i] = Math.random() * 2 - 1;
    }

    this.noiseBuffer = buffer;
    this.noiseBufferSampleRate = sampleRate;
    return buffer;
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
