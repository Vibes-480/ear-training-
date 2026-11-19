// The vocabulary the drills draw from: intervals, chords and scales.
// Everything is defined as scale degrees so notes can be spelled correctly in any key.

export interface IntervalDef {
  id: string;
  short: string;
  name: string;
  /** Degree of the upper note relative to the lower one. */
  degree: string;
  semitones: number;
  compound?: boolean;
}

export const INTERVALS: IntervalDef[] = [
  { id: "m2", short: "m2", name: "Minor 2nd", degree: "b2", semitones: 1 },
  { id: "M2", short: "M2", name: "Major 2nd", degree: "2", semitones: 2 },
  { id: "m3", short: "m3", name: "Minor 3rd", degree: "b3", semitones: 3 },
  { id: "M3", short: "M3", name: "Major 3rd", degree: "3", semitones: 4 },
  { id: "P4", short: "P4", name: "Perfect 4th", degree: "4", semitones: 5 },
  { id: "TT", short: "TT", name: "Tritone", degree: "#4", semitones: 6 },
  { id: "P5", short: "P5", name: "Perfect 5th", degree: "5", semitones: 7 },
  { id: "m6", short: "m6", name: "Minor 6th", degree: "b6", semitones: 8 },
  { id: "M6", short: "M6", name: "Major 6th", degree: "6", semitones: 9 },
  { id: "m7", short: "m7", name: "Minor 7th", degree: "b7", semitones: 10 },
  { id: "M7", short: "M7", name: "Major 7th", degree: "7", semitones: 11 },
  { id: "P8", short: "P8", name: "Octave", degree: "8", semitones: 12 },
  { id: "m9", short: "m9", name: "Minor 9th", degree: "b9", semitones: 13, compound: true },
  { id: "M9", short: "M9", name: "Major 9th", degree: "9", semitones: 14, compound: true },
  { id: "m10", short: "m10", name: "Minor 10th", degree: "b10", semitones: 15, compound: true },
  { id: "M10", short: "M10", name: "Major 10th", degree: "10", semitones: 16, compound: true },
  { id: "P11", short: "P11", name: "Perfect 11th", degree: "11", semitones: 17, compound: true },
  { id: "A11", short: "♯11", name: "Augmented 11th", degree: "#11", semitones: 18, compound: true },
  { id: "P12", short: "P12", name: "Perfect 12th", degree: "12", semitones: 19, compound: true },
  { id: "m13", short: "m13", name: "Minor 13th", degree: "b13", semitones: 20, compound: true },
  { id: "M13", short: "M13", name: "Major 13th", degree: "13", semitones: 21, compound: true },
];

export type ChordGroup = "triad" | "seventh" | "extended";

export interface ChordDef {
  id: string;
  /** Symbol suffix shown after the root, e.g. "m7♭5". */
  symbol: string;
  name: string;
  degrees: string[];
  group: ChordGroup;
}

export const CHORDS: ChordDef[] = [
  { id: "maj", symbol: "", name: "Major", degrees: ["1", "3", "5"], group: "triad" },
  { id: "min", symbol: "m", name: "Minor", degrees: ["1", "b3", "5"], group: "triad" },
  { id: "dim", symbol: "°", name: "Diminished", degrees: ["1", "b3", "b5"], group: "triad" },
  { id: "aug", symbol: "+", name: "Augmented", degrees: ["1", "3", "#5"], group: "triad" },
  { id: "sus2", symbol: "sus2", name: "Sus 2", degrees: ["1", "2", "5"], group: "triad" },
  { id: "sus4", symbol: "sus4", name: "Sus 4", degrees: ["1", "4", "5"], group: "triad" },
  { id: "maj7", symbol: "maj7", name: "Major 7", degrees: ["1", "3", "5", "7"], group: "seventh" },
  { id: "dom7", symbol: "7", name: "Dominant 7", degrees: ["1", "3", "5", "b7"], group: "seventh" },
  { id: "min7", symbol: "m7", name: "Minor 7", degrees: ["1", "b3", "5", "b7"], group: "seventh" },
  { id: "m7b5", symbol: "m7♭5", name: "Half-diminished", degrees: ["1", "b3", "b5", "b7"], group: "seventh" },
  { id: "dim7", symbol: "°7", name: "Diminished 7", degrees: ["1", "b3", "b5", "bb7"], group: "seventh" },
  { id: "mMaj7", symbol: "m(maj7)", name: "Minor-major 7", degrees: ["1", "b3", "5", "7"], group: "seventh" },
  { id: "aug7", symbol: "+7", name: "Augmented 7", degrees: ["1", "3", "#5", "b7"], group: "seventh" },
  { id: "6", symbol: "6", name: "Major 6", degrees: ["1", "3", "5", "6"], group: "seventh" },
  { id: "m6", symbol: "m6", name: "Minor 6", degrees: ["1", "b3", "5", "6"], group: "seventh" },
  { id: "7sus4", symbol: "7sus4", name: "Dominant 7 sus4", degrees: ["1", "4", "5", "b7"], group: "seventh" },
  { id: "maj9", symbol: "maj9", name: "Major 9", degrees: ["1", "3", "5", "7", "9"], group: "extended" },
  { id: "dom9", symbol: "9", name: "Dominant 9", degrees: ["1", "3", "5", "b7", "9"], group: "extended" },
  { id: "min9", symbol: "m9", name: "Minor 9", degrees: ["1", "b3", "5", "b7", "9"], group: "extended" },
  { id: "7b9", symbol: "7♭9", name: "Dominant 7♭9", degrees: ["1", "3", "5", "b7", "b9"], group: "extended" },
  { id: "7s9", symbol: "7♯9", name: "Dominant 7♯9", degrees: ["1", "3", "5", "b7", "#9"], group: "extended" },
  { id: "maj7s11", symbol: "maj7♯11", name: "Lydian major 7", degrees: ["1", "3", "5", "7", "#11"], group: "extended" },
  { id: "dom13", symbol: "13", name: "Dominant 13", degrees: ["1", "3", "b7", "9", "13"], group: "extended" },
  { id: "min11", symbol: "m11", name: "Minor 11", degrees: ["1", "b3", "b7", "9", "11"], group: "extended" },
];

