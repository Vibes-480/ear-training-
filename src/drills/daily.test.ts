import { describe, expect, it } from "vitest";
import { applyAttempt, BOX_INTERVALS_MS, type Progress } from "../store/progress";
import { DEFAULT_CONFIGS } from "./config";
import { buildDailyPlan, interleave } from "./daily";
import { cadenceEvents, generate } from "./generate";

const empty: Progress = { version: 1, items: {}, confusions: {}, days: {}, sessions: [] };
const att = (correctId: string, answeredId: string, at: number) => ({ drill: "intervals", part: "interval", correctId, answeredId, ms: 1000, at });

describe("spaced repetition", () => {
  it("promotes only when due and demotes on a miss", () => {
    const t = 1_700_000_000_000;
    let p = applyAttempt(empty, att("M3", "M3", t));
    expect(p.items["intervals:interval:M3"].box).toBe(1);
    // Same day again: not due, stays in box 1.
    p = applyAttempt(p, att("M3", "M3", t + 60_000));
    expect(p.items["intervals:interval:M3"].box).toBe(1);
    // After it's due: promoted.
    p = applyAttempt(p, att("M3", "M3", t + BOX_INTERVALS_MS[1] + 1));
    expect(p.items["intervals:interval:M3"].box).toBe(2);
    p = applyAttempt(p, att("M3", "P4", t + BOX_INTERVALS_MS[1] + 2));
    expect(p.items["intervals:interval:M3"].box).toBe(0);
    expect(p.items["intervals:interval:M3"].due).toBe(t + BOX_INTERVALS_MS[1] + 2 + BOX_INTERVALS_MS[0]);
  });
});

describe("daily plan", () => {
  it("puts due items first, includes new ones and fills to length", () => {
    const now = 1_700_000_000_000;
    let p = empty;
    p = applyAttempt(p, att("m2", "M2", now - 86_400_000)); // missed yesterday: due
    p = applyAttempt(p, att("P5", "P5", now - 1000)); // just learned: not due
    const plan = buildDailyPlan(p, DEFAULT_CONFIGS, ["intervals", "chords"], 20, now, Math.random);
    expect(plan.queue).toHaveLength(20);
    expect(plan.dueCount).toBe(1);
    expect(plan.newCount).toBeGreaterThanOrEqual(2);
    expect(plan.queue.some((e) => e.item === "m2")).toBe(true);
    for (let i = 1; i < plan.queue.length; i++) {
      const a = plan.queue[i - 1];
      const b = plan.queue[i];
      expect(a.drill === b.drill && a.item === b.item).toBe(false);
    }
  });

  it("interleaves drills", () => {
    const q = interleave(
      [
        { drill: "intervals", item: "a" },
        { drill: "intervals", item: "b" },
        { drill: "chords", item: "c" },
        { drill: "chords", item: "d" },
      ],
      Math.random,
    );
    for (let i = 1; i < q.length; i++) expect(q[i].drill).not.toBe(q[i - 1].drill);
  });

  it("forced items are asked", () => {
    const q = generate("chords", DEFAULT_CONFIGS, { randomKey: true, fixedRoot: 0, randomRegister: true, tempo: 90 }, { rng: Math.random, weight: () => 1, force: "dim7" });
    expect(q.parts[0].answer).toBe("dim7");
  });
});

describe("key context", () => {
  it("cadence ends on the tonic chord", () => {
    const { events } = cadenceEvents(62, 90);
    expect(events).toHaveLength(4);
    const last = events[3].midi;
    expect(last.every((m) => [2, 6, 9].includes(m % 12))).toBe(true);
  });
  it("adds a lead-in when context is on", () => {
    const q = generate("intervals", DEFAULT_CONFIGS, { randomKey: true, fixedRoot: 0, randomRegister: true, tempo: 90, context: "cadence" }, { rng: Math.random, weight: () => 1 });
    expect(q.lead?.length).toBe(4);
  });
});
