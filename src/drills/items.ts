// The askable items of each drill under the current options. Used by the daily
// session planner and by progress views.

import type { DrillConfigs, DrillId } from "./types";

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
  }
}
