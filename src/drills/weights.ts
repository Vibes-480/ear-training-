import { getProgress, itemKey, recentAccuracy } from "../store/progress";

/** Weight function for picking items: weaker items get asked more when focus is on. */
export function makeWeight(drill: string, focusWeak: boolean): (part: string, itemId: string) => number {
  if (!focusWeak) return () => 1;
  const progress = getProgress();
  return (part, itemId) => 0.25 + (1 - recentAccuracy(progress.items[itemKey(drill, part, itemId)])) * 2;
}
