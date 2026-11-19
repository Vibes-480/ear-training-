import { lazy, Suspense, useMemo } from "react";
import type { QuestionNote } from "../drills/types";
import { defaultSpelling, LETTERS, type SpelledNote } from "../theory/notes";
import type { StaffNote, StaffProps } from "./Staff";

const StaffImpl = lazy(() => import("./Staff"));

export function StaffLazy(props: StaffProps) {
  return (
    <Suspense fallback={<div className="staff" style={{ minHeight: props.height ?? 130 }} />}>
      <StaffImpl {...props} />
    </Suspense>
  );
}

const ACC = (acc: number) => (acc > 0 ? "#".repeat(acc) : "b".repeat(-acc));

/** VexFlow key for a spelled note at a MIDI pitch, e.g. "eb/4". */
export function vexKey(spelled: SpelledNote, midi: number): string {
  const octave = Math.floor((midi - spelled.acc) / 12) - 1;
  return `${spelled.letter.toLowerCase()}${ACC(spelled.acc)}/${octave}`;
}

/** VexFlow key-signature name for a spelled tonic. */
export function vexKeySig(tonic: SpelledNote, minor = false): string {
  const name = tonic.letter + ACC(tonic.acc) + (minor ? "m" : "");
  // VexFlow knows the usual 15 major and 15 minor keys; fall back to C otherwise.
  const known = ["C", "G", "D", "A", "E", "B", "F#", "C#", "F", "Bb", "Eb", "Ab", "Db", "Gb", "Cb"];
  const knownMinor = ["Am", "Em", "Bm", "F#m", "C#m", "G#m", "D#m", "A#m", "Dm", "Gm", "Cm", "Fm", "Bbm", "Ebm", "Abm"];
  return (minor ? knownMinor : known).includes(name) ? name : "C";
}

export function clefFor(midis: number[]): "treble" | "bass" {
  if (!midis.length) return "treble";
  const avg = midis.reduce((a, b) => a + b, 0) / midis.length;
  return avg < 57 ? "bass" : "treble";
}

/** Question notes on a staff: chords stacked, melodies in sequence. */
export function QuestionStaff({ notes, harmonic, keySig = "C" }: { notes: QuestionNote[]; harmonic: boolean; keySig?: string }) {
  const staffNotes = useMemo<StaffNote[]>(() => {
    if (!notes.length) return [];
    if (harmonic) {
      const sorted = [...notes].sort((a, b) => a.midi - b.midi);
      return [{ keys: sorted.map((n) => vexKey(n.spelled, n.midi)), duration: "w" }];
    }
    return notes.map((n) => ({ keys: [vexKey(n.spelled, n.midi)], duration: "q" }));
  }, [notes, harmonic]);
  if (!staffNotes.length) return null;
  return <StaffLazy notes={staffNotes} clef={clefFor(notes.map((n) => n.midi))} keySig={keySig} ariaLabel="Answer on the staff" />;
}

/** Sight-singing melody with per-note colours. */
export function StaffForTask({ keySig, midis, states, current }: { keySig: SpelledNote; midis: number[]; states: string[]; current: number }) {
  const notes = useMemo<StaffNote[]>(
    () =>
      midis.map((m, i) => ({
        keys: [vexKey(spellInKey(m, keySig), m)],
        duration: "q",
        color: states[i] === "hit" ? "var(--ok)" : states[i] === "miss" ? "var(--bad)" : i === current ? "var(--accent)" : undefined,
      })),
    [midis, states, current, keySig],
  );
  return <StaffLazy notes={notes} clef={clefFor(midis)} keySig={vexKeySig(keySig)} ariaLabel="Melody to sing" />;
}

/** Spell a MIDI note within a major key: diatonic notes use the key's letters. */
export function spellInKey(midi: number, tonic: SpelledNote): SpelledNote {
  const tonicPc = (LETTERS.indexOf(tonic.letter) >= 0 ? [0, 2, 4, 5, 7, 9, 11][LETTERS.indexOf(tonic.letter)] + tonic.acc : 0) % 12;
  const rel = (((midi - tonicPc) % 12) + 12) % 12;
  const scale = [0, 2, 4, 5, 7, 9, 11];
  const step = scale.indexOf(rel);
  if (step < 0) return defaultSpelling(midi, tonic.acc < 0 || tonic.letter === "F");
  const letter = LETTERS[(LETTERS.indexOf(tonic.letter) + step) % 7];
  const natural = [0, 2, 4, 5, 7, 9, 11][LETTERS.indexOf(letter)];
  let acc = (((midi % 12) - natural + 12) % 12);
  if (acc > 6) acc -= 12;
  return { letter, acc };
}
