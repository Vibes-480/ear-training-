// Question generators for the harmony drills: progressions, cadences,
// functional (scale-degree) hearing and chord tones over a backing track.

import { CHORDS } from "../theory/catalog";
import {
  BACKING_SETS,
  CADENCE_OPENINGS,
  CADENCES,
  CHORD_TONES,
  COMMON_PROGRESSIONS,
  FUNCTIONAL_DEGREES,
  NUMERALS,
  TONIC,
  type NumeralDef,
  type Tonality,
} from "../theory/harmony";
import { bestRootSpelling, COMMON_ROOTS, degreeLabel, degreeSemitones, parseDegree, pitchClass, spellDegree, spelledName, type SpelledNote } from "../theory/notes";
import { beat, cadenceEvents, octavesFrom, weightedPick, type GenContext } from "./generate";
import { pick } from "./register";
import type { ChordToneConfig, Choice, FunctionalConfig, PlayEvent, ProgressionConfig, Question, QuestionNote, QuestionPart } from "./types";

type KeyOpts = { randomKey: boolean; fixedRoot: number; tempo: number };

let uidCounter = 0;
const uid = () => `h${Date.now().toString(36)}${(uidCounter++).toString(36)}`;
const mod12 = (n: number) => ((n % 12) + 12) % 12;

function chooseKey(s: KeyOpts, rng: () => number): SpelledNote {
  return s.randomKey ? pick(COMMON_ROOTS, rng) : COMMON_ROOTS[s.fixedRoot] ?? COMMON_ROOTS[0];
}

/** MIDI of the key's tonic in the bass octave (C2–B2). */
const bassTonic = (key: SpelledNote) => 36 + pitchClass(key);

export function numeralDef(tonality: Tonality, id: string): NumeralDef {
  return NUMERALS[tonality].find((n) => n.id === id) ?? NUMERALS[tonality][0];
}

/** Semitones of a chord's tones above its root, in chord order (root, 3rd, 5th, 7th...). */
function chordOffsets(chordId: string): number[] {
  const def = CHORDS.find((c) => c.id === chordId)!;
  return def.degrees.map(degreeSemitones);
}

/** All close-position voicings of the pitch classes with the lowest note in [lo, hi]. */
function closeVoicings(pcs: number[], lo: number, hi: number): number[][] {
  const out: number[][] = [];
  for (let inv = 0; inv < pcs.length; inv++) {
    const order = [...pcs.slice(inv), ...pcs.slice(0, inv)];
    for (let start = lo; start <= hi; start++) {
      if (mod12(start) !== order[0]) continue;
      const v = [start];
      for (const pc of order.slice(1)) {
        let n = v[v.length - 1] + 1;
        while (mod12(n) !== pc) n++;
        v.push(n);
      }
      out.push(v);
    }
  }
  return out;
}

function movement(a: number[], b: number[]): number {
  const n = Math.min(a.length, b.length);
  let sum = 0;
  for (let i = 0; i < n; i++) sum += Math.abs(a[i] - b[i]);
  return sum + Math.abs(a.reduce((x, y) => x + y, 0) / a.length - b.reduce((x, y) => x + y, 0) / b.length);
}

/** Upper voicing for a chord, as close as possible to the previous one (smooth voice leading). */
export function voiceLead(pcs: number[], prev: number[] | null, lo = 53, hi = 66): number[] {
  const options = closeVoicings(pcs, lo, hi);
  if (!prev) {
    // Root position, centred around middle C.
    const rootPos = options.filter((v) => mod12(v[0]) === pcs[0]);
    return rootPos.sort((a, b) => Math.abs(a[0] - 58) - Math.abs(b[0] - 58))[0] ?? options[0];
  }
  return options.sort((a, b) => movement(a, prev) - movement(b, prev))[0];
}

interface ChordSpec {
  /** Root MIDI in the bass. */
  bass: number;
  chordId: string;
}

function numeralChord(key: SpelledNote, tonality: Tonality, id: string, sevenths: boolean): ChordSpec {
  const def = numeralDef(tonality, id);
  let bass = bassTonic(key) + degreeSemitones(def.root);
  if (bass > 47) bass -= 12;
  return { bass, chordId: sevenths ? def.seventh : def.triad };
}

