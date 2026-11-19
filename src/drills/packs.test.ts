import { describe, expect, it } from "vitest";
import { configProblem } from "../components/DrillOptions";
import { NUMERALS } from "../theory/harmony";
import { generate } from "./generate";
import { voiceChord } from "./generate";
import { CHORDS } from "../theory/catalog";
import { CURRICULUM, moduleConfigs, PACKS } from "./packs";
import { degreeSemitones } from "../theory/notes";

const s = { randomKey: true, fixedRoot: 0, randomRegister: true, tempo: 90 };
const modules = [...PACKS.flatMap((p) => p.modules), ...CURRICULUM];

describe("packs and curriculum", () => {
  it("have unique ids", () => {
    const ids = modules.map((m) => m.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it.each(modules.map((m) => [m.id, m] as const))("%s is valid and generates questions", (_id, mod) => {
    const cfgs = moduleConfigs(mod);
    expect(configProblem(mod.drill, cfgs)).toBeNull();
    const p = cfgs.progressions;
    if (mod.drill === "progressions") {
      for (const t of ["major", "minor"] as const) {
        const known = new Set(NUMERALS[t].map((n) => n.id));
        for (const id of t === "major" ? p.major : p.minor) expect(known.has(id), `${id} in ${t}`).toBe(true);
        for (const tpl of p.templates?.[t] ?? []) for (const id of tpl) expect(known.has(id), `${id} in ${t} template`).toBe(true);
      }
    }
    for (let i = 0; i < 25; i++) {
      const q = generate(mod.drill, cfgs, s, { rng: Math.random, weight: () => 1 });
      for (const part of q.parts) expect(part.choices.map((c) => c.id)).toContain(part.answer);
    }
  });

  it("pack progressions use their own templates", () => {
    const pop = PACKS.find((p) => p.id === "pop")!.modules[0];
    const cfgs = moduleConfigs(pop);
    const templates = cfgs.progressions.templates!.major!.map((t) => t.join(" "));
    for (let i = 0; i < 30; i++) {
      const q = generate("progressions", cfgs, s, { rng: Math.random, weight: () => 1 });
      expect(templates).toContain(q.meta!.numerals!.join(" "));
    }
  });
});

describe("voicings", () => {
  const dom7 = CHORDS.find((c) => c.id === "dom7")!;
  it("shell = root, 3rd, 7th", () => {
    expect(voiceChord(dom7, 0, "shell").map((v) => v.degree)).toEqual(["1", "3", "b7"]);
  });
  it("rootless has no root above the bass and adds the 9th", () => {
    const v = voiceChord(dom7, 0, "rootless");
    expect(v[0]).toEqual({ offset: -12, degree: "1" });
    expect(v.slice(1).map((x) => x.degree)).toEqual(["3", "5", "b7", "9"]);
    const b = voiceChord(dom7, 1, "rootless");
    expect(b[1].degree).toBe("b7");
    for (let i = 2; i < b.length; i++) expect(b[i].offset).toBeGreaterThan(b[i - 1].offset);
  });
  it("drop-2 spreads a 7th chord beyond an octave", () => {
    const v = voiceChord(dom7, 0, "open");
    const span = Math.max(...v.map((x) => x.offset)) - Math.min(...v.map((x) => x.offset));
    expect(span).toBeGreaterThan(12);
    expect(new Set(v.map((x) => ((x.offset % 12) + 12) % 12))).toEqual(new Set(dom7.degrees.map((d) => degreeSemitones(d) % 12)));
  });
});
