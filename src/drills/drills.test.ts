import { describe, expect, it } from "vitest";
import { CHORDS, INTERVALS, SCALES } from "../theory/catalog";
import { degreeSemitones, pitchClass, spellDegree, spellDegreeBelow, spelledName, type SpelledNote } from "../theory/notes";
import { applyAttempt, currentStreak, localDay, type Progress } from "../store/progress";
import { DEFAULT_CONFIGS } from "./config";
import { evaluatePiano, OTHER } from "./evaluate";
import { answerPreview, chordVoicing, generate, weightedPick, type GenContext } from "./generate";
import { chooseRoot } from "./register";
import type { DrillId } from "./types";

const n = (letter: SpelledNote["letter"], acc = 0): SpelledNote => ({ letter, acc });

function seeded(seed: number) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
}

const ctx = (seed = 1): GenContext => ({ rng: seeded(seed), weight: () => 1 });
const baseSettings = { randomKey: true, fixedRoot: 0, randomRegister: true, tempo: 90 };

describe("spelling", () => {
  it("spells degrees in flat and sharp keys", () => {
    expect(spelledName(spellDegree(n("E", -1), "3"))).toBe("G");
    expect(spelledName(spellDegree(n("E", -1), "b7"))).toBe("D♭");
    expect(spelledName(spellDegree(n("F", 1), "3"))).toBe("A♯");
    expect(spelledName(spellDegree(n("B"), "#9"))).toBe("C𝄪");
    expect(spelledName(spellDegree(n("C"), "bb7"))).toBe("B𝄫");
    expect(spelledName(spellDegree(n("D", -1), "#4"))).toBe("G");
  });

  it("spells below a note", () => {
    expect(spelledName(spellDegreeBelow(n("C"), "3"))).toBe("A♭");
    expect(spelledName(spellDegreeBelow(n("G"), "b3"))).toBe("E");
    expect(spelledName(spellDegreeBelow(n("E", -1), "5"))).toBe("A♭");
  });

  it("every catalog interval's degree matches its semitone count", () => {
    for (const i of INTERVALS) expect(degreeSemitones(i.degree)).toBe(i.semitones);
  });

  it("spelled chord tones always have the right pitch", () => {
    for (const root of [n("C"), n("E", -1), n("F", 1), n("B")]) {
      for (const c of CHORDS) {
        for (const d of c.degrees) {
          expect(pitchClass(spellDegree(root, d))).toBe((pitchClass(root) + degreeSemitones(d)) % 12);
        }
      }
    }
  });
});

describe("register", () => {
  it("keeps every note in range", () => {
    const rng = seeded(7);
    for (let i = 0; i < 200; i++) {
      const r = chooseRoot([0, 21], { ...baseSettings }, rng);
      expect(r.midi).toBeGreaterThanOrEqual(40);
      expect(r.midi + 21).toBeLessThanOrEqual(88);
      expect(((r.midi % 12) + 12) % 12).toBe(pitchClass(r.spelled));
    }
  });

  it("uses the fixed key and middle register when randomness is off", () => {
    const r = chooseRoot([0, 4, 7], { randomKey: false, fixedRoot: 0, randomRegister: false }, Math.random);
    expect(spelledName(r.spelled)).toBe("C");
    expect(r.midi).toBe(60);
  });
});

describe("chord voicings", () => {
  it("puts the right tone in the bass for each inversion", () => {
    const dom7 = CHORDS.find((c) => c.id === "dom7")!;
    for (let inv = 0; inv < 4; inv++) {
      const v = chordVoicing(dom7.degrees, inv);
      const bassIdx = v.indexOf(Math.min(...v));
      expect(bassIdx).toBe(inv);
    }
  });
});

