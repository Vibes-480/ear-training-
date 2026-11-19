import { useEffect, useMemo, useRef, useState } from "react";
import { midiName } from "../theory/notes";

export type KeyMark = "given" | "selected" | "correct" | "wrong" | "answer";

interface Props {
  /** Lowest MIDI note shown (should be a C). */
  lo: number;
  /** Highest MIDI note shown (should be a C). */
  hi: number;
  marks?: Record<number, KeyMark>;
  onKey?: (midi: number) => void;
  disabled?: boolean;
  /** Listen to the computer keyboard (A W S E D F T G Y H U J K O L P ;). */
  keyboard?: boolean;
  /** Scroll this key into view on narrow screens. */
  focusMidi?: number;
}

const BLACK = new Set([1, 3, 6, 8, 10]);
// Computer keys for one and a bit octaves starting on C.
const KEY_MAP = ["a", "w", "s", "e", "d", "f", "t", "g", "y", "h", "u", "j", "k", "o", "l", "p", ";"];

export function Piano({ lo, hi, marks = {}, onKey, disabled, keyboard, focusMidi }: Props) {
  const scrollRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = scrollRef.current;
    if (!el || focusMidi === undefined) return;
    const key = el.querySelector<HTMLElement>(`[data-midi="${focusMidi}"]`);
    if (key) el.scrollLeft = Math.max(0, key.offsetLeft - el.clientWidth / 3);
  }, [focusMidi, lo, hi]);
  // Octave the computer keyboard starts on (Z / X shift it).
  const [kbBase, setKbBase] = useState(lo);
  useEffect(() => setKbBase(lo), [lo]);

  useEffect(() => {
    if (!keyboard || disabled) return;
    const handler = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey || e.repeat) return;
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === "INPUT" || target.tagName === "SELECT" || target.tagName === "TEXTAREA")) return;
      const k = e.key.toLowerCase();
      if (k === "z") return setKbBase((b) => Math.max(lo, b - 12));
      if (k === "x") return setKbBase((b) => Math.min(hi - 12, b + 12));
      const idx = KEY_MAP.indexOf(k);
      if (idx >= 0) {
        const midi = kbBase + idx;
        if (midi <= hi) {
          e.preventDefault();
          onKey?.(midi);
        }
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [keyboard, disabled, kbBase, lo, hi, onKey]);

  const { whites, blacks } = useMemo(() => {
    const whites: number[] = [];
    const blacks: { midi: number; whiteIndex: number }[] = [];
    for (let m = lo; m <= hi; m++) {
      if (BLACK.has(((m % 12) + 12) % 12)) blacks.push({ midi: m, whiteIndex: whites.length });
      else whites.push(m);
    }
    return { whites, blacks };
  }, [lo, hi]);

  const whiteWidth = 100 / whites.length;

  const press = (midi: number) => {
    if (!disabled) onKey?.(midi);
  };

  const label = (m: number) => {
    const mark = marks[m];
    if (mark && mark !== "selected") return midiName(m);
    if (m % 12 === 0) return midiName(m);
    return "";
  };

  return (
    <div className="piano-scroll" ref={scrollRef}>
      <div className={`piano ${disabled ? "is-disabled" : ""}`} style={{ minWidth: whites.length * 34 }} role="group" aria-label="Piano keyboard">
        {whites.map((m) => (
          <button
            key={m}
            data-midi={m}
            type="button"
            className={`key white ${marks[m] ? `mark-${marks[m]}` : ""} ${keyboard && m >= kbBase && m < kbBase + KEY_MAP.length ? "kb-range" : ""}`}
            onPointerDown={(e) => {
              e.preventDefault();
              press(m);
            }}
            aria-label={midiName(m)}
            tabIndex={-1}
          >
            <span className="key-label">{label(m)}</span>
          </button>
        ))}
        {blacks.map(({ midi, whiteIndex }) => (
          <button
            key={midi}
            data-midi={midi}
            type="button"
            className={`key black ${marks[midi] ? `mark-${marks[midi]}` : ""}`}
            style={{ left: `calc(${whiteIndex * whiteWidth}% - ${whiteWidth * 0.31}%)`, width: `${whiteWidth * 0.62}%` }}
            onPointerDown={(e) => {
              e.preventDefault();
              press(midi);
            }}
            aria-label={midiName(midi)}
            tabIndex={-1}
          >
            <span className="key-label">{marks[midi] && marks[midi] !== "selected" ? midiName(midi) : ""}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
