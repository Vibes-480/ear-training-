// Melody and rhythm dictation: question generation and answer checking.

import { FUNCTIONAL_DEGREES } from "../theory/harmony";
import { bestRootSpelling, COMMON_ROOTS, degreeSemitones, pitchClass, spellDegree, type SpelledNote } from "../theory/notes";
import { cadenceEvents, type GenContext } from "./generate";
import { pick } from "./register";
import type { PlayEvent } from "./types";

const mod12 = (n: number) => ((n % 12) + 12) % 12;

// ---------------------------------------------------------------------------
// Melodies

export interface MelodySettings {
  tonalities: ("major" | "minor")[];
  degreesMajor: string[];
  degreesMinor: string[];
  length: number;
  /** Largest leap in semitones. */
  maxLeap: number;
  /** Show the first note. */
  giveFirst: boolean;
}

export interface Melody {
  key: SpelledNote;
  tonality: "major" | "minor";
  tonic: number;
  notes: { midi: number; degree: string }[];
}

/** A singable random melody: starts on a tonic-triad note, mostly steps, ends on a stable degree. */
export function buildMelody(
  pool: string[],
  tonic: number,
  n: number,
  maxLeap: number,
  ctx: Pick<GenContext, "rng" | "weight">,
  part: string,
  bounds: [number, number],
  minor = false,
): { midi: number; degree: string }[] {
  const place = (d: string, prev: number) => {
    const base = tonic + mod12(degreeSemitones(d));
    const options = [base - 12, base, base + 12].filter((m) => m >= bounds[0] && m <= bounds[1]);
    return options.sort((a, b) => Math.abs(a - prev) - Math.abs(b - prev))[0] ?? base;
  };
  const stable = minor ? ["1", "b3", "5"] : ["1", "3", "5"];
  const out: { midi: number; degree: string }[] = [];
  let prev = tonic + 4;
  for (let i = 0; i < n; i++) {
    let options = i === 0 || i === n - 1 ? pool.filter((d) => stable.includes(d)) : pool;
    if (!options.length) options = pool;
    const weights = options.map((d) => {
      const m = place(d, prev);
      const leap = Math.abs(m - prev);
      if (i > 0 && leap > maxLeap) return 0.02;
      const shape = i === 0 ? 1 : leap === 0 ? 0.25 : leap <= 2 ? 3 : leap <= 4 ? 2 : leap <= 7 ? 1 : 0.4;
      return shape * Math.max(0.1, ctx.weight(part, d));
    });
    const total = weights.reduce((a, b) => a + b, 0);
    let r = ctx.rng() * total;
    let k = 0;
    while (k < options.length - 1 && (r -= weights[k]) > 0) k++;
    const d = options[k];
    const midi = place(d, prev);
    out.push({ midi, degree: d });
    prev = midi;
  }
  return out;
}

export function makeMelody(cfg: MelodySettings, opts: { randomKey: boolean; fixedRoot: number }, ctx: Pick<GenContext, "rng" | "weight">): Melody {
  const tonality = pick(cfg.tonalities.length ? cfg.tonalities : (["major"] as const), ctx.rng);
  const raw = opts.randomKey ? pick(COMMON_ROOTS, ctx.rng) : COMMON_ROOTS[opts.fixedRoot] ?? COMMON_ROOTS[0];
  const key = bestRootSpelling(raw, tonality === "minor" ? ["2", "b3", "4", "5", "b6", "b7"] : ["2", "3", "4", "5", "6", "7"]);
  // Tonic between G3 and F#4 keeps melodies on the treble staff.
  let tonic = 55;
  while (mod12(tonic) !== pitchClass(key)) tonic++;
  const pool = (tonality === "major" ? cfg.degreesMajor : cfg.degreesMinor).filter((d) => FUNCTIONAL_DEGREES.some((f) => f.id === d));
  const notes = buildMelody(pool.length >= 2 ? pool : ["1", "2", "3", "4", "5"], tonic, Math.max(2, Math.min(12, cfg.length)), cfg.maxLeap, ctx, tonality, [tonic - 5, tonic + 16], tonality === "minor");
  return { key, tonality, tonic, notes };
}

export function melodyEvents(m: Melody, tempo: number, withCadence: boolean): { events: PlayEvent[]; melodyStart: number } {
  const beat = 60 / tempo;
  const cad = withCadence ? cadenceEvents(m.tonic, tempo, m.tonality === "minor") : { events: [], length: 0 };
  const start = withCadence ? cad.length + beat : 0;
  const events = m.notes.map((n, i) => ({ midi: [n.midi], at: start + i * beat, dur: beat * 0.95, velocity: 88 }));
  return { events: [...cad.events, ...events], melodyStart: start };
}