describe("question generation", () => {
  const drills: DrillId[] = ["intervals", "chords", "scales", "pitch"];
  it.each(drills)("%s questions are well-formed", (drill) => {
    for (let seed = 1; seed < 60; seed++) {
      const q = generate(drill, DEFAULT_CONFIGS, baseSettings, ctx(seed));
      expect(q.parts.length).toBeGreaterThan(0);
      for (const p of q.parts) expect(p.choices.map((c) => c.id)).toContain(p.answer);
      expect(q.events.length).toBeGreaterThan(0);
      for (const e of q.events) for (const m of e.midi) expect(m).toBeGreaterThan(20);
    }
  });

  it("interval notes match the interval asked", () => {
    for (let seed = 1; seed < 100; seed++) {
      const q = generate("intervals", DEFAULT_CONFIGS, baseSettings, ctx(seed));
      const def = INTERVALS.find((i) => i.id === q.parts[0].answer)!;
      expect(Math.abs(q.notes[1].midi - q.notes[0].midi)).toBe(def.semitones);
      // The spelled upper/lower notes really are that interval apart.
      const [a, b] = q.notes;
      expect(((b.midi - a.midi) % 12 + 12) % 12).toBe(((pitchClass(b.spelled) - pitchClass(a.spelled)) % 12 + 12) % 12);
    }
  });

  it("asks inversions only when enabled", () => {
    const cfgs = { ...DEFAULT_CONFIGS, chords: { ...DEFAULT_CONFIGS.chords, askInversion: true } };
    const q = generate("chords", cfgs, baseSettings, ctx(3));
    expect(q.parts.map((p) => p.key)).toEqual(["quality", "inversion"]);
  });

  it("weighted pick favours heavier items and avoids repeats", () => {
    const rng = seeded(11);
    const counts: Record<string, number> = { a: 0, b: 0 };
    for (let i = 0; i < 2000; i++) counts[weightedPick(["a", "b"], "x", { rng, weight: (_p, id) => (id === "a" ? 3 : 1) })]++;
    expect(counts.a).toBeGreaterThan(counts.b * 2);
  });

  it("answer previews exist for every drill", () => {
    for (const drill of drills) {
      const q = generate(drill, DEFAULT_CONFIGS, baseSettings, ctx(5));
      const other = q.parts[0].choices.find((c) => c.id !== q.parts[0].answer)!;
      expect(answerPreview(q, q.parts[0].key, other.id, 90)).not.toBeNull();
    }
  });
});

describe("piano answers", () => {
  it("scores intervals in both directions", () => {
    for (let seed = 1; seed < 40; seed++) {
      const q = generate("intervals", DEFAULT_CONFIGS, baseSettings, ctx(seed));
      expect(evaluatePiano(q, [q.notes[1].midi])).toBe(q.parts[0].answer);
    }
  });

  it("accepts chord tones in any octave and spots the chord you played instead", () => {
    const q = generate("chords", DEFAULT_CONFIGS, baseSettings, ctx(9));
    const root = q.piano!.given[0];
    const def = CHORDS.find((c) => c.id === q.parts[0].answer)!;
    const played = def.degrees.map((d, i) => root + degreeSemitones(d) + (i % 2 ? 12 : 0));
    expect(evaluatePiano(q, played)).toBe(def.id);
    const other = CHORDS.find((c) => c.id === "maj")!;
    const otherPlayed = other.degrees.map((d) => root + degreeSemitones(d));
    expect(evaluatePiano(q, otherPlayed)).toBe("maj");
    expect(evaluatePiano(q, [root, root + 1])).toBe(OTHER);
  });

  it("scores scales", () => {
    const q = generate("scales", DEFAULT_CONFIGS, baseSettings, ctx(4));
    const def = SCALES.find((s) => s.id === q.parts[0].answer)!;
    expect(evaluatePiano(q, def.degrees.map((d) => q.piano!.given[0] + degreeSemitones(d)))).toBe(def.id);
  });
});

describe("progress", () => {
  const empty: Progress = { version: 1, items: {}, confusions: {}, days: {}, sessions: [] };

  it("records accuracy and confusions", () => {
    let p = applyAttempt(empty, { drill: "intervals", part: "interval", correctId: "m6", answeredId: "P5", ms: 2000 });
    p = applyAttempt(p, { drill: "intervals", part: "interval", correctId: "m6", answeredId: "m6", ms: 1000 });
    const item = p.items["intervals:interval:m6"];
    expect(item.attempts).toBe(2);
    expect(item.correct).toBe(1);
    expect(item.totalMs).toBe(1000);
    expect(p.confusions["intervals:interval"].m6.P5).toBe(1);
    expect(p.days[localDay()].questions).toBe(2);
  });

  it("counts streaks", () => {
    const day = 86_400_000;
    const now = Date.now();
    const days = { [localDay(now)]: { questions: 1, correct: 1, ms: 0 }, [localDay(now - day)]: { questions: 1, correct: 1, ms: 0 } };
    expect(currentStreak({ ...empty, days }, now)).toBe(2);
    expect(currentStreak(empty, now)).toBe(0);
  });
});

describe("enharmonic spelling", () => {
  it("never uses double accidentals for chords and scales", () => {
    for (let seed = 1; seed < 400; seed++) {
      for (const drill of ["chords", "scales"] as const) {
        const cfgs = {
          ...DEFAULT_CONFIGS,
          chords: { ...DEFAULT_CONFIGS.chords, enabled: CHORDS.filter((c) => c.id !== "dim7").map((c) => c.id) },
          scales: { ...DEFAULT_CONFIGS.scales, enabled: ["ionian", "dorian", "phrygian", "lydian", "mixolydian", "aeolian", "locrian", "harmMinor", "melMinor"] },
        };
        const q = generate(drill, cfgs, baseSettings, ctx(seed));
        for (const note of q.notes) expect(Math.abs(note.spelled.acc), `${q.reveal}`).toBeLessThan(2);
      }
    }
  });
});
