// Tuning drill: is the second note flat, sharp or in tune? The detune amount
// adapts: two right answers in a row make it harder, a miss makes it easier.

import { loadJSON, saveJSON } from "../store/storage";
import { pick } from "./register";
import { weightedPick, type GenContext } from "./generate";
import type { Question, TuningConfig } from "./types";

const KEY = "et.tuning.v1";
const MIN = 2;
const MAX = 60;

interface TuningState {
  cents: number;
  streak: number;
}

export function getTuningState(): TuningState {
  return { cents: 30, streak: 0, ...loadJSON<Partial<TuningState>>(KEY, {}) };
}

export function setTuningCents(cents: number) {
  saveJSON(KEY, { cents, streak: 0 });
}

export function observeTuning(correct: boolean) {
  const s = getTuningState();
  if (correct) {
    const streak = s.streak + 1;
    if (streak >= 2) saveJSON(KEY, { cents: Math.max(MIN, Math.round(s.cents * 0.8 * 10) / 10), streak: 0 });
    else saveJSON(KEY, { ...s, streak });
  } else {
    saveJSON(KEY, { cents: Math.min(MAX, Math.round(s.cents * 1.35 * 10) / 10), streak: 0 });
  }
}

let n = 0;

export function generateTuning(cfg: TuningConfig, ctx: GenContext): Question {
  const ids = cfg.inTune ? ["flat", "in", "sharp"] : ["flat", "sharp"];
  const id = weightedPick(ids, "tuning", ctx);
  const { cents } = getTuningState();
  const detune = id === "flat" ? -cents : id === "sharp" ? cents : 0;
  const base = 55 + Math.floor(ctx.rng() * 22);
  const mode = pick(cfg.modes.length ? cfg.modes : (["sequence"] as const), ctx.rng);
  const events =
    mode === "together"
      ? [
          { midi: [base], at: 0, dur: 2.4, velocity: 75 },
          { midi: [base], at: 0, dur: 2.4, velocity: 75, detune },
        ]
      : [
          { midi: [base], at: 0, dur: 1.1, velocity: 80 },
          { midi: [base], at: 1.25, dur: 1.3, velocity: 80, detune },
        ];
  const choices = [
    { id: "flat", label: "Flat", sub: "second note lower" },
    ...(cfg.inTune ? [{ id: "in", label: "In tune", sub: "the same" }] : []),
    { id: "sharp", label: "Sharp", sub: "second note higher" },
  ];
  return {
    drill: "tuning",
    uid: `t${Date.now().toString(36)}${n++}`,
    parts: [{ key: "tuning", prompt: mode === "together" ? "Two notes together: is the second one flat, sharp or in tune?" : "Is the second note flat, sharp or in tune?", choices, answer: id }],
    events,
    notes: [],
    root: { midi: base, spelled: { letter: "C", acc: 0 } },
    reveal: id === "in" ? `In tune (level: ${cents}¢)` : `${cents}¢ ${id}`,
    onResult: observeTuning,
  };
}
