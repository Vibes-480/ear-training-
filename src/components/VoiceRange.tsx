import { useRef, useState } from "react";
import { useMic } from "../audio/mic";
import { NoteStabilizer } from "../audio/pitch";
import { updateSettings } from "../store/settings";
import { midiName } from "../theory/notes";
import { PitchMeter } from "./PitchMeter";

/** Two-step check: sing your lowest, then your highest comfortable note. */
export function VoiceRangeCheck({ onDone, onCancel }: { onDone: () => void; onCancel?: () => void }) {
  const [step, setStep] = useState<"low" | "high">("low");
  const [low, setLow] = useState<number | null>(null);
  const [high, setHigh] = useState<number | null>(null);
  const stab = useRef(new NoteStabilizer(400));

  const { state, reading } = useMic(true, (r, t) => {
    const n = stab.current.push(r, t);
    if (!n) return;
    if (step === "low") setLow((v) => (v === null ? n.midi : Math.min(v, n.midi)));
    else setHigh((v) => (v === null ? n.midi : Math.max(v, n.midi)));
  });

  const current = step === "low" ? low : high;
  const save = () => {
    if (low === null || high === null) return;
    const lo = Math.min(low, high);
    const hi = Math.max(low, high);
    updateSettings({ voiceRange: { lo, hi: Math.max(hi, lo + 7) } });
    onDone();
  };

  return (
    <section className="card">
      <h2 className="card-title">Find your voice range</h2>
      <p className="muted">
        {step === "low"
          ? "Sing your lowest comfortable note and hold it for a second. Try going a little lower until it gets strained, then stop."
          : "Now sing your highest comfortable note (no straining) and hold it."}
      </p>
      <PitchMeter reading={reading} state={state} />
      <div className="range-result">
        <span>
          {step === "low" ? "Lowest" : "Highest"} so far: <strong>{current === null ? "–" : midiName(current)}</strong>
        </span>
        {step === "high" && low !== null && <span className="muted">Lowest: {midiName(low)}</span>}
      </div>
      <div className="row-buttons">
        {step === "low" ? (
          <button
            type="button"
            className="btn primary"
            disabled={low === null}
            onClick={() => {
              stab.current.reset();
              setStep("high");
            }}
          >
            Next: highest note
          </button>
        ) : (
          <button type="button" className="btn primary" disabled={high === null} onClick={save}>
            Save my range
          </button>
        )}
        {step === "low" && low !== null && (
          <button type="button" className="btn" onClick={() => setLow(null)}>
            Start over
          </button>
        )}
        <button
          type="button"
          className="btn"
          onClick={() => {
            if (!onCancel) {
              updateSettings({ voiceRange: { lo: 48, hi: 72 } });
              onDone();
            } else onCancel();
          }}
        >
          {onCancel ? "Cancel" : "Skip (use C3–C5)"}
        </button>
      </div>
    </section>
  );
}