/** Block-chord playback of a chord sequence with bass and voice-led upper parts. */
export function chordSequenceEvents(chords: ChordSpec[], tempo: number, velocity = 70): PlayEvent[] {
  const step = Math.max(1, beat(tempo) * 2);
  let prev: number[] | null = null;
  return chords.map((c, i) => {
    const pcs = chordOffsets(c.chordId).map((o) => mod12(c.bass + o));
    const upper = voiceLead(pcs, prev);
    prev = upper;
    return { midi: [c.bass, ...upper], at: i * step, dur: i === chords.length - 1 ? step * 1.5 : step * 0.95, velocity };
  });
}

function chordSymbol(key: SpelledNote, rootDegree: string, chordId: string): string {
  const def = CHORDS.find((c) => c.id === chordId)!;
  return spelledName(spellDegree(key, rootDegree)) + def.symbol;
}

/** Keys are spelled the way they're usually written (F♯ minor, not G♭ minor). */
function keyFor(key: SpelledNote, tonality: Tonality): SpelledNote {
  return bestRootSpelling(key, tonality === "minor" ? ["2", "b3", "4", "5", "b6", "b7"] : ["2", "3", "4", "5", "6", "7"]);
}

function keyName(key: SpelledNote, tonality: Tonality) {
  return `${spelledName(key)} ${tonality}`;
}

// ---------------------------------------------------------------------------
// Progressions

function numeralChoices(tonality: Tonality, enabled: string[]): Choice[] {
  const set = new Set([TONIC[tonality], ...enabled]);
  return NUMERALS[tonality].filter((n) => set.has(n.id)).map((n) => ({ id: n.id, label: n.id, sub: n.hint }));
}

export function progressionTonality(cfg: ProgressionConfig, rng: () => number): Tonality {
  return pick(cfg.tonalities.length ? cfg.tonalities : (["major"] as Tonality[]), rng);
}

export function generateProgression(cfg: ProgressionConfig, s: KeyOpts, ctx: GenContext): Question {
  if (cfg.mode === "cadences") return generateCadence(cfg, s, ctx);
  const tonality = progressionTonality(cfg, ctx.rng);
  const key = keyFor(chooseKey(s, ctx.rng), tonality);
  const choices = numeralChoices(tonality, tonality === "major" ? cfg.major : cfg.minor);
  const allowed = new Set(choices.map((c) => c.id));
  const tonic = TONIC[tonality];
  const force = ctx.force && allowed.has(ctx.force) ? ctx.force : undefined;

  let numerals: string[] | undefined;
  if (cfg.style === "common") {
    let pool = COMMON_PROGRESSIONS[tonality].filter((p) => p.every((n) => allowed.has(n)) && p.slice(1).some((n) => n !== tonic));
    if (force) pool = pool.filter((p) => p.slice(1).includes(force));
    if (pool.length) numerals = [...pick(pool, ctx.rng)];
  }
  if (!numerals) {
    const len = Math.max(3, Math.min(8, cfg.length));
    numerals = [tonic];
    const ids = choices.map((c) => c.id);
    for (let i = 1; i < len; i++) {
      const options = ids.filter((id) => id !== numerals![i - 1]);
      numerals.push(weightedPick(options.length ? options : ids, tonality, { ...ctx, force: undefined, previous: undefined }));
    }
    if (force && !numerals.slice(1).includes(force)) numerals[1 + Math.floor(ctx.rng() * (len - 1))] = force;
  }

  const chords = numerals.map((n) => numeralChord(key, tonality, n, cfg.sevenths));
  const parts: QuestionPart[] = numerals.slice(1).map((n, i) => ({
    key: tonality,
    prompt: `Chord ${i + 2} of ${numerals!.length}?`,
    short: `Chord ${i + 2}`,
    choices,
    answer: n,
  }));
  const symbols = numerals.map((n) => {
    const d = numeralDef(tonality, n);
    return chordSymbol(key, d.root, cfg.sevenths ? d.seventh : d.triad);
  });

  return {
    drill: "progressions",
    uid: uid(),
    parts,
    events: chordSequenceEvents(chords, s.tempo),
    notes: [],
    root: { midi: bassTonic(key), spelled: key },
    reveal: `${keyName(key, tonality)}: ${numerals.join(" – ")}  (${symbols.join(" – ")})`,
    meta: { tonality, numerals, sevenths: cfg.sevenths },
  };
}

