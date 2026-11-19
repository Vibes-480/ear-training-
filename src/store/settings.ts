import { useSyncExternalStore } from "react";
import { loadJSON, saveJSON } from "./storage";

export type InstrumentId = "piano" | "epiano" | "guitar" | "strings" | "vibes" | "synth";

export const INSTRUMENTS: { id: InstrumentId; name: string }[] = [
  { id: "piano", name: "Grand piano" },
  { id: "epiano", name: "Electric piano" },
  { id: "guitar", name: "Nylon guitar" },
  { id: "strings", name: "Strings" },
  { id: "vibes", name: "Vibraphone" },
  { id: "synth", name: "Simple synth (works offline)" },
];

export interface Settings {
  instrument: InstrumentId;
  /** Use a different instrument for each question, for timbre-independent hearing. */
  varyInstrument: boolean;
  /** Pick a random key for each question. Off = always use `fixedRoot`. */
  randomKey: boolean;
  /** Root used when randomKey is off, as an index into COMMON_ROOTS. */
  fixedRoot: number;
  /** Move questions to a random octave. Off = stay in a comfortable middle range. */
  randomRegister: boolean;
  /** How notes are labelled in feedback. */
  noteNames: "letters" | "degrees";
  /** Melodic playback speed in beats per minute. */
  tempo: number;
  volume: number;
  /** Go to the next question automatically after a correct answer. */
  autoAdvance: boolean;
  /** Ask the items you miss more often. */
  focusWeak: boolean;
  /** Questions per session. */
  sessionLength: number;
  /** Default answer method. */
  inputMode: "buttons" | "piano" | "sing";
  theme: "system" | "light" | "dark";
  /** Questions per day to hit the daily goal. */
  dailyGoal: number;
  /** Questions in the smart daily session. */
  dailyLength: number;
  /** Drills mixed into the daily session. */
  dailyDrills: string[];
  /** Show famous-song references for intervals after answering. */
  songRefs: boolean;
  /** Your own song references, by interval id. Replace the built-in ones. */
  songRefEdits: Record<string, { asc?: string; desc?: string }>;
  /** Set the key before interval, scale and note questions. */
  context: "off" | "cadence" | "drone";
  /** Show answers on a music staff too. */
  showStaff: boolean;
  /** Comfortable singing range (MIDI), measured by the range check. */
  voiceRange: { lo: number; hi: number } | null;
  sing: SingSettings;
}

export interface SingSettings {
  mode: "match" | "intervals" | "sightsing";
  intervals: string[];
  /** Degrees used for sight-singing melodies. */
  degrees: string[];
  /** Notes per sight-singing melody. */
  length: number;
  /** How close counts as in tune, in cents. */
  tolerance: number;
  /** Accept the right note in any octave. */
  anyOctave: boolean;
  /** Seconds allowed per note before it counts as a miss. */
  timeLimit: number;
}

const KEY = "et.settings.v1";

export const DEFAULT_SETTINGS: Settings = {
  instrument: "piano",
  varyInstrument: false,
  randomKey: true,
  fixedRoot: 0,
  randomRegister: true,
  noteNames: "letters",
  tempo: 90,
  volume: 0.8,
  autoAdvance: false,
  focusWeak: true,
  sessionLength: 20,
  inputMode: "buttons",
  theme: "system",
  dailyGoal: 40,
  dailyLength: 20,
  dailyDrills: ["intervals", "chords", "scales", "pitch"],
  songRefs: true,
  songRefEdits: {},
  context: "off",
  showStaff: true,
  voiceRange: null,
  sing: {
    mode: "match",
    intervals: ["M2", "m3", "M3", "P4", "P5", "M6", "P8"],
    degrees: ["1", "2", "3", "4", "5", "6", "7"],
    length: 4,
    tolerance: 35,
    anyOctave: true,
    timeLimit: 10,
  },
};

function withDefaults(saved: Partial<Settings>): Settings {
  return { ...DEFAULT_SETTINGS, ...saved, sing: { ...DEFAULT_SETTINGS.sing, ...saved.sing } };
}

let current: Settings = withDefaults(loadJSON<Partial<Settings>>(KEY, {}));
const listeners = new Set<() => void>();

export function getSettings(): Settings {
  return current;
}

export function updateSettings(patch: Partial<Settings>): void {
  current = { ...current, ...patch };
  saveJSON(KEY, current);
  listeners.forEach((l) => l());
}

/** Replace all settings (backup restore / cloud sync). Unknown keys fall back to defaults. */
export function replaceSettings(next: Partial<Settings>): void {
  current = withDefaults(next);
  saveJSON(KEY, current);
  listeners.forEach((l) => l());
}

function subscribe(l: () => void) {
  listeners.add(l);
  return () => listeners.delete(l);
}

export function useSettings(): Settings {
  return useSyncExternalStore(subscribe, getSettings, getSettings);
}
