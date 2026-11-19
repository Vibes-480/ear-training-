// Cloud sync through Supabase. Turned on by the VITE_SUPABASE_URL and
// VITE_SUPABASE_ANON_KEY environment variables; without them the app is local-only.
//
// One row per user (see supabase/schema.sql). On sign-in and when the app comes
// back to the foreground we pull, merge with what's on this device, and push.
// Local changes are pushed a few seconds after they happen.

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { useSyncExternalStore } from "react";
import { getConfigs, onConfigsChange, replaceConfigs } from "../drills/config";
import { getPresets, onPresetsChange, replacePresets } from "../store/presets";
import { getProgress, onProgressChange, replaceProgress, type Progress } from "../store/progress";
import { getSettings, onSettingsChange, replaceSettings } from "../store/settings";
import { loadJSON, saveJSON } from "../store/storage";
import { getCurriculum, replaceCurriculum, subscribe as onCurriculumChange, type CurriculumState } from "../store/curriculum";
import { mergeProgress, newer, sameProgress } from "./merge";

const URL_ = import.meta.env.VITE_SUPABASE_URL;
const KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;
export const syncConfigured = !!(URL_ && KEY);

export type SyncStatus = "off" | "signed-out" | "syncing" | "synced" | "error";

export interface SyncState {
  status: SyncStatus;
  email?: string;
  lastSync?: number;
  error?: string;
}

let state: SyncState = { status: syncConfigured ? "signed-out" : "off" };
const listeners = new Set<() => void>();
function setState(patch: Partial<SyncState>) {
  state = { ...state, ...patch };
  listeners.forEach((l) => l());
}

export function useSync(): SyncState {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => state,
    () => state,
  );
}

let client: SupabaseClient | null = null;
function sb(): SupabaseClient | null {
  if (!client && syncConfigured) {
    client = createClient(URL_!, KEY!, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, flowType: "pkce" },
    });
  }
  return client;
}

// When each kind of data last changed on this device, so the newest copy wins.
interface Meta {
  settingsAt: number;
  configsAt: number;
  presetsAt: number;
}
const META_KEY = "et.sync.meta.v1";
let meta: Meta = { settingsAt: 0, configsAt: 0, presetsAt: 0, ...loadJSON<Partial<Meta>>(META_KEY, {}) };
const saveMeta = () => saveJSON(META_KEY, meta);

let userId: string | null = null;
let applyingRemote = false;
let pushTimer: number | undefined;
let lastPull = 0;
let busy = false;

function schedulePush() {
  if (!userId || applyingRemote) return;
  window.clearTimeout(pushTimer);
  pushTimer = window.setTimeout(() => void push(), 3000);
}

async function push(): Promise<void> {
  const c = sb();
  if (!c || !userId) return;
  setState({ status: "syncing" });
  const { error } = await c.from("user_data").upsert({
    user_id: userId,
    progress: getProgress(),
    settings: getSettings(),
    configs: getConfigs(),
    presets: getPresets(),
    extra: { meta, curriculum: getCurriculum() },
    updated_at: new Date().toISOString(),
  });
  if (error) setState({ status: "error", error: friendly(error.message) });
  else setState({ status: "synced", lastSync: Date.now(), error: undefined });
}

