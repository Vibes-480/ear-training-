import { CHORDS, INTERVALS, INVERSION_NAMES, SCALES } from "../theory/catalog";
import { PITCH_LABELS } from "./generate";

const SCALE_SHORT: Record<string, string> = {
  ionian: "Ion", dorian: "Dor", phrygian: "Phr", lydian: "Lyd", mixolydian: "Mix", aeolian: "Aeo", locrian: "Loc",
  harmMinor: "HM", melMinor: "MM", phrygDom: "PhD", lydDom: "LyD", altered: "Alt", wholeTone: "WT",
  dimHW: "HW", dimWH: "WH", majPent: "M5", minPent: "m5", blues: "Blu",
};

/** Full name of an answer id, for tables and tooltips. */
export function itemLabel(drill: string, part: string, id: string): string {
  if (id === "other") return "something else";
  if (drill === "intervals") return INTERVALS.find((i) => i.id === id)?.name ?? id;
  if (drill === "chords" && part === "quality") return CHORDS.find((c) => c.id === id)?.name ?? id;
  if (drill === "chords" && part === "inversion") return INVERSION_NAMES[Number(id)] ?? id;
  if (drill === "scales") return SCALES.find((s) => s.id === id)?.name ?? id;
  if (drill === "pitch") return PITCH_LABELS[Number(id)] ?? id;
  return id;
}

/** Compact label for grid axes. */
export function shortLabel(drill: string, part: string, id: string): string {
  if (id === "other") return "?";
  if (drill === "intervals") return INTERVALS.find((i) => i.id === id)?.short ?? id;
  if (drill === "chords" && part === "quality") return CHORDS.find((c) => c.id === id)?.symbol || "maj";
  if (drill === "chords" && part === "inversion") return id === "0" ? "Root" : `Inv${id}`;
  if (drill === "scales") return SCALE_SHORT[id] ?? id.slice(0, 3);
  if (drill === "pitch") return (PITCH_LABELS[Number(id)] ?? id).split("/")[0];
  return id;
}

