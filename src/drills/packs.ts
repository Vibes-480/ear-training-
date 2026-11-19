// Genre packs: ready-made drills with genre-specific vocabulary, and the
// curriculum: levels that unlock in order. Both are drill options layered on
// top of the defaults, so they never touch your own saved options.

import { DEFAULT_CONFIGS } from "./config";
import type { DrillConfigs, DrillId } from "./types";

export interface Module<K extends DrillId = DrillId> {
  id: string;
  title: string;
  blurb: string;
  drill: K;
  config: Partial<DrillConfigs[K]>;
}

/** Build a module with type-checked options for its drill. */
function m<K extends DrillId>(id: string, title: string, blurb: string, drill: K, config: Partial<DrillConfigs[K]>): Module {
  return { id, title, blurb, drill, config } as unknown as Module;
}

export interface Pack {
  id: string;
  name: string;
  blurb: string;
  modules: Module[];
}

export const PACKS: Pack[] = [
  {
    id: "jazz",
    name: "Jazz",
    blurb: "7th chords, real voicings, ii–V–Is and jazz scales",
    modules: [
      m("jazz-7ths", "Seventh-chord qualities", "maj7, 7, m7, m7♭5, °7, m(maj7) in close and drop-2 voicings", "chords", {
        enabled: ["maj7", "dom7", "min7", "m7b5", "dim7", "mMaj7"],
        voicings: ["close", "open"],
        inversions: [0, 1, 2, 3],
        playback: ["block"],
      }),
      m("jazz-shells", "Shell voicings", "Hear the quality from just root, 3rd and 7th", "chords", { enabled: ["maj7", "dom7", "min7", "m7b5", "6"], voicings: ["shell"], playback: ["block"] }),
      m("jazz-rootless", "Rootless voicings", "Bill Evans-style A and B voicings over a bass root", "chords", {
        enabled: ["maj7", "dom7", "min7", "m7b5", "maj9", "dom9", "min9", "dom13"],
        voicings: ["rootless"],
        inversions: [0, 1],
        playback: ["block"],
      }),
      m("jazz-alt", "Dominant colours", "9, 13, ♭9, ♯9 and plain dominants", "chords", { enabled: ["dom7", "dom9", "dom13", "7b9", "7s9", "7sus4"], voicings: ["close", "rootless"], playback: ["block"] }),
      m("jazz-251", "ii–V–I and turnarounds", "Major-key jazz progressions with 7th chords", "progressions", {
        mode: "numerals",
        tonalities: ["major"],
        sevenths: true,
        style: "common",
        major: ["ii", "iii", "IV", "V", "vi", "II", "VI", "III", "♭VII"],
        templates: {
          major: [
            ["I", "ii", "V", "I"],
            ["I", "vi", "ii", "V"],
            ["I", "VI", "ii", "V"],
            ["I", "iii", "VI", "ii", "V", "I"],
            ["I", "II", "ii", "V"],
            ["I", "IV", "iii", "VI", "ii", "V", "I"],
            ["I", "♭VII", "I"],
          ],
        },
      }),
      m("jazz-minor251", "Minor ii–V–i", "iiø7–V7–i and friends", "progressions", {
        mode: "numerals",
        tonalities: ["minor"],
        sevenths: true,
        style: "common",
        minor: ["ii°", "iv", "V", "VI", "III", "VII"],
        templates: {
          minor: [
            ["i", "ii°", "V", "i"],
            ["i", "iv", "ii°", "V"],
            ["i", "VI", "ii°", "V"],
            ["i", "VII", "III", "VI", "ii°", "V", "i"],
          ],
        },
      }),
      m("jazz-tones", "Chord tones over changes", "Root to 9th over ii–V–I, minor ii–V–i and rhythm changes", "chordtones", {
        sets: ["ii-V-I", "minor-ii-V-i", "rhythm"],
        tones: ["1", "3", "5", "7", "9"],
      }),
      m("jazz-scales", "Jazz scales", "Dorian, Mixolydian, Lydian, altered, diminished, whole tone", "scales", {
        enabled: ["dorian", "mixolydian", "lydian", "melMinor", "altered", "lydDom", "dimHW", "wholeTone"],
        directions: ["asc", "desc"],
      }),
    ],
  },
  {
    id: "gospel",
    name: "Gospel",
    blurb: "Circle-of-fifths movement, rich dominants and blue notes",
    modules: [
      m("gospel-colors", "Gospel chord colours", "6, 9, 13 and ♯9 chords", "chords", { enabled: ["6", "dom9", "dom13", "maj9", "min9", "7s9", "min7"], voicings: ["close", "rootless"], playback: ["block"] }),
      m("gospel-progs", "Gospel progressions", "1–6–2–5, 3–6–2–5–1, the minor-iv Amen", "progressions", {
        mode: "numerals",
        tonalities: ["major"],
        sevenths: true,
        style: "common",
        major: ["ii", "iii", "IV", "V", "vi", "II", "III", "VI", "iv", "♭VII"],
        templates: {
          major: [
            ["I", "VI", "ii", "V"],
            ["I", "iii", "VI", "ii", "V", "I"],
            ["I", "IV", "iv", "I"],
            ["I", "III", "VI", "II", "V", "I"],
            ["I", "IV", "I", "V"],
            ["I", "♭VII", "IV", "I"],
          ],
        },
      }),
      m("gospel-blue", "Blue notes in the melody", "Scale degrees including ♭3 and ♭7", "functional", {
        tonalities: ["major"],
        major: ["1", "2", "b3", "3", "4", "5", "6", "b7"],
        notes: 2,
        registers: ["mid"],
      }),
      m("gospel-bass", "Gospel bass lines", "Scale degrees in the bass register", "functional", { tonalities: ["major"], major: ["1", "2", "3", "4", "5", "6", "b7"], notes: 2, registers: ["bass"] }),
    ],
  },
  {
    id: "pop",
    name: "Pop & rock",
    blurb: "The progressions behind most hits",
    modules: [
      m("pop-progs", "Pop progressions", "I–V–vi–IV and its many rotations", "progressions", {
        mode: "numerals",
        tonalities: ["major"],
        sevenths: false,
        style: "common",
        major: ["ii", "iii", "IV", "V", "vi", "♭VII"],
        templates: {
          major: [
            ["I", "V", "vi", "IV"],
            ["I", "vi", "IV", "V"],
            ["I", "IV", "vi", "V"],
            ["I", "iii", "vi", "IV"],
            ["I", "IV", "I", "V"],
            ["I", "V", "IV", "I"],
            ["I", "♭VII", "IV", "I"],
            ["I", "V", "vi", "iii", "IV", "I", "IV", "V"],
          ],
        },
      }),
      m("pop-minor", "Minor-key pop", "i–VI–III–VII and relatives", "progressions", {
        mode: "numerals",
        tonalities: ["minor"],
        style: "common",
        minor: ["iv", "v", "VI", "III", "VII"],
        templates: {
          minor: [
            ["i", "VI", "III", "VII"],
            ["i", "VII", "VI", "VII"],
            ["i", "iv", "VI", "v"],
            ["i", "III", "VII", "VI"],
          ],
        },
      }),
      m("pop-chords", "Pop chord sounds", "Major, minor, sus2, sus4, maj7, m7", "chords", { enabled: ["maj", "min", "sus2", "sus4", "maj7", "min7"], voicings: ["close", "open"], playback: ["block", "arp"] }),
      m("pop-tones", "Melody over I–V–vi–IV", "Name the melody note's role over each chord", "chordtones", { sets: ["pop"], tones: ["1", "3", "5", "9"] }),
    ],
  },
  {
    id: "modal",
    name: "Modal",
    blurb: "Hear the modes and their signature chord moves",
    modules: [
      m("modal-modes", "The seven modes", "From bright Lydian to dark Locrian", "scales", { enabled: ["lydian", "ionian", "mixolydian", "dorian", "aeolian", "phrygian", "locrian"], directions: ["asc", "both"] }),
      m("modal-vamps", "Modal vamps", "Dorian i–IV, Mixolydian I–♭VII, Aeolian i–♭VI–♭VII, Phrygian i–♭II", "progressions", {
        mode: "numerals",
        tonalities: ["major", "minor"],
        style: "common",
        major: ["♭VII", "IV", "II", "V"],
        minor: ["IV", "VI", "VII", "♭II", "iv"],
        templates: {
          major: [
            ["I", "♭VII", "IV", "I"],
            ["I", "♭VII", "I", "♭VII"],
            ["I", "II", "I", "II"],
            ["I", "IV", "♭VII", "I"],
          ],
          minor: [
            ["i", "IV", "i", "IV"],
            ["i", "VI", "VII", "i"],
            ["i", "♭II", "i", "♭II"],
            ["i", "iv", "VII", "i"],
          ],
        },
      }),
      m("modal-tones", "Dorian chord tones", "Notes over a Dorian vamp", "chordtones", { sets: ["dorian"], tones: ["1", "3", "5", "7", "9", "11", "13"] }),
    ],
  },
  {
    id: "classical",
    name: "Classical",
    blurb: "Cadences, inversions and functional harmony",
    modules: [
      m("classical-cadences", "Cadences", "Authentic, plagal, half and deceptive", "progressions", { mode: "cadences", tonalities: ["major", "minor"], cadences: ["authentic", "plagal", "half", "deceptive"] }),
      m("classical-inversions", "Triads and their inversions", "Name quality and inversion", "chords", { enabled: ["maj", "min", "dim", "aug"], inversions: [0, 1, 2], askInversion: true, voicings: ["close"], playback: ["block"] }),
      m("classical-harmony", "Functional progressions", "Including vii°, the Neapolitan and minor keys", "progressions", {
        mode: "numerals",
        tonalities: ["major", "minor"],
        style: "common",
        major: ["ii", "iii", "IV", "V", "vi", "vii°", "II", "♭II"],
        minor: ["ii°", "III", "iv", "V", "VI", "VII", "vii°", "♭II"],
      }),
      m("classical-7ths", "Dominant and diminished 7ths", "V7, vii°7, viiø7 sounds", "chords", { enabled: ["dom7", "dim7", "m7b5", "maj7", "min7"], inversions: [0, 1, 2, 3], askInversion: true, voicings: ["close"] }),
    ],
  },
  {
    id: "blues",
    name: "Blues",
    blurb: "Dominant 7ths, blues scales and blue notes",
    modules: [
      m("blues-tones", "Notes over a blues", "Chord tones over I7–IV7–V7", "chordtones", { sets: ["blues"], tones: ["1", "3", "5", "7", "9"] }),
      m("blues-scales", "Blues and pentatonic scales", "Blues, minor and major pentatonic, Mixolydian, Dorian", "scales", { enabled: ["blues", "minPent", "majPent", "mixolydian", "dorian"], directions: ["asc", "desc"] }),
      m("blues-notes", "Blue notes", "♭3, ♭5 and ♭7 against major", "functional", { tonalities: ["major"], major: ["1", "b3", "3", "4", "#4", "5", "6", "b7"], notes: 1, registers: ["mid", "high"] }),
      m("blues-progs", "Blues changes", "I7, IV7, V7 movements", "progressions", {
        mode: "numerals",
        tonalities: ["major"],
        sevenths: true,
        style: "random",
        length: 4,
        major: ["IV", "V"],
      }),
    ],
  },
];