/** Pull the cloud copy, merge it into this device, then push the result. */
export async function syncNow(): Promise<void> {
  const c = sb();
  if (!c || !userId || busy) return;
  busy = true;
  setState({ status: "syncing" });
  try {
    const { data, error } = await c.from("user_data").select("*").eq("user_id", userId).maybeSingle();
    if (error) {
      setState({ status: "error", error: friendly(error.message) });
      return;
    }
    lastPull = Date.now();
    if (data) {
      applyingRemote = true;
      try {
        const remoteMeta: Partial<Meta> = data.extra?.meta ?? {};
        const merged = mergeProgress(getProgress(), (data.progress ?? {}) as Progress);
        if (!sameProgress(merged, getProgress())) replaceProgress(merged);

        const s = newer({ value: getSettings(), at: meta.settingsAt }, { value: emptyToUndef(data.settings), at: remoteMeta.settingsAt ?? 0 });
        if (s.fromRemote) {
          replaceSettings(s.value);
          meta.settingsAt = remoteMeta.settingsAt ?? 0;
        }
        const cf = newer({ value: getConfigs(), at: meta.configsAt }, { value: emptyToUndef(data.configs), at: remoteMeta.configsAt ?? 0 });
        if (cf.fromRemote) {
          replaceConfigs(cf.value);
          meta.configsAt = remoteMeta.configsAt ?? 0;
        }
        const pr = newer({ value: getPresets(), at: meta.presetsAt }, { value: Array.isArray(data.presets) ? data.presets : undefined, at: remoteMeta.presetsAt ?? 0 });
        if (pr.fromRemote) {
          replacePresets(pr.value);
          meta.presetsAt = remoteMeta.presetsAt ?? 0;
        }
        // Levels: keep the best result from either device.
        const rc: CurriculumState | undefined = data.extra?.curriculum;
        if (rc?.best) {
          const best = { ...getCurriculum().best };
          let changed = false;
          for (const [id, r] of Object.entries(rc.best)) {
            if (!best[id] || r.pct > best[id].pct) {
              best[id] = r;
              changed = true;
            }
          }
          if (changed) replaceCurriculum({ best });
        }
        saveMeta();
      } finally {
        applyingRemote = false;
      }
    }
    await push();
  } catch (e) {
    setState({ status: "error", error: friendly(e instanceof Error ? e.message : String(e)) });
  } finally {
    busy = false;
  }
}

function emptyToUndef<T>(v: T): T | undefined {
  return v && typeof v === "object" && Object.keys(v as object).length === 0 ? undefined : v;
}

function friendly(msg: string): string {
  if (/relation .*user_data.* does not exist|Could not find the table/i.test(msg)) return "The user_data table is missing. Run supabase/schema.sql in the Supabase SQL Editor.";
  if (/Failed to fetch|NetworkError|network/i.test(msg)) return "Can't reach the server. You're probably offline; changes will sync later.";
  return msg;
}

export async function sendSignInLink(email: string): Promise<string | null> {
  const c = sb();
  if (!c) return "Cloud sync isn't set up.";
  const { error } = await c.auth.signInWithOtp({ email, options: { emailRedirectTo: `${window.location.origin}/settings` } });
  return error ? friendly(error.message) : null;
}

export async function signOut(): Promise<void> {
  await sb()?.auth.signOut();
}

let started = false;
/** Call once at startup. */
export function initSync(): void {
  if (started) return;
  started = true;

  const touch = (k: keyof Meta) => () => {
    if (applyingRemote) return;
    meta[k] = Date.now();
    saveMeta();
    schedulePush();
  };
  onSettingsChange(touch("settingsAt"));
  onConfigsChange(touch("configsAt"));
  onPresetsChange(touch("presetsAt"));
  onProgressChange(() => schedulePush());
  onCurriculumChange(() => schedulePush());

  const c = sb();
  if (!c) return;
  c.auth.onAuthStateChange((_event, session) => {
    const uid = session?.user?.id ?? null;
    const changed = uid !== userId;
    userId = uid;
    if (!uid) {
      setState({ status: "signed-out", email: undefined });
      return;
    }
    setState({ email: session?.user?.email ?? undefined });
    // Supabase advises against awaiting its own calls inside this callback.
    if (changed) window.setTimeout(() => void syncNow(), 0);
  });

  const onVisible = () => {
    if (document.visibilityState === "visible" && userId && Date.now() - lastPull > 60_000) void syncNow();
    if (document.visibilityState === "hidden" && userId) {
      window.clearTimeout(pushTimer);
      void push();
    }
  };
  document.addEventListener("visibilitychange", onVisible);
  window.addEventListener("online", () => userId && void syncNow());
}