export type ScaleGroup = "diatonic" | "minor" | "symmetric" | "pentatonic";

export interface ScaleDef {
  id: string;
  name: string;
  degrees: string[];
  group: ScaleGroup;
}

export const SCALES: ScaleDef[] = [
  { id: "ionian", name: "Major (Ionian)", degrees: ["1", "2", "3", "4", "5", "6", "7"], group: "diatonic" },
  { id: "dorian", name: "Dorian", degrees: ["1", "2", "b3", "4", "5", "6", "b7"], group: "diatonic" },
  { id: "phrygian", name: "Phrygian", degrees: ["1", "b2", "b3", "4", "5", "b6", "b7"], group: "diatonic" },
  { id: "lydian", name: "Lydian", degrees: ["1", "2", "3", "#4", "5", "6", "7"], group: "diatonic" },
  { id: "mixolydian", name: "Mixolydian", degrees: ["1", "2", "3", "4", "5", "6", "b7"], group: "diatonic" },
  { id: "aeolian", name: "Natural minor (Aeolian)", degrees: ["1", "2", "b3", "4", "5", "b6", "b7"], group: "diatonic" },
  { id: "locrian", name: "Locrian", degrees: ["1", "b2", "b3", "4", "b5", "b6", "b7"], group: "diatonic" },
  { id: "harmMinor", name: "Harmonic minor", degrees: ["1", "2", "b3", "4", "5", "b6", "7"], group: "minor" },
  { id: "melMinor", name: "Melodic minor", degrees: ["1", "2", "b3", "4", "5", "6", "7"], group: "minor" },
  { id: "phrygDom", name: "Phrygian dominant", degrees: ["1", "b2", "3", "4", "5", "b6", "b7"], group: "minor" },
  { id: "lydDom", name: "Lydian dominant", degrees: ["1", "2", "3", "#4", "5", "6", "b7"], group: "minor" },
  { id: "altered", name: "Altered", degrees: ["1", "b2", "b3", "b4", "b5", "b6", "b7"], group: "minor" },
  { id: "wholeTone", name: "Whole tone", degrees: ["1", "2", "3", "#4", "#5", "b7"], group: "symmetric" },
  { id: "dimHW", name: "Diminished (half-whole)", degrees: ["1", "b2", "b3", "3", "#4", "5", "6", "b7"], group: "symmetric" },
  { id: "dimWH", name: "Diminished (whole-half)", degrees: ["1", "2", "b3", "4", "b5", "b6", "6", "7"], group: "symmetric" },
  { id: "majPent", name: "Major pentatonic", degrees: ["1", "2", "3", "5", "6"], group: "pentatonic" },
  { id: "minPent", name: "Minor pentatonic", degrees: ["1", "b3", "4", "5", "b7"], group: "pentatonic" },
  { id: "blues", name: "Blues", degrees: ["1", "b3", "4", "b5", "5", "b7"], group: "pentatonic" },
];

export const INVERSION_NAMES = ["Root position", "1st inversion", "2nd inversion", "3rd inversion", "4th inversion"];
