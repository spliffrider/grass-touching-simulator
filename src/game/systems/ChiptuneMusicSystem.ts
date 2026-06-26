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
type GrooveId = "meadow" | "groove" | "dreamy" | "climb" | "sprint" | "rain";

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
  useFM?: boolean;
  fmRatio?: number;
  fmIndex?: number;
}

export interface ChiptuneTrack {
  id: string;
  name: string;
  bpm: number;
  groove: GrooveId;
  melodyPhrases: Array<Array<NoteName | null>>;
  counterPhrases: Array<Array<NoteName | null>>;
  chords: ChordShape[];
  waveformLead: Waveform;
  waveformBass: Waveform;
  leadGain?: number;
  delayTime?: number;
  delayFeedback?: number;
  delayReturn?: number;
  useFMLead?: boolean;
  useFMBass?: boolean;
  fmRatioLead?: number;
  fmIndexLead?: number;
  fmRatioBass?: number;
  fmIndexBass?: number;
}

interface ArrangementLayers {
  bass: boolean;
  chords: boolean;
  drums: boolean;
  hats: boolean;
  counter: boolean;
  arp: boolean;
  harmony: boolean;
  melody: boolean;
  flourishes: boolean;
  intensity: number;
}

interface BassEvent {
  note: NoteName;
  octaveDivisor: number;
  offsetSteps: number;
  durationSteps: number;
  accent: number;
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

const NOISE_BUFFER_SECONDS = 0.5;
const TITLE_MASTER_GAIN = 0.88;
const GAME_MASTER_GAIN = 0.82;
export const TITLE_TRACK_ID = "title_garden";

const TITLE_MELODY: Array<Array<NoteName | null>> = [
  ["C5", "E5", "G5", null, "E5", "D5", "C5", null, "A4", "C5", "E5", null, "D5", "C5", "G4", null],
  ["E5", "G5", "A5", "G5", "E5", "C5", "D5", null, "F5", "E5", "D5", "C5", "A4", null, "C5", null],
  ["G4", "C5", "D5", "E5", "G5", null, "E5", "D5", "C5", "A4", "C5", "E5", "D5", "G4", "A4", null],
  ["A4", "C5", "E5", "G5", "A5", "G5", "E5", null, "D5", "E5", "C5", "A4", "G4", null, "C5", null],
  ["C5", "D5", "E5", "G5", "A5", null, "G5", "E5", "D5", "C5", "A4", "C5", "E5", "G5", "E5", null],
  ["G5", "A5", "G5", "E5", "D5", "E5", "C5", null, "A4", "C5", "D5", "F5", "E5", "D5", "C5", null],
  ["E5", "G5", "A5", "C6", "A5", "G5", "E5", "D5", "C5", "E5", "G5", "A5", "G5", "E5", "D5", null],
  ["F5", "E5", "D5", "C5", "A4", "C5", "D5", null, "E5", "G5", "E5", "C5", "D5", null, "C5", null],
];

const TITLE_COUNTER: Array<Array<NoteName | null>> = [
  [null, "G4", null, "E4", null, "G4", null, "C5", null, "E4", null, "G4", null, "E4", null, null],
  ["C4", null, "E4", null, "G4", null, "E4", null, "A4", null, "F4", null, "D4", null, "G4", null],
  [null, "E4", "G4", null, "C5", null, "G4", null, "E4", null, "C4", null, "D4", null, "F4", null],
  ["F4", null, "A4", null, "C5", null, "A4", null, "G4", null, "E4", null, "C4", null, "E4", null],
  [null, "C4", null, "G4", null, "E4", null, "C5", "A4", null, "C5", null, "E5", null, "G4", null],
  ["E4", null, "G4", null, "A4", null, "C5", null, "F4", null, "A4", null, "D5", null, "G4", null],
  [null, "G4", null, "C5", null, "E5", null, "G4", "C4", null, "E4", null, "A4", null, "G4", null],
  ["A4", null, "F4", null, "D4", null, "F4", null, "C4", null, "E4", null, "G4", null, "C5", null],
];

const TITLE_CHORDS: ChordShape[] = [
  { bass: "C3", chord: ["C4", "E4", "G4", "C5"] },
  { bass: "G3", chord: ["G3", "B3", "D4", "G4"] },
  { bass: "A3", chord: ["A3", "C4", "E4", "A4"] },
  { bass: "F3", chord: ["F3", "A3", "C4", "F4"] },
  { bass: "D3", chord: ["D3", "F3", "A3", "D4"] },
  { bass: "A3", chord: ["A3", "C4", "E4", "A4"] },
  { bass: "F3", chord: ["F3", "A3", "C4", "F4"] },
  { bass: "G3", chord: ["G3", "B3", "D4", "G4"] },
];

// Track 1: Cozy Meadow
const COZY_MELODY: Array<Array<NoteName | null>> = [
  ["C4", "E4", "G4", "C5", "B4", "G4", "E4", null, "A4", "C5", "B4", "G4", "E4", "D4", "C4", null],
  ["E4", "G4", "A4", "C5", "B4", "A4", "G4", "E4", "F4", "A4", "G4", "E4", "D4", "E4", "C4", null],
  ["G4", "A4", "C5", "D5", "C5", "A4", "G4", "E4", "F4", "G4", "A4", "C5", "B4", "G4", "E4", null],
  ["E4", "G4", "B4", "C5", "D5", "C5", "B4", "G4", "A4", "G4", "E4", "D4", "C4", null, "G4", null],
  ["C5", "D5", "E5", "G5", "E5", "D5", "C5", "A4", "G4", "A4", "C5", "D5", "E5", null, "G5", null],
  ["E5", "G5", "A5", "G5", "E5", "D5", "C5", null, "D5", "E5", "G5", "E5", "D5", "C5", "A4", null],
  ["G4", "C5", "E5", "G5", "A5", "G5", "E5", "D5", "C5", "D5", "E5", "G5", "E5", "C5", "D5", null],
  ["E5", "D5", "C5", "A4", "G4", "E4", "D4", null, "C4", "E4", "G4", "C5", "B4", "G4", "C5", null],
];

const COZY_COUNTER: Array<Array<NoteName | null>> = [
  [null, null, "C4", null, null, "D4", null, null, "E4", null, null, "D4", null, null, "C4", null],
  [null, "C4", null, null, "D4", null, null, "E4", null, "F4", null, null, "E4", null, null, null],
  [null, null, "E4", null, null, "F4", null, "E4", null, null, "D4", null, "E4", null, null, null],
  [null, "D4", null, null, "E4", null, "G4", null, null, "E4", null, "D4", null, null, "C4", null],
  [null, "G4", null, "E4", null, "C4", null, null, "E4", null, "G4", null, "A4", null, null, null],
  ["C4", null, null, "D4", null, "E4", null, null, "G4", null, "E4", null, "D4", null, "C4", null],
  [null, "E4", null, "G4", null, "A4", null, "G4", null, "E4", null, "D4", null, "C4", null, null],
  [null, null, "G4", null, "E4", null, "D4", null, "C4", null, null, "D4", null, "E4", null, null],
];

const COZY_CHORDS: ChordShape[] = [
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

// Track 2: Grasslands Groove
const GROOVE_MELODY: Array<Array<NoteName | null>> = [
  ["E4", null, "G4", "A4", null, "C5", "A4", null, "D5", null, "C5", "A4", "G4", null, "E4", null],
  ["G4", null, "A4", "C5", null, "D5", "E5", null, "D5", null, "C5", "A4", "G4", "E4", "D4", null],
  ["C5", "A4", "G4", "E4", "G4", "A4", "C5", null, "A4", "G4", "E4", "D4", "C4", null, null, null],
  ["E5", null, "D5", "C5", null, "A4", "G4", null, "A4", null, "C5", "D5", "E5", null, "G5", null],
];

const GROOVE_COUNTER: Array<Array<NoteName | null>> = [
  [null, "C4", null, "D4", null, "E4", null, "G4", null, "E4", null, "D4", null, "C4", null, null],
  [null, null, "E4", null, "G4", null, "A4", null, "G4", null, "E4", null, "D4", null, null, null],
  ["C4", null, null, "D4", null, "E4", null, "F4", null, "E4", null, "D4", null, "C4", null, null],
  [null, "G4", null, "A4", null, "C5", null, null, "G4", null, "E4", null, "D4", null, "C4", null],
];

const GROOVE_CHORDS: ChordShape[] = [
  { bass: "C3", chord: ["C4", "E4", "G4", "B4"] },
  { bass: "F3", chord: ["F3", "A3", "C4", "E4"] },
  { bass: "G3", chord: ["G3", "B3", "D4", "F4"] },
  { bass: "A2", chord: ["A3", "C4", "E4", "G4"] },
];

// Track 3: Dreamy Dewdrops
const DREAMY_MELODY: Array<Array<NoteName | null>> = [
  ["G5", null, null, null, "E5", null, null, null, "C5", null, "D5", null, "E5", null, null, null],
  ["A5", null, null, null, "G5", null, null, null, "E5", null, "D5", null, "C5", null, null, null],
  ["C5", null, "D5", null, "E5", null, "G5", null, "A5", null, "G5", null, "E5", null, null, null],
  ["G5", null, "E5", null, "D5", null, "C5", null, "D5", null, "E5", null, "C5", null, null, null],
];

const DREAMY_COUNTER: Array<Array<NoteName | null>> = [
  [null, null, "C4", null, null, null, "E4", null, null, null, "G4", null, null, null, "C4", null],
  [null, null, "E4", null, null, null, "F4", null, null, null, "E4", null, null, null, "D4", null],
  [null, "C4", null, null, "E4", null, null, "G4", null, null, "A4", null, null, "E4", null, null],
  [null, null, "G4", null, null, "E4", null, null, "D4", null, null, "C4", null, null, null, null],
];

const DREAMY_CHORDS: ChordShape[] = [
  { bass: "C3", chord: ["C4", "E4", "G4", "C5"] },
  { bass: "A2", chord: ["A3", "C4", "E4", "A4"] },
  { bass: "F3", chord: ["F3", "A3", "C4", "F4"] },
  { bass: "G3", chord: ["G3", "B3", "D4", "G4"] },
];

// Track 4: Constellation Climb
const CLIMB_MELODY: Array<Array<NoteName | null>> = [
  ["A4", "C5", "E5", "A5", "G5", "E5", "C5", null, "F4", "A4", "C5", "F5", "E5", "C5", "A4", null],
  ["C5", "E5", "G5", "C6", "B5", "G5", "E5", null, "G4", "B4", "D5", "G5", "F5", "D5", "B4", null],
  ["E5", null, "A5", null, "B5", null, "C6", null, "B5", null, "G5", null, "E5", null, null, null],
  ["A5", "G5", "E5", "D5", "C5", "A4", "G4", null, "E4", "G4", "A4", "C5", "B4", "G4", "A4", null],
];

const CLIMB_COUNTER: Array<Array<NoteName | null>> = [
  [null, null, "E4", null, null, null, "A4", null, null, null, "C5", null, null, null, "E4", null],
  [null, null, "G4", null, null, null, "B4", null, null, null, "D5", null, null, null, "G4", null],
  ["A4", null, null, "B4", null, "C5", null, "E5", null, "D5", null, "B4", null, "A4", null, null],
  [null, "E4", null, null, "A4", null, null, "C5", null, null, "B4", null, null, "A4", null, null],
];

const CLIMB_CHORDS: ChordShape[] = [
  { bass: "A2", chord: ["A3", "C4", "E4", "A4"] },
  { bass: "F3", chord: ["F3", "A3", "C4", "F4"] },
  { bass: "C3", chord: ["C4", "E4", "G4", "C5"] },
  { bass: "G3", chord: ["G3", "B3", "D4", "G4"] },
];

// Track 5: Sunlit Sprint
const SPRINT_MELODY: Array<Array<NoteName | null>> = [
  ["C5", null, "E5", "G5", "A5", null, "G5", "E5", "D5", null, "E5", "G5", "C6", null, "A5", null],
  ["G4", "C5", null, "D5", "E5", "G5", null, "E5", "D5", "C5", "A4", null, "G4", null, "C5", null],
  ["E5", null, "G5", "A5", "G5", "E5", "D5", null, "C5", "D5", "E5", null, "G5", "A5", "C6", null],
  ["A5", "G5", "E5", null, "D5", "E5", "G5", null, "E5", "D5", "C5", "A4", "G4", null, "E4", null],
];

const SPRINT_COUNTER: Array<Array<NoteName | null>> = [
  [null, "C4", null, "G4", null, "E4", null, "C4", null, "D4", null, "A4", null, "G4", null, null],
  ["E4", null, "G4", null, "A4", null, "G4", null, "E4", null, "D4", null, "C4", null, null, null],
  [null, "G4", null, "A4", null, "C5", null, "A4", null, "G4", null, "E4", null, "D4", null, null],
  ["C4", null, "E4", null, "G4", null, "A4", null, "G4", null, "E4", null, "D4", null, "C4", null],
];

const SPRINT_CHORDS: ChordShape[] = [
  { bass: "C3", chord: ["C4", "E4", "G4", "C5"] },
  { bass: "D3", chord: ["D3", "F3", "A3", "D4"] },
  { bass: "F3", chord: ["F3", "A3", "C4", "F4"] },
  { bass: "G3", chord: ["G3", "B3", "D4", "G4"] },
  { bass: "A2", chord: ["A3", "C4", "E4", "A4"] },
  { bass: "F3", chord: ["F3", "A3", "C4", "F4"] },
  { bass: "C3", chord: ["C4", "E4", "G4", "C5"] },
  { bass: "G3", chord: ["G3", "B3", "D4", "G4"] },
];

// Track 6: Rain Barrel Run
const RAIN_RUN_MELODY: Array<Array<NoteName | null>> = [
  ["A4", null, "C5", null, "E5", "D5", "C5", null, "G4", null, "A4", "C5", "D5", null, "E5", null],
  ["F4", "A4", null, "C5", "E5", null, "D5", "C5", "B4", null, "G4", "B4", "D5", null, "C5", null],
  ["E5", null, "D5", "C5", "A4", null, "C5", "D5", "E5", null, "G5", null, "A5", "G5", "E5", null],
  ["C5", null, "A4", null, "G4", "A4", "C5", null, "D5", "E5", "G5", null, "E5", "D5", "C5", null],
];

const RAIN_RUN_COUNTER: Array<Array<NoteName | null>> = [
  [null, "E4", null, "A4", null, "C5", null, "A4", null, "E4", null, "G4", null, "A4", null, null],
  ["F4", null, "A4", null, "C5", null, "A4", null, "G4", null, "B4", null, "D5", null, "B4", null],
  [null, "C4", "E4", null, "A4", null, "E4", null, "C4", null, "E4", "G4", null, "E4", null, null],
  ["A3", null, "C4", null, "E4", null, "G4", null, "A4", null, "G4", null, "E4", null, "C4", null],
];

const RAIN_RUN_CHORDS: ChordShape[] = [
  { bass: "A2", chord: ["A3", "C4", "E4", "A4"] },
  { bass: "F3", chord: ["F3", "A3", "C4", "F4"] },
  { bass: "G3", chord: ["G3", "B3", "D4", "G4"] },
  { bass: "E3", chord: ["E3", "G3", "B3", "E4"] },
  { bass: "F3", chord: ["F3", "A3", "C4", "F4"] },
  { bass: "C3", chord: ["C4", "E4", "G4", "C5"] },
  { bass: "D3", chord: ["D3", "F3", "A3", "D4"] },
  { bass: "G3", chord: ["G3", "B3", "D4", "G4"] },
];

export const TRACKS: Record<string, ChiptuneTrack> = {
  [TITLE_TRACK_ID]: {
    id: TITLE_TRACK_ID,
    name: "Title Garden",
    bpm: 118,
    groove: "rain",
    melodyPhrases: TITLE_MELODY,
    counterPhrases: TITLE_COUNTER,
    chords: TITLE_CHORDS,
    waveformLead: "triangle",
    waveformBass: "triangle",
    leadGain: 0.68,
    delayTime: 0.22,
    delayFeedback: 0.17,
    delayReturn: 0.08,
    useFMLead: true,
    fmRatioLead: 2.01,
    fmIndexLead: 2.7,
    useFMBass: true,
    fmRatioBass: 1.5,
    fmIndexBass: 2,
  },
  cozy_meadow: {
    id: "cozy_meadow",
    name: "Cozy Meadow",
    bpm: 138,
    groove: "meadow",
    melodyPhrases: COZY_MELODY,
    counterPhrases: COZY_COUNTER,
    chords: COZY_CHORDS,
    waveformLead: "square",
    waveformBass: "triangle",
    leadGain: 0.82,
    delayTime: 0.18,
    delayFeedback: 0.18,
    delayReturn: 0.09,
    useFMLead: false,
    useFMBass: false,
  },
  grasslands_groove: {
    id: "grasslands_groove",
    name: "Grasslands Groove",
    bpm: 128,
    groove: "groove",
    melodyPhrases: GROOVE_MELODY,
    counterPhrases: GROOVE_COUNTER,
    chords: GROOVE_CHORDS,
    waveformLead: "triangle",
    waveformBass: "triangle",
    leadGain: 0.9,
    delayTime: 0.135,
    delayFeedback: 0.2,
    delayReturn: 0.08,
    useFMLead: true,
    fmRatioLead: 2.01,
    fmIndexLead: 3,
    useFMBass: true,
    fmRatioBass: 1.5,
    fmIndexBass: 4,
  },
  dreamy_dewdrops: {
    id: "dreamy_dewdrops",
    name: "Dreamy Dewdrops",
    bpm: 96,
    groove: "dreamy",
    melodyPhrases: DREAMY_MELODY,
    counterPhrases: DREAMY_COUNTER,
    chords: DREAMY_CHORDS,
    waveformLead: "sine",
    waveformBass: "triangle",
    leadGain: 0.74,
    delayTime: 0.24,
    delayFeedback: 0.24,
    delayReturn: 0.13,
    useFMLead: true,
    fmRatioLead: 3.0,
    fmIndexLead: 6,
    useFMBass: false,
  },
  constellation_climb: {
    id: "constellation_climb",
    name: "Constellation Climb",
    bpm: 144,
    groove: "climb",
    melodyPhrases: CLIMB_MELODY,
    counterPhrases: CLIMB_COUNTER,
    chords: CLIMB_CHORDS,
    waveformLead: "square",
    waveformBass: "triangle",
    leadGain: 0.92,
    delayTime: 0.16,
    delayFeedback: 0.18,
    delayReturn: 0.1,
    useFMLead: true,
    fmRatioLead: 4.0,
    fmIndexLead: 1.8,
    useFMBass: true,
    fmRatioBass: 2.0,
    fmIndexBass: 2.5,
  },
  sunlit_sprint: {
    id: "sunlit_sprint",
    name: "Sunlit Sprint",
    bpm: 156,
    groove: "sprint",
    melodyPhrases: SPRINT_MELODY,
    counterPhrases: SPRINT_COUNTER,
    chords: SPRINT_CHORDS,
    waveformLead: "square",
    waveformBass: "sawtooth",
    leadGain: 0.96,
    delayTime: 0.115,
    delayFeedback: 0.14,
    delayReturn: 0.065,
    useFMLead: true,
    fmRatioLead: 2.5,
    fmIndexLead: 2.2,
    useFMBass: true,
    fmRatioBass: 1.01,
    fmIndexBass: 2.8,
  },
  rain_barrel_run: {
    id: "rain_barrel_run",
    name: "Rain Barrel Run",
    bpm: 118,
    groove: "rain",
    melodyPhrases: RAIN_RUN_MELODY,
    counterPhrases: RAIN_RUN_COUNTER,
    chords: RAIN_RUN_CHORDS,
    waveformLead: "triangle",
    waveformBass: "square",
    leadGain: 0.86,
    delayTime: 0.21,
    delayFeedback: 0.22,
    delayReturn: 0.11,
    useFMLead: true,
    fmRatioLead: 3.01,
    fmIndexLead: 4.2,
    useFMBass: true,
    fmRatioBass: 1.5,
    fmIndexBass: 2.1,
  },
};

export const TRACK_IDS = [
  "grasslands_groove",
  "cozy_meadow",
  "dreamy_dewdrops",
  "constellation_climb",
  "sunlit_sprint",
  "rain_barrel_run",
];

export const DEFAULT_GAME_TRACK_ID = "grasslands_groove";

export class ChiptuneMusicSystem {
  private context?: AudioContext;
  private master?: GainNode;
  private limiter?: DynamicsCompressorNode;
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
  private restartTimer?: number;
  private step = 0;
  private playbackStep = 0;
  private nextStepAt = 0;
  private currentTrackId = DEFAULT_GAME_TRACK_ID;
  private comboLevel = 0;
  private noiseBuffer?: AudioBuffer;
  private noiseBufferSampleRate = 0;

  setVolume(volume: number): void {
    this.volume = Math.max(0, Math.min(1, volume));
    this.muted = this.volume <= 0;

    if (this.master && this.context) {
      this.master.gain.setTargetAtTime(this.getMasterGainTarget(), this.context.currentTime, 0.12);
    }
  }

  setTrack(trackId: string): void {
    if (!TRACKS[trackId]) {
      return;
    }
    const wasPlaying = this.playing;
    if (wasPlaying) {
      this.stop();
    }
    this.currentTrackId = trackId;
    this.step = 0;
    this.playbackStep = 0;
    this.applyTrackMix();
    if (wasPlaying) {
      this.restartTimer = window.setTimeout(() => {
        this.restartTimer = undefined;
        if (this.currentTrackId === trackId && !this.playing) {
          this.start(this.volume);
        }
      }, 180);
    }
  }

  getCurrentTrackId(): string {
    return this.currentTrackId;
  }

  getCurrentTrackName(): string {
    return TRACKS[this.currentTrackId]?.name ?? "Unknown";
  }

  isPlaying(): boolean {
    return this.playing;
  }

  setComboLevel(comboLevel: number): void {
    this.comboLevel = Math.max(0, Math.floor(comboLevel));
  }

  duckForSfx(depth = 0.84, releaseSeconds = 0.18): void {
    if (!this.context || !this.master || !this.playing || this.muted) {
      return;
    }

    const now = this.context.currentTime;
    const target = this.getMasterGainTarget();
    if (target <= 0) {
      return;
    }

    const current = Math.max(0.0001, this.master.gain.value || target);
    this.master.gain.cancelScheduledValues(now);
    this.master.gain.setValueAtTime(current, now);
    this.master.gain.setTargetAtTime(target * Math.max(0.5, Math.min(1, depth)), now, 0.018);
    this.master.gain.setTargetAtTime(target, now + releaseSeconds, 0.1);
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
    this.playbackStep = 0;
    this.nextStepAt = this.context.currentTime + 0.16;
    this.scheduleLoop();
  }

  stop(): void {
    this.playing = false;

    if (this.stepTimer !== undefined) {
      window.clearTimeout(this.stepTimer);
      this.stepTimer = undefined;
    }

    if (this.restartTimer !== undefined) {
      window.clearTimeout(this.restartTimer);
      this.restartTimer = undefined;
    }

    if (this.master && this.context) {
      this.master.gain.setTargetAtTime(0, this.context.currentTime, 0.08);
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
      this.limiter = this.context.createDynamicsCompressor();

      this.master.gain.value = 0;
      this.dryBus.gain.value = 1;
      this.leadBus.gain.value = 0.86;
      this.delay.delayTime.value = 0.155;
      this.delayFeedback.gain.value = 0.16;
      this.delayReturn.gain.value = 0.08;
      this.limiter.threshold.value = -9;
      this.limiter.knee.value = 18;
      this.limiter.ratio.value = 10;
      this.limiter.attack.value = 0.004;
      this.limiter.release.value = 0.18;

      this.dryBus.connect(this.master);
      this.leadBus.connect(this.dryBus);
      this.leadBus.connect(this.delay);
      this.delay.connect(this.delayFeedback);
      this.delayFeedback.connect(this.delay);
      this.delay.connect(this.delayReturn);
      this.delayReturn.connect(this.master);
      this.master.connect(this.limiter);
      this.limiter.connect(this.context.destination);
    }

    this.applyTrackMix();
    this.master?.gain.setTargetAtTime(this.getMasterGainTarget(), this.context.currentTime, 0.12);
    this.unlocked = this.context.state === "running";
  }

  private applyTrackMix(): void {
    if (!this.context) {
      return;
    }

    const track = TRACKS[this.currentTrackId] ?? TRACKS[DEFAULT_GAME_TRACK_ID];
    const now = this.context.currentTime;
    this.leadBus?.gain.setTargetAtTime(track.leadGain ?? 0.86, now, 0.04);
    this.delay?.delayTime.setTargetAtTime(track.delayTime ?? 0.155, now, 0.04);
    this.delayFeedback?.gain.setTargetAtTime(track.delayFeedback ?? 0.16, now, 0.04);
    this.delayReturn?.gain.setTargetAtTime(track.delayReturn ?? 0.08, now, 0.04);
  }

  private getMasterGainTarget(): number {
    if (this.muted) {
      return 0;
    }

    const trackGain = this.currentTrackId === TITLE_TRACK_ID ? TITLE_MASTER_GAIN : GAME_MASTER_GAIN;
    return this.volume * trackGain;
  }

  private scheduleLoop(): void {
    if (!this.context || !this.playing) {
      return;
    }

    const track = TRACKS[this.currentTrackId] ?? TRACKS[DEFAULT_GAME_TRACK_ID];
    const lookaheadSeconds = 0.8;
    const stepSeconds = 60 / track.bpm / 2;

    while (this.nextStepAt < this.context.currentTime + lookaheadSeconds) {
      this.scheduleStep(this.step, this.playbackStep, this.nextStepAt, stepSeconds);
      this.step = (this.step + 1) % 128;
      this.playbackStep += 1;
      this.nextStepAt += stepSeconds;
    }

    this.stepTimer = window.setTimeout(() => this.scheduleLoop(), 90);
  }

  private scheduleStep(songStep: number, playbackStep: number, startAt: number, stepSeconds: number): void {
    const track = TRACKS[this.currentTrackId] ?? TRACKS[DEFAULT_GAME_TRACK_ID];
    const layers = this.getArrangementLayers(playbackStep);
    const phraseIndex = Math.floor(songStep / 16) % track.melodyPhrases.length;
    const localStep = songStep % 16;
    const chord = track.chords[Math.floor(songStep / 8) % track.chords.length];
    const melody = track.melodyPhrases[phraseIndex][localStep];
    const counter = track.counterPhrases[phraseIndex][localStep];
    const sectionIndex = Math.floor(songStep / 32) % 4;
    const swungStart = startAt + this.getSwingOffset(track, localStep, stepSeconds);
    const isLift = phraseIndex >= 4 && phraseIndex <= 6;
    const isTurnaround = phraseIndex === 3 || phraseIndex === 7;

    if (layers.chords && localStep === 0) {
      this.playPad(chord, startAt, stepSeconds, isLift);
    }

    if (layers.chords && songStep % 8 === 0) {
      this.playChord(chord, startAt, stepSeconds, isLift);
    }

    if (layers.bass) {
      for (const event of this.getBassEvents(track, chord, localStep, sectionIndex)) {
        this.playTone({
          frequency: NOTE_FREQUENCIES[event.note] / event.octaveDivisor,
          startAt: swungStart + event.offsetSteps * stepSeconds,
          duration: stepSeconds * event.durationSteps,
          volume: (0.044 + event.accent * 0.016) * layers.intensity,
          waveform: track.waveformBass,
          useFM: track.useFMBass,
          fmRatio: track.fmRatioBass,
          fmIndex: track.fmIndexBass,
          attack: 0.008,
          release: 0.035,
        });
      }
    }

    if (layers.arp && songStep % 2 === 1) {
      const stab = localStep % 8 === 7 ? chord.chord[(sectionIndex + 1) % chord.chord.length] : chord.bass;
      this.playTone({
        frequency: NOTE_FREQUENCIES[stab],
        startAt: swungStart + stepSeconds * 0.05,
        duration: stepSeconds * 0.38,
        volume: (isLift ? 0.024 : 0.018) * layers.intensity,
        waveform: track.waveformBass,
        useFM: track.useFMBass,
        fmRatio: track.fmRatioBass,
        fmIndex: track.fmIndexBass,
        attack: 0.004,
        release: 0.026,
      });
    }

    if (layers.arp && isLift && (localStep === 3 || localStep === 11)) {
      this.playTone({
        frequency: NOTE_FREQUENCIES[chord.chord[2]] / 2,
        startAt: swungStart + stepSeconds * 0.34,
        duration: stepSeconds * 0.54,
        volume: 0.027 * layers.intensity,
        waveform: "square",
        attack: 0.006,
        release: 0.03,
      });
    }

    if (layers.melody && melody) {
      this.playGraceNote(track, chord, melody, swungStart, stepSeconds, localStep, sectionIndex, layers);
      this.playTone({
        frequency: NOTE_FREQUENCIES[melody],
        startAt: swungStart,
        duration: stepSeconds * (localStep % 4 === 3 ? 1.35 : 0.86),
        volume: (isTurnaround && localStep > 10 ? 0.038 : isLift ? 0.055 : 0.048) * layers.intensity,
        waveform: track.waveformLead,
        useFM: track.useFMLead,
        fmRatio: track.fmRatioLead,
        fmIndex: track.fmIndexLead,
        output: this.leadBus,
        attack: 0.012,
        release: 0.045,
      });

      if (layers.flourishes && isLift && localStep % 4 === 2) {
        this.playTone({
          frequency: NOTE_FREQUENCIES[melody] * 2,
          startAt: swungStart + stepSeconds * 0.03,
          duration: stepSeconds * 0.42,
          volume: 0.014 * layers.intensity,
          waveform: "triangle",
          output: this.leadBus,
          attack: 0.008,
          release: 0.035,
        });
      }

      if (layers.harmony && localStep % 4 !== 1) {
        const harmonyNote = chord.chord[(localStep + phraseIndex + 1) % chord.chord.length];
        this.playTone({
          frequency: NOTE_FREQUENCIES[harmonyNote] * (NOTE_FREQUENCIES[harmonyNote] < NOTE_FREQUENCIES[melody] ? 2 : 1),
          startAt: swungStart + stepSeconds * 0.04,
          duration: stepSeconds * 0.54,
          volume: (isLift ? 0.019 : 0.014) * layers.intensity,
          waveform: "triangle",
          output: this.leadBus,
          attack: 0.014,
          release: 0.05,
        });
      }

      if (layers.flourishes && (localStep === 5 || localStep === 13)) {
        this.playLeadEcho(track, melody, swungStart + stepSeconds * 0.46, stepSeconds, layers);
      }
    }

    if (layers.counter && counter && songStep % 4 !== 0) {
      this.playTone({
        frequency: NOTE_FREQUENCIES[counter],
        startAt: swungStart + stepSeconds * 0.12,
        duration: stepSeconds * 0.58,
        volume: (isLift ? 0.027 : 0.022) * layers.intensity,
        waveform: "triangle",
        attack: 0.014,
        release: 0.05,
      });
    }

    if (layers.arp && songStep % 2 === 1) {
      const arpNote = chord.chord[(songStep + phraseIndex) % chord.chord.length];
      this.playTone({
        frequency: NOTE_FREQUENCIES[arpNote] * (phraseIndex === 2 ? 2 : 1),
        startAt: swungStart + stepSeconds * 0.08,
        duration: stepSeconds * 0.36,
        volume: (isLift ? 0.023 : 0.018) * layers.intensity,
        waveform: "square",
        attack: 0.006,
        release: 0.035,
      });
    }

    if (layers.harmony && (localStep === 6 || localStep === 12)) {
      this.playChordStab(track, chord, swungStart + stepSeconds * 0.22, stepSeconds, layers, sectionIndex);
    }

    if (layers.flourishes && localStep === 14 && this.currentTrackId !== "dreamy_dewdrops") {
      this.playFlourish(phraseIndex, startAt + stepSeconds * 0.1, stepSeconds, isLift);
    }

    this.schedulePercussion(songStep, startAt, stepSeconds, isLift, isTurnaround, layers);
  }

  private getSwingOffset(track: ChiptuneTrack, localStep: number, stepSeconds: number): number {
    if (localStep % 2 === 0) {
      return 0;
    }

    switch (track.groove) {
      case "groove":
        return stepSeconds * 0.12;
      case "rain":
        return stepSeconds * 0.16;
      case "sprint":
        return stepSeconds * 0.05;
      case "dreamy":
        return stepSeconds * 0.09;
      default:
        return stepSeconds * 0.07;
    }
  }

  private getBassEvents(track: ChiptuneTrack, chord: ChordShape, localStep: number, sectionIndex: number): BassEvent[] {
    const third = chord.chord[1];
    const fifth = chord.chord[2];
    const top = chord.chord[3];

    switch (track.groove) {
      case "dreamy":
        if (localStep === 0) {
          return [{ note: chord.bass, octaveDivisor: 2, offsetSteps: 0, durationSteps: 3.2, accent: 0.7 }];
        }
        if (localStep === 8) {
          return [{ note: fifth, octaveDivisor: 3, offsetSteps: 0, durationSteps: 2.4, accent: 0.35 }];
        }
        return [];
      case "groove":
        if (localStep % 8 === 0) {
          return [
            { note: chord.bass, octaveDivisor: 2, offsetSteps: 0, durationSteps: 1.15, accent: 1 },
            { note: fifth, octaveDivisor: 3, offsetSteps: 1.5, durationSteps: 0.42, accent: 0.38 },
          ];
        }
        if (localStep % 8 === 3 || localStep % 8 === 6) {
          return [{ note: localStep % 8 === 3 ? third : fifth, octaveDivisor: 2, offsetSteps: 0, durationSteps: 0.72, accent: 0.45 }];
        }
        return [];
      case "sprint":
        if ([0, 2, 4, 6].includes(localStep % 8)) {
          const notes = [chord.bass, fifth, third, sectionIndex % 2 === 0 ? top : fifth];
          return [{ note: notes[(localStep % 8) / 2], octaveDivisor: localStep % 8 === 6 ? 2 : 2.5, offsetSteps: 0, durationSteps: 0.9, accent: localStep % 8 === 0 ? 1 : 0.52 }];
        }
        if (localStep % 8 === 7) {
          return [{ note: third, octaveDivisor: 2, offsetSteps: 0.22, durationSteps: 0.36, accent: 0.25 }];
        }
        return [];
      case "rain":
        if (localStep % 8 === 0) {
          return [{ note: chord.bass, octaveDivisor: 2, offsetSteps: 0, durationSteps: 1.45, accent: 0.85 }];
        }
        if (localStep % 8 === 2 || localStep % 8 === 5) {
          return [{ note: localStep % 8 === 2 ? fifth : third, octaveDivisor: 2, offsetSteps: 0.12, durationSteps: 0.7, accent: 0.36 }];
        }
        return [];
      case "climb":
        if (localStep % 2 === 0) {
          const notes = [chord.bass, third, fifth, top];
          return [{ note: notes[(localStep / 2 + sectionIndex) % notes.length], octaveDivisor: localStep % 8 === 6 ? 1.7 : 2.2, offsetSteps: 0, durationSteps: 0.78, accent: localStep % 8 === 0 ? 0.82 : 0.4 }];
        }
        return [];
      case "meadow":
      default:
        if (localStep % 8 === 0) {
          return [{ note: chord.bass, octaveDivisor: 2, offsetSteps: 0, durationSteps: 1.55, accent: 0.82 }];
        }
        if (localStep % 8 === 4 || (sectionIndex >= 2 && localStep % 8 === 6)) {
          return [{ note: localStep % 8 === 4 ? fifth : third, octaveDivisor: 2, offsetSteps: 0, durationSteps: 0.82, accent: 0.38 }];
        }
        return [];
    }
  }

  private playGraceNote(
    track: ChiptuneTrack,
    chord: ChordShape,
    melody: NoteName,
    startAt: number,
    stepSeconds: number,
    localStep: number,
    sectionIndex: number,
    layers: ArrangementLayers,
  ): void {
    if (track.groove === "dreamy" || localStep % 4 === 0 || (track.groove !== "sprint" && sectionIndex < 2)) {
      return;
    }

    const note = chord.chord[(localStep + sectionIndex) % chord.chord.length];
    const frequency = NOTE_FREQUENCIES[note] < NOTE_FREQUENCIES[melody] ? NOTE_FREQUENCIES[note] * 2 : NOTE_FREQUENCIES[note];
    this.playTone({
      frequency,
      startAt: Math.max(0, startAt - stepSeconds * 0.18),
      duration: stepSeconds * 0.2,
      volume: 0.012 * layers.intensity,
      waveform: track.waveformLead,
      output: this.leadBus,
      attack: 0.003,
      release: 0.018,
    });
  }

  private playLeadEcho(track: ChiptuneTrack, melody: NoteName, startAt: number, stepSeconds: number, layers: ArrangementLayers): void {
    this.playTone({
      frequency: NOTE_FREQUENCIES[melody] / (track.groove === "sprint" ? 1 : 2),
      startAt,
      duration: stepSeconds * 0.36,
      volume: 0.012 * layers.intensity,
      waveform: track.groove === "rain" ? "sine" : "triangle",
      output: this.leadBus,
      attack: 0.01,
      release: 0.05,
    });
  }

  private playChordStab(
    track: ChiptuneTrack,
    chord: ChordShape,
    startAt: number,
    stepSeconds: number,
    layers: ArrangementLayers,
    sectionIndex: number,
  ): void {
    for (const [index, note] of chord.chord.entries()) {
      if (index === 0 && sectionIndex % 2 === 0) {
        continue;
      }

      this.playTone({
        frequency: NOTE_FREQUENCIES[note],
        startAt: startAt + index * 0.01,
        duration: stepSeconds * 0.42,
        volume: 0.0075 * layers.intensity,
        waveform: track.groove === "sprint" ? "square" : "triangle",
        attack: 0.004,
        release: 0.045,
      });
    }
  }

  private getArrangementLayers(playbackStep = this.playbackStep): ArrangementLayers {
    if (this.currentTrackId === TITLE_TRACK_ID) {
      const introStep = playbackStep;
      return {
        bass: true,
        chords: true,
        drums: introStep >= 16,
        hats: introStep >= 32,
        counter: introStep >= 8,
        arp: introStep >= 16,
        harmony: introStep >= 24,
        melody: true,
        flourishes: introStep >= 48,
        intensity: 0.72 + Math.min(introStep, 48) / 48 * 0.2,
      };
    }

    const combo = this.comboLevel;
    const introScale = 0.72 + Math.min(playbackStep, 32) / 32 * 0.28;
    return {
      bass: true,
      chords: true,
      drums: combo >= 3 && playbackStep >= 8,
      hats: combo >= 7 && playbackStep >= 16,
      counter: combo >= 6 && playbackStep >= 8,
      arp: combo >= 8 && playbackStep >= 16,
      harmony: combo >= 14 && playbackStep >= 24,
      melody: true,
      flourishes: combo >= 24 && playbackStep >= 32,
      intensity: (0.86 + Math.min(combo, 40) / 40 * 0.3) * introScale,
    };
  }

  private playChord(chord: ChordShape, startAt: number, stepSeconds: number, isLift: boolean): void {
    const track = TRACKS[this.currentTrackId] ?? TRACKS[DEFAULT_GAME_TRACK_ID];
    for (const [index, note] of chord.chord.entries()) {
      this.playTone({
        frequency: NOTE_FREQUENCIES[note],
        startAt: startAt + index * 0.012,
        duration: stepSeconds * (isLift ? 2.75 : 2.35),
        volume: isLift ? 0.015 : 0.012,
        waveform: "triangle",
        useFM: track.useFMLead,
        fmRatio: track.fmRatioLead,
        fmIndex: track.fmIndexLead ? track.fmIndexLead * 0.5 : undefined,
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

  private schedulePercussion(
    songStep: number,
    startAt: number,
    stepSeconds: number,
    isLift: boolean,
    isTurnaround: boolean,
    layers: ArrangementLayers,
  ): void {
    const track = TRACKS[this.currentTrackId] ?? TRACKS[DEFAULT_GAME_TRACK_ID];
    const barStep = songStep % 8;
    const localStep = songStep % 16;

    if (!layers.drums) {
      return;
    }

    if (track.groove === "dreamy") {
      if (barStep === 0) {
        this.playKick(startAt, 0.46 * layers.intensity);
      }
      if (layers.hats && songStep % 4 === 2) {
        this.playNoise(startAt + stepSeconds * 0.05, 0.03, 0.006 * layers.intensity, 4500, "highpass");
      }
      if (layers.harmony && localStep === 14) {
        this.playNoise(startAt + stepSeconds * 0.18, 0.12, 0.012 * layers.intensity, 1800, "bandpass");
      }
      return;
    }

    if (songStep % 2 === 0 || (track.groove === "sprint" && barStep === 7)) {
      this.playKick(startAt, (barStep === 0 ? 1 : track.groove === "sprint" ? 0.7 : 0.84) * layers.intensity);
    }

    if (barStep === 2 || barStep === 6 || (track.groove === "rain" && barStep === 5)) {
      this.playSnare(startAt + stepSeconds * 0.02, isLift);
    }

    if (track.groove === "groove" && (barStep === 3 || barStep === 7)) {
      this.playRim(startAt + stepSeconds * 0.18, 0.42 * layers.intensity);
    }

    if (track.groove === "sprint" && (barStep === 1 || barStep === 5)) {
      this.playRim(startAt + stepSeconds * 0.08, 0.35 * layers.intensity);
    }

    if (barStep === 4 || (isLift && songStep % 16 === 12)) {
      this.playNoise(startAt + stepSeconds * 0.04, 0.07, isLift ? 0.02 : 0.014, 1250, "bandpass");
    }

    if (layers.hats && songStep % 2 === 1) {
      this.playOpenHat(startAt + stepSeconds * 0.04, isLift);
      if (track.groove === "rain") {
        this.playNoise(startAt + stepSeconds * 0.34, 0.018, 0.0055 * layers.intensity, 6200, "highpass");
      }
    } else if (layers.hats && barStep !== 0) {
      this.playNoise(startAt + stepSeconds * 0.06, 0.018, 0.005, 5200, "highpass");
    }

    if (layers.hats && track.groove === "sprint" && (localStep === 11 || localStep === 15)) {
      this.playNoise(startAt + stepSeconds * 0.32, 0.018, 0.007 * layers.intensity, 7400, "highpass");
      this.playNoise(startAt + stepSeconds * 0.56, 0.018, 0.006 * layers.intensity, 7600, "highpass");
    }

    if (layers.harmony && track.groove === "climb" && localStep === 15) {
      this.playRim(startAt, 0.38 * layers.intensity);
      this.playRim(startAt + stepSeconds * 0.34, 0.3 * layers.intensity);
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
    const peakAt = options.startAt + attack;
    const releaseAt = Math.max(peakAt + 0.001, options.startAt + options.duration - release);
    const endAt = options.startAt + options.duration;

    const carrier = this.context.createOscillator();
    const gain = this.context.createGain();
    const filter = this.context.createBiquadFilter();

    carrier.type = options.waveform;
    carrier.frequency.setValueAtTime(options.frequency, options.startAt);
    carrier.detune.setValueAtTime(options.detune ?? 0, options.startAt);

    let modulator: OscillatorNode | undefined;
    let modGain: GainNode | undefined;

    if (options.useFM) {
      modulator = this.context.createOscillator();
      modGain = this.context.createGain();

      const ratio = options.fmRatio ?? 2;
      const index = options.fmIndex ?? 3;

      modulator.frequency.setValueAtTime(options.frequency * ratio, options.startAt);
      modGain.gain.setValueAtTime(options.frequency * index, options.startAt);
      // Exponential decay of FM modulation index over tone duration
      modGain.gain.exponentialRampToValueAtTime(options.frequency * index * 0.1 || 0.0001, endAt);

      modulator.connect(modGain);
      modGain.connect(carrier.frequency);
    }

    filter.type = "lowpass";
    filter.frequency.setValueAtTime(options.waveform === "square" ? 2200 : 1800, options.startAt);

    gain.gain.setValueAtTime(0.0001, options.startAt);
    gain.gain.exponentialRampToValueAtTime(options.volume, peakAt);
    gain.gain.setValueAtTime(options.volume, releaseAt);
    gain.gain.exponentialRampToValueAtTime(0.0001, endAt);

    carrier.connect(filter);
    filter.connect(gain);
    gain.connect(output);

    carrier.start(options.startAt);
    carrier.stop(endAt + 0.03);

    if (modulator) {
      modulator.start(options.startAt);
      modulator.stop(endAt + 0.03);
    }
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

  private playRim(startAt: number, accent = 1): void {
    this.playTone({
      frequency: 820,
      startAt,
      duration: 0.045,
      volume: 0.012 * accent,
      waveform: "square",
      attack: 0.002,
      release: 0.026,
    });
  }

  private playOpenHat(startAt: number, isLift: boolean): void {
    this.playNoise(startAt, isLift ? 0.052 : 0.044, isLift ? 0.016 : 0.012, 7000, "highpass");
  }

  private playNoise(startAt: number, duration: number, volume: number, frequency: number, filterType: BiquadFilterType): void {
    if (!this.context || !this.dryBus) {
      return;
    }

    const source = this.context.createBufferSource();
    const filter = this.context.createBiquadFilter();
    const gain = this.context.createGain();

    source.buffer = this.getNoiseBuffer();
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
}
