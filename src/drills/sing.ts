// Singing tasks: match a note, sing an interval, sight-sing scale degrees.

import { INTERVALS } from "../theory/catalog";
import { FUNCTIONAL_DEGREES } from "../theory/harmony";
import { COMMON_ROOTS, degreeLabel, degreeSemitones, defaultSpelling, midiName, pitchClass, spellDegree, spelledName, type SpelledNote } from "../theory/notes";
import type { SingSettings } from "../store/settings";
import { PITCH_LABELS, cadenceEvents, weightedPick, type GenContext } from "./generate";
import { pick } from "./register";
import type { PlayEvent } from "./types";

export interface SingTask {
  mode: SingSettings["mode"];
  /** Stats item id per target note. */
  items: string[];
  prompt: string;
  /** Played at the start (and on replay). */
  play: PlayEvent[];
  targets: number[];
  /** Label per target: note name or degree. */
  labels: string[];
  /** Plays the correct answer. */
  hear: PlayEvent[];
  /** Reference for working out what was sung: the root or tonic. */
  ref: number;
  key?: SpelledNote;
}

const mod12 = (n: number) => ((n % 12) + 12) % 12;

export function singRange(range: { lo: number; hi: number } | null): [number, number] {
  const lo = range?.lo ?? 48;
  const hi = range?.hi ?? 72;
  // Keep a little away from the extremes.
  return hi - lo >= 10 ? [lo + 1, hi - 1] : [lo, hi];
}

function randInt(lo: number, hi: number, rng: () => number) {
  return lo + Math.floor(rng() * (hi - lo + 1));
}

export function makeSingTask(
  cfg: SingSettings,
  range: { lo: number; hi: number } | null,
  opts: { randomKey: boolean; fixedRoot: number; tempo: number },
  ctx: GenContext,
): SingTask {
  const [lo, hi] = singRange(range);
  const beatS = 60 / opts.tempo;

  if (cfg.mode === "match") {
    const target = randInt(lo, hi, ctx.rng);
    return {
      mode: "match",
      items: [String(mod12(target))],
      prompt: "Sing this note back",
      play: [{ midi: [target], at: 0, dur: 1.5 }],
      targets: [target],
      labels: [midiName(target)],
      hear: [{ midi: [target], at: 0, dur: 1.5 }],
      ref: target,
    };
  }

  if (cfg.mode === "intervals") {
    const ids = INTERVALS.filter((i) => cfg.intervals.includes(i.id) && i.semitones <= hi - lo).map((i) => i.id);
    const id = weightedPick(ids.length ? ids : ["P5"], "intervals", ctx);
    const def = INTERVALS.find((i) => i.id === id)!;
    const root = randInt(lo, Math.max(lo, hi - def.semitones), ctx.rng);
    const rootSp = defaultSpelling(root);
    const target = root + def.semitones;
    return {
      mode: "intervals",
      items: [id],
      prompt: `Sing a ${def.name.toLowerCase()} above ${spelledName(rootSp)}`,
      play: [{ midi: [root], at: 0, dur: 1.4 }],
      targets: [target],
      labels: [spelledName(spellDegree(rootSp, def.degree))],
      hear: [
        { midi: [root], at: 0, dur: beatS * 0.95 },
        { midi: [target], at: beatS, dur: 1.4 },
      ],
      ref: root,
    };
  }

  // Sight-singing: a short melody in a key, from scale degrees.
  const key = opts.randomKey ? pick(COMMON_ROOTS, ctx.rng) : COMMON_ROOTS[opts.fixedRoot] ?? COMMON_ROOTS[0];
  // Tonic low enough that an octave above fits; otherwise as low as possible.
  const candidates: number[] = [];
  for (let m = lo; m <= hi; m++) if (mod12(m) === pitchClass(key) && m + 7 <= hi) candidates.push(m);
  const tonic = candidates.length ? pick(candidates, ctx.rng) : lo + mod12(pitchClass(key) - lo);
  const degs = cfg.degrees.filter((d) => FUNCTIONAL_DEGREES.some((f) => f.id === d));
  const pool = degs.length >= 2 ? degs : ["1", "2", "3", "4", "5"];
  const n = Math.max(2, Math.min(8, cfg.length));
  const notes: { d: string; midi: number }[] = [];
  let prev = tonic;
  for (let i = 0; i < n; i++) {
    // Start on a tonic-triad note; after that prefer steps and small leaps.
    const options = i === 0 ? pool.filter((d) => ["1", "3", "5"].includes(d)) : pool;
    const weighted: GenContext = {
      ...ctx,
      force: undefined,
      previous: undefined,
      weight: (part, id) => {
        const m = closest(tonic + mod12(degreeSemitones(id)), prev, tonic, hi);
        const leap = Math.abs(m - prev);
        return ctx.weight(part, id) * (leap === 0 ? 0.3 : leap <= 2 ? 3 : leap <= 4 ? 2 : leap <= 7 ? 1 : 0.3);
      },
    };
    const d = weightedPick(options.length ? options : pool, "sightsing", weighted);
    const midi = closest(tonic + mod12(degreeSemitones(d)), prev, tonic, hi);
    notes.push({ d, midi });
    prev = midi;
  }
  const cad = cadenceEvents(tonic, opts.tempo);
  const melody: PlayEvent[] = notes.map((x, i) => ({ midi: [x.midi], at: i * beatS, dur: beatS * 0.95 }));
  return {
    mode: "sightsing",
    items: notes.map((x) => x.d),
    prompt: `Key of ${spelledName(key)} major. Sing these degrees`,
    play: [...cad.events, { midi: [tonic], at: cad.length, dur: 1.2, velocity: 85 }],
    targets: notes.map((x) => x.midi),
    labels: notes.map((x) => `${degreeLabel(x.d)} (${spelledName(spellDegree(key, x.d))})`),
    hear: melody,
    ref: tonic,
    key,
  };
}

/** The octave of a pitch class closest to the previous note, kept within [tonic - 5, hi]. */
function closest(base: number, prev: number, tonic: number, hi: number): number {
  const options = [base - 12, base, base + 12].filter((m) => m >= tonic - 5 && m <= hi);
  return options.sort((a, b) => Math.abs(a - prev) - Math.abs(b - prev))[0] ?? base;
}

/** Cents between sung and target, optionally ignoring octaves. */
export function centsOff(sung: number, target: number, anyOctave: boolean): number {
  let off = (sung - target) * 100;
  if (anyOctave) off = ((((off + 600) % 1200) + 1200) % 1200) - 600;
  return off;
}

/** What a sung note "means" for stats: the interval, degree or note actually sung. */
export function sungItem(task: SingTask, sung: number, anyOctave: boolean): string {
  if (task.mode === "match") return String(mod12(Math.round(sung)));
  const semis = Math.round(sung) - task.ref;
  if (task.mode === "intervals") {
    const exact = INTERVALS.find((i) => i.semitones === semis);
    if (exact && !anyOctave) return exact.id;
    const folded = INTERVALS.find((i) => !i.compound && i.semitones % 12 === mod12(semis));
    return folded?.id ?? exact?.id ?? "other";
  }
  return FUNCTIONAL_DEGREES.find((d) => mod12(degreeSemitones(d.id)) === mod12(semis))?.id ?? "other";
}

export function singItemLabel(part: string, id: string): string {
  if (id === "other" || id === "miss") return id === "miss" ? "no answer" : "something else";
  if (part === "match") return PITCH_LABELS[Number(id)] ?? id;
  if (part === "intervals") return INTERVALS.find((i) => i.id === id)?.name ?? id;
  return `Degree ${degreeLabel(id)}`;
}
