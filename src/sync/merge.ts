// Merging progress from two devices without losing practice.
// Each piece of progress only ever grows, so for every item we keep the copy
// that has seen more answers, and for counts we keep the larger number.

import type { DayStat, ItemStat, Progress, SessionRecord } from "../store/progress";

function pickItem(a: ItemStat | undefined, b: ItemStat | undefined): ItemStat {
  if (!a) return b!;
  if (!b) return a;
  if (a.attempts !== b.attempts) return a.attempts > b.attempts ? a : b;
  return (a.lastSeen ?? 0) >= (b.lastSeen ?? 0) ? a : b;
}

function mergeDay(a: DayStat | undefined, b: DayStat | undefined): DayStat {
  if (!a) return b!;
  if (!b) return a;
  const byDrill: NonNullable<DayStat["byDrill"]> = {};
  for (const k of new Set([...Object.keys(a.byDrill ?? {}), ...Object.keys(b.byDrill ?? {})])) {
    const x = a.byDrill?.[k];
    const y = b.byDrill?.[k];
    // Keep one device's counts whole rather than mixing fields from both.
    byDrill[k] = !x ? y! : !y ? x : x.q >= y.q ? x : y;
  }
  const base = a.questions >= b.questions ? a : b;
  return {
    questions: base.questions,
    correct: base.correct,
    ms: base.ms,
    byDrill,
    dailyDone: !!(a.dailyDone || b.dailyDone),
  };
}

export function mergeProgress(a: Progress, b: Progress): Progress {
  const items: Record<string, ItemStat> = {};
  for (const k of new Set([...Object.keys(a.items ?? {}), ...Object.keys(b.items ?? {})])) items[k] = pickItem(a.items?.[k], b.items?.[k]);

  const confusions: Progress["confusions"] = {};
  for (const ck of new Set([...Object.keys(a.confusions ?? {}), ...Object.keys(b.confusions ?? {})])) {
    const ta = a.confusions?.[ck] ?? {};
    const tb = b.confusions?.[ck] ?? {};
    const table: Record<string, Record<string, number>> = {};
    for (const row of new Set([...Object.keys(ta), ...Object.keys(tb)])) {
      const ra = ta[row] ?? {};
      const rb = tb[row] ?? {};
      const r: Record<string, number> = {};
      for (const col of new Set([...Object.keys(ra), ...Object.keys(rb)])) r[col] = Math.max(ra[col] ?? 0, rb[col] ?? 0);
      table[row] = r;
    }
    confusions[ck] = table;
  }

  const days: Record<string, DayStat> = {};
  for (const k of new Set([...Object.keys(a.days ?? {}), ...Object.keys(b.days ?? {})])) days[k] = mergeDay(a.days?.[k], b.days?.[k]);

  const seen = new Set<string>();
  const sessions: SessionRecord[] = [];
  for (const s of [...(a.sessions ?? []), ...(b.sessions ?? [])].sort((x, y) => x.at - y.at)) {
    const key = `${s.at}:${s.drill}`;
    if (seen.has(key)) continue;
    seen.add(key);
    sessions.push(s);
  }

  return { version: 1, items, confusions, days, sessions: sessions.slice(-500) };
}

/** True when merging `incoming` into `local` would change nothing. */
export function sameProgress(a: Progress, b: Progress): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

/** Settings, drill options and presets: the most recently changed copy wins. */
export function newer<T>(local: { value: T; at: number }, remote: { value: T | undefined; at: number }): { value: T; fromRemote: boolean } {
  if (remote.value !== undefined && remote.value !== null && remote.at > local.at) return { value: remote.value, fromRemote: true };
  return { value: local.value, fromRemote: false };
}