/** Degree of any MIDI note relative to the tonic, e.g. "b3". */
export function degreeOf(midi: number, tonic: number): string {
  const diff = mod12(midi - tonic);
  return FUNCTIONAL_DEGREES.find((d) => mod12(degreeSemitones(d.id)) === diff)?.id ?? "1";
}

/** Spell a note in the melody's key using its degree. */
export function spellMelodyNote(midi: number, m: Melody): SpelledNote {
  return spellDegree(m.key, degreeOf(midi, m.tonic));
}

/**
 * Compare an entered melody with the target. Octave mistakes on the whole
 * melody are forgiven (it's the same tune), single wrong octaves are not.
 */
export function checkMelody(target: number[], entered: number[]): boolean[] {
  let best: boolean[] = [];
  let bestScore = -1;
  for (const shift of [-24, -12, 0, 12, 24]) {
    const res = target.map((t, i) => entered[i] !== undefined && entered[i] + shift === t);
    const score = res.filter(Boolean).length;
    if (score > bestScore) {
      best = res;
      bestScore = score;
    }
  }
  return best;
}

// ---------------------------------------------------------------------------
// Rhythms

export interface RhythmCell {
  id: string;
  name: string;
  /** Beats the cell lasts. */
  beats: number;
  /** Notes inside the cell: duration in beats, rest or not. */
  parts: { dur: number; rest?: boolean }[];
  /** VexFlow notation for display. */
  vex: { duration: string; dots?: number; rest?: boolean; tuplet?: number }[];
}

export const RHYTHM_CELLS: RhythmCell[] = [
  { id: "q", name: "Quarter", beats: 1, parts: [{ dur: 1 }], vex: [{ duration: "q" }] },
  { id: "qr", name: "Quarter rest", beats: 1, parts: [{ dur: 1, rest: true }], vex: [{ duration: "q", rest: true }] },
  { id: "88", name: "Two eighths", beats: 1, parts: [{ dur: 0.5 }, { dur: 0.5 }], vex: [{ duration: "8" }, { duration: "8" }] },
  { id: "8r8", name: "Eighth rest + eighth", beats: 1, parts: [{ dur: 0.5, rest: true }, { dur: 0.5 }], vex: [{ duration: "8", rest: true }, { duration: "8" }] },
  { id: "16x4", name: "Four sixteenths", beats: 1, parts: [{ dur: 0.25 }, { dur: 0.25 }, { dur: 0.25 }, { dur: 0.25 }], vex: [{ duration: "16" }, { duration: "16" }, { duration: "16" }, { duration: "16" }] },
  { id: "81616", name: "Eighth + two sixteenths", beats: 1, parts: [{ dur: 0.5 }, { dur: 0.25 }, { dur: 0.25 }], vex: [{ duration: "8" }, { duration: "16" }, { duration: "16" }] },
  { id: "16168", name: "Two sixteenths + eighth", beats: 1, parts: [{ dur: 0.25 }, { dur: 0.25 }, { dur: 0.5 }], vex: [{ duration: "16" }, { duration: "16" }, { duration: "8" }] },
  { id: "8.16", name: "Dotted eighth + sixteenth", beats: 1, parts: [{ dur: 0.75 }, { dur: 0.25 }], vex: [{ duration: "8", dots: 1 }, { duration: "16" }] },
  { id: "trip", name: "Eighth-note triplet", beats: 1, parts: [{ dur: 1 / 3 }, { dur: 1 / 3 }, { dur: 1 / 3 }], vex: [{ duration: "8", tuplet: 3 }, { duration: "8" }, { duration: "8" }] },
  { id: "h", name: "Half", beats: 2, parts: [{ dur: 2 }], vex: [{ duration: "h" }] },
  { id: "q.8", name: "Dotted quarter + eighth", beats: 2, parts: [{ dur: 1.5 }, { dur: 0.5 }], vex: [{ duration: "q", dots: 1 }, { duration: "8" }] },
  { id: "8q8", name: "Syncopation (8–q–8)", beats: 2, parts: [{ dur: 0.5 }, { dur: 1 }, { dur: 0.5 }], vex: [{ duration: "8" }, { duration: "q" }, { duration: "8" }] },
  { id: "h.", name: "Dotted half", beats: 3, parts: [{ dur: 3 }], vex: [{ duration: "h", dots: 1 }] },
  { id: "w", name: "Whole", beats: 4, parts: [{ dur: 4 }], vex: [{ duration: "w" }] },
];

export interface RhythmSettings {
  cells: string[];
  bars: number;
  beatsPerBar: 3 | 4;
  /** Click on every beat while the rhythm plays. */
  metronome: boolean;
}

