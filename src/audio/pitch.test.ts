import { describe, expect, it } from "vitest";
import { detectPitch, freqToMidi, NoteStabilizer } from "./pitch";

const SR = 48000;

function tone(freq: number, n = 2048, harmonics = [1, 0.5, 0.3, 0.2], noise = 0): Float32Array {
  const b = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    let v = 0;
    harmonics.forEach((a, h) => (v += a * Math.sin((2 * Math.PI * freq * (h + 1) * i) / SR)));
    b[i] = 0.2 * v + noise * (Math.random() * 2 - 1);
  }
  return b;
}

describe("pitch detection", () => {
  it.each([82.41, 110, 196, 261.63, 440, 659.25, 987.77])("finds %f Hz within 5 cents", (f) => {
    const r = detectPitch(tone(f), SR)!;
    expect(r).not.toBeNull();
    expect(Math.abs((freqToMidi(r.freq) - freqToMidi(f)) * 100)).toBeLessThan(5);
  });

  it("copes with a weak fundamental (voice-like)", () => {
    const r = detectPitch(tone(146.83, 2048, [0.3, 1, 0.6, 0.4]), SR)!;
    expect(Math.round(r.midi)).toBe(50);
  });

  it("copes with some noise", () => {
    const r = detectPitch(tone(220, 2048, [1, 0.4], 0.05), SR)!;
    expect(Math.round(r.midi)).toBe(57);
  });

  it("ignores silence and pure noise", () => {
    expect(detectPitch(new Float32Array(2048), SR)).toBeNull();
    const noise = new Float32Array(2048).map(() => Math.random() * 2 - 1);
    const r = detectPitch(noise, SR);
    expect(r === null || r.clarity < 0.75).toBe(true);
  });
});

describe("note stabiliser", () => {
  const reading = (midi: number) => ({ freq: 0, midi, clarity: 0.95, rms: 0.1 });

  it("reports a held note with its cents offset", () => {
    const s = new NoteStabilizer(300);
    let out = null;
    for (let t = 0; t <= 400 && !out; t += 40) out = s.push(reading(60.12), t);
    expect(out).toEqual({ midi: 60, cents: 12 });
  });

  it("restarts when the pitch moves to another note", () => {
    const s = new NoteStabilizer(300);
    for (let t = 0; t < 200; t += 40) s.push(reading(60), t);
    let out = null;
    for (let t = 200; t < 450 && !out; t += 40) out = s.push(reading(64), t);
    expect(out).toBeNull();
  });
});
