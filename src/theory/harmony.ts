// Roman numerals, common progressions, cadences and backing-track chord sets.

export type Tonality = "major" | "minor";

export interface NumeralDef {
  id: string;
  /** Root as a degree of the key, e.g. "b7". */
  root: string;
  /** Chord ids from catalog.ts. */
  triad: string;
  seventh: string;
  /** Not in the key: borrowed or secondary chords. */
  chromatic?: boolean;
  hint?: string;
}

export const NUMERALS: Record<Tonality, NumeralDef[]> = {
  major: [
    { id: "I", root: "1", triad: "maj", seventh: "maj7" },
    { id: "ii", root: "2", triad: "min", seventh: "min7" },
    { id: "iii", root: "3", triad: "min", seventh: "min7" },
    { id: "IV", root: "4", triad: "maj", seventh: "maj7" },
    { id: "V", root: "5", triad: "maj", seventh: "dom7" },
    { id: "vi", root: "6", triad: "min", seventh: "min7" },
    { id: "vii°", root: "7", triad: "dim", seventh: "m7b5" },
    { id: "II", root: "2", triad: "maj", seventh: "dom7", chromatic: true, hint: "V of V" },
    { id: "III", root: "3", triad: "maj", seventh: "dom7", chromatic: true, hint: "V of vi" },
    { id: "VI", root: "6", triad: "maj", seventh: "dom7", chromatic: true, hint: "V of ii" },
    { id: "iv", root: "4", triad: "min", seventh: "min7", chromatic: true, hint: "borrowed" },
    { id: "♭VII", root: "b7", triad: "maj", seventh: "dom7", chromatic: true, hint: "borrowed" },
    { id: "♭VI", root: "b6", triad: "maj", seventh: "maj7", chromatic: true, hint: "borrowed" },
    { id: "♭III", root: "b3", triad: "maj", seventh: "maj7", chromatic: true, hint: "borrowed" },
    { id: "♭II", root: "b2", triad: "maj", seventh: "maj7", chromatic: true, hint: "Neapolitan" },
  ],
  minor: [
    { id: "i", root: "1", triad: "min", seventh: "min7" },
    { id: "ii°", root: "2", triad: "dim", seventh: "m7b5" },
    { id: "III", root: "b3", triad: "maj", seventh: "maj7" },
    { id: "iv", root: "4", triad: "min", seventh: "min7" },
    { id: "v", root: "5", triad: "min", seventh: "min7" },
    { id: "V", root: "5", triad: "maj", seventh: "dom7" },
    { id: "VI", root: "b6", triad: "maj", seventh: "maj7" },
    { id: "VII", root: "b7", triad: "maj", seventh: "dom7" },
    { id: "vii°", root: "7", triad: "dim", seventh: "dim7" },
    { id: "IV", root: "4", triad: "maj", seventh: "dom7", chromatic: true, hint: "Dorian" },
    { id: "♭II", root: "b2", triad: "maj", seventh: "maj7", chromatic: true, hint: "Neapolitan" },
  ],
};

export const TONIC: Record<Tonality, string> = { major: "I", minor: "i" };

/** Common progressions, all starting on the tonic. */
export const COMMON_PROGRESSIONS: Record<Tonality, string[][]> = {
  major: [
    ["I", "IV", "V", "I"],
    ["I", "vi", "IV", "V"],
    ["I", "V", "vi", "IV"],
    ["I", "ii", "V", "I"],
    ["I", "vi", "ii", "V"],
    ["I", "IV", "I", "V"],
    ["I", "iii", "IV", "V"],
    ["I", "IV", "vi", "V"],
    ["I", "V", "IV", "I"],
    ["I", "iii", "vi", "IV"],
    ["I", "♭VII", "IV", "I"],
    ["I", "II", "V", "I"],
    ["I", "IV", "iv", "I"],
    ["I", "♭VI", "♭VII", "I"],
    ["I", "VI", "ii", "V"],
    ["I", "III", "vi", "IV"],
    ["I", "vii°", "iii", "vi"],
    ["I", "IV", "vii°", "iii", "vi", "ii", "V", "I"],
    ["I", "vi", "IV", "V", "I"],
    ["I", "♭III", "IV", "I"],
    ["I", "♭II", "V", "I"],
  ],
  minor: [
    ["i", "iv", "V", "i"],
    ["i", "VI", "III", "VII"],
    ["i", "VII", "VI", "V"],
    ["i", "iv", "VII", "III"],
    ["i", "ii°", "V", "i"],
    ["i", "VI", "iv", "V"],
    ["i", "v", "iv", "i"],
    ["i", "III", "VII", "iv"],
    ["i", "VI", "VII", "i"],
    ["i", "IV", "i", "IV"],
    ["i", "iv", "VII", "III", "VI", "ii°", "V", "i"],
    ["i", "♭II", "V", "i"],
    ["i", "vii°", "i", "V"],
  ],
};

