// Turns notes played on the piano into an answer id, so piano answers are
// scored and tracked exactly like button answers (including confusions).

import { CHORDS, INTERVALS, SCALES } from "../theory/catalog";
import { degreeSemitones } from "../theory/notes";
import { FUNCTIONAL_DEGREES } from "../theory/harmony";
import type { Question } from "./types";

/** Id used when the played notes don't match anything in the catalog. */
export const OTHER = "other";

function pcSetKey(semis: number[]): string {
  return [...new Set(semis.map((s) => ((s % 12) + 12) % 12))].sort((a, b) => a - b).join(",");
}

/**
 * @param played MIDI notes the user selected. For "interval" and "single" the last one counts.
 * @returns the answer id for part 0 of the question.
 */
export function evaluatePiano(q: Question, played: number[]): string {
  if (!q.piano || played.length === 0) return OTHER;
  const task = q.piano;

  if (task.mode === "single") {
    const pc = ((played[played.length - 1] % 12) + 12) % 12;
    return String(pc);
  }

  if (task.mode === "degree") {
    const diff = (((played[played.length - 1] - task.given[0]) % 12) + 12) % 12;
    const match = FUNCTIONAL_DEGREES.find((d) => ((degreeSemitones(d.id) % 12) + 12) % 12 === diff);
    return match ? match.id : OTHER;
  }

  if (task.mode === "interval") {
    const given = task.given[0];
    const note = played[played.length - 1];
    const semis = task.direction === "down" ? given - note : note - given;
    const match = INTERVALS.find((i) => i.semitones === semis);
    return match ? match.id : OTHER;
  }

  // "set": compare pitch classes relative to the root, octave doesn't matter.
  const root = task.given[0];
  const key = pcSetKey(played.map((m) => m - root));
  const correct = q.parts[0].answer;
  const catalog = q.drill === "chords" ? CHORDS : SCALES;
  const correctDef = catalog.find((c) => c.id === correct);
  if (correctDef && pcSetKey(correctDef.degrees.map(degreeSemitones)) === key) return correct;
  const other = catalog.find((c) => pcSetKey(c.degrees.map(degreeSemitones)) === key);
  return other ? other.id : OTHER;
}

/** Can this question be answered by singing one note? */
export function canSing(q: Question): boolean {
  return !!q.piano && (q.piano.mode === "interval" || q.piano.mode === "single" || q.piano.mode === "degree");
}

/**
 * Score a sung note. Octaves are ignored because the question may be outside the
 * singer's range: an interval counts by its size within the octave.
 */
export function evaluateSung(q: Question, sung: number): string {
  if (!q.piano) return OTHER;
  const task = q.piano;
  const mod12 = (n: number) => ((n % 12) + 12) % 12;
  if (task.mode === "single") return String(mod12(sung));
  if (task.mode === "degree") return evaluatePiano(q, [sung]);
  if (task.mode === "interval") {
    const given = task.given[0];
    const diff = task.direction === "down" ? mod12(given - sung) : mod12(sung - given);
    const ids = q.parts[0].choices.map((c) => c.id);
    const answer = INTERVALS.find((i) => i.id === q.parts[0].answer);
    if (answer && mod12(answer.semitones) === diff) return answer.id;
    const offered = INTERVALS.find((i) => ids.includes(i.id) && mod12(i.semitones) === diff);
    if (offered) return offered.id;
    return INTERVALS.find((i) => !i.compound && mod12(i.semitones) === diff)?.id ?? OTHER;
  }
  return OTHER;
}
