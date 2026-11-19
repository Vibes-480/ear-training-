import { describe, expect, it } from "vitest";
import {
  alignedCell,
  checkMelody,
  checkRhythmCells,
  makeMelody,
  makeRhythm,
  onsets,
  rhythmEvents,
  RHYTHM_CELLS,
  scoreTaps,
  spellMelodyNote,
  totalBeats,
} from "./dictation";
import { pitchClass } from "../theory/notes";

const ctx = { rng: Math.random, weight: () => 1 };

describe("melody", () => {
  it("builds melodies in the key, within range and leap limit", () => {
    for (let i = 0; i < 200; i++) {
      const m = makeMelody(
        { tonalities: ["major", "minor"], degreesMajor: ["1", "2", "3", "4", "5", "6", "7"], degreesMinor: ["1", "2", "b3", "4", "5", "b6", "b7", "7"], length: 6, maxLeap: 7, giveFirst: true },
        { randomKey: true, fixedRoot: 0 },
        ctx,
      );
      expect(m.notes).toHaveLength(6);
      for (let k = 1; k < m.notes.length; k++) expect(Math.abs(m.notes[k].midi - m.notes[k - 1].midi)).toBeLessThanOrEqual(12);
      for (const n of m.notes) {
        expect(n.midi).toBeGreaterThanOrEqual(m.tonic - 5);
        expect(n.midi).toBeLessThanOrEqual(m.tonic + 16);
        const sp = spellMelodyNote(n.midi, m);
        expect(pitchClass(sp)).toBe(((n.midi % 12) + 12) % 12);
      }
    }
  });

  it("forgives a whole-melody octave shift but not a single wrong octave", () => {
    expect(checkMelody([60, 62, 64], [72, 74, 76])).toEqual([true, true, true]);
    expect(checkMelody([60, 62, 64], [60, 74, 64])).toEqual([true, false, true]);
    expect(checkMelody([60, 62, 64], [60])).toEqual([true, false, false]);
  });
});

describe("rhythm", () => {
  it("fills every bar exactly", () => {
    for (let i = 0; i < 200; i++) {
      const cells = makeRhythm({ cells: RHYTHM_CELLS.map((c) => c.id), bars: 2, beatsPerBar: 4, metronome: true }, ctx);
      expect(totalBeats(cells)).toBe(8);
      // No cell crosses a barline.
      let t = 0;
      for (const id of cells) {
        const c = RHYTHM_CELLS.find((x) => x.id === id)!;
        expect(Math.floor(t / 4)).toBe(Math.floor((t + c.beats - 0.001) / 4));
        t += c.beats;
      }
    }
  });

  it("computes onsets and treats equivalent rhythms as equal", () => {
    expect(onsets(["q", "88", "8r8", "h"])).toEqual([0, 1, 1.5, 2.5, 3]);
    // Two quarters vs a half note differ.
    expect(checkRhythmCells(["h"], ["q", "q"])).toEqual([false]);
    expect(checkRhythmCells(["q", "88"], ["q", "88"])).toEqual([true, true]);
    expect(checkRhythmCells(["q", "88"], ["q", "8.16"])).toEqual([true, false]);
  });

  it("aligns entered cells for confusion stats", () => {
    expect(alignedCell(["q", "88"], ["q", "8.16"], 1)).toBe("8.16");
    expect(alignedCell(["h", "q"], ["q", "q", "q"], 1)).toBe("q");
  });

  it("plays a count-in then the notes", () => {
    const { events, start } = rhythmEvents(["q", "88"], { cells: [], bars: 1, beatsPerBar: 4, metronome: false }, 60);
    expect(start).toBe(4);
    expect(events.filter((e) => e.midi[0] < 0)).toHaveLength(4);
    expect(events.filter((e) => e.midi[0] > 0).map((e) => e.at)).toEqual([4, 5, 5.5]);
  });

  it("scores taps with tolerance", () => {
    expect(scoreTaps([0, 1, 1.5], [0.05, 0.97, 1.6])).toEqual({ hits: [true, true, true], extra: 0 });
    expect(scoreTaps([0, 1], [0, 0.5, 1.4])).toEqual({ hits: [true, false], extra: 2 });
  });
});
