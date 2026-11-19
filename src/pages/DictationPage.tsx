import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { audio } from "../audio/engine";
import { Switch } from "../components/DrillOptions";
import { Piano, type KeyMark } from "../components/Piano";
import { prepareAudio, SessionSummary, type SessionResult } from "../components/QuestionRunner";
import { StaffLazy, vexKey, vexKeySig } from "../components/StaffLazy";
import type { StaffNote } from "../components/Staff";
import {
  alignedCell,
  cellById,
  checkMelody,
  checkRhythmCells,
  degreeOf,
  makeMelody,
  makeRhythm,
  melodyEvents,
  onsets,
  rhythmEvents,
  RHYTHM_CELLS,
  scoreTaps,
  spellMelodyNote,
  totalBeats,
  type Melody,
  type MelodySettings,
  type RhythmSettings,
} from "../drills/dictation";
import { cBelow } from "../drills/generate";
import { makeWeight } from "../drills/weights";
import { recordAttempt, recordSession } from "../store/progress";
import { getSettings, updateSettings, useSettings, type InstrumentId } from "../store/settings";
import { FUNCTIONAL_DEGREES } from "../theory/harmony";
import { degreeLabel, degreeSemitones, spelledName } from "../theory/notes";

type Kind = "melody" | "rhythm";
type Phase = "setup" | "running" | "summary";

function toggle<T>(list: T[], item: T): T[] {
  return list.includes(item) ? list.filter((x) => x !== item) : [...list, item];
}

const OK = "var(--ok)";
const BAD = "var(--bad)";