/** Fill bars with random cells (each cell stays inside its bar). */
export function makeRhythm(cfg: RhythmSettings, ctx: Pick<GenContext, "rng" | "weight">): string[] {
  const cells = RHYTHM_CELLS.filter((c) => cfg.cells.includes(c.id) && c.beats <= cfg.beatsPerBar);
  const pool = cells.length ? cells : RHYTHM_CELLS.filter((c) => c.id === "q" || c.id === "88");
  const out: string[] = [];
  for (let b = 0; b < Math.max(1, cfg.bars); b++) {
    let left = cfg.beatsPerBar;
    let barHasNote = false;
    while (left > 0) {
      const fits = pool.filter((c) => c.beats <= left);
      const options = fits.length ? fits : RHYTHM_CELLS.filter((c) => c.id === "q");
      const weights = options.map((c) => Math.max(0.1, ctx.weight("cell", c.id)) * (c.parts.every((p) => p.rest) && !barHasNote && left - c.beats <= 0 ? 0 : 1));
      const total = weights.reduce((a, x) => a + x, 0) || 1;
      let r = ctx.rng() * total;
      let k = 0;
      while (k < options.length - 1 && (r -= weights[k]) > 0) k++;
      const c = options[k];
      out.push(c.id);
      if (c.parts.some((p) => !p.rest)) barHasNote = true;
      left -= c.beats;
    }
  }
  return out;
}

export function cellById(id: string): RhythmCell {
  return RHYTHM_CELLS.find((c) => c.id === id) ?? RHYTHM_CELLS[0];
}

export function totalBeats(cells: string[]): number {
  return cells.reduce((a, id) => a + cellById(id).beats, 0);
}

/** Note onsets in beats (rests excluded). */
export function onsets(cells: string[]): number[] {
  const out: number[] = [];
  let t = 0;
  for (const id of cells) {
    for (const p of cellById(id).parts) {
      if (!p.rest) out.push(Math.round(t * 1000) / 1000);
      t += p.dur;
    }
  }
  return out;
}

/** Playback: one bar of count-in clicks, then the rhythm on one pitch, with optional metronome. */
export function rhythmEvents(cells: string[], cfg: RhythmSettings, tempo: number, pitch = 72): { events: PlayEvent[]; start: number } {
  const beat = 60 / tempo;
  const events: PlayEvent[] = [];
  for (let i = 0; i < cfg.beatsPerBar; i++) events.push({ midi: [i === 0 ? -1 : -2], at: i * beat, dur: 0.05 });
  const start = cfg.beatsPerBar * beat;
  const total = totalBeats(cells);
  if (cfg.metronome) for (let i = 0; i < total; i++) events.push({ midi: [i % cfg.beatsPerBar === 0 ? -1 : -2], at: start + i * beat, dur: 0.05 });
  let t = 0;
  for (const id of cells) {
    for (const p of cellById(id).parts) {
      if (!p.rest) events.push({ midi: [pitch], at: start + t * beat, dur: Math.max(0.08, p.dur * beat * 0.85), velocity: 95 });
      t += p.dur;
    }
  }
  return { events, start };
}

/** Per target cell: was the entered rhythm the same over that cell's beats? */
export function checkRhythmCells(target: string[], entered: string[]): boolean[] {
  const tOn = onsets(target);
  const eOn = new Set(onsets(entered).map((x) => x.toFixed(3)));
  const tSet = new Set(tOn.map((x) => x.toFixed(3)));
  const eList = onsets(entered);
  let t = 0;
  return target.map((id) => {
    const c = cellById(id);
    const from = t;
    const to = t + c.beats;
    t = to;
    const inRange = (x: number) => x >= from - 1e-6 && x < to - 1e-6;
    const targetHere = tOn.filter(inRange);
    const enteredHere = eList.filter(inRange);
    return targetHere.length === enteredHere.length && targetHere.every((x) => eOn.has(x.toFixed(3))) && enteredHere.every((x) => tSet.has(x.toFixed(3)));
  });
}

/** The entered cell that starts where a target cell starts, for confusion stats. */
export function alignedCell(target: string[], entered: string[], index: number): string {
  const startOf = (cells: string[], i: number) => totalBeats(cells.slice(0, i));
  const s = startOf(target, index);
  let t = 0;
  for (const id of entered) {
    if (Math.abs(t - s) < 1e-6) return cellById(id).beats === cellById(target[index]).beats ? id : "other";
    t += cellById(id).beats;
  }
  return "other";
}

/**
 * Score tapped onsets (in beats from the downbeat) against the target.
 * Each target onset needs a tap within `tolerance` beats; extra taps count against you.
 */
export function scoreTaps(target: number[], taps: number[], tolerance = 0.18): { hits: boolean[]; extra: number } {
  const used = new Set<number>();
  const hits = target.map((t) => {
    let best = -1;
    let bestD = Infinity;
    taps.forEach((x, i) => {
      const d = Math.abs(x - t);
      if (!used.has(i) && d < bestD) {
        best = i;
        bestD = d;
      }
    });
    if (best >= 0 && bestD <= tolerance) {
      used.add(best);
      return true;
    }
    return false;
  });
  return { hits, extra: taps.length - used.size };
}
