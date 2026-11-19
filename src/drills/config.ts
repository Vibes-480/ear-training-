import { useSyncExternalStore } from "react";
import { loadJSON, saveJSON } from "../store/storage";
import type { DrillConfigs, DrillId } from "./types";

const KEY = "et.drills.v1";

export const DEFAULT_CONFIGS: DrillConfigs = {
  intervals: {
    enabled: ["m2", "M2", "m3", "M3", "P4", "TT", "P5", "m6", "M6", "m7", "M7", "P8"],
    directions: ["asc", "desc", "harm"],
  },
  chords: {
    enabled: ["maj7", "dom7", "min7", "m7b5", "dim7", "mMaj7"],
    inversions: [0, 1, 2, 3],
    playback: ["block", "arp"],
    askInversion: false,
  },
  scales: {
    enabled: ["ionian", "dorian", "phrygian", "lydian", "mixolydian", "aeolian", "locrian"],
    directions: ["asc", "desc"],
  },
  pitch: {
    enabled: [0, 2, 4, 5, 7, 9, 11],
    reference: true,
    octaves: 2,
  },
};

export const DRILL_INFO: Record<DrillId, { title: string; blurb: string }> = {
  intervals: { title: "Intervals", blurb: "Melodic and harmonic, simple and compound" },
  chords: { title: "Chords", blurb: "Triads, 7ths and extensions, in every inversion" },
  scales: { title: "Scales & modes", blurb: "The church modes, minor scales, symmetric scales" },
  pitch: { title: "Note naming", blurb: "Name single notes, with or without a reference" },
};

function withDefaults(saved: Partial<DrillConfigs>): DrillConfigs {
  return {
    intervals: { ...DEFAULT_CONFIGS.intervals, ...saved.intervals },
    chords: { ...DEFAULT_CONFIGS.chords, ...saved.chords },
    scales: { ...DEFAULT_CONFIGS.scales, ...saved.scales },
    pitch: { ...DEFAULT_CONFIGS.pitch, ...saved.pitch },
  };
}

let current = withDefaults(loadJSON<Partial<DrillConfigs>>(KEY, {}));

/** Replace all drill options (backup restore / cloud sync). */
export function replaceConfigs(next: Partial<DrillConfigs>): void {
  current = withDefaults(next);
  saveJSON(KEY, current);
  listeners.forEach((l) => l());
}
const listeners = new Set<() => void>();

export function getConfigs(): DrillConfigs {
  return current;
}

export function updateConfig<K extends DrillId>(drill: K, patch: Partial<DrillConfigs[K]>): void {
  current = { ...current, [drill]: { ...current[drill], ...patch } };
  saveJSON(KEY, current);
  listeners.forEach((l) => l());
}

export function resetConfig(drill: DrillId): void {
  current = { ...current, [drill]: DEFAULT_CONFIGS[drill] };
  saveJSON(KEY, current);
  listeners.forEach((l) => l());
}

function subscribe(l: () => void) {
  listeners.add(l);
  return () => listeners.delete(l);
}

export function useConfigs(): DrillConfigs {
  return useSyncExternalStore(subscribe, getConfigs, getConfigs);
}