function generateCadence(cfg: ProgressionConfig, s: KeyOpts, ctx: GenContext): Question {
  const tonality = progressionTonality(cfg, ctx.rng);
  const key = keyFor(chooseKey(s, ctx.rng), tonality);
  const enabled = CADENCES.filter((c) => cfg.cadences.includes(c.id));
  const list = enabled.length ? enabled : CADENCES;
  const id = weightedPick(
    list.map((c) => c.id),
    "cadence",
    ctx,
  );
  const cad = CADENCES.find((c) => c.id === id)!;
  const opening = pick(CADENCE_OPENINGS[tonality], ctx.rng);
  const numerals = [...opening, ...cad.end[tonality]];
  const chords = numerals.map((n) => numeralChord(key, tonality, n, cfg.sevenths));
  return {
    drill: "progressions",
    uid: uid(),
    parts: [
      {
        key: "cadence",
        prompt: "Which cadence ends the phrase?",
        choices: list.map((c) => ({ id: c.id, label: c.name, sub: c.sub })),
        answer: id,
      },
    ],
    events: chordSequenceEvents(chords, s.tempo),
    notes: [],
    root: { midi: bassTonic(key), spelled: key },
    reveal: `${cad.name} cadence in ${keyName(key, tonality)}: ${numerals.join(" – ")}`,
    meta: { tonality, numerals, sevenths: cfg.sevenths },
  };
}

// ---------------------------------------------------------------------------
// Functional hearing: scale degrees after a cadence.

const REGISTER_TONIC: Record<"bass" | "mid" | "high", number> = { bass: 36, mid: 55, high: 67 };

export function generateFunctional(cfg: FunctionalConfig, s: KeyOpts, ctx: GenContext): Question {
  const tonality: Tonality = pick(cfg.tonalities.length ? cfg.tonalities : (["major"] as Tonality[]), ctx.rng);
  const key = keyFor(chooseKey(s, ctx.rng), tonality);
  const enabled = (tonality === "major" ? cfg.major : cfg.minor).filter((d) => FUNCTIONAL_DEGREES.some((f) => f.id === d));
  const ids = enabled.length >= 2 ? enabled : ["1", "3", "5"];
  const n = Math.max(1, Math.min(4, cfg.notes));
  const register = pick(cfg.registers.length ? cfg.registers : (["mid"] as const), ctx.rng);
  // Tonic in the register's starting octave.
  let tonicMidi = REGISTER_TONIC[register];
  while (mod12(tonicMidi) !== pitchClass(key)) tonicMidi++;

  const degrees: string[] = [];
  for (let i = 0; i < n; i++) {
    degrees.push(weightedPick(ids, tonality, { ...ctx, force: undefined, previous: i === 0 ? ctx.previous : degrees[i - 1] }));
  }
  if (ctx.force && ids.includes(ctx.force) && !degrees.includes(ctx.force)) degrees[Math.floor(ctx.rng() * n)] = ctx.force;

  // Place each note in the octave closest to the previous note (melodic), within the register.
  const midis: number[] = [];
  degrees.forEach((d, i) => {
    const base = tonicMidi + mod12(degreeSemitones(d));
    const prev = i ? midis[i - 1] : tonicMidi + 5;
    const options = [base - 12, base, base + 12].filter((m) => m >= REGISTER_TONIC[register] - 5 && m <= REGISTER_TONIC[register] + 19);
    midis.push(options.sort((a, b) => Math.abs(a - prev) - Math.abs(b - prev))[0] ?? base);
  });

  const b = beat(s.tempo);
  const events: PlayEvent[] = midis.map((m, i) => ({ midi: [m], at: i * b, dur: i === n - 1 ? b * 1.8 : b * 0.95, velocity: 90 }));
  const notes: QuestionNote[] = degrees.map((d, i) => ({ midi: midis[i], spelled: spellDegree(key, d), degree: d }));
  const choices: Choice[] = FUNCTIONAL_DEGREES.filter((f) => ids.includes(f.id)).map((f) => ({ id: f.id, label: degreeLabel(f.id), sub: f.name || undefined }));

  return {
    drill: "functional",
    uid: uid(),
    parts: degrees.map((d, i) => ({ key: tonality, prompt: n > 1 ? `Note ${i + 1} of ${n}: which degree?` : "Which scale degree?", short: `Note ${i + 1}`, choices, answer: d })),
    lead: cadenceEvents(tonicMidi, s.tempo, tonality === "minor").events,
    events,
    notes,
    root: { midi: tonicMidi, spelled: key },
    reveal: `${keyName(key, tonality)}${register === "bass" ? " (bass)" : ""}: ${degrees.map(degreeLabel).join(" – ")}  (${notes.map((x) => spelledName(x.spelled)).join(" ")})`,
    meta: { tonality, degrees },
    piano:
      n === 1
        ? { mode: "degree", given: [tonicMidi], instruction: `The tonic ${spelledName(key)} is highlighted. Play the note you heard`, range: octavesFrom(tonicMidi, 2) }
        : undefined,
  };
}

