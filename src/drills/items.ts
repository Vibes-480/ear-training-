// The askable items of each drill under the current options. Used by the daily
// session planner and by progress views.

import type { DrillConfigs, DrillId } from "./types";
import { TONIC } from "../theory/harmony";

export interface DrillItems {
  /** Part key the items are tracked under, e.g. "interval". */
  part: string;
  ids: string[];
}

export function mainItems(drill: DrillId, cfgs: DrillConfigs): DrillItems {
  switch (drill) {
    case "intervals":
      return { part: "interval", ids: cfgs.intervals.enabled };
    case "chords":
      return { part: "quality", ids: cfgs.chords.enabled };
    case "scales":
      return { part: "scale", ids: cfgs.scales.enabled };
    case "pitch":
      return { part: "note", ids: cfgs.pitch.enabled.map(String) };
    case "progressions": {
      const c = cfgs.progressions;
      if (c.mode === "cadences") return { part: "cadence", ids: c.cadences };
      const t = c.tonalities.includes("major") || !c.tonalities.length ? "major" : "minor";
      return { part: t, ids: (t === "major" ? c.major : c.minor).filter((n) => n !== TONIC[t]) };
    }
    case "functional": {
      const c = cfgs.functional;
      const t = c.tonalities.includes("major") || !c.tonalities.length ? "major" : "minor";
      return { part: t, ids: t === "major" ? c.major : c.minor };
    }
    case "chordtones":
      return { part: "tone", ids: cfgs.chordtones.tones };
    case "tuning":
      return { part: "tuning", ids: cfgs.tuning.inTune ? ["flat", "in", "sharp"] : ["flat", "sharp"] };
  }
}
