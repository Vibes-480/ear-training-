// Audio playback. Real instrument samples come from smplr (streamed and cached by
// the browser); a small built-in synth is used while samples load or if they fail.

import { CacheStorage, Soundfont, SplendidGrandPiano, type NotesToLoad, type Smplr, type Storage } from "smplr";
import type { InstrumentId } from "../store/settings";
import type { PlayEvent } from "../drills/types";

export type LoadState = "idle" | "loading" | "ready" | "failed";

const SOUNDFONT_NAMES: Partial<Record<InstrumentId, string>> = {
  epiano: "electric_piano_1",
  guitar: "acoustic_guitar_nylon",
  strings: "string_ensemble_1",
  vibes: "vibraphone",
};

/** Only fetch samples for the range and loudness the app actually plays. */
const NOTES_TO_LOAD: NotesToLoad = {
  notes: Array.from({ length: 61 }, (_, i) => 36 + i), // C2–C7
  velocityRange: [75, 85],
  fallback: "nearest",
};

let storage: Storage | undefined;
function sampleStorage(): Storage | undefined {
  // Keep downloaded samples in the browser cache so later visits load instantly.
  if (storage === undefined && typeof caches !== "undefined") {
    try {
      storage = CacheStorage("ear-trainer-samples");
    } catch {
      storage = undefined;
    }
  }
  return storage;
}

export const SAMPLED_INSTRUMENTS: InstrumentId[] = ["piano", "epiano", "guitar", "strings", "vibes"];

type Listener = () => void;

class AudioEngine {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private instruments = new Map<InstrumentId, Smplr>();
  private loadPromises = new Map<InstrumentId, Promise<Smplr | null>>();
  private states = new Map<InstrumentId, LoadState>();
  private synthVoices: { osc: OscillatorNode[]; gain: GainNode }[] = [];
  private listeners = new Set<Listener>();
  private volume = 0.8;

  /** Must be called from a user gesture the first time (browser autoplay rules). */
  async unlock(): Promise<AudioContext> {
    if (!this.ctx) {
      this.ctx = new AudioContext({ latencyHint: "interactive" });
      this.master = this.ctx.createGain();
      this.master.gain.value = this.volume;
      this.master.connect(this.ctx.destination);
    }
    if (this.ctx.state === "suspended") await this.ctx.resume();
    return this.ctx;
  }

  get context(): AudioContext | null {
    return this.ctx;
  }

  setVolume(v: number) {
    this.volume = v;
    if (this.master && this.ctx) this.master.gain.setTargetAtTime(v, this.ctx.currentTime, 0.02);
    this.instruments.forEach((inst) => (inst.output.volume = Math.round(v * 127)));
  }

  state(id: InstrumentId): LoadState {
    if (id === "synth") return "ready";
    return this.states.get(id) ?? "idle";
  }

  subscribe(l: Listener) {
    this.listeners.add(l);
    return () => {
      this.listeners.delete(l);
    };
  }

  private setState(id: InstrumentId, s: LoadState) {
    this.states.set(id, s);
    this.listeners.forEach((l) => l());
  }

  /** Start loading an instrument's samples. Safe to call repeatedly. */
  load(id: InstrumentId): Promise<Smplr | null> {
    if (id === "synth") return Promise.resolve(null);
    const existing = this.loadPromises.get(id);
    if (existing) return existing;
    const p = (async () => {
      const ctx = await this.unlock();
      this.setState(id, "loading");
      try {
        const common = { volume: Math.round(this.volume * 127), storage: sampleStorage(), notesToLoad: NOTES_TO_LOAD };
        const inst =
          id === "piano"
            ? SplendidGrandPiano(ctx, common)
            : Soundfont(ctx, { ...common, instrument: SOUNDFONT_NAMES[id]! });
        await withTimeout(inst.ready, 30_000);
        this.instruments.set(id, inst);
        this.setState(id, "ready");
        return inst;
      } catch (err) {
        console.warn(`Could not load ${id} samples, using synth`, err);
        this.loadPromises.delete(id);
        this.setState(id, "failed");
        return null;
      }
    })();
    this.loadPromises.set(id, p);
    return p;
  }

  /**
   * Play a sequence of events. Returns the total length in seconds.
   * Uses the sampled instrument if ready, otherwise the synth.
   */
  async play(events: PlayEvent[], id: InstrumentId, offset = 0.05): Promise<number> {
    const ctx = await this.unlock();
    this.stop();
    const inst = id === "synth" ? null : this.instruments.get(id) ?? null;
    const t0 = ctx.currentTime + offset;
    let end = 0;
    for (const ev of events) {
      end = Math.max(end, ev.at + ev.dur);
      for (const midi of ev.midi) {
        if (inst) inst.start({ note: midi, time: t0 + ev.at, duration: ev.dur, velocity: 80 });
        else this.synthNote(midi, t0 + ev.at, ev.dur);
      }
    }
    return end + offset;
  }

  /** Short note for piano key taps. */
  async tap(midi: number, id: InstrumentId) {
    const ctx = await this.unlock();
    const inst = id === "synth" ? null : this.instruments.get(id) ?? null;
    if (inst) inst.start({ note: midi, time: ctx.currentTime, duration: 0.9, velocity: 75 });
    else this.synthNote(midi, ctx.currentTime, 0.7);
  }

  stop() {
    this.instruments.forEach((inst) => inst.stop());
    const now = this.ctx?.currentTime ?? 0;
    for (const v of this.synthVoices) {
      try {
        v.gain.gain.cancelScheduledValues(now);
        v.gain.gain.setTargetAtTime(0, now, 0.02);
        v.osc.forEach((o) => o.stop(now + 0.1));
      } catch {
        // Voice already finished.
      }
    }
    this.synthVoices = [];
  }

  private synthNote(midi: number, time: number, dur: number) {
    if (!this.ctx || !this.master) return;
    const ctx = this.ctx;
    const freq = 440 * Math.pow(2, (midi - 69) / 12);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0, time);
    gain.gain.linearRampToValueAtTime(0.22, time + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.12, time + 0.25);
    gain.gain.setValueAtTime(0.12, time + Math.max(0.26, dur));
    gain.gain.exponentialRampToValueAtTime(0.0001, time + dur + 0.35);
    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = Math.min(8000, freq * 6);
    filter.connect(gain);
    gain.connect(this.master);
    const osc = [ctx.createOscillator(), ctx.createOscillator()];
    osc[0].type = "triangle";
    osc[0].frequency.value = freq;
    osc[1].type = "sine";
    osc[1].frequency.value = freq * 2;
    const g2 = ctx.createGain();
    g2.gain.value = 0.25;
    osc[0].connect(filter);
    osc[1].connect(g2).connect(filter);
    osc.forEach((o) => {
      o.start(time);
      o.stop(time + dur + 0.4);
    });
    const voice = { osc, gain };
    this.synthVoices.push(voice);
    osc[0].onended = () => {
      this.synthVoices = this.synthVoices.filter((v) => v !== voice);
    };
  }
}

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error("timeout")), ms);
    p.then(
      (v) => {
        clearTimeout(t);
        resolve(v);
      },
      (e) => {
        clearTimeout(t);
        reject(e);
      },
    );
  });
}

export const audio = new AudioEngine();
