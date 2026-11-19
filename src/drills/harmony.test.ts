import { describe, expect, it } from "vitest";
import { CHORDS } from "../theory/catalog";
import { NUMERALS } from "../theory/harmony";
import { degreeSemitones, pitchClass } from "../theory/notes";
import { DEFAULT_CONFIGS } from "./config";
import { evaluatePiano } from "./evaluate";
import { answerPreview, generate, type GenContext } from "./generate";
import { toneDegree, voiceLead } from "./harmony";
import type { DrillConfigs } from "./types";

const s = { randomKey: true, fixedRoot: 0, randomRegister: true, tempo: 90 };
const ctx = (): GenContext => ({ rng: Math.random, weight: () => 1 });
const mod12 = (n: number) => ((n % 12) + 12) % 12;

describe("voice leading", () => {
  it("moves little between chords", () => {
    const c = voiceLead([0, 4, 7], null);
    const f = voiceLead([5, 9, 0], c);
    const moved = f.reduce((a, n, i) => a + Math.abs(n - c[i]), 0);
    expect(moved).toBeLessThanOrEqual(4); // C–E–G → C–F–A
  });
});

describe("progressions", () => {
  it("plays the chords it asks about", () => {
    for (let i = 0; i < 100; i++) {
      const cfg: DrillConfigs = { ...DEFAULT_CONFIGS, progressions: { ...DEFAULT_CONFIGS.progressions, tonalities: ["major", "minor"], style: i % 2 ? "common" : "random" } };
      const q = generate("progressions", cfg, s, ctx());
      const tonality = q.meta!.tonality!;
      const tonicPc = pitchClass(q.root.spelled);
      q.meta!.numerals!.forEach((n, k) => {
        const def = NUMERALS[tonality].find((x) => x.id === n)!;
        const bassPc = mod12(q.events[k].midi[0]);
        expect(bassPc).toBe(mod12(tonicPc + degreeSemitones(def.root)));
        const chord = CHORDS.find((c) => c.id === def.triad)!;
        const expected = new Set(chord.degrees.map((d) => mod12(bassPc + degreeSemitones(d))));
        expect(new Set(q.events[k].midi.map(mod12))).toEqual(expected);
      });
      expect(q.parts.map((p) => p.answer)).toEqual(q.meta!.numerals!.slice(1));
      for (const p of q.parts) expect(p.choices.map((c) => c.id)).toContain(p.answer);
    }
  });

  it("cadence mode asks one question", () => {
    const cfg = { ...DEFAULT_CONFIGS, progressions: { ...DEFAULT_CONFIGS.progressions, mode: "cadences" as const } };
    const q = generate("progressions", cfg, s, ctx());
    expect(q.parts).toHaveLength(1);
    expect(answerPreview(q, "cadence", "plagal", 90, 0)).not.toBeNull();
  });

  it("forces a requested numeral into the progression", () => {
    for (let i = 0; i < 30; i++) {
      const q = generate("progressions", DEFAULT_CONFIGS, s, { ...ctx(), force: "iii" });
      expect(q.meta!.numerals!.slice(1)).toContain("iii");
    }
  });
});

describe("functional", () => {
  it("notes are the degrees asked", () => {
    for (let i = 0; i < 100; i++) {
      const cfg = { ...DEFAULT_CONFIGS, functional: { ...DEFAULT_CONFIGS.functional, notes: 3, tonalities: ["major", "minor"] as ("major" | "minor")[], registers: ["bass", "mid", "high"] as ("bass" | "mid" | "high")[] } };
      const q = generate("functional", cfg, s, ctx());
      q.parts.forEach((p, k) => {
        expect(mod12(q.events[k].midi[0] - q.root.midi)).toBe(mod12(degreeSemitones(p.answer)));
      });
      expect(q.lead?.length).toBe(4);
    }
  });

  it("scores piano answers as degrees", () => {
    const q = generate("functional", DEFAULT_CONFIGS, s, ctx());
    expect(evaluatePiano(q, [q.notes[0].midi + 12])).toBe(q.parts[0].answer);
  });
});

describe("chord tones", () => {
  it("plays the requested tone over each chord", () => {
    const cfg = { ...DEFAULT_CONFIGS, chordtones: { sets: ["ii-V-I", "blues", "pop", "minor-ii-V-i"], tones: ["1", "3", "5", "7", "9", "11", "13"] } };
    for (let i = 0; i < 100; i++) {
      const q = generate("chordtones", cfg, s, ctx());
      q.parts.forEach((p, k) => {
        const c = q.meta!.backing![k];
        const deg = toneDegree(c.chord, p.answer)!;
        expect(mod12(q.events[k].midi[0] - c.root)).toBe(mod12(degreeSemitones(deg)));
        expect(answerPreview(q, "tone", "1", 90, k)).not.toBeNull();
      });
      expect(q.under!.length).toBeGreaterThan(0);
    }
  });

  it("knows which 3rd and 7th a chord has", () => {
    expect(toneDegree("min7", "3")).toBe("b3");
    expect(toneDegree("dom7", "7")).toBe("b7");
    expect(toneDegree("dim7", "7")).toBe("bb7");
    expect(toneDegree("maj", "7")).toBeNull();
    expect(toneDegree("maj7", "11")).toBe("#11");
  });
});
