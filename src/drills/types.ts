import type { SpelledNote } from "../theory/notes";

export type DrillId = "intervals" | "chords" | "scales" | "pitch";

export interface Choice {
  id: string;
  label: string;
  sub?: string;
}

/** One thing to identify. Chords can have two parts: quality, then inversion. */
export interface QuestionPart {
  /** Stable key used for stats, e.g. "quality" or "inversion". */
  key: string;
  prompt: string;
  choices: Choice[];
  answer: string;
}

/** A group of notes starting together. */
export interface PlayEvent {
  midi: number[];
  /** Start time in seconds from the start of the question. */
  at: number;
  /** Length in seconds. */
  dur: number;
  /** 0–127, default 80. */
  velocity?: number;
  /** Detune in cents (tuning drills). */
  detune?: number;
}

export interface QuestionNote {
  midi: number;
  spelled: SpelledNote;
  /** Degree relative to the question root, e.g. "b3". */
  degree: string;
}

/**
 * How the piano can be used to answer part 0.
 * - "interval": the `given` note is shown; play the one other note.
 * - "set": the root is shown; play every note (any octave), then check.
 * - "single": play one note (any octave).
 */
export interface PianoTask {
  mode: "interval" | "set" | "single";
  given: number[];
  instruction: string;
  /** For "interval": whether the answer note is above or below the given note. */
  direction?: "up" | "down";
  /** Keys to show: lowest and highest MIDI note (both Cs). */
  range: [number, number];
}

export interface Question {
  drill: DrillId;
  /** Unique per question, used as React key. */
  uid: string;
  parts: QuestionPart[];
  events: PlayEvent[];
  notes: QuestionNote[];
  root: { midi: number; spelled: SpelledNote };
  /** Full description revealed after answering, e.g. "E♭ major 7, 1st inversion". */
  reveal: string;
  piano?: PianoTask;
  /** Played before the question: a reference note, cadence or count-in. */
  lead?: PlayEvent[];
  /** Played underneath the question, starting with it (e.g. a drone). */
  under?: PlayEvent[];
  /** Extra facts the UI can use, e.g. interval direction for song references. */
  meta?: { direction?: "asc" | "desc" | "harm" };
}

export interface IntervalConfig {
  enabled: string[];
  directions: ("asc" | "desc" | "harm")[];
}

export interface ChordConfig {
  enabled: string[];
  inversions: number[];
  playback: ("block" | "arp")[];
  askInversion: boolean;
}

export interface ScaleConfig {
  enabled: string[];
  directions: ("asc" | "desc" | "both")[];
}

export interface PitchConfig {
  /** Pitch classes relative to the reference (0 = same note). */
  enabled: number[];
  /** Play a reference C before each note. Off = absolute pitch practice. */
  reference: boolean;
  /** Spread notes over this many octaves. */
  octaves: number;
}

export interface DrillConfigs {
  intervals: IntervalConfig;
  chords: ChordConfig;
  scales: ScaleConfig;
  pitch: PitchConfig;
}