export function DictationPage() {
  const settings = useSettings();
  const [kind, setKind] = useState<Kind>("melody");
  const [phase, setPhase] = useState<Phase>("setup");
  const [result, setResult] = useState<SessionResult | null>(null);
  const [soundNote, setSoundNote] = useState<string | null>(null);
  const total = Math.min(settings.sessionLength, 10);

  const start = async () => {
    setSoundNote(await prepareAudio());
    setPhase("running");
  };
  const done = (r: SessionResult) => {
    recordSession({ at: Date.now(), drill: kind, total: r.n, correct: r.correct });
    setResult(r);
    setPhase("summary");
  };

  if (phase === "running") {
    return (
      <div className="page">
        {soundNote && <p className="warn">{soundNote}</p>}
        {kind === "melody" ? <MelodyRunner total={total} onExit={() => setPhase("setup")} onDone={done} /> : <RhythmRunner total={total} onExit={() => setPhase("setup")} onDone={done} />}
      </div>
    );
  }
  if (phase === "summary" && result) {
    return (
      <div className="page">
        <SessionSummary result={result}>
          <button type="button" className="btn primary" onClick={start}>
            Go again
          </button>
          <button type="button" className="btn" onClick={() => setPhase("setup")}>
            Change options
          </button>
          <Link to="/" className="btn">
            Home
          </Link>
        </SessionSummary>
      </div>
    );
  }

  const m = settings.melody;
  const r = settings.rhythm;
  const setM = (patch: Partial<MelodySettings>) => updateSettings({ melody: { ...m, ...patch } });
  const setR = (patch: Partial<RhythmSettings>) => updateSettings({ rhythm: { ...r, ...patch } });
  const problem =
    kind === "melody"
      ? !m.tonalities.length
        ? "Pick major, minor or both."
        : (m.tonalities.includes("major") && m.degreesMajor.length < 2) || (m.tonalities.includes("minor") && m.degreesMinor.length < 2)
          ? "Pick at least two degrees."
          : null
      : !r.cells.some((c) => cellById(c).parts.some((p) => !p.rest))
        ? "Pick at least one rhythm with notes in it."
        : null;

  return (
    <div className="page">
      <Link to="/" className="back">
        ← Home
      </Link>
      <h1>Dictation</h1>
      <p className="lede">Hear it, then write it down.</p>
      <div className="segmented wide" role="tablist">
        <button type="button" role="tab" aria-selected={kind === "melody"} className={kind === "melody" ? "on" : ""} onClick={() => setKind("melody")}>
          Melody
        </button>
        <button type="button" role="tab" aria-selected={kind === "rhythm"} className={kind === "rhythm" ? "on" : ""} onClick={() => setKind("rhythm")}>
          Rhythm
        </button>
      </div>

      {kind === "melody" ? (
        <section className="card" style={{ marginTop: 16 }}>
          <h2 className="card-title">Melody options</h2>
          <div className="opt-group">
            <div className="opt-head">
              <span>Keys</span>
            </div>
            <div className="chips">
              {(["major", "minor"] as const).map((t) => (
                <button key={t} type="button" className={`chip ${m.tonalities.includes(t) ? "on" : ""}`} onClick={() => setM({ tonalities: toggle(m.tonalities, t) })}>
                  {t === "major" ? "Major" : "Minor"}
                </button>
              ))}
            </div>
          </div>
          {m.tonalities.map((t) => {
            const value = t === "major" ? m.degreesMajor : m.degreesMinor;
            return (
              <div className="opt-group" key={t}>
                <div className="opt-head">
                  <span>Degrees in {t} keys</span>
                </div>
                <div className="chips">
                  {FUNCTIONAL_DEGREES.map((d) => (
                    <button
                      key={d.id}
                      type="button"
                      className={`chip ${value.includes(d.id) ? "on" : ""}`}
                      onClick={() => setM(t === "major" ? { degreesMajor: toggle(value, d.id) } : { degreesMinor: toggle(value, d.id) })}
                    >
                      {degreeLabel(d.id)}
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
          <label className="field-inline">
            Notes
            <select value={m.length} onChange={(e) => setM({ length: Number(e.target.value) })}>
              {[3, 4, 5, 6, 8, 10, 12].map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </label>
          <label className="field-inline">
            Largest leap
            <select value={m.maxLeap} onChange={(e) => setM({ maxLeap: Number(e.target.value) })}>
              <option value={2}>Steps only</option>
              <option value={4}>Up to a 3rd</option>
              <option value={7}>Up to a 5th</option>
              <option value={12}>Up to an octave</option>
            </select>
          </label>
          <Switch checked={m.giveFirst} onChange={(v) => setM({ giveFirst: v })} label="Give me the first note" />
        </section>
      ) : (
        <section className="card" style={{ marginTop: 16 }}>
          <h2 className="card-title">Rhythm options</h2>
          <div className="opt-group">
            <div className="opt-head">
              <span>Rhythms to use</span>
            </div>
            <div className="cell-palette">
              {RHYTHM_CELLS.map((c) => (
                <button key={c.id} type="button" className={`cell-btn ${r.cells.includes(c.id) ? "on" : ""}`} aria-pressed={r.cells.includes(c.id)} onClick={() => setR({ cells: toggle(r.cells, c.id) })} title={c.name}>
                  <CellNotation id={c.id} />
                  <span className="cell-name">{c.name}</span>
                </button>
              ))}
            </div>
          </div>
          <label className="field-inline">
            Time signature
            <select value={r.beatsPerBar} onChange={(e) => setR({ beatsPerBar: Number(e.target.value) as 3 | 4 })}>
              <option value={4}>4/4</option>
              <option value={3}>3/4</option>
            </select>
          </label>
          <label className="field-inline">
            Bars
            <select value={r.bars} onChange={(e) => setR({ bars: Number(e.target.value) })}>
              {[1, 2, 4].map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </label>
          <Switch checked={r.metronome} onChange={(v) => setR({ metronome: v })} label="Metronome while it plays" />
        </section>
      )}

      <div className="sticky-cta">
        {problem && <p className="warn">{problem}</p>}
        <button type="button" className="btn primary big" disabled={!!problem} onClick={start}>
          Start {total} {kind === "melody" ? "melodies" : "rhythms"}
        </button>
      </div>
    </div>
  );
}

function CellNotation({ id, color }: { id: string; color?: string }) {
  const notes = useMemo<StaffNote[]>(() => cellById(id).vex.map((v) => ({ keys: ["b/4"], ...v, color })), [id, color]);
  return <StaffLazy notes={notes} bare height={64} ariaLabel={cellById(id).name} />;
}

function RunnerTop({ title, n, total, onExit }: { title: string; n: number; total: number; onExit: () => void }) {
  return (
    <>
      <div className="drill-top">
        <button
          type="button"
          className="link"
          onClick={() => {
            audio.stop();
            onExit();
          }}
        >
          ← Options
        </button>
        <span className="drill-title">{title}</span>
        <span className="muted tabular">
          {Math.min(n + 1, total)} / {total}
        </span>
      </div>
      <div className="progress-bar" aria-hidden>
        <div style={{ width: `${(n / total) * 100}%` }} />
      </div>
    </>
  );
}

function instrument(): InstrumentId {
  const s = getSettings();
  return audio.state(s.instrument) === "ready" ? s.instrument : "synth";
}

// ---------------------------------------------------------------------------

function MelodyRunner({ total, onExit, onDone }: { total: number; onExit: () => void; onDone: (r: SessionResult) => void }) {
  const settings = useSettings();
  const [mel, setMel] = useState<Melody | null>(null);
  const [entered, setEntered] = useState<number[]>([]);
  const [checked, setChecked] = useState<boolean[] | null>(null);
  const [result, setResult] = useState<SessionResult>({ n: 0, correct: 0, missed: {} });
  const startedAt = useRef(0);

  const newMelody = useCallback(() => {
    const s = getSettings();
    const m = makeMelody(s.melody, s, { rng: Math.random, weight: makeWeight("melody", s.focusWeak) });
    setMel(m);
    setEntered(s.melody.giveFirst ? [m.notes[0].midi] : []);
    setChecked(null);
    startedAt.current = performance.now();
    void audio.play(melodyEvents(m, s.tempo, true).events, instrument());
  }, []);

  const started = useRef(false);
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    newMelody();
  }, [newMelody]);
  useEffect(() => () => audio.stop(), []);

  const add = useCallback(
    (midi: number) => {
      void audio.tap(midi, instrument());
      if (!mel || checked) return;
      setEntered((e) => (e.length < mel.notes.length ? [...e, midi] : e));
    },
    [mel, checked],
  );

  const check = () => {
    if (!mel) return;
    const res = checkMelody(
      mel.notes.map((n) => n.midi),
      entered,
    );
    setChecked(res);
    const ms = performance.now() - startedAt.current;
    const first = settings.melody.giveFirst ? 1 : 0;
    mel.notes.forEach((n, i) => {
      if (i < first) return;
      recordAttempt({
        drill: "melody",
        part: mel.tonality,
        correctId: n.degree,
        answeredId: res[i] ? n.degree : entered[i] !== undefined ? degreeOf(entered[i], mel.tonic) : "other",
        ms: ms / mel.notes.length,
      });
    });
    const allOk = res.every(Boolean);
    setResult((r) => {
      const missed = { ...r.missed };
      if (!allOk) {
        mel.notes.forEach((n, i) => {
          if (!res[i]) {
            const label = `Degree ${degreeLabel(n.degree)}`;
            missed[label] = (missed[label] ?? 0) + 1;
          }
        });
      }
      return { n: r.n + 1, correct: r.correct + (allOk ? 1 : 0), missed };
    });
  };

  const next = () => {
    if (result.n >= total) {
      audio.stop();
      onDone(result);
    } else newMelody();
  };

  // Keyboard: Backspace removes, Enter checks / continues, Space replays the melody.
  const keys = useRef({ check, next, mel, entered, checked });
  keys.current = { check, next, mel, entered, checked };
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && ["INPUT", "SELECT", "TEXTAREA", "BUTTON"].includes(t.tagName)) return;
      const k = keys.current;
      if (e.key === "Backspace" && !k.checked) {
        e.preventDefault();
        setEntered((x) => x.slice(0, Math.max(getSettings().melody.giveFirst ? 1 : 0, x.length - 1)));
      } else if (e.key === "Enter") {
        e.preventDefault();
        if (k.checked) k.next();
        else if (k.mel && k.entered.length === k.mel.notes.length) k.check();
      } else if (e.key === " " && k.mel) {
        e.preventDefault();
        void audio.play(melodyEvents(k.mel, getSettings().tempo, false).events, instrument());
      }
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, []);

  if (!mel) return null;
  const keySig = vexKeySig(mel.key, mel.tonality === "minor");
  const lo = cBelow(mel.tonic - 5);
  const hi = cBelow(mel.tonic + 16) + 12;
  const minFixed = settings.melody.giveFirst ? 1 : 0;

  const enteredStaff: StaffNote[] = entered.map((m, i) => ({
    keys: [vexKey(spellMelodyNote(m, mel), m)],
    duration: "q",
    color: checked ? (checked[i] ? OK : BAD) : undefined,
  }));
  // Placeholders for the notes still to enter.
  const placeholders: StaffNote[] = checked ? [] : Array.from({ length: mel.notes.length - entered.length }, () => ({ keys: ["b/4"], duration: "q", rest: true, color: "var(--border)" }));
  const correctStaff: StaffNote[] = mel.notes.map((n) => ({ keys: [vexKey(spellMelodyNote(n.midi, mel), n.midi)], duration: "q" }));

  const marks: Record<number, KeyMark> = {};
  if (!checked) {
    marks[mel.tonic] = "given";
    entered.slice(-1).forEach((m) => (marks[m] = "selected"));
  }

  const degreesPool = mel.tonality === "major" ? settings.melody.degreesMajor : settings.melody.degreesMinor;
  const addDegree = (d: string) => {
    const prev = entered[entered.length - 1] ?? mel.tonic;
    const base = mel.tonic + (((degreeSemitones(d) % 12) + 12) % 12);
    const options = [base - 12, base, base + 12];
    add(options.sort((a, b) => Math.abs(a - prev) - Math.abs(b - prev))[0]);
  };
  const shiftLast = (by: number) => setEntered((e) => (e.length > minFixed ? [...e.slice(0, -1), e[e.length - 1] + by] : e));

  return (
    <div className="drill">
      <RunnerTop title="Melody dictation" n={result.n} total={total} onExit={onExit} />
      <div className="play-row">
        <button type="button" className="btn play" onClick={() => void audio.play(melodyEvents(mel, settings.tempo, false).events, instrument())}>
          <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden>
            <path d="M8 5v14l11-7z" fill="currentColor" />
          </svg>
          Melody
        </button>
        <div className="row-buttons" style={{ marginTop: 0 }}>
          <button type="button" className="btn small" onClick={() => void audio.play(melodyEvents(mel, settings.tempo, true).events, instrument())}>
            Key + melody
          </button>
          <button type="button" className="btn small" onClick={() => void audio.play([{ midi: [mel.tonic], at: 0, dur: 1.2 }], instrument())}>
            Tonic
          </button>
        </div>
      </div>
      <p className="prompt">
        {spelledName(mel.key)} {mel.tonality}: write the {mel.notes.length} notes
      </p>

      <StaffLazy notes={[...enteredStaff, ...placeholders]} keySig={keySig} timeSig={mel.notes.length % 4 === 0 ? "4/4" : undefined} beatsPerBar={mel.notes.length % 4 === 0 ? 4 : undefined} ariaLabel="Your melody" />

      {checked ? (
        <div className={`feedback ${checked.every(Boolean) ? "ok" : "bad"}`}>
          <div className="feedback-head">{checked.every(Boolean) ? "Correct" : `${checked.filter(Boolean).length} of ${checked.length} right`}</div>
          <div className="feedback-reveal">Degrees: {mel.notes.map((n) => degreeLabel(n.degree)).join(" – ")}</div>
          {!checked.every(Boolean) && <StaffLazy notes={correctStaff} keySig={keySig} ariaLabel="Correct melody" />}
          <div className="row-buttons">
            <button type="button" className="btn small" onClick={() => void audio.play(entered.map((m, i) => ({ midi: [m], at: i * (60 / settings.tempo), dur: (60 / settings.tempo) * 0.95 })), instrument())}>
              Hear yours
            </button>
          </div>
        </div>
      ) : (
        <>
          <div className="degree-pad">
            {FUNCTIONAL_DEGREES.filter((d) => degreesPool.includes(d.id)).map((d) => (
              <button key={d.id} type="button" className="btn small" onClick={() => addDegree(d.id)} disabled={entered.length >= mel.notes.length}>
                {degreeLabel(d.id)}
              </button>
            ))}
          </div>
          <Piano lo={lo} hi={hi} marks={marks} onKey={add} keyboard focusMidi={mel.tonic} />
          <div className="row-buttons">
            <button type="button" className="btn small" onClick={() => shiftLast(12)} disabled={entered.length <= minFixed}>
              Last note ↑ octave
            </button>
            <button type="button" className="btn small" onClick={() => shiftLast(-12)} disabled={entered.length <= minFixed}>
              ↓ octave
            </button>
            <button type="button" className="btn small" onClick={() => setEntered((e) => e.slice(0, Math.max(minFixed, e.length - 1)))} disabled={entered.length <= minFixed}>
              ⌫ Undo
            </button>
            <button type="button" className="btn small" onClick={() => setEntered((e) => e.slice(0, minFixed))} disabled={entered.length <= minFixed}>
              Clear
            </button>
          </div>
        </>
      )}

      <div className="sticky-cta">
        {checked ? (
          <button type="button" className="btn primary big" onClick={next}>
            {result.n >= total ? "See results" : "Next"} <kbd>Enter</kbd>
          </button>
        ) : (
          <button type="button" className="btn primary big" disabled={entered.length !== mel.notes.length} onClick={check}>
            Check ({entered.length}/{mel.notes.length})
          </button>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------

function RhythmRunner({ total, onExit, onDone }: { total: number; onExit: () => void; onDone: (r: SessionResult) => void }) {
  const settings = useSettings();
  const cfg = settings.rhythm;
  const [target, setTarget] = useState<string[]>([]);
  const [entered, setEntered] = useState<string[]>([]);
  const [mode, setMode] = useState<"build" | "tap">("build");
  const [checked, setChecked] = useState<boolean[] | null>(null);
  const [tapState, setTapState] = useState<"idle" | "counting" | "done">("idle");
  const [taps, setTaps] = useState<number[]>([]);
  const [tapResult, setTapResult] = useState<{ hits: boolean[]; extra: number } | null>(null);
  const [result, setResult] = useState<SessionResult>({ n: 0, correct: 0, missed: {} });
  const t0 = useRef(0);
  const tapTimer = useRef<number | undefined>(undefined);
  const startedAt = useRef(0);
  const beatsTotal = cfg.bars * cfg.beatsPerBar;

  const play = (cells: string[]) => void audio.play(rhythmEvents(cells, cfg, settings.tempo).events, instrument());

  const newRhythm = useCallback(() => {
    const s = getSettings();
    const cells = makeRhythm(s.rhythm, { rng: Math.random, weight: makeWeight("rhythm", s.focusWeak) });
    setTarget(cells);
    setEntered([]);
    setChecked(null);
    setTaps([]);
    setTapResult(null);
    setTapState("idle");
    startedAt.current = performance.now();
    void audio.play(rhythmEvents(cells, s.rhythm, s.tempo).events, instrument());
  }, []);

  const started = useRef(false);
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    newRhythm();
  }, [newRhythm]);
  useEffect(
    () => () => {
      audio.stop();
      window.clearTimeout(tapTimer.current);
    },
    [],
  );

  const finish = (perCell: boolean[], answeredFor: (i: number) => string) => {
    setChecked(perCell);
    const ms = performance.now() - startedAt.current;
    target.forEach((id, i) => recordAttempt({ drill: "rhythm", part: "cell", correctId: id, answeredId: perCell[i] ? id : answeredFor(i), ms: ms / target.length }));
    const allOk = perCell.every(Boolean);
    setResult((r) => {
      const missed = { ...r.missed };
      target.forEach((id, i) => {
        if (!perCell[i]) missed[cellById(id).name] = (missed[cellById(id).name] ?? 0) + 1;
      });
      return { n: r.n + 1, correct: r.correct + (allOk ? 1 : 0), missed };
    });
  };

  const checkBuilt = () => finish(checkRhythmCells(target, entered), (i) => alignedCell(target, entered, i));

  // ---- Tapping ----
  const startTapping = async () => {
    const ctx = await audio.unlock();
    setTaps([]);
    setTapResult(null);
    setTapState("counting");
    const beat = 60 / settings.tempo;
    // Count-in plus metronome clicks for the whole rhythm, no notes.
    const clicks = Array.from({ length: cfg.beatsPerBar + beatsTotal }, (_, i) => ({ midi: [i % cfg.beatsPerBar === 0 ? -1 : -2], at: i * beat, dur: 0.05 }));
    const startTime = ctx.currentTime + 0.05;
    await audio.play(clicks, "synth");
    const latency = (ctx.baseLatency || 0) + ((ctx as AudioContext & { outputLatency?: number }).outputLatency || 0);
    t0.current = startTime + cfg.beatsPerBar * beat + latency;
    window.clearTimeout(tapTimer.current);
    tapTimer.current = window.setTimeout(() => setTapState("done"), (cfg.beatsPerBar + beatsTotal + 0.6) * beat * 1000);
  };

  const tap = useCallback(() => {
    const ctx = audio.context;
    if (!ctx || tapState !== "counting") return;
    const beat = 60 / getSettings().tempo;
    const pos = (ctx.currentTime - t0.current) / beat;
    if (pos < -0.5) return;
    void audio.tap(72, instrument());
    setTaps((t) => [...t, pos]);
  }, [tapState]);

  useEffect(() => {
    if (tapState !== "done" || checked) return;
    const target_onsets = onsets(target);
    const res = scoreTaps(target_onsets, taps);
    setTapResult(res);
    // A cell is right when all its notes were hit and no extra taps landed inside it.
    let t = 0;
    let k = 0;
    const perCell = target.map((id) => {
      const c = cellById(id);
      const from = t;
      const to = t + c.beats;
      t = to;
      const n = c.parts.filter((p) => !p.rest).length;
      const hits = res.hits.slice(k, k + n);
      k += n;
      const stray = taps.filter((x) => x >= from - 0.18 && x < to - 0.18).length - hits.filter(Boolean).length;
      return hits.every(Boolean) && stray <= 0;
    });
    finish(perCell, () => "other");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tapState]);

  const next = () => {
    if (result.n >= total) {
      audio.stop();
      onDone(result);
    } else newRhythm();
  };

  // Keyboard: Space taps (tap mode) or replays; Enter checks / continues; Backspace removes.
  const keys = useRef({ tap, next, checkBuilt, mode, tapState, checked, entered });
  keys.current = { tap, next, checkBuilt, mode, tapState, checked, entered };
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && ["INPUT", "SELECT", "TEXTAREA"].includes(t.tagName)) return;
      const k = keys.current;
      if (e.key === " " && k.mode === "tap" && k.tapState === "counting") {
        e.preventDefault();
        if (!e.repeat) k.tap();
      } else if (e.key === "Enter" && t?.tagName !== "BUTTON") {
        e.preventDefault();
        if (k.checked) k.next();
        else if (k.mode === "build" && totalBeats(k.entered) === getSettings().rhythm.bars * getSettings().rhythm.beatsPerBar) k.checkBuilt();
      } else if (e.key === "Backspace" && !k.checked && k.mode === "build") {
        e.preventDefault();
        setEntered((x) => x.slice(0, -1));
      }
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, []);

  const toStaff = (cells: string[], colors?: (string | undefined)[]): StaffNote[] =>
    cells.flatMap((id, i) => cellById(id).vex.map((v) => ({ keys: ["b/4"], ...v, color: colors?.[i] })));

  const used = totalBeats(entered);
  const leftInBar = cfg.beatsPerBar - (used % cfg.beatsPerBar);
  const full = used >= beatsTotal;
  const palette = RHYTHM_CELLS.filter((c) => cfg.cells.includes(c.id) || entered.includes(c.id));
  const timeSig = `${cfg.beatsPerBar}/4`;

  return (
    <div className="drill">
      <RunnerTop title="Rhythm dictation" n={result.n} total={total} onExit={onExit} />
      <div className="play-row">
        <button type="button" className="btn play" onClick={() => play(target)} disabled={tapState === "counting"}>
          <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden>
            <path d="M8 5v14l11-7z" fill="currentColor" />
          </svg>
          Replay
        </button>
        {!checked && (
          <div className="segmented" role="tablist" aria-label="Answer by">
            <button type="button" role="tab" aria-selected={mode === "build"} className={mode === "build" ? "on" : ""} onClick={() => setMode("build")}>
              Write it
            </button>
            <button type="button" role="tab" aria-selected={mode === "tap"} className={mode === "tap" ? "on" : ""} onClick={() => setMode("tap")}>
              Tap it
            </button>
          </div>
        )}
      </div>
      <p className="prompt">
        {cfg.bars} bar{cfg.bars > 1 ? "s" : ""} of {timeSig}, after a one-bar count-in
      </p>

      {checked ? (
        <div className={`feedback ${checked.every(Boolean) ? "ok" : "bad"}`}>
          <div className="feedback-head">{checked.every(Boolean) ? "Correct" : `${checked.filter(Boolean).length} of ${checked.length} rhythm groups right`}</div>
          {tapResult && (
            <div className="feedback-reveal">
              Hit {tapResult.hits.filter(Boolean).length} of {tapResult.hits.length} notes{tapResult.extra ? `, ${tapResult.extra} extra tap${tapResult.extra > 1 ? "s" : ""}` : ""}
            </div>
          )}
          <p className="muted small" style={{ margin: "8px 0 0" }}>
            The rhythm:
          </p>
          <StaffLazy notes={toStaff(target, checked.map((ok) => (ok ? OK : BAD)))} timeSig={timeSig} beatsPerBar={cfg.beatsPerBar} ariaLabel="The rhythm" />
          {mode === "build" && (
            <>
              <p className="muted small" style={{ margin: "8px 0 0" }}>
                What you wrote:
              </p>
              <StaffLazy notes={toStaff(entered)} timeSig={timeSig} beatsPerBar={cfg.beatsPerBar} ariaLabel="Your rhythm" />
              <div className="row-buttons">
                <button type="button" className="btn small" onClick={() => play(entered)}>
                  Hear yours
                </button>
              </div>
            </>
          )}
        </div>
      ) : mode === "build" ? (
        <>
          <StaffLazy notes={toStaff(entered)} timeSig={timeSig} beatsPerBar={cfg.beatsPerBar} ariaLabel="Your rhythm" />
          <p className="hint">
            Beat {Math.min(used + 1, beatsTotal)} of {beatsTotal}
          </p>
          <div className="cell-palette">
            {palette.map((c) => (
              <button key={c.id} type="button" className="cell-btn" disabled={full || c.beats > leftInBar} onClick={() => setEntered((e) => [...e, c.id])} title={c.name}>
                <CellNotation id={c.id} />
                <span className="cell-name">{c.name}</span>
              </button>
            ))}
          </div>
          <div className="row-buttons">
            <button type="button" className="btn small" onClick={() => setEntered((e) => e.slice(0, -1))} disabled={!entered.length}>
              ⌫ Undo
            </button>
            <button type="button" className="btn small" onClick={() => setEntered([])} disabled={!entered.length}>
              Clear
            </button>
          </div>
        </>
      ) : (
        <div className="tap-area">
          <p className="hint">Press Start, listen to the count-in, then tap the rhythm on the big button (or the space bar). The clicks keep time for you.</p>
          {tapState === "counting" ? (
            <button type="button" className="tap-pad" onPointerDown={(e) => { e.preventDefault(); tap(); }}>
              Tap
              <span className="muted small">{taps.length} taps</span>
            </button>
          ) : (
            <button type="button" className="btn primary big" onClick={startTapping}>
              Start
            </button>
          )}
        </div>
      )}

      <div className="sticky-cta">
        {checked ? (
          <button type="button" className="btn primary big" onClick={next}>
            {result.n >= total ? "See results" : "Next"} <kbd>Enter</kbd>
          </button>
        ) : mode === "build" ? (
          <button type="button" className="btn primary big" disabled={!full} onClick={checkBuilt}>
            Check
          </button>
        ) : null}
      </div>
    </div>
  );
}
