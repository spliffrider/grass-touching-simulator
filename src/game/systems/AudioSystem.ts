import { DEFAULT_SFX_VOLUME } from "../data/audio-settings";
import {
  SoundVariationBank,
  type SoundVariation,
  type SoundVariationProfile,
} from "./SoundVariation";

type TileTrait = "normal" | "dewy" | "lush";
type GrassTierId = "normal" | "thick" | "clover" | "golden" | "wildflower" | "moss" | "mushroom" | "crystal" | "frost";

type SoundName =
  | "upgrade"
  | "skill_select"
  | "milestone"
  | "blocked"
  | "seed"
  | "unlock"
  | "sprinkler"
  | "touch_cooldown"
  | "dormancy";

const NOISE_BUFFER_SECONDS = 0.5;
const TOUCH_SOUND_MIN_INTERVAL_MS = 42;
const TOUCH_SOUND_BUSY_INTERVAL_MS = 68;
const SFX_MASTER_GAIN = 0.64;
const TOUCH_TRANSIENT_GAIN = 0.74;
const TOUCH_CRUNCH_GAIN = 0.52;
const FALLBACK_GRASS_VARIANT_COUNT = 7;
const FALLBACK_GRASS_AUDIO_POOL_SIZE = 10;

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
  private fallbackGrassDataUris: string[] = [];
  private readonly soundVariations = new SoundVariationBank();

  setVolume(volume: number): void {
    this.volume = Math.max(0, Math.min(1, volume));
    this.applyVolume();
  }

  prepare(): void {
    this.ensureContext();
  }

  unlock(): void {
    if (!this.ensureContext()) return;
    const context = this.context;
    if (!context) return;

    if (context.state === "suspended") {
      this.resumePromise ??= context
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

  private ensureContext(): boolean {
    if (this.context) return true;
    const AudioContextCtor = window.AudioContext ?? window.webkitAudioContext;
    if (!AudioContextCtor) return false;
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
    return true;
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

  play(name: SoundName, variationProfile: SoundVariationProfile = "none"): void {
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
      void this.resumePromise.then(() => this.playNow(name, variationProfile));
      return;
    }

    this.playNow(name, variationProfile);
  }

  playGrassTouch(
    tier: GrassTierId = "normal",
    trait: TileTrait = "normal",
    isCrit = false,
    comboCount = 0,
    force = false,
    variationProfile: SoundVariationProfile = "none",
  ): boolean {
    if (this.volume <= 0) {
      return false;
    }

    this.unlock();

    if (!this.context || !this.master) {
      if (!this.claimGrassTouchSound(isCrit, comboCount, force)) {
        return false;
      }

      return this.playFallbackGrassTouch(isCrit, this.soundVariations.next(variationProfile));
    }

    if (this.context.state !== "running" || !this.unlocked) {
      if (!this.claimGrassTouchSound(isCrit, comboCount, force)) {
        return false;
      }

      this.resumePromise ??= this.context
        .resume()
        .then(() => {
          this.unlocked = true;
        })
        .finally(() => {
          this.resumePromise = undefined;
        });
      void this.resumePromise.then(() => this.playGrassTouchNow(
        tier,
        trait,
        isCrit,
        comboCount,
        false,
        this.soundVariations.next(variationProfile),
      ));
      return true;
    }

    if (!this.claimGrassTouchSound(isCrit, comboCount, force)) {
      return false;
    }

    this.playGrassTouchNow(tier, trait, isCrit, comboCount, false, this.soundVariations.next(variationProfile));
    return true;
  }

  private playNow(name: SoundName, variationProfile: SoundVariationProfile): void {
    if (!this.context || !this.master || this.context.state !== "running") {
      return;
    }
    const variation = this.soundVariations.next(variationProfile);

    switch (name) {
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
        this.playSeed(variation);
        break;
      case "unlock":
        this.playUnlock();
        break;
      case "sprinkler":
        this.playSprinkler(variation);
        break;
      case "touch_cooldown":
        this.playTouchCooldown();
        break;
      case "dormancy":
        this.playDormancy();
        break;
    }
  }

  private playGrassTouchNow(
    tier: GrassTierId,
    trait: TileTrait,
    isCrit: boolean,
    comboCount: number,
    includeFallback = false,
    variation: SoundVariation = { pitchRatio: 1, gainRatio: 1, variantIndex: 0 },
  ): void {
    if (includeFallback) {
      this.playFallbackGrassTouch(isCrit, variation);
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
    const critBoost = isCrit ? 1.12 : 1;
    const comboPitch = (1 + Math.min(40, Math.max(0, comboCount)) * 0.006) * variation.pitchRatio;
    const volume = tierSound.volume * traitSound.volume * critBoost * TOUCH_TRANSIENT_GAIN * variation.gainRatio;

    this.playNoiseSweep(0.26 * tierSound.duration, (tierSound.brush + traitSound.brushOffset + Math.random() * 120) * comboPitch, 0.18 * volume, now);
    this.playNoiseSweep(0.11, (tierSound.snap + traitSound.snapOffset + Math.random() * 220) * 0.74 * comboPitch, 0.055 * volume, now + 0.018);
    this.playCrunchTransient((tierSound.snap + traitSound.snapOffset + 220 + Math.random() * 160) * 0.72 * comboPitch, 0.045 * volume, now + 0.004);
    this.playCrunchTransient((tierSound.snap + traitSound.snapOffset + 420 + Math.random() * 180) * 0.62 * comboPitch, 0.018 * volume, now + 0.032);
    this.playTone((tierSound.low + Math.random() * 18) * comboPitch, 0.07, 0.05 * volume, "sine", now);
    this.playTone((tierSound.tone + Math.random() * 38) * comboPitch, 0.09, 0.058 * volume, "triangle", now + 0.018);
    this.playTone((620 + Math.random() * 80) * comboPitch, 0.052, 0.014 * volume, "sine", now + 0.014);

    if (traitSound.extraPing > 0) {
      this.playTone((traitSound.extraPing + Math.random() * 80) * comboPitch, 0.055, 0.02 * volume, trait === "dewy" ? "sine" : "triangle", now + 0.04);
    }

    if (tier === "golden") {
      this.playTone((880 + Math.random() * 130) * comboPitch, 0.12, 0.026 * critBoost, "sine", now + 0.055);
      this.playTone((1320 + Math.random() * 160) * comboPitch, 0.1, 0.016 * critBoost, "sine", now + 0.1);
    }

    if (tier === "crystal" || tier === "frost") {
      this.playTone((1560 + Math.random() * 180) * comboPitch, 0.075, 0.022 * critBoost, "sine", now + 0.045);
      this.playTone((2320 + Math.random() * 220) * comboPitch, 0.055, 0.012 * critBoost, "sine", now + 0.092);
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

  private claimGrassTouchSound(isCrit: boolean, comboCount: number, force: boolean): boolean {
    if (!force) return this.shouldPlayGrassTouchSound(isCrit, comboCount);
    this.lastGrassTouchSoundAt = performance.now();
    return true;
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

  private playSeed(variation: SoundVariation): void {
    const now = this.now();
    const pitch = variation.pitchRatio;
    const gain = variation.gainRatio;
    this.playNoiseSweep(0.08, (1450 + Math.random() * 380) * pitch, 0.026 * gain, now);
    this.playTone((620 + Math.random() * 50) * pitch, 0.06, 0.052 * gain, "sine", now);
    this.playTone((940 + Math.random() * 80) * pitch, 0.08, 0.045 * gain, "triangle", now + 0.045);
    this.playTone((1240 + Math.random() * 90) * pitch, 0.05, 0.022 * gain, "sine", now + 0.094);
  }

  private playCritAccent(startAt: number): void {
    const now = this.now();
    const start = Math.max(now, startAt);
    this.playNoiseSweep(0.09, 1600 + Math.random() * 450, 0.035, start);
    this.playTone(220, 0.055, 0.052, "triangle", start);
    this.playTone(660, 0.08, 0.052, "triangle", start + 0.035);
    this.playTone(990, 0.1, 0.036, "sine", start + 0.085);
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

  private playSprinkler(variation: SoundVariation): void {
    const now = this.now();
    const pitch = variation.pitchRatio;
    const gain = variation.gainRatio;
    this.playNoiseSweep(0.18, (2380 + Math.random() * 420) * pitch, 0.032 * gain, now);
    this.playNoiseSweep(0.11, (4100 + Math.random() * 480) * pitch, 0.015 * gain, now + 0.055);
    this.playToneSweep(620 * pitch, 360 * pitch, 0.13, 0.026 * gain, "sine", now + 0.015);
    this.playTone((980 + Math.random() * 70) * pitch, 0.07, 0.02 * gain, "triangle", now + 0.11);
  }

  private playTouchCooldown(): void {
    const now = this.now();
    this.playToneSweep(420, 330, 0.045, 0.025, "triangle", now);
    this.playNoiseSweep(0.035, 980, 0.012, now);
  }

  private playDormancy(): void {
    const now = this.now();
    this.playNoiseSweep(0.5, 250 + Math.random() * 70, 0.052, now);
    this.playToneSweep(196, 55, 0.74, 0.068, "triangle", now);
    this.playToneSweep(293.66, 82.41, 0.66, 0.034, "sine", now + 0.055);
    this.playTone(48, 0.52, 0.025, "sine", now + 0.22);
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

  private playToneSweep(
    startFrequency: number,
    endFrequency: number,
    duration: number,
    volume: number,
    type: OscillatorType,
    startAt: number,
  ): void {
    const oscillator = this.context!.createOscillator();
    const gain = this.context!.createGain();

    oscillator.type = type;
    oscillator.frequency.setValueAtTime(Math.max(20, startFrequency), startAt);
    oscillator.frequency.exponentialRampToValueAtTime(Math.max(20, endFrequency), startAt + duration);
    gain.gain.setValueAtTime(0.0001, startAt);
    gain.gain.exponentialRampToValueAtTime(volume, startAt + 0.018);
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
    filter.frequency.exponentialRampToValueAtTime(Math.max(80, frequency * 0.45), startAt + duration);
    filter.Q.value = 0.48;
    gain.gain.setValueAtTime(0.0001, startAt);
    gain.gain.exponentialRampToValueAtTime(volume, startAt + 0.018);
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
    const duration = 0.04;

    filter.type = "bandpass";
    filter.frequency.setValueAtTime(Math.max(420, Math.min(1600, frequency)), startAt);
    filter.frequency.exponentialRampToValueAtTime(Math.max(320, Math.min(1300, frequency * 0.52)), startAt + duration);
    filter.Q.value = 0.6;
    gain.gain.setValueAtTime(0.0001, startAt);
    gain.gain.exponentialRampToValueAtTime(volume * TOUCH_CRUNCH_GAIN, startAt + 0.006);
    gain.gain.exponentialRampToValueAtTime(0.0001, startAt + duration);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.master!);
    noise.start(startAt);
    noise.stop(startAt + duration + 0.01);
  }

  private playFallbackGrassTouch(
    isCrit: boolean,
    variation: SoundVariation = { pitchRatio: 1, gainRatio: 1, variantIndex: 0 },
  ): boolean {
    const audio = this.getFallbackGrassAudio();
    if (!audio) {
      return false;
    }

    audio.volume = Math.min(1, this.volume * (isCrit ? 0.62 : 0.5) * variation.gainRatio);
    try {
      audio.playbackRate = (isCrit ? 0.96 + Math.random() * 0.05 : 0.78 + Math.random() * 0.08)
        * variation.pitchRatio;
    } catch {
      // Playback-rate changes are only seasoning; the pre-rendered variants still carry the crunch.
    }
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
      const sources = this.getFallbackGrassDataUris();
      this.fallbackGrassAudios = Array.from({ length: FALLBACK_GRASS_AUDIO_POOL_SIZE }, (_, index) => {
        const source = sources[index % sources.length];
        const audio = new Audio(source);
        audio.preload = "auto";
        audio.load();
        return audio;
      });
      this.fallbackGrassAudioIndex = Math.floor(Math.random() * this.fallbackGrassAudios.length);
    }

    const audio = this.fallbackGrassAudios[this.fallbackGrassAudioIndex];
    this.fallbackGrassAudioIndex = (this.fallbackGrassAudioIndex + 1) % this.fallbackGrassAudios.length;
    return audio;
  }

  private getFallbackGrassDataUris(): string[] {
    if (this.fallbackGrassDataUris.length === 0) {
      this.fallbackGrassDataUris = Array.from({ length: FALLBACK_GRASS_VARIANT_COUNT }, (_, index) => this.createFallbackGrassDataUri(index));
    }

    return this.fallbackGrassDataUris;
  }

  private createFallbackGrassDataUri(variantIndex: number): string {
    const profile = [
      { duration: 0.142, bodyFreq: 112, clickFreq: 500, toothFreq: 760, lateClickFreq: 620, bodyDecay: 12.5, snapDecay: 38, lateClickAt: 0.034, lateClickDecay: 44, bodySmoothing: 0.92, bodyGain: 0.82, gritGain: 0.09, clickGain: 0.045, toothGain: 0.018, lateClickGain: 0.03, drive: 0.94 },
      { duration: 0.158, bodyFreq: 86, clickFreq: 390, toothFreq: 640, lateClickFreq: 520, bodyDecay: 10.8, snapDecay: 32, lateClickAt: 0.042, lateClickDecay: 38, bodySmoothing: 0.94, bodyGain: 0.9, gritGain: 0.075, clickGain: 0.04, toothGain: 0.016, lateClickGain: 0.026, drive: 0.9 },
      { duration: 0.134, bodyFreq: 132, clickFreq: 560, toothFreq: 820, lateClickFreq: 690, bodyDecay: 14.2, snapDecay: 46, lateClickAt: 0.028, lateClickDecay: 52, bodySmoothing: 0.9, bodyGain: 0.76, gritGain: 0.11, clickGain: 0.052, toothGain: 0.021, lateClickGain: 0.034, drive: 0.98 },
      { duration: 0.166, bodyFreq: 74, clickFreq: 340, toothFreq: 560, lateClickFreq: 470, bodyDecay: 9.8, snapDecay: 30, lateClickAt: 0.05, lateClickDecay: 36, bodySmoothing: 0.952, bodyGain: 0.95, gritGain: 0.06, clickGain: 0.034, toothGain: 0.014, lateClickGain: 0.025, drive: 0.88 },
      { duration: 0.146, bodyFreq: 98, clickFreq: 460, toothFreq: 700, lateClickFreq: 590, bodyDecay: 11.8, snapDecay: 36, lateClickAt: 0.036, lateClickDecay: 42, bodySmoothing: 0.93, bodyGain: 0.86, gritGain: 0.085, clickGain: 0.043, toothGain: 0.017, lateClickGain: 0.028, drive: 0.92 },
      { duration: 0.152, bodyFreq: 124, clickFreq: 520, toothFreq: 760, lateClickFreq: 660, bodyDecay: 13.2, snapDecay: 42, lateClickAt: 0.031, lateClickDecay: 48, bodySmoothing: 0.91, bodyGain: 0.78, gritGain: 0.1, clickGain: 0.048, toothGain: 0.019, lateClickGain: 0.032, drive: 0.96 },
      { duration: 0.162, bodyFreq: 80, clickFreq: 370, toothFreq: 620, lateClickFreq: 540, bodyDecay: 10.2, snapDecay: 32, lateClickAt: 0.046, lateClickDecay: 39, bodySmoothing: 0.946, bodyGain: 0.92, gritGain: 0.07, clickGain: 0.038, toothGain: 0.015, lateClickGain: 0.027, drive: 0.9 },
    ][variantIndex % FALLBACK_GRASS_VARIANT_COUNT];
    const sampleRate = 24000;
    const durationSeconds = profile.duration;
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

    let seed = (0x9e3779b9 ^ ((variantIndex + 1) * 0x85ebca6b)) >>> 0;
    const random = () => {
      seed = (seed * 1664525 + 1013904223) >>> 0;
      return seed / 0x100000000;
    };
    const phase = random() * Math.PI * 2;
    let previousBody = 0;
    let bodyState = 0;
    let gritState = 0;
    for (let i = 0; i < sampleCount; i += 1) {
      const t = i / sampleRate;
      const raw = random() * 2 - 1;
      bodyState = bodyState * profile.bodySmoothing + raw * (1 - profile.bodySmoothing);
      gritState = gritState * 0.62 + raw * 0.38;
      const lowerScrape = bodyState - previousBody * 0.14;
      const midGrit = gritState - bodyState * 0.34;
      previousBody = bodyState;
      const bodyEnvelope = Math.exp(-t * profile.bodyDecay);
      const snapEnvelope = Math.exp(-t * profile.snapDecay);
      const lateT = t - profile.lateClickAt;
      const lateEnvelope = lateT > 0 ? Math.exp(-lateT * profile.lateClickDecay) : 0;
      const scratch = lowerScrape * bodyEnvelope * profile.bodyGain;
      const bristle = midGrit * snapEnvelope * profile.gritGain;
      const bodyTone = Math.sin(2 * Math.PI * profile.bodyFreq * t + phase) * bodyEnvelope * 0.14;
      const woodClick = Math.sin(2 * Math.PI * profile.clickFreq * t) * snapEnvelope * profile.clickGain;
      const tooth = Math.sin(2 * Math.PI * profile.toothFreq * t) * Math.exp(-t * 72) * profile.toothGain;
      const lateClick = lateEnvelope > 0 ? Math.sin(2 * Math.PI * profile.lateClickFreq * lateT) * lateEnvelope * profile.lateClickGain : 0;
      const crackle = random() > 0.988 ? (random() * 2 - 1) * snapEnvelope * 0.035 : 0;
      const value = Math.tanh((scratch + bristle + bodyTone + woodClick + tooth + lateClick + crackle) * profile.drive) * 0.82;
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
