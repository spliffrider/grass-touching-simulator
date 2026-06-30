import { DEFAULT_SFX_VOLUME } from "../data/audio-settings";
import type { GrassTierId, TileTrait } from "../types/game-state";

type SoundName =
  | "touch"
  | "regrow"
  | "upgrade"
  | "skill_select"
  | "milestone"
  | "blocked"
  | "seed"
  | "gold"
  | "crit"
  | "unlock"
  | "perfect"
  | "prick"
  | "mower";

const NOISE_BUFFER_SECONDS = 0.5;
const TOUCH_SOUND_MIN_INTERVAL_MS = 42;
const TOUCH_SOUND_BUSY_INTERVAL_MS = 68;
const SFX_MASTER_GAIN = 0.64;
const TOUCH_TRANSIENT_GAIN = 1.24;
const TOUCH_CRUNCH_GAIN = 1.7;

export class AudioSystem {
  private context?: AudioContext;
  private master?: GainNode;
  private limiter?: DynamicsCompressorNode;
  private unlocked = false;
  private resumePromise?: Promise<void>;
  private noiseBuffer?: AudioBuffer;
  private noiseBufferSampleRate = 0;
  private lastGrassTouchSoundAt = 0;
  private volume = DEFAULT_SFX_VOLUME;
  private fallbackGrassAudios: HTMLAudioElement[] = [];
  private fallbackGrassAudioIndex = 0;
  private fallbackGrassDataUri?: string;

  setVolume(volume: number): void {
    this.volume = Math.max(0, Math.min(1, volume));
    this.applyVolume();
  }

