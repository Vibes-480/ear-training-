import { useSyncExternalStore } from "react";
import { CURRICULUM } from "../drills/packs";
import { loadJSON, saveJSON } from "./storage";

export interface CurriculumState {
  /** Best result per level: accuracy 0–1 and when. */
  best: Record<string, { pct: number; at: number }>;
}

const KEY = "et.curriculum.v1";
let current: CurriculumState = { best: {}, ...loadJSON<Partial<CurriculumState>>(KEY, {}) };
const listeners = new Set<() => void>();

export function getCurriculum(): CurriculumState {
  return current;
}

export function replaceCurriculum(next: Partial<CurriculumState>) {
  current = { best: { ...(next.best ?? {}) } };
  saveJSON(KEY, current);
  listeners.forEach((l) => l());
}

export function recordLevel(id: string, pct: number) {
  const prev = current.best[id];
  if (prev && prev.pct >= pct) return;
  current = { best: { ...current.best, [id]: { pct, at: Date.now() } } };
  saveJSON(KEY, current);
  listeners.forEach((l) => l());
}

export function isPassed(state: CurriculumState, id: string): boolean {
  const level = CURRICULUM.find((l) => l.id === id);
  const best = state.best[id];
  return !!level && !!best && best.pct >= level.pass;
}

/** A level is open when every level before it is passed. */
export function isUnlocked(state: CurriculumState, id: string): boolean {
  const idx = CURRICULUM.findIndex((l) => l.id === id);
  return CURRICULUM.slice(0, idx).every((l) => isPassed(state, l.id));
}

export function subscribe(l: () => void) {
  listeners.add(l);
  return () => listeners.delete(l);
}

export function useCurriculum(): CurriculumState {
  return useSyncExternalStore(subscribe, getCurriculum, getCurriculum);
}
