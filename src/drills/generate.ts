// Builds questions for every drill from the drill config and the user's settings.

import { CHORDS, INTERVALS, INVERSION_NAMES, SCALES } from "../theory/catalog";
import {
  COMMON_ROOTS,
  degreeSemitones,
  pitchClass,
  spellDegree,
  spellDegreeBelow,
  spelledName,
  defaultSpelling,
  type SpelledNote,
} from "../theory/notes";
import type { Settings } from "../store/settings";
import { chooseRoot, pick, type Rng } from "./register";
import type {
  ChordConfig,
  Choice,
  DrillConfigs,
  DrillId,
  IntervalConfig,
  PitchConfig,
  PlayEvent,
  Question,
  QuestionNote,
  QuestionPart,
  ScaleConfig,
} from "./types";

export interface GenContext {
  rng: Rng;
  /** Relative weight for asking an item (higher = more often). */
  weight: (part: string, itemId: string) => number;
  /** Answer of the previous question, to avoid immediate repeats. */
  previous?: string;
}

type RootOpts = Pick<Settings, "randomKey" | "fixedRoot" | "randomRegister" | "tempo">;

let uidCounter = 0;
const uid = () => `q${Date.now().toString(36)}${(uidCounter++).toString(36)}`;

export function weightedPick(ids: string[], part: string, ctx: GenContext): string {
  if (ids.length === 0) throw new Error("Nothing selected to practise");
  const weights = ids.map((id) => {
    let w = Math.max(0.05, ctx.weight(part, id));
    if (ids.length > 1 && id === ctx.previous) w *= 0.25;
    return w;
  });
  const total = weights.reduce((a, b) => a + b, 0);
  let r = ctx.rng() * total;
  for (let i = 0; i < ids.length; i++) {
    r -= weights[i];
    if (r <= 0) return ids[i];
  }
  return ids[ids.length - 1];
}

function beat(tempo: number) {
  return 60 / Math.max(30, Math.min(240, tempo));
}

// ---------------------------------------------------------------------------

export function generateInterval(cfg: IntervalConfig, s: RootOpts, ctx: GenContext): Question {
  const ids = INTERVALS.filter((i) => cfg.enabled.includes(i.id)).map((i) => i.id);
  const id = weightedPick(ids, "interval", ctx);
  const def = INTERVALS.find((i) => i.id === id)!;
  const dirs = cfg.directions.length ? cfg.directions : (["asc"] as const);
  const dir = pick(dirs, ctx.rng);
  const b = beat(s.tempo);

  // The root is the first note heard (the lower note for ascending/harmonic, the upper for descending).
  let lower: QuestionNote;
  let upper: QuestionNote;
  let root: { midi: number; spelled: SpelledNote };
  if (dir === "desc") {
    const r = chooseRoot([-def.semitones], s, ctx.rng);
    root = r;
    upper = { midi: r.midi, spelled: r.spelled, degree: def.degree };
    lower = { midi: r.midi - def.semitones, spelled: spellDegreeBelow(r.spelled, def.degree), degree: "1" };
  } else {
    const r = chooseRoot([def.semitones], s, ctx.rng);
    root = r;
    lower = { midi: r.midi, spelled: r.spelled, degree: "1" };
    upper = { midi: r.midi + def.semitones, spelled: spellDegree(r.spelled, def.degree), degree: def.degree };
  }

  let events: PlayEvent[];
  if (dir === "harm") events = [{ midi: [lower.midi, upper.midi], at: 0, dur: 1.8 }];
  else if (dir === "asc")
    events = [
      { midi: [lower.midi], at: 0, dur: b * 0.95 },
      { midi: [upper.midi], at: b, dur: b * 1.4 },
    ];
  else
    events = [
      { midi: [upper.midi], at: 0, dur: b * 0.95 },
      { midi: [lower.midi], at: b, dur: b * 1.4 },
    ];

  const dirName = dir === "asc" ? "ascending" : dir === "desc" ? "descending" : "harmonic";
  const choices: Choice[] = INTERVALS.filter((i) => ids.includes(i.id)).map((i) => ({ id: i.id, label: i.name, sub: i.short }));
  const startNote = dir === "desc" ? upper : lower;
  const otherNote = dir === "desc" ? lower : upper;

  return {
    drill: "intervals",
    uid: uid(),
    parts: [{ key: "interval", prompt: "Which interval?", choices, answer: id }],
    events,
    notes: [startNote, otherNote],
    root,
    reveal: `${def.name} ${dirName}: ${spelledName(startNote.spelled)} → ${spelledName(otherNote.spelled)}`,
    piano: {
      mode: "interval",
      given: [startNote.midi],
      direction: dir === "desc" ? "down" : "up",
      instruction: `Play the note ${dir === "desc" ? "below" : "above"} the highlighted ${spelledName(startNote.spelled)}`,
    },
  };
}

