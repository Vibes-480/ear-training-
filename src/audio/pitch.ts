// Monophonic pitch detection (YIN) and a stabiliser that turns a stream of
// readings into confident sung notes.

export interface PitchReading {
  freq: number;
  /** Fractional MIDI number, e.g. 60.23 = C4 + 23 cents. */
  midi: number;
  /** 0–1, how periodic the signal is. */
  clarity: number;
  rms: number;
}

export function freqToMidi(f: number): number {
  return 69 + 12 * Math.log2(f / 440);
}

export interface DetectOptions {
  minFreq?: number;
  maxFreq?: number;
  threshold?: number;
  /** Below this RMS level the input counts as silence. */
  minRms?: number;
}

/** YIN pitch detection on a block of samples. Returns null for silence or noise. */
export function detectPitch(buf: Float32Array, sampleRate: number, opts: DetectOptions = {}): PitchReading | null {
  const { minFreq = 60, maxFreq = 1100, threshold = 0.15, minRms = 0.01 } = opts;
  const n = buf.length;
  let sq = 0;
  for (let i = 0; i < n; i++) sq += buf[i] * buf[i];
  const rms = Math.sqrt(sq / n);
  if (rms < minRms) return null;

  const tauMin = Math.max(2, Math.floor(sampleRate / maxFreq));
  const tauMax = Math.min(Math.floor(sampleRate / minFreq), Math.floor(n / 2));
  const w = n - tauMax;
  const d = new Float32Array(tauMax + 2);
  for (let tau = 1; tau <= tauMax + 1 && tau < n - w; tau++) {
    let sum = 0;
    for (let i = 0; i < w; i++) {
      const diff = buf[i] - buf[i + tau];
      sum += diff * diff;
    }
    d[tau] = sum;
  }
  // Cumulative mean normalised difference.
  const cmnd = new Float32Array(tauMax + 2);
  cmnd[0] = 1;
  let running = 0;
  for (let tau = 1; tau <= tauMax + 1; tau++) {
    running += d[tau];
    cmnd[tau] = running > 0 ? (d[tau] * tau) / running : 1;
  }

  let tau = -1;
  for (let t = tauMin; t <= tauMax; t++) {
    if (cmnd[t] < threshold) {
      while (t + 1 <= tauMax && cmnd[t + 1] < cmnd[t]) t++;
      tau = t;
      break;
    }
  }
  if (tau < 0) {
    // No dip under the threshold: accept the best one only if it's fairly clear.
    let best = tauMin;
    for (let t = tauMin; t <= tauMax; t++) if (cmnd[t] < cmnd[best]) best = t;
    if (cmnd[best] > 0.3) return null;
    tau = best;
  }

  // Parabolic interpolation for sub-sample accuracy.
  const x0 = tau > 1 ? cmnd[tau - 1] : cmnd[tau];
  const x2 = tau + 1 <= tauMax ? cmnd[tau + 1] : cmnd[tau];
  const denom = x0 + x2 - 2 * cmnd[tau];
  const better = denom !== 0 ? tau + (x0 - x2) / (2 * denom) : tau;
  const freq = sampleRate / better;
  if (freq < minFreq || freq > maxFreq) return null;
  return { freq, midi: freqToMidi(freq), clarity: Math.max(0, 1 - cmnd[tau]), rms };
}

export interface StableNote {
  /** Nearest whole MIDI note. */
  midi: number;
  /** Average deviation from it, in cents. */
  cents: number;
}

/**
 * Reports a note once the singer has held the same pitch for `holdMs`.
 * Brief dropouts are tolerated; changing note restarts the clock.
 */
export class NoteStabilizer {
  private samples: { t: number; midi: number }[] = [];
  private lastHeard = 0;

  constructor(
    private holdMs = 350,
    private gapMs = 120,
  ) {}

  reset() {
    this.samples = [];
    this.lastHeard = 0;
  }

  push(r: PitchReading | null, t: number): StableNote | null {
    if (!r || r.clarity < 0.75) {
      if (t - this.lastHeard > this.gapMs) this.samples = [];
      return null;
    }
    this.lastHeard = t;
    const note = Math.round(r.midi);
    // Pitch jumped to another note: start over from here.
    if (this.samples.length && Math.round(this.median()) !== note) this.samples = [];
    this.samples.push({ t, midi: r.midi });
    this.samples = this.samples.filter((s) => t - s.t <= this.holdMs * 2);
    const span = t - this.samples[0].t;
    if (span < this.holdMs || this.samples.length < 4) return null;
    const m = this.median();
    return { midi: Math.round(m), cents: Math.round((m - Math.round(m)) * 100) };
  }

  private median(): number {
    const v = this.samples.map((s) => s.midi).sort((a, b) => a - b);
    return v[Math.floor(v.length / 2)];
  }
}
