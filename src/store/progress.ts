import { useSyncExternalStore } from "react";
import { loadJSON, saveJSON } from "./storage";

// Progress is kept as compact aggregates rather than a raw attempt log, so it
// stays small in localStorage and is easy to sync to the cloud later.

export interface ItemStat {
  attempts: number;
  correct: number;
  /** Sum of answer times for correct answers, in ms. */
  totalMs: number;
  /** Last results, newest last (1 = correct). Max RECENT_MAX entries. */
  recent: number[];
  lastSeen: number;
  /** Spaced-repetition box: 0 = new or just missed, higher = known longer. */
  box?: number;
  /** When the item is next due for review (ms timestamp). */
  due?: number;
}

/** How long to wait before reviewing an item again, per box. */
export const BOX_INTERVALS_MS = [
  5 * 60_000, // box 0: a few minutes
  20 * 3_600_000, // 1: next day
  2 * 86_400_000,
  5 * 86_400_000,
  11 * 86_400_000,
  24 * 86_400_000,
  50 * 86_400_000,
];
const MAX_BOX = BOX_INTERVALS_MS.length - 1;

export interface DayStat {
  questions: number;
  correct: number;
  ms: number;
  /** Per-drill counts for charts. ms = total answer time of correct answers. */
  byDrill?: Record<string, { q: number; c: number; ms: number }>;
  /** The daily session was completed this day. */
  dailyDone?: boolean;
}

export interface SessionRecord {
  at: number;
  drill: string;
  total: number;
  correct: number;
}

export interface Progress {
  version: 1;
  /** Keyed by `${drill}:${part}:${itemId}`. */
  items: Record<string, ItemStat>;
  /** confusions[`${drill}:${part}`][correctId][answeredId] = count */
  confusions: Record<string, Record<string, Record<string, number>>>;
  /** Keyed by local date YYYY-MM-DD. */
  days: Record<string, DayStat>;
  sessions: SessionRecord[];
}

const KEY = "et.progress.v1";
const RECENT_MAX = 12;
const SESSIONS_MAX = 500;

function empty(): Progress {
  return { version: 1, items: {}, confusions: {}, days: {}, sessions: [] };
}

let current: Progress = { ...empty(), ...loadJSON<Partial<Progress>>(KEY, {}) };
const listeners = new Set<() => void>();

function commit(next: Progress) {
  current = next;
  saveJSON(KEY, current);
  listeners.forEach((l) => l());
}

export function getProgress(): Progress {
  return current;
}

export function itemKey(drill: string, part: string, itemId: string): string {
  return `${drill}:${part}:${itemId}`;
}

export function localDay(ts = Date.now()): string {
  const d = new Date(ts);
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

export interface AttemptInput {
  drill: string;
  part: string;
  correctId: string;
  answeredId: string;
  ms: number;
  at?: number;
}

/** Pure reducer: returns a new Progress with one answer recorded. */
export function applyAttempt(p: Progress, a: AttemptInput): Progress {
  const at = a.at ?? Date.now();
  const ok = a.correctId === a.answeredId;
  const key = itemKey(a.drill, a.part, a.correctId);
  const prev = p.items[key] ?? { attempts: 0, correct: 0, totalMs: 0, recent: [], lastSeen: 0 };
  // Leitner-style scheduling. A correct answer only promotes the item when it was due
  // (or new), so drilling the same item ten times in a row doesn't fake long-term memory.
  const box = prev.box ?? 0;
  const wasDue = prev.due === undefined || at >= prev.due;
  let nextBox = box;
  if (!ok) nextBox = Math.max(0, box - 2);
  else if (wasDue) nextBox = Math.min(MAX_BOX, box + 1);
  const item: ItemStat = {
    attempts: prev.attempts + 1,
    correct: prev.correct + (ok ? 1 : 0),
    totalMs: prev.totalMs + (ok ? a.ms : 0),
    recent: [...prev.recent, ok ? 1 : 0].slice(-RECENT_MAX),
    lastSeen: at,
    box: nextBox,
    due: ok && !wasDue ? prev.due : at + BOX_INTERVALS_MS[nextBox],
  };

  const confusions = { ...p.confusions };
  if (!ok) {
    const ck = `${a.drill}:${a.part}`;
    const table = { ...(confusions[ck] ?? {}) };
    const row = { ...(table[a.correctId] ?? {}) };
    row[a.answeredId] = (row[a.answeredId] ?? 0) + 1;
    table[a.correctId] = row;
    confusions[ck] = table;
  }

  const dk = localDay(at);
  const day = p.days[dk] ?? { questions: 0, correct: 0, ms: 0 };
  const capped = Math.min(a.ms, 60_000);
  const dd = day.byDrill?.[a.drill] ?? { q: 0, c: 0, ms: 0 };
  const days = {
    ...p.days,
    [dk]: {
      ...day,
      questions: day.questions + 1,
      correct: day.correct + (ok ? 1 : 0),
      ms: day.ms + capped,
      byDrill: { ...day.byDrill, [a.drill]: { q: dd.q + 1, c: dd.c + (ok ? 1 : 0), ms: dd.ms + (ok ? capped : 0) } },
    },
  };

  return { ...p, items: { ...p.items, [key]: item }, confusions, days };
}

export function recordAttempt(a: AttemptInput): void {
  commit(applyAttempt(current, a));
}

export function recordSession(s: SessionRecord): void {
  commit({ ...current, sessions: [...current.sessions, s].slice(-SESSIONS_MAX) });
}

export function markDailyDone(at = Date.now()): void {
  const dk = localDay(at);
  const day = current.days[dk] ?? { questions: 0, correct: 0, ms: 0 };
  commit({ ...current, days: { ...current.days, [dk]: { ...day, dailyDone: true } } });
}

export function resetProgress(): void {
  commit(empty());
}

/** Replace all progress (cloud sync). */
export function replaceProgress(p: Progress): void {
  commit({ ...empty(), ...p, version: 1 });
}

export function exportProgress(): string {
  return JSON.stringify(current, null, 2);
}

export function importProgress(json: string): void {
  const parsed = JSON.parse(json) as Partial<Progress>;
  if (!parsed || typeof parsed !== "object" || !parsed.items) throw new Error("This file doesn't look like an ear trainer backup.");
  commit({ ...empty(), ...parsed, version: 1 });
}

/** Recent accuracy for an item, smoothed so unseen items count as weak. */
export function recentAccuracy(stat: ItemStat | undefined): number {
  if (!stat || stat.recent.length === 0) return 0.5;
  const sum = stat.recent.reduce((a, b) => a + b, 0);
  // Laplace smoothing toward 0.5.
  return (sum + 1) / (stat.recent.length + 2);
}

/** Consecutive days with practice, ending today (or yesterday if not practised yet today). */
export function currentStreak(p: Progress, now = Date.now()): number {
  let streak = 0;
  const dayMs = 86_400_000;
  let t = now;
  if (!p.days[localDay(t)]) t -= dayMs;
  while (p.days[localDay(t)]) {
    streak++;
    t -= dayMs;
  }
  return streak;
}

function subscribe(l: () => void) {
  listeners.add(l);
  return () => listeners.delete(l);
}

export function useProgress(): Progress {
  return useSyncExternalStore(subscribe, getProgress, getProgress);
}

export { subscribe as onProgressChange };
