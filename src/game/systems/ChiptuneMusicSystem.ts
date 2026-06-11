type NoteName = "C3" | "D3" | "E3" | "F3" | "G3" | "A3" | "B3" | "C4" | "D4" | "E4" | "F4" | "G4" | "A4" | "B4" | "C5";

const NOTE_FREQUENCIES: Record<NoteName, number> = {
  C3: 130.81,
  D3: 146.83,
  E3: 164.81,
  F3: 174.61,
  G3: 196,
  A3: 220,
  B3: 246.94,
  C4: 261.63,
  D4: 293.66,
  E4: 329.63,
  F4: 349.23,
  G4: 392,
  A4: 440,
  B4: 493.88,
  C5: 523.25,
};

const MELODY: Array<NoteName | null> = ["C4", "E4", "G4", "A4", "G4", "E4", "D4", null, "E4", "G4", "C5", "B4", "A4", "G4", "E4", null];
const HARMONY: Array<NoteName | null> = ["C3", null, "G3", null, "A3", null, "G3", null, "F3", null, "G3", null, "E3", null, "G3", null];
const BASS: NoteName[] = ["C3", "C3", "G3", "G3", "A3", "A3", "F3", "G3"];

export class ChiptuneMusicSystem {
  private context?: AudioContext;
  private master?: GainNode;
  private unlocked = false;
  private playing = false;
  private muted = false;
  private volume = 0.72;
  private stepTimer?: number;
  private step = 0;
  private nextStepAt = 0;

  setVolume(volume: number): void {
    this.volume = Math.max(0, Math.min(1, volume));
    this.muted = this.volume <= 0;

    if (this.master && this.context) {
      this.master.gain.setTargetAtTime(this.muted ? 0 : this.volume * 0.18, this.context.currentTime, 0.02);
    }
  }

  start(volume = this.volume): void {
    this.setVolume(volume);
    this.unlock();

    if (!this.context || !this.master || this.muted) {
      return;
    }

    if (this.context.state !== "running" || !this.unlocked) {
      void this.context
        .resume()
        .then(() => {
          this.unlocked = true;
          this.start(this.volume);
        })
        .catch(() => {
          // Browser autoplay rules can block resume until a later user gesture.
        });
      return;
    }

    if (this.playing) {
      return;
    }

    this.playing = true;
    this.nextStepAt = this.context.currentTime + 0.05;
    this.scheduleLoop();
  }

  stop(): void {
    this.playing = false;

    if (this.stepTimer !== undefined) {
      window.clearTimeout(this.stepTimer);
      this.stepTimer = undefined;
    }

    if (this.master && this.context) {
      this.master.gain.setTargetAtTime(0, this.context.currentTime, 0.03);
    }
  }

  private unlock(): void {
    const AudioContextCtor = window.AudioContext ?? window.webkitAudioContext;
    if (!AudioContextCtor) {
      return;
    }

    if (!this.context) {
      this.context = new AudioContextCtor();
      this.master = this.context.createGain();
      this.master.gain.value = 0;
      this.master.connect(this.context.destination);
    }

    this.unlocked = this.context.state === "running";
  }

  private scheduleLoop(): void {
    if (!this.context || !this.playing) {
      return;
    }

    const lookaheadSeconds = 0.8;
    const stepSeconds = 60 / 132 / 2;

    while (this.nextStepAt < this.context.currentTime + lookaheadSeconds) {
      this.scheduleStep(this.step, this.nextStepAt, stepSeconds);
      this.step = (this.step + 1) % 16;
      this.nextStepAt += stepSeconds;
    }

    this.stepTimer = window.setTimeout(() => this.scheduleLoop(), 90);
  }

  private scheduleStep(step: number, startAt: number, stepSeconds: number): void {
    const melody = MELODY[step];
    const harmony = HARMONY[step];
    const bass = BASS[Math.floor(step / 2) % BASS.length];

    if (melody) {
      this.playPulse(NOTE_FREQUENCIES[melody], startAt, stepSeconds * 0.82, 0.5, 0.06);
    }

    if (harmony) {
      this.playPulse(NOTE_FREQUENCIES[harmony], startAt + stepSeconds * 0.03, stepSeconds * 0.92, 0.25, 0.045);
    }

    if (step % 2 === 0) {
      this.playPulse(NOTE_FREQUENCIES[bass] / 2, startAt, stepSeconds * 1.7, 0.18, 0.055);
    }

    if (step % 4 === 0 || step % 4 === 3) {
      this.playNoiseHat(startAt + stepSeconds * 0.06, 0.035);
    }
  }

  private playPulse(frequency: number, startAt: number, duration: number, duty: number, volume: number): void {
    if (!this.context || !this.master) {
      return;
    }

    const oscillator = this.context.createOscillator();
    const gain = this.context.createGain();

    oscillator.type = duty < 0.3 ? "square" : "triangle";
    oscillator.frequency.setValueAtTime(frequency, startAt);
    gain.gain.setValueAtTime(0.0001, startAt);
    gain.gain.exponentialRampToValueAtTime(volume, startAt + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, startAt + duration);
    oscillator.connect(gain);
    gain.connect(this.master);
    oscillator.start(startAt);
    oscillator.stop(startAt + duration + 0.02);
  }

  private playNoiseHat(startAt: number, duration: number): void {
    if (!this.context || !this.master) {
      return;
    }

    const sampleRate = this.context.sampleRate;
    const buffer = this.context.createBuffer(1, Math.floor(sampleRate * duration), sampleRate);
    const data = buffer.getChannelData(0);

    for (let i = 0; i < data.length; i += 1) {
      data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
    }

    const source = this.context.createBufferSource();
    const filter = this.context.createBiquadFilter();
    const gain = this.context.createGain();

    source.buffer = buffer;
    filter.type = "highpass";
    filter.frequency.setValueAtTime(3400, startAt);
    gain.gain.setValueAtTime(0.0001, startAt);
    gain.gain.exponentialRampToValueAtTime(0.018, startAt + 0.006);
    gain.gain.exponentialRampToValueAtTime(0.0001, startAt + duration);
    source.connect(filter);
    filter.connect(gain);
    gain.connect(this.master);
    source.start(startAt);
    source.stop(startAt + duration + 0.01);
  }
}
