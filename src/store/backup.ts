// Whole-app backup: progress, settings, drill options and presets in one file.

import { getConfigs, replaceConfigs } from "../drills/config";
import type { DrillConfigs } from "../drills/types";
import { getPresets, replacePresets, type Preset } from "./presets";
import { getProgress, importProgress, type Progress } from "./progress";
import { getSettings, replaceSettings, type Settings } from "./settings";

export interface Backup {
  app: "ear-trainer";
  version: 2;
  exportedAt: string;
  progress: Progress;
  settings: Settings;
  configs: DrillConfigs;
  presets: Preset[];
}

export function exportAll(): string {
  const b: Backup = {
    app: "ear-trainer",
    version: 2,
    exportedAt: new Date().toISOString(),
    progress: getProgress(),
    settings: getSettings(),
    configs: getConfigs(),
    presets: getPresets(),
  };
  return JSON.stringify(b, null, 2);
}

export function importAll(json: string): void {
  const data = JSON.parse(json) as Partial<Backup> & Partial<Progress>;
  if (data && data.app === "ear-trainer" && data.progress) {
    importProgress(JSON.stringify(data.progress));
    if (data.settings) replaceSettings(data.settings);
    if (data.configs) replaceConfigs(data.configs);
    if (Array.isArray(data.presets)) replacePresets(data.presets);
    return;
  }
  // Version 1 backups held progress only.
  importProgress(json);
}
