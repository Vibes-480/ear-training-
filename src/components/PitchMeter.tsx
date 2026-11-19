import { useEffect, useRef } from "react";
import type { MicState } from "../audio/mic";
import type { PitchReading } from "../audio/pitch";
import { midiName } from "../theory/notes";

interface Props {
  reading: PitchReading | null;
  state: MicState;
  /** MIDI note being aimed for, if any. Shown as a band on the trace. */
  target?: number | null;
  /** Ignore the octave when comparing with the target. */
  anyOctave?: boolean;
  tolerance?: number;
}

/** Live sung pitch: note name, a cents needle and a scrolling trace. */
export function PitchMeter({ reading, state, target, anyOctave, tolerance = 35 }: Props) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const history = useRef<{ t: number; midi: number | null }[]>([]);

  // Distance from target in cents (octave-folded if anyOctave).
  let off: number | null = null;
  if (reading && target != null) {
    off = (reading.midi - target) * 100;
    if (anyOctave) off = ((((off + 600) % 1200) + 1200) % 1200) - 600;
  }
  const onTarget = off !== null && Math.abs(off) <= tolerance;

  useEffect(() => {
    const now = performance.now();
    history.current.push({ t: now, midi: reading ? reading.midi : null });
    history.current = history.current.filter((h) => now - h.t < 4000);
    const c = canvas.current;
    if (!c) return;
    const dpr = window.devicePixelRatio || 1;
    const w = c.clientWidth;
    const h = c.clientHeight;
    if (c.width !== w * dpr) {
      c.width = w * dpr;
      c.height = h * dpr;
    }
    const g = c.getContext("2d");
    if (!g) return;
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.clearRect(0, 0, w, h);
    const css = getComputedStyle(c);
    const accent = css.getPropertyValue("--accent").trim() || "#3b5bdb";
    const okc = css.getPropertyValue("--ok").trim() || "#1f8a4c";
    const grid = css.getPropertyValue("--border").trim() || "#ddd";

    const pts = history.current.filter((p) => p.midi !== null) as { t: number; midi: number }[];
    let center = target ?? (pts.length ? pts[pts.length - 1].midi : 60);
    if (anyOctave && target != null && pts.length) {
      // Show the target in the singer's octave.
      const last = pts[pts.length - 1].midi;
      center = target + 12 * Math.round((last - target) / 12);
    }
    const span = 7; // semitones visible above and below
    const y = (m: number) => h / 2 - ((m - center) / span) * (h / 2);
    g.strokeStyle = grid;
    g.lineWidth = 1;
    for (let k = -span; k <= span; k++) {
      g.beginPath();
      g.moveTo(0, y(center + k));
      g.lineTo(w, y(center + k));
      g.stroke();
    }
    if (target != null) {
      g.fillStyle = okc + "33";
      const band = tolerance / 100;
      g.fillRect(0, y(center + band), w, y(center - band) - y(center + band));
    }
    g.strokeStyle = accent;
    g.lineWidth = 2;
    g.beginPath();
    let pen = false;
    let prevT = 0;
    for (const p of history.current) {
      const x = w - ((now - p.t) / 4000) * w;
      if (p.midi === null || p.t - prevT > 150) pen = false;
      if (p.midi !== null) {
        const yy = y(p.midi);
        if (pen) g.lineTo(x, yy);
        else g.moveTo(x, yy);
        pen = true;
      }
      prevT = p.t;
    }
    g.stroke();
  }, [reading, target, anyOctave, tolerance]);

  let status = "";
  if (state === "starting") status = "Starting microphone…";
  else if (state === "denied") status = "Microphone blocked. Allow it in your browser's site settings, then reload.";
  else if (state === "unsupported") status = "No microphone available in this browser.";

  const cents = reading ? Math.round((reading.midi - Math.round(reading.midi)) * 100) : 0;

  return (
    <div className={`pitch-meter ${onTarget ? "on-target" : ""}`}>
      {status ? (
        <p className="warn">{status}</p>
      ) : (
        <>
          <div className="pm-row">
            <span className="pm-note">{reading ? midiName(Math.round(reading.midi), cents > 0 ? false : true) : "–"}</span>
            <div className="pm-needle" aria-hidden>
              <div className="pm-scale" />
              <div className="pm-center" />
              {reading && <div className="pm-dot" style={{ left: `${50 + Math.max(-50, Math.min(50, off ?? cents))}%` }} />}
            </div>
            <span className="pm-cents tabular">
              {!reading ? "" : off !== null && Math.abs(off) > 100 ? (off < 0 ? "↑ higher" : "↓ lower") : `${(off ?? cents) > 0 ? "+" : ""}${Math.round(off ?? cents)}¢`}
            </span>
          </div>
          <canvas ref={canvas} className="pm-trace" aria-label="Pitch trace" />
        </>
      )}
    </div>
  );
}
