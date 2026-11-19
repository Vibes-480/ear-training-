// Plans the smart daily session: items due for review first, then a few new
// items, then the weakest of the rest, interleaved across drills.

import { itemKey, recentAccuracy, type Progress } from "../store/progress";
import { mainItems } from "./items";
import type { Rng } from "./register";
import type { DrillConfigs, DrillId } from "./types";

export interface DailyEntry {
  drill: DrillId;
  item: string;
}

export interface DailyPlan {
  queue: DailyEntry[];
  dueCount: number;
  newCount: number;
  weakCount: number;
}

function shuffle<T>(arr: T[], rng: Rng): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

const same = (a: DailyEntry, b: DailyEntry) => a.drill === b.drill && a.item === b.item;

/**
 * Reorder so the same item never appears twice in a row and drills alternate
 * where possible. Always placing the item with the most copies left (that
 * isn't the one just placed) keeps repeats spread out, so we never get stuck
 * with only duplicates at the end.
 */
export function interleave(entries: DailyEntry[], rng: Rng): DailyEntry[] {
  const pool = shuffle(entries, rng);
  const key = (e: DailyEntry) => `${e.drill}:${e.item}`;
  const left = new Map<string, number>();
  pool.forEach((e) => left.set(key(e), (left.get(key(e)) ?? 0) + 1));
  const out: DailyEntry[] = [];
  while (pool.length) {
    const last = out[out.length - 1];
    let best = -1;
    let bestScore = -Infinity;
    pool.forEach((e, i) => {
      if (last && same(e, last)) return;
      // More copies left matters most; a different drill is a bonus; earlier in the shuffle breaks ties.
      const score = (left.get(key(e)) ?? 0) * 10 + (last && e.drill !== last.drill ? 1 : 0) - i * 1e-3;
      if (score > bestScore) {
        bestScore = score;
        best = i;
      }
    });
    if (best < 0) best = 0; // only duplicates of the last item remain: unavoidable
    const [e] = pool.splice(best, 1);
    left.set(key(e), (left.get(key(e)) ?? 1) - 1);
    out.push(e);
  }
  return out;
}

export function buildDailyPlan(
  p: Progress,
  cfgs: DrillConfigs,
  drills: DrillId[],
  length: number,
  now: number,
  rng: Rng,
): DailyPlan {
  const due: { e: DailyEntry; overdue: number; acc: number }[] = [];
  const fresh: DailyEntry[] = [];
  const rest: { e: DailyEntry; acc: number }[] = [];

  for (const drill of drills) {
    const { part, ids } = mainItems(drill, cfgs);
    if (ids.length < 2) continue;
    for (const item of ids) {
      const stat = p.items[itemKey(drill, part, item)];
      const e = { drill, item };
      if (!stat) fresh.push(e);
      else if ((stat.due ?? 0) <= now) due.push({ e, overdue: now - (stat.due ?? 0), acc: recentAccuracy(stat) });
      else rest.push({ e, acc: recentAccuracy(stat) });
    }
  }

  // Most overdue and weakest first.
  due.sort((a, b) => a.acc - b.acc || b.overdue - a.overdue);
  rest.sort((a, b) => a.acc - b.acc);

  const picked: DailyEntry[] = [];
  const newSlots = Math.max(2, Math.round(length * 0.25));
  const dueTake = due.slice(0, length - Math.min(newSlots, fresh.length));
  picked.push(...dueTake.map((d) => d.e));
  const freshTake = shuffle(fresh, rng).slice(0, Math.min(newSlots, length - picked.length));
  picked.push(...freshTake);
  const weakTake = rest.slice(0, length - picked.length).map((r) => r.e);
  picked.push(...weakTake);
  // Anything due that didn't fit yet, if space remains.
  for (const d of due.slice(dueTake.length)) if (picked.length < length) picked.push(d.e);

  // A short list: repeat the weakest items to fill the session.
  const base = [...picked];
  let i = 0;
  while (picked.length < length && base.length) {
    picked.push(base[i % base.length]);
    i++;
  }

  return {
    queue: interleave(picked.slice(0, length), rng),
    dueCount: dueTake.length,
    newCount: freshTake.length,
    weakCount: weakTake.length,
  };
}
