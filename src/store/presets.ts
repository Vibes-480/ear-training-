import { useSyncExternalStore } from "react";
import type { DrillConfigs, DrillId } from "../drills/types";
import { loadJSON, saveJSON } from "./storage";

export interface Preset<K extends DrillId = DrillId> {
  id: string;
  name: string;
  drill: K;
  config: DrillConfigs[K];
  createdAt: number;
}

const KEY = "et.presets.v1";
let current: Preset[] = loadJSON<Preset[]>(KEY, []);
const listeners = new Set<() => void>();

function commit(next: Preset[]) {
  current = next;
  saveJSON(KEY, current);
  listeners.forEach((l) => l());
}

export function getPresets(): Preset[] {
  return current;
}

export function savePreset<K extends DrillId>(drill: K, name: string, config: DrillConfigs[K]): Preset<K> {
  const preset: Preset<K> = { id: Math.random().toString(36).slice(2, 10), name: name.trim() || "My preset", drill, config, createdAt: Date.now() };
  commit([...current, preset as unknown as Preset]);
  return preset;
}

export function deletePreset(id: string): void {
  commit(current.filter((p) => p.id !== id));
}

export function replacePresets(list: Preset[]): void {
  commit(list);
}

function subscribe(l: () => void) {
  listeners.add(l);
  return () => listeners.delete(l);
}

export function usePresets(): Preset[] {
  return useSyncExternalStore(subscribe, getPresets, getPresets);
}

export { subscribe as onPresetsChange };
