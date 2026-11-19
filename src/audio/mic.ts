// Microphone input feeding the pitch detector. Readings taken while the app
// itself is playing are dropped, so the speaker doesn't "answer" for you.

import { useEffect, useRef, useState } from "react";
import { audio } from "./engine";
import { detectPitch, type PitchReading } from "./pitch";

export type MicState = "off" | "starting" | "on" | "denied" | "unsupported";

class Mic {
  private stream: MediaStream | null = null;
  private analyser: AnalyserNode | null = null;
  private source: MediaStreamAudioSourceNode | null = null;
  private timer: number | undefined;
  private buf: Float32Array<ArrayBuffer> = new Float32Array(2048);
  private listeners = new Set<(r: PitchReading | null, t: number) => void>();
  state: MicState = "off";
  private stateListeners = new Set<() => void>();

  private setState(s: MicState) {
    this.state = s;
    this.stateListeners.forEach((l) => l());
  }

  onState(l: () => void) {
    this.stateListeners.add(l);
    return () => {
      this.stateListeners.delete(l);
    };
  }

  async start(): Promise<MicState> {
    if (this.state === "on") return "on";
    if (!navigator.mediaDevices?.getUserMedia) {
      this.setState("unsupported");
      return this.state;
    }
    this.setState("starting");
    try {
      const ctx = await audio.unlock();
      this.stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false },
      });
      this.source = ctx.createMediaStreamSource(this.stream);
      this.analyser = ctx.createAnalyser();
      this.analyser.fftSize = 2048;
      this.source.connect(this.analyser);
      this.buf = new Float32Array(this.analyser.fftSize);
      const sr = ctx.sampleRate;
      // ~25 readings a second is plenty and easy on phones.
      this.timer = window.setInterval(() => {
        if (!this.analyser) return;
        const t = performance.now();
        if (audio.isPlaying()) {
          this.listeners.forEach((l) => l(null, t));
          return;
        }
        this.analyser.getFloatTimeDomainData(this.buf);
        const r = detectPitch(this.buf, sr);
        this.listeners.forEach((l) => l(r, t));
      }, 40);
      this.setState("on");
    } catch (e) {
      console.warn("Microphone unavailable", e);
      this.setState(e instanceof DOMException && e.name === "NotAllowedError" ? "denied" : "unsupported");
    }
    return this.state;
  }

  stop() {
    window.clearInterval(this.timer);
    this.source?.disconnect();
    this.stream?.getTracks().forEach((t) => t.stop());
    this.stream = null;
    this.analyser = null;
    this.source = null;
    if (this.state === "on" || this.state === "starting") this.setState("off");
  }

  subscribe(l: (r: PitchReading | null, t: number) => void) {
    this.listeners.add(l);
    return () => {
      this.listeners.delete(l);
    };
  }
}

export const mic = new Mic();

/**
 * Turns the mic on while `active` and calls `onReading` for each reading.
 * Returns the mic state and the latest reading (for display).
 */
export function useMic(active: boolean, onReading?: (r: PitchReading | null, t: number) => void) {
  const [state, setState] = useState<MicState>(mic.state);
  const [reading, setReading] = useState<PitchReading | null>(null);
  const cb = useRef(onReading);
  cb.current = onReading;

  useEffect(() => mic.onState(() => setState(mic.state)), []);

  useEffect(() => {
    if (!active) return;
    void mic.start();
    const unsub = mic.subscribe((r, t) => {
      setReading(r);
      cb.current?.(r, t);
    });
    return () => {
      unsub();
      mic.stop();
    };
  }, [active]);

  return { state, reading };
}