export interface CadenceDef {
  id: string;
  name: string;
  sub: string;
  /** Final two chords, by tonality. */
  end: Record<Tonality, [string, string]>;
}

export const CADENCES: CadenceDef[] = [
  { id: "authentic", name: "Authentic", sub: "V → I", end: { major: ["V", "I"], minor: ["V", "i"] } },
  { id: "plagal", name: "Plagal", sub: "IV → I", end: { major: ["IV", "I"], minor: ["iv", "i"] } },
  { id: "half", name: "Half", sub: "… → V", end: { major: ["ii", "V"], minor: ["iv", "V"] } },
  { id: "deceptive", name: "Deceptive", sub: "V → vi", end: { major: ["V", "vi"], minor: ["V", "VI"] } },
];

/** Opening chords before the cadence, so the key is clear first. */
export const CADENCE_OPENINGS: Record<Tonality, string[][]> = {
  major: [
    ["I", "vi"],
    ["I", "IV"],
    ["I", "iii"],
    ["I", "ii"],
  ],
  minor: [
    ["i", "VI"],
    ["i", "iv"],
    ["i", "III"],
  ],
};

// ---------------------------------------------------------------------------
// Chord-tone backing tracks: 4-bar loops with chord symbols.

export interface BackingSet {
  id: string;
  name: string;
  tonality: Tonality;
  /** Chords as [root degree of key, chord id]. */
  chords: [string, string][];
}

export const BACKING_SETS: BackingSet[] = [
  { id: "ii-V-I", name: "ii–V–I", tonality: "major", chords: [["2", "min7"], ["5", "dom7"], ["1", "maj7"], ["1", "maj7"]] },
  { id: "I-vi-ii-V", name: "I–vi–ii–V", tonality: "major", chords: [["1", "maj7"], ["6", "min7"], ["2", "min7"], ["5", "dom7"]] },
  { id: "minor-ii-V-i", name: "Minor ii–V–i", tonality: "minor", chords: [["2", "m7b5"], ["5", "dom7"], ["1", "min7"], ["1", "min7"]] },
  { id: "blues", name: "Blues turnaround", tonality: "major", chords: [["1", "dom7"], ["4", "dom7"], ["1", "dom7"], ["5", "dom7"]] },
  { id: "pop", name: "Pop I–V–vi–IV", tonality: "major", chords: [["1", "maj"], ["5", "maj"], ["6", "min"], ["4", "maj"]] },
  { id: "dorian", name: "Dorian vamp", tonality: "minor", chords: [["1", "min7"], ["4", "dom7"], ["1", "min7"], ["4", "dom7"]] },
  { id: "rhythm", name: "Rhythm-changes turnaround", tonality: "major", chords: [["1", "maj7"], ["6", "dom7"], ["2", "min7"], ["5", "dom7"]] },
];

export const CHORD_TONES: { id: string; name: string }[] = [
  { id: "1", name: "Root" },
  { id: "3", name: "3rd" },
  { id: "5", name: "5th" },
  { id: "7", name: "7th" },
  { id: "9", name: "9th" },
  { id: "11", name: "11th" },
  { id: "13", name: "13th" },
];

/** Functional degrees offered as answers, with descriptive names. */
export const FUNCTIONAL_DEGREES: { id: string; name: string }[] = [
  { id: "1", name: "Tonic" },
  { id: "b2", name: "" },
  { id: "2", name: "Supertonic" },
  { id: "b3", name: "" },
  { id: "3", name: "Mediant" },
  { id: "4", name: "Subdominant" },
  { id: "#4", name: "" },
  { id: "5", name: "Dominant" },
  { id: "b6", name: "" },
  { id: "6", name: "Submediant" },
  { id: "b7", name: "" },
  { id: "7", name: "Leading tone" },
];
