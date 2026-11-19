import { describe, expect, it } from "vitest";
import { applyAttempt, type Progress } from "../store/progress";
import { mergeProgress, newer } from "./merge";

const empty: Progress = { version: 1, items: {}, confusions: {}, days: {}, sessions: [] };
const att = (correctId: string, answeredId: string, at: number) => ({ drill: "intervals", part: "interval", correctId, answeredId, ms: 1000, at });

describe("merge", () => {
  it("keeps practice from both devices", () => {
    const t = 1_700_000_000_000;
    let phone = applyAttempt(empty, att("m3", "M3", t));
    phone = applyAttempt(phone, att("m3", "m3", t + 1));
    let laptop = applyAttempt(empty, att("P5", "P5", t + 2));
    laptop = { ...laptop, sessions: [{ at: t + 5, drill: "intervals", total: 1, correct: 1 }] };
    phone = { ...phone, sessions: [{ at: t + 3, drill: "intervals", total: 2, correct: 1 }] };

    const m = mergeProgress(phone, laptop);
    expect(Object.keys(m.items).sort()).toEqual(["intervals:interval:P5", "intervals:interval:m3"]);
    expect(m.items["intervals:interval:m3"].attempts).toBe(2);
    expect(m.confusions["intervals:interval"].m3.M3).toBe(1);
    expect(m.sessions).toHaveLength(2);
    // Merging is idempotent and order-independent for item data.
    expect(mergeProgress(m, laptop).items).toEqual(m.items);
    expect(mergeProgress(laptop, phone).items).toEqual(m.items);
  });

  it("keeps the more advanced copy of the same item", () => {
    const t = 1_700_000_000_000;
    const a = applyAttempt(empty, att("M2", "M2", t));
    const b = applyAttempt(a, att("M2", "M2", t + 10));
    expect(mergeProgress(a, b).items["intervals:interval:M2"].attempts).toBe(2);
    expect(mergeProgress(b, a).items["intervals:interval:M2"].attempts).toBe(2);
  });

  it("does not duplicate sessions", () => {
    const s = { ...empty, sessions: [{ at: 1, drill: "x", total: 1, correct: 1 }] };
    expect(mergeProgress(s, s).sessions).toHaveLength(1);
  });

  it("newest settings win", () => {
    expect(newer({ value: "local", at: 10 }, { value: "remote", at: 20 })).toEqual({ value: "remote", fromRemote: true });
    expect(newer({ value: "local", at: 30 }, { value: "remote", at: 20 })).toEqual({ value: "local", fromRemote: false });
    expect(newer({ value: "local", at: 30 }, { value: undefined, at: 99 })).toEqual({ value: "local", fromRemote: false });
  });
});
