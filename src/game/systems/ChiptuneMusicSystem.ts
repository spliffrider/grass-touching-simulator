type NoteName =
  | "A2"
  | "B2"
  | "C3"
  | "D3"
  | "E3"
  | "F3"
  | "G3"
  | "A3"
  | "B3"
  | "C4"
  | "D4"
  | "E4"
  | "F4"
  | "G4"
  | "A4"
  | "B4"
  | "C5"
  | "D5"
  | "E5"
  | "F5"
  | "G5"
  | "A5"
  | "B5"
  | "C6";

type Waveform = OscillatorType;

interface ChordShape {
  bass: NoteName;
  chord: [NoteName, NoteName, NoteName, NoteName];
}

interface ToneOptions {
  frequency: number;
  startAt: number;
  duration: number;
  volume: number;
  waveform: Waveform;
  output?: AudioNode;
  attack?: number;
  release?: number;
  detune?: number;
}

const NOTE_FREQUENCIES: Record<NoteName, number> = {
  A2: 110,
  B2: 123.47,
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
  D5: 587.33,
  E5: 659.25,
  F5: 698.46,
  G5: 783.99,
  A5: 880,
  B5: 987.77,
  C6: 1046.5,
};

const MELODY_PHRASES: Array<Array<NoteName | null>> = [
  ["C4", "E4", "G4", "C5", "B4", "G4", "E4", null, "A4", "C5", "B4", "G4", "E4", "D4", "C4", null],
  ["E4", "G4", "A4", "C5", "B4", "A4", "G4", "E4", "F4", "A4", "G4", "E4", "D4", "E4", "C4", null],
  ["G4", "A4", "C5", "D5", "C5", "A4", "G4", "E4", "F4", "G4", "A4", "C5", "B4", "G4", "E4", null],
  ["E4", "G4", "B4", "C5", "D5", "C5", "B4", "G4", "A4", "G4", "E4", "D4", "C4", null, "G4", null],
  ["C5", "D5", "E5", "G5", "E5", "D5", "C5", "A4", "G4", "A4", "C5", "D5", "E5", null, "G5", null],
  ["E5", "G5", "A5", "G5", "E5", "D5", "C5", null, "D5", "E5", "G5", "E5", "D5", "C5", "A4", null],
  ["G4", "C5", "E5", "G5", "A5", "G5", "E5", "D5", "C5", "D5", "E5", "G5", "E5", "C5", "D5", null],
  ["E5", "D5", "C5", "A4", "G4", "E4", "D4", null, "C4", "E4", "G4", "C5", "B4", "G4", "C5", null],
];

const COUNTER_PHRASES: Array<Array<NoteName | null>> = [
  [null, null, "C4", null, null, "D4", null, null, "E4", null, null, "D4", null, null, "C4", null],
  [null, "C4", null, null, "D4", null, null, "E4", null, "F4", null, null, "E4", null, null, null],
  [null, null, "E4", null, null, "F4", null, "E4", null, null, "D4", null, "E4", null, null, null],
  [null, "D4", null, null, "E4", null, "G4", null, null, "E4", null, "D4", null, null, "C4", null],
  [null, "G4", null, "E4", null, "C4", null, null, "E4", null, "G4", null, "A4", null, null, null],
  ["C4", null, null, "D4", null, "E4", null, null, "G4", null, "E4", null, "D4", null, "C4", null],
  [null, "E4", null, "G4", null, "A4", null, "G4", null, "E4", null, "D4", null, "C4", null, null],
  [null, null, "G4", null, "E4", null, "D4", null, "C4", null, null, "D4", null, "E4", null, null],
];

const CHORDS: ChordShape[] = [
  { bass: "C3", chord: ["C4", "E4", "G4", "C5"] },
  { bass: "G3", chord: ["G3", "B3", "D4", "G4"] },
  { bass: "A2", chord: ["A3", "C4", "E4", "A4"] },
  { bass: "F3", chord: ["F3", "A3", "C4", "F4"] },
  { bass: "C3", chord: ["C4", "E4", "G4", "C5"] },
  { bass: "E3", chord: ["E3", "G3", "B3", "E4"] },
  { bass: "F3", chord: ["F3", "A3", "C4", "F4"] },
  { bass: "G3", chord: ["G3", "B3", "D4", "G4"] },
  { bass: "A2", chord: ["A3", "C4", "E4", "A4"] },
  { bass: "F3", chord: ["F3", "A3", "C4", "F4"] },
  { bass: "C3", chord: ["C4", "E4", "G4", "C5"] },
  { bass: "G3", chord: ["G3", "B3", "D4", "G4"] },
  { bass: "F3", chord: ["F3", "A3", "C4", "F4"] },
  { bass: "E3", chord: ["E3", "G3", "B3", "E4"] },
  { bass: "D3", chord: ["D3", "F3", "A3", "D4"] },
  { bass: "G3", chord: ["G3", "B3", "D4", "G4"] },
];

