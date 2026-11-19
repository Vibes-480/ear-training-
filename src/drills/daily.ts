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

/** Reorder so the same item never appears twice in a row and drills alternate where possible. */
export function interleave(entries: DailyEntry[], rng: Rng): DailyEntry[] {
  const pool = shuffle(entries, rng);
  const out: DailyEntry[] = [];
  while (pool.length) {
    const last = out[out.length - 1];
    let idx = pool.findIndex((e) => !last || (e.drill !== last.drill && !same(e, last)));
    if (idx < 0) idx = pool.findIndex((e) => !last || !same(e, last));
    if (idx < 0) idx = 0;
    out.push(pool.splice(idx, 1)[0]);
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
