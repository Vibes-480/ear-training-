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
  inputMode: "buttons" | "piano";
  theme: "system" | "light" | "dark";
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
};

let current: Settings = { ...DEFAULT_SETTINGS, ...loadJSON<Partial<Settings>>(KEY, {}) };
const listeners = new Set<() => void>();

export function getSettings(): Settings {
  return current;
}

export function updateSettings(patch: Partial<Settings>): void {
  current = { ...current, ...patch };
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