const TEMPO_BPM = 138;

export class ChiptuneMusicSystem {
  private context?: AudioContext;
  private master?: GainNode;
  private dryBus?: GainNode;
  private leadBus?: GainNode;
  private delay?: DelayNode;
  private delayFeedback?: GainNode;
  private delayReturn?: GainNode;
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
      this.master.gain.setTargetAtTime(this.muted ? 0 : this.volume * 0.15, this.context.currentTime, 0.02);
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
      this.dryBus = this.context.createGain();
      this.leadBus = this.context.createGain();
      this.delay = this.context.createDelay(0.5);
      this.delayFeedback = this.context.createGain();
      this.delayReturn = this.context.createGain();

      this.master.gain.value = 0;
      this.dryBus.gain.value = 1;
      this.leadBus.gain.value = 0.86;
      this.delay.delayTime.value = 0.155;
      this.delayFeedback.gain.value = 0.16;
      this.delayReturn.gain.value = 0.08;

      this.dryBus.connect(this.master);
      this.leadBus.connect(this.dryBus);
      this.leadBus.connect(this.delay);
      this.delay.connect(this.delayFeedback);
      this.delayFeedback.connect(this.delay);
      this.delay.connect(this.delayReturn);
      this.delayReturn.connect(this.master);
      this.master.connect(this.context.destination);
    }

    this.unlocked = this.context.state === "running";
  }

  private scheduleLoop(): void {
    if (!this.context || !this.playing) {
      return;
    }

    const lookaheadSeconds = 0.8;
    const stepSeconds = 60 / TEMPO_BPM / 2;

    while (this.nextStepAt < this.context.currentTime + lookaheadSeconds) {
      this.scheduleStep(this.step, this.nextStepAt, stepSeconds);
      this.step = (this.step + 1) % 128;
      this.nextStepAt += stepSeconds;
    }

    this.stepTimer = window.setTimeout(() => this.scheduleLoop(), 90);
  }

  private scheduleStep(songStep: number, startAt: number, stepSeconds: number): void {
    const phraseIndex = Math.floor(songStep / 16) % MELODY_PHRASES.length;
    const localStep = songStep % 16;
    const chord = CHORDS[Math.floor(songStep / 8) % CHORDS.length];
    const melody = MELODY_PHRASES[phraseIndex][localStep];
    const counter = COUNTER_PHRASES[phraseIndex][localStep];
    const isLift = phraseIndex >= 4 && phraseIndex <= 6;
    const isTurnaround = phraseIndex === 3 || phraseIndex === 7;

    if (localStep === 0) {
      this.playPad(chord, startAt, stepSeconds, isLift);
    }

    if (songStep % 8 === 0) {
      this.playChord(chord, startAt, stepSeconds, isLift);
    }

    if (songStep % 2 === 0) {
      const walk = localStep % 8 === 6 ? chord.chord[1] : chord.bass;
      this.playTone({
        frequency: NOTE_FREQUENCIES[walk] / 2,
        startAt,
        duration: stepSeconds * 1.24,
        volume: songStep % 8 === 0 ? 0.062 : 0.046,
        waveform: "triangle",
        attack: 0.01,
        release: 0.035,
      });
    } else {
      const stab = localStep % 8 === 7 ? chord.chord[1] : chord.bass;
      this.playTone({
        frequency: NOTE_FREQUENCIES[stab],
        startAt: startAt + stepSeconds * 0.05,
        duration: stepSeconds * 0.38,
        volume: isLift ? 0.024 : 0.018,
        waveform: "square",
        attack: 0.004,
        release: 0.026,
      });
    }

    if (isLift && (localStep === 3 || localStep === 11)) {
      this.playTone({
        frequency: NOTE_FREQUENCIES[chord.chord[2]] / 2,
        startAt: startAt + stepSeconds * 0.34,
        duration: stepSeconds * 0.54,
        volume: 0.027,
        waveform: "square",
        attack: 0.006,
        release: 0.03,
      });
    }

    if (melody) {
      this.playTone({
        frequency: NOTE_FREQUENCIES[melody],
        startAt,
        duration: stepSeconds * (localStep % 4 === 3 ? 1.35 : 0.86),
        volume: isTurnaround && localStep > 10 ? 0.038 : isLift ? 0.055 : 0.048,
        waveform: localStep % 8 === 0 ? "triangle" : "square",
        output: this.leadBus,
        attack: 0.012,
        release: 0.045,
      });

      if (isLift && localStep % 4 === 2) {
        this.playTone({
          frequency: NOTE_FREQUENCIES[melody] * 2,
          startAt: startAt + stepSeconds * 0.03,
          duration: stepSeconds * 0.42,
          volume: 0.014,
          waveform: "triangle",
          output: this.leadBus,
          attack: 0.008,
          release: 0.035,
        });
      }
    }

    if (counter && songStep % 4 !== 0) {
      this.playTone({
        frequency: NOTE_FREQUENCIES[counter],
        startAt: startAt + stepSeconds * 0.12,
        duration: stepSeconds * 0.58,
        volume: isLift ? 0.027 : 0.022,
        waveform: "triangle",
        attack: 0.014,
        release: 0.05,
      });
    }

    if (songStep % 2 === 1) {
      const arpNote = chord.chord[(songStep + phraseIndex) % chord.chord.length];
      this.playTone({
        frequency: NOTE_FREQUENCIES[arpNote] * (phraseIndex === 2 ? 2 : 1),
        startAt: startAt + stepSeconds * 0.08,
        duration: stepSeconds * 0.36,
        volume: isLift ? 0.023 : 0.018,
        waveform: "square",
        attack: 0.006,
        release: 0.035,
      });
    }

    if (localStep === 14) {
      this.playFlourish(phraseIndex, startAt + stepSeconds * 0.1, stepSeconds, isLift);
    }

    this.schedulePercussion(songStep, startAt, stepSeconds, isLift, isTurnaround);
  }

  private playChord(chord: ChordShape, startAt: number, stepSeconds: number, isLift: boolean): void {
    for (const [index, note] of chord.chord.entries()) {
      this.playTone({
        frequency: NOTE_FREQUENCIES[note],
        startAt: startAt + index * 0.012,
        duration: stepSeconds * (isLift ? 2.75 : 2.35),
        volume: isLift ? 0.015 : 0.012,
        waveform: "triangle",
        attack: 0.025,
        release: 0.12,
      });
    }
  }

  private playPad(chord: ChordShape, startAt: number, stepSeconds: number, isLift: boolean): void {
    const root = NOTE_FREQUENCIES[chord.chord[0]];
    const fifth = NOTE_FREQUENCIES[chord.chord[2]];

    this.playTone({
      frequency: root,
      startAt,
      duration: stepSeconds * 6.4,
      volume: isLift ? 0.012 : 0.008,
      waveform: "triangle",
      attack: 0.08,
      release: 0.35,
    });
    this.playTone({
      frequency: fifth,
      startAt: startAt + 0.025,
      duration: stepSeconds * 5.8,
      volume: isLift ? 0.009 : 0.006,
      waveform: "triangle",
      attack: 0.08,
      release: 0.35,
    });
  }

  private playFlourish(phraseIndex: number, startAt: number, stepSeconds: number, isLift: boolean): void {
    const runs: NoteName[][] = [
      ["E4", "G4", "C5"],
      ["D4", "G4", "B4"],
      ["E4", "A4", "C5"],
      ["G4", "B4", "D5"],
      ["C5", "E5", "G5", "C6"],
      ["A4", "C5", "E5", "A5"],
      ["G4", "C5", "E5", "G5"],
      ["D4", "G4", "B4", "C5"],
    ];
    const notes = runs[phraseIndex % runs.length];
    const noteDuration = stepSeconds * (isLift ? 0.34 : 0.3);

    for (const [index, note] of notes.entries()) {
      this.playTone({
        frequency: NOTE_FREQUENCIES[note],
        startAt: startAt + index * stepSeconds * 0.2,
        duration: noteDuration,
        volume: isLift ? 0.026 : 0.019,
        waveform: index % 2 === 0 ? "square" : "triangle",
        output: this.leadBus,
        attack: 0.004,
        release: 0.028,
      });
    }
  }

  private schedulePercussion(songStep: number, startAt: number, stepSeconds: number, isLift: boolean, isTurnaround: boolean): void {
    const barStep = songStep % 8;

    if (songStep % 2 === 0) {
      this.playKick(startAt, barStep === 0 ? 1 : 0.84);
    }

    if (barStep === 2 || barStep === 6) {
      this.playSnare(startAt + stepSeconds * 0.02, isLift);
    }

    if (barStep === 4 || (isLift && songStep % 16 === 12)) {
      this.playNoise(startAt + stepSeconds * 0.04, 0.07, isLift ? 0.02 : 0.014, 1250, "bandpass");
    }

    if (songStep % 2 === 1) {
      this.playOpenHat(startAt + stepSeconds * 0.04, isLift);
    } else if (barStep !== 0) {
      this.playNoise(startAt + stepSeconds * 0.06, 0.018, 0.005, 5200, "highpass");
    }

    if ((isLift || isTurnaround) && songStep % 16 === 15) {
      this.playNoise(startAt, 0.025, 0.014, 5200, "highpass");
      this.playNoise(startAt + stepSeconds * 0.25, 0.025, 0.012, 5600, "highpass");
      this.playNoise(startAt + stepSeconds * 0.5, 0.025, 0.01, 6000, "highpass");
    }
  }

  private playTone(options: ToneOptions): void {
    if (!this.context || !this.master) {
      return;
    }

    const output = options.output ?? this.dryBus ?? this.master;
    const attack = options.attack ?? 0.01;
    const release = options.release ?? 0.04;
    const oscillator = this.context.createOscillator();
    const filter = this.context.createBiquadFilter();
    const gain = this.context.createGain();
    const peakAt = options.startAt + attack;
    const releaseAt = Math.max(peakAt + 0.001, options.startAt + options.duration - release);
    const endAt = options.startAt + options.duration;

    oscillator.type = options.waveform;
    oscillator.frequency.setValueAtTime(options.frequency, options.startAt);
    oscillator.detune.setValueAtTime(options.detune ?? 0, options.startAt);
    filter.type = "lowpass";
    filter.frequency.setValueAtTime(options.waveform === "square" ? 2200 : 1800, options.startAt);
    gain.gain.setValueAtTime(0.0001, options.startAt);
    gain.gain.exponentialRampToValueAtTime(options.volume, peakAt);
    gain.gain.setValueAtTime(options.volume, releaseAt);
    gain.gain.exponentialRampToValueAtTime(0.0001, endAt);

    oscillator.connect(filter);
    filter.connect(gain);
    gain.connect(output);
    oscillator.start(options.startAt);
    oscillator.stop(endAt + 0.03);
  }

  private playKick(startAt: number, accent = 1): void {
    if (!this.context || !this.dryBus) {
      return;
    }

    const oscillator = this.context.createOscillator();
    const gain = this.context.createGain();

    oscillator.type = "sine";
    oscillator.frequency.setValueAtTime(112, startAt);
    oscillator.frequency.exponentialRampToValueAtTime(42, startAt + 0.12);
    gain.gain.setValueAtTime(0.0001, startAt);
    gain.gain.exponentialRampToValueAtTime(0.066 * accent, startAt + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.0001, startAt + 0.15);
    oscillator.connect(gain);
    gain.connect(this.dryBus);
    oscillator.start(startAt);
    oscillator.stop(startAt + 0.17);
  }

  private playSnare(startAt: number, isLift: boolean): void {
    if (!this.context || !this.dryBus) {
      return;
    }

    this.playNoise(startAt, 0.082, isLift ? 0.035 : 0.029, 1450, "bandpass");
    this.playNoise(startAt + 0.012, 0.045, isLift ? 0.013 : 0.01, 6100, "highpass");

    const oscillator = this.context.createOscillator();
    const gain = this.context.createGain();

    oscillator.type = "triangle";
    oscillator.frequency.setValueAtTime(180, startAt);
    oscillator.frequency.exponentialRampToValueAtTime(126, startAt + 0.055);
    gain.gain.setValueAtTime(0.0001, startAt);
    gain.gain.exponentialRampToValueAtTime(isLift ? 0.018 : 0.014, startAt + 0.006);
    gain.gain.exponentialRampToValueAtTime(0.0001, startAt + 0.07);
    oscillator.connect(gain);
    gain.connect(this.dryBus);
    oscillator.start(startAt);
    oscillator.stop(startAt + 0.085);
  }

  private playOpenHat(startAt: number, isLift: boolean): void {
    this.playNoise(startAt, isLift ? 0.052 : 0.044, isLift ? 0.016 : 0.012, 7000, "highpass");
  }

  private playNoise(startAt: number, duration: number, volume: number, frequency: number, filterType: BiquadFilterType): void {
    if (!this.context || !this.dryBus) {
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
    filter.type = filterType;
    filter.frequency.setValueAtTime(frequency, startAt);
    gain.gain.setValueAtTime(0.0001, startAt);
    gain.gain.exponentialRampToValueAtTime(volume, startAt + 0.006);
    gain.gain.exponentialRampToValueAtTime(0.0001, startAt + duration);
    source.connect(filter);
    filter.connect(gain);
    gain.connect(this.dryBus);
    source.start(startAt);
    source.stop(startAt + duration + 0.01);
  }
}