// ---------------------------------------------------------------------------

export interface Level extends Module {
  unit: string;
  /** Accuracy needed to pass (0–1). */
  pass: number;
  questions: number;
}

function lvl<K extends DrillId>(unit: string, id: string, title: string, blurb: string, drill: K, config: Partial<DrillConfigs[K]>, pass = 0.85, questions = 20): Level {
  return { unit, id, title, blurb, drill, config, pass, questions } as unknown as Level;
}

const U1 = "1 · Foundations";
const U2 = "2 · Building blocks";
const U3 = "3 · Harmony";
const U4 = "4 · Advanced";

export const CURRICULUM: Level[] = [
  lvl(U1, "l1", "Big intervals", "Major 3rd, perfect 5th and octave, going up", "intervals", { enabled: ["M3", "P5", "P8"], directions: ["asc"] }),
  lvl(U1, "l2", "Thirds, fourths and fifths", "m3, M3, P4, P5 going up", "intervals", { enabled: ["m3", "M3", "P4", "P5"], directions: ["asc"] }),
  lvl(U1, "l3", "Major vs minor", "The two most common triads", "chords", { enabled: ["maj", "min"], inversions: [0], voicings: ["close"], playback: ["block", "arp"] }),
  lvl(U1, "l4", "Do, Mi, Sol", "Scale degrees 1, 3 and 5 after a cadence", "functional", { tonalities: ["major"], major: ["1", "3", "5"], notes: 1, registers: ["mid"] }),
  lvl(U1, "l5", "I, IV and V", "The three primary chords", "progressions", { mode: "numerals", tonalities: ["major"], style: "random", length: 4, major: ["IV", "V"], sevenths: false }),
  lvl(U1, "l6", "Seconds and sixths", "M2, m3, M3, P4, P5, M6, both directions", "intervals", { enabled: ["M2", "m3", "M3", "P4", "P5", "M6"], directions: ["asc", "desc"] }),

  lvl(U2, "l7", "All intervals, up", "Every interval within the octave, ascending", "intervals", {
    enabled: ["m2", "M2", "m3", "M3", "P4", "TT", "P5", "m6", "M6", "m7", "M7", "P8"],
    directions: ["asc"],
  }),
  lvl(U2, "l8", "All intervals, up and down", "Every interval within the octave, both directions", "intervals", {
    enabled: ["m2", "M2", "m3", "M3", "P4", "TT", "P5", "m6", "M6", "m7", "M7", "P8"],
    directions: ["asc", "desc"],
  }),
  lvl(U2, "l9", "All four triads", "Major, minor, diminished, augmented", "chords", { enabled: ["maj", "min", "dim", "aug"], inversions: [0], voicings: ["close"] }),
  lvl(U2, "l10", "The whole major scale", "All seven degrees after a cadence", "functional", { tonalities: ["major"], major: ["1", "2", "3", "4", "5", "6", "7"], notes: 1, registers: ["mid"] }),
  lvl(U2, "l11", "Diatonic progressions", "I, ii, IV, V, vi", "progressions", { mode: "numerals", tonalities: ["major"], style: "common", major: ["ii", "IV", "V", "vi"], sevenths: false }),
  lvl(U2, "l12", "Cadences", "Authentic, plagal, half, deceptive", "progressions", { mode: "cadences", tonalities: ["major"], cadences: ["authentic", "plagal", "half", "deceptive"] }),
  lvl(U2, "l13", "Note naming", "Natural notes with a C reference", "pitch", { enabled: [0, 2, 4, 5, 7, 9, 11], reference: true, octaves: 1 }),

  lvl(U3, "l14", "Harmonic intervals", "Both notes together", "intervals", {
    enabled: ["m2", "M2", "m3", "M3", "P4", "TT", "P5", "m6", "M6", "m7", "M7", "P8"],
    directions: ["harm"],
  }),
  lvl(U3, "l15", "Three 7th chords", "maj7, dominant 7, m7", "chords", { enabled: ["maj7", "dom7", "min7"], inversions: [0], voicings: ["close"] }),
  lvl(U3, "l16", "Five 7th chords", "Add m7♭5 and °7", "chords", { enabled: ["maj7", "dom7", "min7", "m7b5", "dim7"], inversions: [0, 1, 2, 3], voicings: ["close"] }),
  lvl(U3, "l17", "Triad inversions", "Quality and inversion", "chords", { enabled: ["maj", "min"], inversions: [0, 1, 2], askInversion: true, voicings: ["close"] }, 0.8),
  lvl(U3, "l18", "Two-note melodies", "Two scale degrees after a cadence", "functional", { tonalities: ["major"], major: ["1", "2", "3", "4", "5", "6", "7"], notes: 2, registers: ["mid"] }),
  lvl(U3, "l19", "Minor-key progressions", "i, iv, V, VI, III, VII", "progressions", { mode: "numerals", tonalities: ["minor"], style: "common", minor: ["iv", "V", "VI", "III", "VII"] }),
  lvl(U3, "l20", "Four modes", "Ionian, Dorian, Mixolydian, Aeolian", "scales", { enabled: ["ionian", "dorian", "mixolydian", "aeolian"], directions: ["asc"] }),

  lvl(U4, "l21", "All seven modes", "Including Phrygian, Lydian and Locrian", "scales", { enabled: ["ionian", "dorian", "phrygian", "lydian", "mixolydian", "aeolian", "locrian"], directions: ["asc", "desc"] }, 0.8),
  lvl(U4, "l22", "Compound intervals", "9ths to 13ths", "intervals", { enabled: ["P8", "m9", "M9", "m10", "M10", "P11", "P12", "M13"], directions: ["asc", "harm"] }, 0.8),
  lvl(U4, "l23", "Extended chords", "9ths, 13ths and altered dominants", "chords", { enabled: ["maj9", "dom9", "min9", "7b9", "7s9", "dom13"], inversions: [0], voicings: ["close"] }, 0.8),
  lvl(U4, "l24", "Chord tones", "Root, 3rd, 5th, 7th over ii–V–I", "chordtones", { sets: ["ii-V-I", "I-vi-ii-V"], tones: ["1", "3", "5", "7"] }, 0.8, 10),
  lvl(U4, "l25", "Borrowed chords", "iv, ♭VII, ♭VI, II alongside the diatonic chords", "progressions", { mode: "numerals", tonalities: ["major"], style: "common", major: ["ii", "IV", "V", "vi", "iv", "♭VII", "♭VI", "II"] }, 0.8),
  lvl(U4, "l26", "Chromatic degrees in the bass", "All 12 degrees, bass register", "functional", { tonalities: ["major"], major: ["1", "b2", "2", "b3", "3", "4", "#4", "5", "b6", "6", "b7", "7"], notes: 1, registers: ["bass", "mid"] }, 0.8),
  lvl(U4, "l27", "Chord tones with extensions", "Up to the 13th, several backing tracks", "chordtones", { sets: ["ii-V-I", "minor-ii-V-i", "blues", "rhythm"], tones: ["1", "3", "5", "7", "9", "11", "13"] }, 0.75, 10),
  lvl(U4, "l28", "Minor scale family", "Natural, harmonic and melodic minor, Dorian, Phrygian dominant", "scales", { enabled: ["aeolian", "harmMinor", "melMinor", "dorian", "phrygDom"], directions: ["asc", "desc"] }, 0.8),
];

/** Full drill options for a module: defaults with the module's changes on top. */
export function moduleConfigs(mod: Module): DrillConfigs {
  return { ...DEFAULT_CONFIGS, [mod.drill]: { ...DEFAULT_CONFIGS[mod.drill], ...mod.config } } as DrillConfigs;
}

export function findModule(packId: string | null, moduleId: string | null): Module | null {
  if (!packId || !moduleId) return null;
  return PACKS.find((p) => p.id === packId)?.modules.find((x) => x.id === moduleId) ?? null;
}

export function findLevel(id: string | null): Level | null {
  return id ? CURRICULUM.find((l) => l.id === id) ?? null : null;
}