  unlock(): void {
    const AudioContextCtor = window.AudioContext ?? window.webkitAudioContext;
    if (!AudioContextCtor) {
      return;
    }

    if (!this.context) {
      this.context = new AudioContextCtor();
      this.master = this.context.createGain();
      this.limiter = this.context.createDynamicsCompressor();
      this.master.gain.value = this.getMasterGainTarget();
      this.limiter.threshold.value = -10;
      this.limiter.knee.value = 18;
      this.limiter.ratio.value = 12;
      this.limiter.attack.value = 0.003;
      this.limiter.release.value = 0.14;
      this.master.connect(this.limiter);
      this.limiter.connect(this.context.destination);
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

  private applyVolume(): void {
    if (!this.master || !this.context) {
      return;
    }

    this.master.gain.setTargetAtTime(this.getMasterGainTarget(), this.context.currentTime, 0.05);
  }

  private getMasterGainTarget(): number {
    return SFX_MASTER_GAIN * this.volume;
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

  playGrassTouch(tier: GrassTierId = "normal", trait: TileTrait = "normal", isCrit = false, comboCount = 0): boolean {
    if (this.volume <= 0) {
      return false;
    }

    this.unlock();

    if (!this.context || !this.master) {
      if (!this.shouldPlayGrassTouchSound(isCrit, comboCount)) {
        return false;
      }

      return this.playFallbackGrassTouch(isCrit);
    }

    if (this.context.state !== "running" || !this.unlocked) {
      if (!this.shouldPlayGrassTouchSound(isCrit, comboCount)) {
        return false;
      }

      this.playFallbackGrassTouch(isCrit);
      this.resumePromise ??= this.context
        .resume()
        .then(() => {
          this.unlocked = true;
        })
        .finally(() => {
          this.resumePromise = undefined;
        });
      void this.resumePromise.then(() => this.playGrassTouchNow(tier, trait, isCrit, comboCount, false));
      return true;
    }

    if (!this.shouldPlayGrassTouchSound(isCrit, comboCount)) {
      return false;
    }

    this.playGrassTouchNow(tier, trait, isCrit, comboCount);
    return true;
  }

  playFirstTouch(tier: GrassTierId = "normal", trait: TileTrait = "normal"): boolean {
    if (this.volume <= 0) {
      return false;
    }

    this.unlock();

    if (!this.context || !this.master) {
      this.lastGrassTouchSoundAt = performance.now();
      return this.playFallbackGrassTouch(false);
    }

    if (this.context.state !== "running" || !this.unlocked) {
      this.lastGrassTouchSoundAt = performance.now();
      this.playFallbackGrassTouch(false);
      this.resumePromise ??= this.context
        .resume()
        .then(() => {
          this.unlocked = true;
        })
        .finally(() => {
          this.resumePromise = undefined;
        });
      void this.resumePromise.then(() => this.playFirstTouchNow(tier, trait, false));
      return true;
    }

    this.playFirstTouchNow(tier, trait);
    return true;
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
      case "skill_select":
        this.playSkillSelect();
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
      case "prick":
        this.playPrick();
        break;
      case "mower":
        this.playMower();
        break;
    }
  }

  private playGrassTouchNow(tier: GrassTierId, trait: TileTrait, isCrit: boolean, comboCount: number, includeFallback = true): void {
    if (includeFallback) {
      this.playFallbackGrassTouch(isCrit);
    }

    const now = this.now();
    const tierProfile = {
      normal: { low: 86, brush: 520, snap: 1120, volume: 1.08, tone: 172, duration: 1.08 },
      thick: { low: 70, brush: 410, snap: 880, volume: 1.2, tone: 140, duration: 1.24 },
      clover: { low: 118, brush: 650, snap: 1400, volume: 1, tone: 250, duration: 0.98 },
      golden: { low: 138, brush: 760, snap: 1640, volume: 1.1, tone: 340, duration: 1 },
      wildflower: { low: 108, brush: 620, snap: 1360, volume: 1.04, tone: 290, duration: 1 },
      moss: { low: 58, brush: 340, snap: 720, volume: 1.22, tone: 118, duration: 1.32 },
      mushroom: { low: 66, brush: 380, snap: 820, volume: 1.18, tone: 142, duration: 1.26 },
      crystal: { low: 156, brush: 880, snap: 2050, volume: 1.04, tone: 520, duration: 0.95 },
      frost: { low: 132, brush: 920, snap: 2200, volume: 1, tone: 570, duration: 0.94 },
    } satisfies Record<GrassTierId, { low: number; brush: number; snap: number; volume: number; tone: number; duration: number }>;
    const traitProfile = {
      normal: { brushOffset: 0, snapOffset: 0, volume: 1, extraPing: 0 },
      dewy: { brushOffset: 140, snapOffset: 220, volume: 0.94, extraPing: 520 },
      lush: { brushOffset: -70, snapOffset: 90, volume: 1.14, extraPing: 340 },
    } satisfies Record<TileTrait, { brushOffset: number; snapOffset: number; volume: number; extraPing: number }>;
    const tierSound = tierProfile[tier];
    const traitSound = traitProfile[trait];
    const critBoost = isCrit ? 1.22 : 1;
    const comboPitch = 1 + Math.min(40, Math.max(0, comboCount)) * 0.006;
    const volume = tierSound.volume * traitSound.volume * critBoost * TOUCH_TRANSIENT_GAIN;

    this.playNoiseSweep(0.24 * tierSound.duration, (tierSound.brush + traitSound.brushOffset + Math.random() * 170) * comboPitch, 0.34 * volume, now);
    this.playNoiseSweep(0.13, (tierSound.snap + traitSound.snapOffset + Math.random() * 320) * comboPitch, 0.17 * volume, now + 0.014);
    this.playCrunchTransient((tierSound.snap + traitSound.snapOffset + 380 + Math.random() * 260) * comboPitch, 0.15 * volume, now + 0.002);
    this.playCrunchTransient((tierSound.snap + traitSound.snapOffset + 860 + Math.random() * 420) * comboPitch, 0.095 * volume, now + 0.03);
    this.playTone((tierSound.low + Math.random() * 18) * comboPitch, 0.065, 0.06 * volume, "sine", now);
    this.playTone((tierSound.tone + Math.random() * 38) * comboPitch, 0.085, 0.072 * volume, "triangle", now + 0.018);
    this.playTone((720 + Math.random() * 95) * comboPitch, 0.05, 0.048 * volume, "square", now + 0.006);

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

  private playFirstTouchNow(tier: GrassTierId, trait: TileTrait, includeFallback = true): void {
    if (!this.context || !this.master || this.context.state !== "running") {
      return;
    }

    this.lastGrassTouchSoundAt = performance.now();
    if (includeFallback) {
      this.playFallbackGrassTouch(false);
    }

    const now = this.now();
    const tierLift = tier === "crystal" || tier === "frost" ? 1.18 : tier === "golden" ? 1.12 : tier === "moss" || tier === "mushroom" ? 0.92 : 1;
    const traitSpark = trait === "dewy" ? 1.16 : trait === "lush" ? 1.08 : 1;
    const low = 98 * tierLift;
    const root = 196 * tierLift;

    this.playNoiseSweep(0.28, 560 * traitSpark, 0.22, now);
    this.playNoiseSweep(0.13, 1450 * traitSpark, 0.13, now + 0.016);
    this.playCrunchTransient(1680 * traitSpark, 0.14, now + 0.01);
    this.playCrunchTransient(2300 * traitSpark, 0.09, now + 0.04);
    this.playTone(low, 0.19, 0.08, "sine", now);
    this.playTone(root, 0.17, 0.072, "triangle", now + 0.012);
    this.playTone(root * 1.5, 0.14, 0.052, "triangle", now + 0.035);
    this.playArp([392, 523.25, 659.25, 783.99].map((frequency) => frequency * tierLift), now + 0.055, 0.042, 0.052, "triangle");
    this.playTone(1567.98 * tierLift * traitSpark, 0.12, 0.034, "sine", now + 0.18);
    this.playTone(2349.32 * tierLift * traitSpark, 0.08, 0.02, "sine", now + 0.235);
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

  private playSkillSelect(): void {
    const now = this.now();
    this.playNoiseSweep(0.035, 4300 + Math.random() * 900, 0.038, now);
    this.playTone(620 + Math.random() * 30, 0.034, 0.036, "square", now);
    this.playTone(1240 + Math.random() * 55, 0.048, 0.032, "triangle", now + 0.018);
    this.playTone(1860 + Math.random() * 90, 0.04, 0.022, "sine", now + 0.05);
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

  private playPrick(): void {
    const now = this.now();
    this.playTone(1240, 0.035, 0.048, "square", now);
    this.playTone(1820, 0.026, 0.032, "sawtooth", now + 0.018);
    this.playNoiseSweep(0.045, 2600, 0.035, now);
  }

  private playMower(): void {
    const now = this.now();
    this.playTone(96, 0.28, 0.036, "sawtooth", now);
    this.playTone(128, 0.22, 0.028, "square", now + 0.045);
    this.playNoiseSweep(0.26, 420, 0.045, now);
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

  private playCrunchTransient(frequency: number, volume: number, startAt: number): void {
    const noise = this.createNoiseSource();
    const filter = this.context!.createBiquadFilter();
    const gain = this.context!.createGain();
    const duration = 0.052;

    filter.type = "bandpass";
    filter.frequency.setValueAtTime(Math.max(560, Math.min(2800, frequency)), startAt);
    filter.frequency.exponentialRampToValueAtTime(Math.max(480, frequency * 0.72), startAt + duration);
    filter.Q.value = 1.25;
    gain.gain.setValueAtTime(0.0001, startAt);
    gain.gain.exponentialRampToValueAtTime(volume * TOUCH_CRUNCH_GAIN, startAt + 0.004);
    gain.gain.exponentialRampToValueAtTime(0.0001, startAt + duration);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.master!);
    noise.start(startAt);
    noise.stop(startAt + duration + 0.01);
  }

  private playFallbackGrassTouch(isCrit: boolean): boolean {
    const audio = this.getFallbackGrassAudio();
    if (!audio) {
      return false;
    }

    audio.volume = Math.min(1, this.volume * (isCrit ? 1 : 0.88));
    try {
      audio.currentTime = 0;
    } catch {
      // Some mobile browsers reject seeking until metadata is ready; playback can still proceed.
    }
    void audio.play().catch(() => undefined);
    return true;
  }

  private getFallbackGrassAudio(): HTMLAudioElement | undefined {
    if (typeof Audio === "undefined") {
      return undefined;
    }

    if (this.fallbackGrassAudios.length === 0) {
      const source = this.getFallbackGrassDataUri();
      this.fallbackGrassAudios = Array.from({ length: 5 }, () => {
        const audio = new Audio(source);
        audio.preload = "auto";
        audio.load();
        return audio;
      });
    }

    const audio = this.fallbackGrassAudios[this.fallbackGrassAudioIndex];
    this.fallbackGrassAudioIndex = (this.fallbackGrassAudioIndex + 1) % this.fallbackGrassAudios.length;
    return audio;
  }

  private getFallbackGrassDataUri(): string {
    this.fallbackGrassDataUri ??= this.createFallbackGrassDataUri();
    return this.fallbackGrassDataUri;
  }

  private createFallbackGrassDataUri(): string {
    const sampleRate = 22050;
    const durationSeconds = 0.12;
    const sampleCount = Math.floor(sampleRate * durationSeconds);
    const bytesPerSample = 2;
    const dataSize = sampleCount * bytesPerSample;
    const buffer = new ArrayBuffer(44 + dataSize);
    const view = new DataView(buffer);
    let offset = 0;

    const writeString = (value: string) => {
      for (let i = 0; i < value.length; i += 1) {
        view.setUint8(offset, value.charCodeAt(i));
        offset += 1;
      }
    };
    const writeUint16 = (value: number) => {
      view.setUint16(offset, value, true);
      offset += 2;
    };
    const writeUint32 = (value: number) => {
      view.setUint32(offset, value, true);
      offset += 4;
    };

    writeString("RIFF");
    writeUint32(36 + dataSize);
    writeString("WAVE");
    writeString("fmt ");
    writeUint32(16);
    writeUint16(1);
    writeUint16(1);
    writeUint32(sampleRate);
    writeUint32(sampleRate * bytesPerSample);
    writeUint16(bytesPerSample);
    writeUint16(16);
    writeString("data");
    writeUint32(dataSize);

    let previousNoise = 0;
    let bodyState = 0;
    let gritState = 0;
    for (let i = 0; i < sampleCount; i += 1) {
      const t = i / sampleRate;
      const random = Math.random() * 2 - 1;
      bodyState = bodyState * 0.72 + random * 0.28;
      gritState = gritState * 0.35 + random * 0.65;
      const lowerScrape = bodyState - previousNoise * 0.3;
      const midGrit = gritState - bodyState * 0.48;
      previousNoise = random;
      const bodyEnvelope = Math.exp(-t * 25);
      const snapEnvelope = Math.exp(-t * 58);
      const scratch = lowerScrape * bodyEnvelope * 0.82;
      const snap = midGrit * snapEnvelope * 0.42;
      const woodClick = Math.sin(2 * Math.PI * 760 * t) * snapEnvelope * 0.2;
      const tooth = Math.sin(2 * Math.PI * 1320 * t) * Math.exp(-t * 72) * 0.13;
      const value = Math.tanh((scratch + snap + woodClick + tooth) * 1.55);
      view.setInt16(offset, Math.round(value * 32767), true);
      offset += 2;
    }

    let binary = "";
    const bytes = new Uint8Array(buffer);
    for (let i = 0; i < bytes.length; i += 1) {
      binary += String.fromCharCode(bytes[i]);
    }

    return `data:audio/wav;base64,${btoa(binary)}`;
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
