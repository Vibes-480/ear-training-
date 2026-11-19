// Note names, MIDI numbers and correct enharmonic spelling.

export const LETTERS = ["C", "D", "E", "F", "G", "A", "B"] as const;
export type Letter = (typeof LETTERS)[number];

/** Pitch class of each natural letter. */
const LETTER_PC: Record<Letter, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };

/** A spelled note without an octave, e.g. { letter: "E", acc: -1 } = E♭. */
export interface SpelledNote {
  letter: Letter;
  /** Accidental in semitones: -2 = 𝄫, -1 = ♭, 0 = natural, 1 = ♯, 2 = 𝄪. */
  acc: number;
}

/** Roots we pick for questions: the 12 keys spelled the way musicians usually write them. */
export const COMMON_ROOTS: SpelledNote[] = [
  { letter: "C", acc: 0 },
  { letter: "D", acc: -1 },
  { letter: "D", acc: 0 },
  { letter: "E", acc: -1 },
  { letter: "E", acc: 0 },
  { letter: "F", acc: 0 },
  { letter: "F", acc: 1 },
  { letter: "G", acc: 0 },
  { letter: "A", acc: -1 },
  { letter: "A", acc: 0 },
  { letter: "B", acc: -1 },
  { letter: "B", acc: 0 },
];

export function pitchClass(n: SpelledNote): number {
  return (((LETTER_PC[n.letter] + n.acc) % 12) + 12) % 12;
}

const ACC_SYMBOL: Record<number, string> = { [-2]: "𝄫", [-1]: "♭", 0: "", 1: "♯", 2: "𝄪" };

export function accidentalSymbol(acc: number): string {
  return ACC_SYMBOL[acc] ?? (acc > 0 ? "♯".repeat(acc) : "♭".repeat(-acc));
}

export function spelledName(n: SpelledNote): string {
  return n.letter + accidentalSymbol(n.acc);
}

/** Spelled name with octave for a given MIDI number, e.g. "E♭4". */
export function spelledNameWithOctave(n: SpelledNote, midi: number): string {
  // Octave follows the letter, not the sounding pitch (B♯3 sounds like C4).
  const octave = Math.floor((midi - n.acc) / 12) - 1;
  return spelledName(n) + octave;
}

/** Default spelling for a MIDI number when no key context exists. */
export function defaultSpelling(midi: number, preferFlats = true): SpelledNote {
  const pc = ((midi % 12) + 12) % 12;
  const sharp: SpelledNote[] = [
    { letter: "C", acc: 0 }, { letter: "C", acc: 1 }, { letter: "D", acc: 0 }, { letter: "D", acc: 1 },
    { letter: "E", acc: 0 }, { letter: "F", acc: 0 }, { letter: "F", acc: 1 }, { letter: "G", acc: 0 },
    { letter: "G", acc: 1 }, { letter: "A", acc: 0 }, { letter: "A", acc: 1 }, { letter: "B", acc: 0 },
  ];
  const flat: SpelledNote[] = [
    { letter: "C", acc: 0 }, { letter: "D", acc: -1 }, { letter: "D", acc: 0 }, { letter: "E", acc: -1 },
    { letter: "E", acc: 0 }, { letter: "F", acc: 0 }, { letter: "G", acc: -1 }, { letter: "G", acc: 0 },
    { letter: "A", acc: -1 }, { letter: "A", acc: 0 }, { letter: "B", acc: -1 }, { letter: "B", acc: 0 },
  ];
  return (preferFlats ? flat : sharp)[pc];
}

export function midiName(midi: number, preferFlats = true): string {
  return spelledNameWithOctave(defaultSpelling(midi, preferFlats), midi);
}

/** MIDI number of a spelled note placed in the octave starting at `octave` (C4 = 60). */
export function midiOf(n: SpelledNote, octave: number): number {
  return (octave + 1) * 12 + LETTER_PC[n.letter] + n.acc;
}