// ---------------------------------------------------------------------------

export function chordVoicing(degrees: string[], inversion: number): number[] {
  const semis = degrees.map(degreeSemitones);
  return semis.map((s, i) => (i < inversion ? s + 12 : s));
}

export function maxInversion(degrees: string[]): number {
  return Math.min(degrees.length - 1, 3);
}

export function generateChord(cfg: ChordConfig, s: RootOpts, ctx: GenContext): Question {
  const ids = CHORDS.filter((c) => cfg.enabled.includes(c.id)).map((c) => c.id);
  const id = weightedPick(ids, "quality", ctx);
  const def = CHORDS.find((c) => c.id === id)!;
  const allowedInv = (cfg.inversions.length ? cfg.inversions : [0]).filter((i) => i <= maxInversion(def.degrees));
  const inv = allowedInv.length ? pick(allowedInv, ctx.rng) : 0;
  const offsets = chordVoicing(def.degrees, inv);
  const r = chooseRoot(offsets, s, ctx.rng);
  const b = beat(s.tempo);

  const notes: QuestionNote[] = def.degrees
    .map((d, i) => ({ midi: r.midi + offsets[i], spelled: spellDegree(r.spelled, d), degree: d }))
    .sort((a, z) => a.midi - z.midi);

  const mode = pick(cfg.playback.length ? cfg.playback : (["block"] as const), ctx.rng);
  let events: PlayEvent[];
  if (mode === "block") {
    events = [{ midi: notes.map((n) => n.midi), at: 0, dur: 2.2 }];
  } else {
    const step = b / 2;
    const end = step * notes.length + 1.4;
    events = notes.map((n, i) => ({ midi: [n.midi], at: i * step, dur: end - i * step }));
  }

  const parts: QuestionPart[] = [
    {
      key: "quality",
      prompt: "Which chord quality?",
      choices: CHORDS.filter((c) => ids.includes(c.id)).map((c) => ({ id: c.id, label: c.name, sub: c.symbol || "maj" })),
      answer: id,
    },
  ];
  if (cfg.askInversion && allowedInv.length > 1) {
    parts.push({
      key: "inversion",
      prompt: "Which inversion?",
      choices: allowedInv.map((i) => ({ id: String(i), label: INVERSION_NAMES[i], sub: i === 0 ? "root in bass" : `${def.degrees[i]} in bass` })),
      answer: String(inv),
    });
  }

  return {
    drill: "chords",
    uid: uid(),
    parts,
    events,
    notes,
    root: r,
    reveal: `${spelledName(r.spelled)}${def.symbol} (${def.name}), ${INVERSION_NAMES[inv].toLowerCase()}`,
    piano: {
      mode: "set",
      given: [r.midi],
      instruction: `Play every note of the chord on the root ${spelledName(r.spelled)}, then press Check`,
    },
  };
}

// ---------------------------------------------------------------------------

export function generateScale(cfg: ScaleConfig, s: RootOpts, ctx: GenContext): Question {
  const ids = SCALES.filter((c) => cfg.enabled.includes(c.id)).map((c) => c.id);
  const id = weightedPick(ids, "scale", ctx);
  const def = SCALES.find((c) => c.id === id)!;
  const dir = pick(cfg.directions.length ? cfg.directions : (["asc"] as const), ctx.rng);
  const degs = [...def.degrees, "8"];
  const offsets = degs.map(degreeSemitones);
  const r = chooseRoot(offsets, s, ctx.rng);
  const step = beat(s.tempo) / 2;

  const up: QuestionNote[] = degs.map((d) => ({ midi: r.midi + degreeSemitones(d), spelled: spellDegree(r.spelled, d), degree: d }));
  const seq = dir === "asc" ? up : dir === "desc" ? [...up].reverse() : [...up, ...up.slice(0, -1).reverse()];
  const events: PlayEvent[] = seq.map((n, i) => ({
    midi: [n.midi],
    at: i * step,
    dur: i === seq.length - 1 ? step * 2.5 : step * 1.05,
  }));

  return {
    drill: "scales",
    uid: uid(),
    parts: [
      {
        key: "scale",
        prompt: "Which scale or mode?",
        choices: SCALES.filter((c) => ids.includes(c.id)).map((c) => ({ id: c.id, label: c.name })),
        answer: id,
      },
    ],
    events,
    notes: up,
    root: r,
    reveal: `${spelledName(r.spelled)} ${def.name}`,
    piano: {
      mode: "set",
      given: [r.midi],
      instruction: `Play the notes of the scale starting on ${spelledName(r.spelled)}, then press Check`,
    },
  };
}

// ---------------------------------------------------------------------------

