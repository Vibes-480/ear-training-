// Choosing a root note: which key, and which octave.

import { COMMON_ROOTS, midiOf, pitchClass, type SpelledNote } from "../theory/notes";

/** Lowest and highest MIDI notes any question may use (A1 – C7). */
const WIDE_LO = 40;
const WIDE_HI = 88;
/** Comfortable middle used when random register is off. */
const CENTER = 62;

export type Rng = () => number;

export function pick<T>(items: readonly T[], rng: Rng): T {
  return items[Math.floor(rng() * items.length)];
}

export interface RootChoice {
  spelled: SpelledNote;
  midi: number;
}

/**
 * Pick a root so that every note (root + offsets) fits in range.
 * @param offsets semitone offsets of every note relative to the root (may be negative)
 */
export function chooseRoot(
  offsets: number[],
  opts: { randomKey: boolean; fixedRoot: number; randomRegister: boolean },
  rng: Rng,
): RootChoice {
  const spelled = opts.randomKey ? pick(COMMON_ROOTS, rng) : COMMON_ROOTS[opts.fixedRoot] ?? COMMON_ROOTS[0];
  const lo = Math.min(0, ...offsets);
  const hi = Math.max(0, ...offsets);
  const pc = pitchClass(spelled);

  const candidates: number[] = [];
  for (let m = WIDE_LO; m <= WIDE_HI; m++) {
    if (((m % 12) + 12) % 12 !== pc) continue;
    if (m + lo >= WIDE_LO && m + hi <= WIDE_HI) candidates.push(m);
  }
  if (candidates.length === 0) {
    // Very wide question: centre it and accept going out of range.
    return { spelled, midi: midiOf(spelled, 3) };
  }

  if (opts.randomRegister) return { spelled, midi: pick(candidates, rng) };

  const mid = (lo + hi) / 2;
  let best = candidates[0];
  for (const c of candidates) {
    if (Math.abs(c + mid - CENTER) < Math.abs(best + mid - CENTER)) best = c;
  }
  return { spelled, midi: best };
}