// ---------------------------------------------------------------------------
// Scale degrees: "1", "b3", "#4", "b7", "9", "#11", "13", "bb7" ...

const MAJOR_STEPS = [0, 2, 4, 5, 7, 9, 11];

export interface Degree {
  /** 1-based degree number, can exceed 7 (9, 11, 13). */
  number: number;
  /** Alteration in semitones relative to the major scale. */
  alt: number;
}

export function parseDegree(d: string): Degree {
  const m = /^(b{1,2}|#{1,2})?(\d+)$/.exec(d);
  if (!m) throw new Error(`Bad degree: ${d}`);
  const prefix = m[1] ?? "";
  const alt = prefix.startsWith("b") ? -prefix.length : prefix.length;
  return { number: Number(m[2]), alt };
}

/** Semitones above the root for a degree string. */
export function degreeSemitones(d: string): number {
  const { number, alt } = parseDegree(d);
  const idx = (number - 1) % 7;
  const octaves = Math.floor((number - 1) / 7);
  return MAJOR_STEPS[idx] + 12 * octaves + alt;
}

/** Spell the note a given degree above a spelled root. */
export function spellDegree(root: SpelledNote, d: string): SpelledNote {
  const { number } = parseDegree(d);
  const rootIdx = LETTERS.indexOf(root.letter);
  const letter = LETTERS[(rootIdx + number - 1) % 7];
  const targetPc = (pitchClass(root) + degreeSemitones(d)) % 12;
  let acc = targetPc - LETTER_PC[letter];
  if (acc > 6) acc -= 12;
  if (acc < -6) acc += 12;
  return { letter, acc };
}

/** Pretty degree label: "b3" -> "♭3". */
export function degreeLabel(d: string): string {
  return d.replace(/bb/g, "𝄫").replace(/b/g, "♭").replace(/#/g, "♯");
}

/** Spell the note a given degree *below* a spelled note (inverse of spellDegree). */
export function spellDegreeBelow(upper: SpelledNote, d: string): SpelledNote {
  const { number } = parseDegree(d);
  const upperIdx = LETTERS.indexOf(upper.letter);
  const letter = LETTERS[(((upperIdx - (number - 1)) % 7) + 7) % 7];
  const targetPc = (((pitchClass(upper) - degreeSemitones(d)) % 12) + 12) % 12;
  let acc = targetPc - LETTER_PC[letter];
  if (acc > 6) acc -= 12;
  if (acc < -6) acc += 12;
  return { letter, acc };
}

/** The same pitch spelled with the neighbouring letter (D♭ ↔ C♯, F ↔ E♯ is never chosen). */
export function enharmonic(n: SpelledNote): SpelledNote | null {
  if (n.acc === -1) {
    const idx = LETTERS.indexOf(n.letter);
    const letter = LETTERS[(idx + 6) % 7];
    const acc = pitchClass(n) - LETTER_PC[letter];
    const fixed = acc < -6 ? acc + 12 : acc > 6 ? acc - 12 : acc;
    return fixed === 1 ? { letter, acc: 1 } : null;
  }
  if (n.acc === 1) {
    const idx = LETTERS.indexOf(n.letter);
    const letter = LETTERS[(idx + 1) % 7];
    const acc = pitchClass(n) - LETTER_PC[letter];
    const fixed = acc < -6 ? acc + 12 : acc > 6 ? acc - 12 : acc;
    return fixed === -1 ? { letter, acc: -1 } : null;
  }
  return null;
}

/** Pick the root spelling (as given or enharmonic) that spells these degrees most simply. */
export function bestRootSpelling(root: SpelledNote, degrees: string[]): SpelledNote {
  const alt = enharmonic(root);
  if (!alt) return root;
  const cost = (r: SpelledNote) =>
    degrees.reduce((sum, d) => {
      const a = Math.abs(spellDegree(r, d).acc);
      return sum + (a >= 2 ? 10 : a);
    }, Math.abs(r.acc));
  return cost(alt) < cost(root) ? alt : root;
}