export const PITCH_LABELS = ["C", "C♯/D♭", "D", "E♭/D♯", "E", "F", "F♯/G♭", "G", "A♭/G♯", "A", "B♭/A♯", "B"];

export function generatePitch(cfg: PitchConfig, s: RootOpts, ctx: GenContext): Question {
  const ids = (cfg.enabled.length ? cfg.enabled : [0]).map(String);
  const id = weightedPick(ids, "note", ctx);
  const pc = Number(id);

  // The reference note: C, or a random key when random key is on.
  const refSpelled = s.randomKey ? pick(COMMON_ROOTS, ctx.rng) : COMMON_ROOTS[s.fixedRoot] ?? COMMON_ROOTS[0];
  const refMidi = 60 + pitchClass(refSpelled) - (pitchClass(refSpelled) > 6 ? 12 : 0);

  const octaveSpan = Math.max(1, Math.min(4, cfg.octaves));
  const baseOct = s.randomRegister ? Math.floor(ctx.rng() * octaveSpan) - Math.floor(octaveSpan / 2) : 0;
  const midi = 60 + pc + 12 * baseOct;
  const spelled = defaultSpelling(midi, pc !== 6);

  const reference: PlayEvent[] | undefined = cfg.reference ? [{ midi: [refMidi], at: 0, dur: 1.1 }] : undefined;

  return {
    drill: "pitch",
    uid: uid(),
    parts: [
      {
        key: "note",
        prompt: cfg.reference ? `Reference: ${spelledName(refSpelled)}. Which note is this?` : "Which note is this?",
        choices: ids.map((i) => ({ id: i, label: PITCH_LABELS[Number(i)] })),
        answer: id,
      },
    ],
    events: [{ midi: [midi], at: 0, dur: 1.6 }],
    reference,
    notes: [{ midi, spelled, degree: "1" }],
    root: { midi: refMidi, spelled: refSpelled },
    reveal: `${PITCH_LABELS[pc]}`,
    piano: { mode: "single", given: cfg.reference ? [refMidi] : [], instruction: "Play the note you heard (any octave)" },
  };
}

// ---------------------------------------------------------------------------

export function generate(drill: DrillId, cfgs: DrillConfigs, s: RootOpts, ctx: GenContext): Question {
  switch (drill) {
    case "intervals":
      return generateInterval(cfgs.intervals, s, ctx);
    case "chords":
      return generateChord(cfgs.chords, s, ctx);
    case "scales":
      return generateScale(cfgs.scales, s, ctx);
    case "pitch":
      return generatePitch(cfgs.pitch, s, ctx);
  }
}

// ---------------------------------------------------------------------------

/**
 * Playback for an answer the user picked, built on the same root as the question,
 * so they can compare what they chose with what was played.
 * Returns null when there's nothing sensible to play.
 */
export function answerPreview(q: Question, partKey: string, answerId: string, tempo: number): PlayEvent[] | null {
  const b = beat(tempo);
  const root = q.root.midi;
  if (q.drill === "intervals") {
    const def = INTERVALS.find((i) => i.id === answerId);
    if (!def) return null;
    const start = q.notes[0].midi;
    const other = q.piano?.direction === "down" ? start - def.semitones : start + def.semitones;
    const harmonic = q.events.length === 1;
    return harmonic
      ? [{ midi: [start, other].sort((a, z) => a - z), at: 0, dur: 1.8 }]
      : [
          { midi: [start], at: 0, dur: b * 0.95 },
          { midi: [other], at: b, dur: b * 1.4 },
        ];
  }
  if (q.drill === "chords" && partKey === "quality") {
    const def = CHORDS.find((c) => c.id === answerId);
    if (!def) return null;
    return [{ midi: def.degrees.map((d) => root + degreeSemitones(d)), at: 0, dur: 2.2 }];
  }
  if (q.drill === "chords" && partKey === "inversion") {
    const def = CHORDS.find((c) => c.id === q.parts[0].answer);
    if (!def) return null;
    const offs = chordVoicing(def.degrees, Number(answerId));
    return [{ midi: offs.map((o) => root + o), at: 0, dur: 2.2 }];
  }
  if (q.drill === "scales") {
    const def = SCALES.find((c) => c.id === answerId);
    if (!def) return null;
    const step = b / 2;
    const degs = [...def.degrees, "8"];
    return degs.map((d, i) => ({ midi: [root + degreeSemitones(d)], at: i * step, dur: i === degs.length - 1 ? step * 2.5 : step * 1.05 }));
  }
  if (q.drill === "pitch") {
    const pc = Number(answerId);
    if (Number.isNaN(pc)) return null;
    const target = q.notes[0].midi;
    const midi = target - (((target % 12) + 12) % 12) + pc;
    return [{ midi: [midi], at: 0, dur: 1.6 }];
  }
  return null;
}
