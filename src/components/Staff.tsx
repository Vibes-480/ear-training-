// Music staff rendering with VexFlow. Loaded lazily (see StaffLazy.tsx) so the
// notation library only downloads when a staff is actually shown.

import { useEffect, useRef } from "react";
import { Accidental, Beam, Dot, Formatter, Renderer, Stave, StaveNote, Tuplet, Voice } from "vexflow";

export interface StaffNote {
  /** VexFlow keys, e.g. ["eb/4", "g/4"]. Ignored for rests. */
  keys: string[];
  /** VexFlow duration without the rest marker: "w", "h", "q", "8", "16". */
  duration: string;
  dots?: number;
  rest?: boolean;
  /** CSS color for this note (feedback). */
  color?: string;
  /** Start a new triplet group of this many notes at this note. */
  tuplet?: number;
}

export interface StaffProps {
  notes: StaffNote[];
  clef?: "treble" | "bass";
  /** VexFlow key signature, e.g. "Eb" or "F#m". */
  keySig?: string;
  /** e.g. "4/4". Adds a time signature and enables beaming. */
  timeSig?: string;
  /** Add barlines after this many beats (quarter notes). */
  beatsPerBar?: number;
  /** Width of the drawing; defaults to the container width. */
  height?: number;
  ariaLabel?: string;
  /** Small inline notation: no clef, compact. */
  bare?: boolean;
}

const BEATS: Record<string, number> = { w: 4, h: 2, q: 1, "8": 0.5, "16": 0.25 };

export function noteBeats(n: StaffNote): number {
  let b = BEATS[n.duration] ?? 1;
  let add = b;
  for (let i = 0; i < (n.dots ?? 0); i++) {
    add /= 2;
    b += add;
  }
  return b;
}

export default function Staff({ notes, clef = "treble", keySig = "C", timeSig, beatsPerBar, height = 130, ariaLabel = "Music staff", bare }: StaffProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const draw = () => {
      el.innerHTML = "";
      const width = Math.max(bare ? 60 : 260, el.clientWidth);
      const renderer = new Renderer(el, Renderer.Backends.SVG);
      renderer.resize(width, height);
      const ctx = renderer.getContext();
      ctx.setFillStyle("currentColor");
      ctx.setStrokeStyle("currentColor");

      // Split into bars when asked, otherwise one long bar without barlines.
      const bars: StaffNote[][] = [];
      if (beatsPerBar) {
        let cur: StaffNote[] = [];
        let beats = 0;
        let inTuplet = 0;
        for (const n of notes) {
          cur.push(n);
          if (n.tuplet) inTuplet = n.tuplet;
          const b = noteBeats(n) * (inTuplet ? 2 / 3 : 1);
          if (inTuplet) inTuplet--;
          beats += b;
          if (beats >= beatsPerBar - 1e-6) {
            bars.push(cur);
            cur = [];
            beats = 0;
          }
        }
        if (cur.length) bars.push(cur);
      } else bars.push(notes);
      if (!bars.length) bars.push([]);

      const firstExtra = bare ? 0 : 70 + (keySig !== "C" ? 40 : 0) + (timeSig ? 30 : 0);
      const usable = width - 20 - firstExtra;
      const barW = usable / bars.length;
      let x = 10;
      bars.forEach((bar, bi) => {
        const w = bi === 0 ? barW + firstExtra : barW;
        const stave = new Stave(x, bare ? -10 : 10, w);
        if (bare) {
          stave.setBegBarType(7); // none
          stave.setEndBarType(7);
        }
        if (bi === 0 && !bare) {
          stave.addClef(clef);
          if (keySig !== "C") stave.addKeySignature(keySig);
          if (timeSig) stave.addTimeSignature(timeSig);
        }
        if (bi === bars.length - 1 && beatsPerBar && !bare) stave.setEndBarType(3); // final barline
        stave.setContext(ctx).draw();
        x += w;
        if (!bar.length) return;

        const tuplets: StaveNote[][] = [];
        let tupletLeft = 0;
        const staveNotes = bar.map((n) => {
          const sn = new StaveNote({
            keys: n.rest ? [clef === "bass" ? "d/3" : "b/4"] : n.keys,
            duration: n.duration + (n.rest ? "r" : ""),
            clef,
            auto_stem: true,
          });
          if (n.dots) Dot.buildAndAttach([sn], { all: true });
          if (n.color) sn.setStyle({ fillStyle: n.color, strokeStyle: n.color });
          if (n.tuplet) {
            tuplets.push([]);
            tupletLeft = n.tuplet;
          }
          if (tupletLeft > 0) {
            tuplets[tuplets.length - 1].push(sn);
            tupletLeft--;
          }
          return sn;
        });
        const voice = new Voice({ num_beats: 4, beat_value: 4 }).setMode(Voice.Mode.SOFT);
        voice.addTickables(staveNotes);
        Accidental.applyAccidentals([voice], keySig);
        const beams = timeSig || bare ? Beam.generateBeams(staveNotes.filter((n) => !n.isRest())) : [];
        new Formatter().joinVoices([voice]).format([voice], w - (bi === 0 ? firstExtra : 0) - 20);
        voice.draw(ctx, stave);
        beams.forEach((b) => b.setContext(ctx).draw());
        tuplets.forEach((t) => {
          if (t.length >= 2) new Tuplet(t, { num_notes: 3, notes_occupied: 2 }).setContext(ctx).draw();
        });
      });
      const svg = el.querySelector("svg");
      if (svg) {
        svg.setAttribute("role", "img");
        svg.setAttribute("aria-label", ariaLabel);
      }
    };
    try {
      draw();
    } catch (e) {
      console.warn("Staff render failed", e);
    }
    const ro = new ResizeObserver(() => {
      try {
        draw();
      } catch {
        // ignore
      }
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [notes, clef, keySig, timeSig, beatsPerBar, height, ariaLabel, bare]);

  return <div className="staff" ref={ref} style={{ minHeight: height }} />;
}