// ---------------------------------------------------------------------------
// Chord tones over a backing track.

/** The degree (relative to the chord root) that a generic tone means on a given chord. */
export function toneDegree(chordId: string, tone: string): string | null {
  const def = CHORDS.find((c) => c.id === chordId)!;
  const byNumber = (n: number) => def.degrees.find((d) => parseDegree(d).number === n) ?? null;
  const minorish = def.degrees.includes("b3");
  switch (tone) {
    case "1":
      return "1";
    case "3":
      return byNumber(3);
    case "5":
      return byNumber(5);
    case "7":
      return byNumber(7);
    case "9":
      return "9";
    case "11":
      return minorish ? "11" : "#11";
    case "13":
      return chordId === "m7b5" ? "b13" : "13";
  }
  return null;
}

export function generateChordTones(cfg: ChordToneConfig, s: KeyOpts, ctx: GenContext): Question {
  const sets = BACKING_SETS.filter((b) => cfg.sets.includes(b.id));
  const set = pick(sets.length ? sets : BACKING_SETS.slice(0, 1), ctx.rng);
  const key = keyFor(chooseKey(s, ctx.rng), set.tonality);
  const tones = CHORD_TONES.filter((t) => cfg.tones.includes(t.id)).map((t) => t.id);
  const toneIds = tones.length >= 2 ? tones : ["1", "3", "5", "7"];
  const b = beat(s.tempo);
  const bar = b * 4;

  const chords = set.chords.map(([deg, chordId]) => {
    let root = bassTonic(key) + degreeSemitones(deg);
    if (root > 47) root -= 12;
    return { root, chordId, deg };
  });

  // Pick a tone for each bar that exists on that chord.
  const picks: string[] = chords.map((c, i) => {
    const ok = toneIds.filter((t) => toneDegree(c.chordId, t) !== null);
    return weightedPick(ok.length ? ok : ["1"], "tone", { ...ctx, force: undefined, previous: i ? undefined : ctx.previous });
  });
  if (ctx.force && toneIds.includes(ctx.force) && !picks.includes(ctx.force)) {
    const slot = chords.findIndex((c) => toneDegree(c.chordId, ctx.force!) !== null);
    if (slot >= 0) picks[slot] = ctx.force;
  }

  const events: PlayEvent[] = [];
  const under: PlayEvent[] = [];
  const notes: QuestionNote[] = [];
  let prev: number[] | null = null;
  chords.forEach((c, i) => {
    const t0 = i * bar;
    const offs = chordOffsets(c.chordId);
    const pcs = offs.map((o) => mod12(c.root + o));
    const upper = voiceLead(pcs.slice(0, 4), prev, 52, 62);
    prev = upper;
    // Comping: chord on 1 and the "and" of 2, bass on 1 and 3.
    under.push({ midi: upper, at: t0, dur: b * 1.4, velocity: 48 });
    under.push({ midi: upper, at: t0 + b * 2.5, dur: b * 1.3, velocity: 42 });
    under.push({ midi: [c.root], at: t0, dur: b * 1.9, velocity: 68 });
    under.push({ midi: [c.root + (offs.includes(7) ? 7 : offs[2] ?? 7)], at: t0 + b * 2, dur: b * 1.9, velocity: 60 });
    // The target note: beat 2, above the comping.
    const deg = toneDegree(c.chordId, picks[i])!;
    let target = c.root + mod12(degreeSemitones(deg));
    while (target < 67) target += 12;
    while (target > 84) target -= 12;
    events.push({ midi: [target], at: t0 + b, dur: b * 1.5, velocity: 105 });
    const rootSpelled = spellDegree(key, c.deg);
    notes.push({ midi: target, spelled: spellDegree(rootSpelled, deg), degree: deg });
  });

  const symbols = chords.map((c) => chordSymbol(key, c.deg, c.chordId));
  const choices = CHORD_TONES.filter((t) => toneIds.includes(t.id)).map((t) => ({ id: t.id, label: t.name }));
  return {
    drill: "chordtones",
    uid: uid(),
    parts: picks.map((t, i) => ({ key: "tone", prompt: `Bar ${i + 1}, over ${symbols[i]}: which chord tone?`, short: `Bar ${i + 1} (${symbols[i]})`, choices, answer: t })),
    events,
    under,
    notes,
    root: { midi: bassTonic(key), spelled: key },
    reveal: `${set.name} in ${spelledName(key)}: ${symbols.map((sym, i) => `${sym} → ${spelledName(notes[i].spelled)} (${CHORD_TONES.find((t) => t.id === picks[i])!.name})`).join(" · ")}`,
    meta: { backing: chords.map((c) => ({ root: c.root, chord: c.chordId })) },
  };
}

