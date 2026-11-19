import type { DrillId } from "./types";

/** Choice-based drills, in the order shown on the home page. */
export const CHOICE_DRILLS: DrillId[] = ["intervals", "chords", "scales", "pitch", "progressions", "functional", "chordtones", "tuning"];

/** Grouping for the home page. */
export const HEARING_DRILLS: DrillId[] = ["intervals", "chords", "scales", "pitch"];
export const HARMONY_DRILLS: DrillId[] = ["progressions", "functional", "chordtones"];
export const PITCH_DRILLS: DrillId[] = ["tuning"];

/** Drills that can be mixed into the daily session. */
export const DAILY_DRILLS: DrillId[] = ["intervals", "chords", "scales", "pitch", "progressions", "functional", "chordtones"];