// ---------------------------------------------------------------------------
// "Hear yours" for harmony drills.

export function harmonyPreview(q: Question, partKey: string, answerId: string, partIndex: number, tempo: number): PlayEvent[] | null {
  const m = q.meta;
  if (q.drill === "progressions" && m?.numerals && m.tonality) {
    const nums = [...m.numerals];
    if (partKey === "cadence") {
      const cad = CADENCES.find((c) => c.id === answerId);
      if (!cad) return null;
      nums.splice(nums.length - 2, 2, ...cad.end[m.tonality]);
    } else {
      if (!numeralDef(m.tonality, answerId)) return null;
      nums[partIndex + 1] = answerId;
    }
    return chordSequenceEvents(
      nums.map((n) => numeralChord(q.root.spelled, m.tonality!, n, !!m.sevenths)),
      tempo,
    );
  }
  if (q.drill === "functional" && m?.tonality) {
    const tonic = q.root.midi;
    const target = q.notes[partIndex]?.midi ?? tonic;
    const midi = target - mod12(target - tonic) + mod12(degreeSemitones(answerId));
    const triad = m.tonality === "minor" ? [0, 3, 7] : [0, 4, 7];
    return [
      { midi: triad.map((o) => tonic + o - (tonic > 60 ? 12 : 0)), at: 0, dur: 1.2, velocity: 55 },
      { midi: [midi], at: 1.3, dur: 1.4, velocity: 90 },
    ];
  }
  if (q.drill === "chordtones" && m?.backing) {
    const c = m.backing[partIndex];
    const deg = c && toneDegree(c.chord, answerId);
    if (!c || !deg) return null;
    const pcs = chordOffsets(c.chord).map((o) => mod12(c.root + o));
    let target = c.root + mod12(degreeSemitones(deg));
    while (target < 67) target += 12;
    return [
      { midi: [c.root, ...voiceLead(pcs.slice(0, 4), null, 52, 62)], at: 0, dur: 2, velocity: 50 },
      { midi: [target], at: 0.5, dur: 1.5, velocity: 105 },
    ];
  }
  return null;
}
