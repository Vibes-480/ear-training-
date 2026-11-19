import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { audio } from "../audio/engine";
import { useMic } from "../audio/mic";
import { NoteStabilizer } from "../audio/pitch";
import { Switch } from "../components/DrillOptions";
import { PitchMeter } from "../components/PitchMeter";
import { prepareAudio, SessionSummary, type SessionResult } from "../components/QuestionRunner";
import { StaffForTask } from "../components/StaffLazy";
import { VoiceRangeCheck } from "../components/VoiceRange";
import { centsOff, makeSingTask, singItemLabel, sungItem, type SingTask } from "../drills/sing";
import { makeWeight } from "../drills/weights";
import { recordAttempt, recordSession } from "../store/progress";
import { getSettings, updateSettings, useSettings, type InstrumentId, type SingSettings } from "../store/settings";
import { INTERVALS } from "../theory/catalog";
import { FUNCTIONAL_DEGREES } from "../theory/harmony";
import { degreeLabel, midiName } from "../theory/notes";

type Phase = "setup" | "range" | "running" | "summary";

const MODES: { id: SingSettings["mode"]; name: string; blurb: string }[] = [
  { id: "match", name: "Match notes", blurb: "Hear a note, sing it back" },
  { id: "intervals", name: "Sing intervals", blurb: "Hear a note, sing an interval above it" },
  { id: "sightsing", name: "Sight-sing", blurb: "Hear the key, sing a melody from scale degrees" },
];

function toggle<T>(list: T[], item: T): T[] {
  return list.includes(item) ? list.filter((x) => x !== item) : [...list, item];
}

export function SingPage() {
  const settings = useSettings();
  const cfg = settings.sing;
  const [phase, setPhase] = useState<Phase>(settings.voiceRange ? "setup" : "range");
  const [result, setResult] = useState<SessionResult | null>(null);
  const [soundNote, setSoundNote] = useState<string | null>(null);
  const set = (patch: Partial<SingSettings>) => updateSettings({ sing: { ...cfg, ...patch } });

  const start = async () => {
    setSoundNote(await prepareAudio());
    setPhase("running");
  };

  if (phase === "range") {
    return (
      <div className="page">
        <Link to="/" className="back">
          ← Home
        </Link>
        <h1>Singing</h1>
        <p className="lede">First, let's find a comfortable range so every exercise fits your voice. Use headphones or keep the volume moderate.</p>
        <VoiceRangeCheck onDone={() => setPhase("setup")} onCancel={settings.voiceRange ? () => setPhase("setup") : undefined} />
      </div>
    );
  }

  if (phase === "running") {
    return (
      <div className="page">
        {soundNote && <p className="warn">{soundNote}</p>}
        <SingRunner
          onExit={() => setPhase("setup")}
          onDone={(r) => {
            recordSession({ at: Date.now(), drill: "sing", total: r.n, correct: r.correct });
            setResult(r);
            setPhase("summary");
          }}
        />
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

  const problem =
    cfg.mode === "intervals" && cfg.intervals.length < 1 ? "Pick at least one interval." : cfg.mode === "sightsing" && cfg.degrees.length < 2 ? "Pick at least two degrees." : null;

  return (
    <div className="page">
      <Link to="/" className="back">
        ← Home
      </Link>
      <h1>Singing</h1>
      <p className="lede">
        Your range: <strong>{settings.voiceRange ? `${midiName(settings.voiceRange.lo)} – ${midiName(settings.voiceRange.hi)}` : "not set"}</strong>{" "}
        <button type="button" className="link" onClick={() => setPhase("range")}>
          Check again
        </button>
      </p>

      <section className="card">
        <h2 className="card-title">Exercise</h2>
        <div className="mode-list">
          {MODES.map((m) => (
            <button key={m.id} type="button" className={`mode-card ${cfg.mode === m.id ? "on" : ""}`} aria-pressed={cfg.mode === m.id} onClick={() => set({ mode: m.id })}>
              <span className="mode-name">{m.name}</span>
              <span className="muted small">{m.blurb}</span>
            </button>
          ))}
        </div>

        {cfg.mode === "intervals" && (
          <div className="opt-group" style={{ marginTop: 16 }}>
            <div className="opt-head">
              <span>Intervals</span>
            </div>
            <div className="chips">
              {INTERVALS.filter((i) => !i.compound).map((i) => (
                <button key={i.id} type="button" className={`chip ${cfg.intervals.includes(i.id) ? "on" : ""}`} onClick={() => set({ intervals: toggle(cfg.intervals, i.id) })} title={i.name}>
                  {i.short}
                </button>
              ))}
            </div>
          </div>
        )}
        {cfg.mode === "sightsing" && (
          <>
            <div className="opt-group" style={{ marginTop: 16 }}>
              <div className="opt-head">
                <span>Scale degrees</span>
              </div>
              <div className="chips">
                {FUNCTIONAL_DEGREES.map((d) => (
                  <button key={d.id} type="button" className={`chip ${cfg.degrees.includes(d.id) ? "on" : ""}`} onClick={() => set({ degrees: toggle(cfg.degrees, d.id) })}>
                    {degreeLabel(d.id)}
                  </button>
                ))}
              </div>
            </div>
            <label className="field-inline">
              Notes per melody
              <select value={cfg.length} onChange={(e) => set({ length: Number(e.target.value) })}>
                {[2, 3, 4, 5, 6, 8].map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            </label>
          </>
        )}
      </section>

      <section className="card">
        <h2 className="card-title">Checking</h2>
        <label className="field-inline">
          In tune within
          <select value={cfg.tolerance} onChange={(e) => set({ tolerance: Number(e.target.value) })}>
            <option value={50}>50 cents (relaxed)</option>
            <option value={35}>35 cents</option>
            <option value={25}>25 cents</option>
            <option value={15}>15 cents (strict)</option>
          </select>
        </label>
        <label className="field-inline">
          Time per note
          <select value={cfg.timeLimit} onChange={(e) => set({ timeLimit: Number(e.target.value) })}>
            {[5, 10, 15, 30].map((n) => (
              <option key={n} value={n}>
                {n} seconds
              </option>
            ))}
          </select>
        </label>
        <Switch checked={cfg.anyOctave} onChange={(v) => set({ anyOctave: v })} label="Any octave counts" hint="Useful when the note is outside your range" />
      </section>

      <div className="sticky-cta">
        {problem && <p className="warn">{problem}</p>}
        <button type="button" className="btn primary big" disabled={!!problem} onClick={start}>
          Start {settings.sessionLength} exercises
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------

type NoteState = "waiting" | "hit" | "miss";

function SingRunner({ onExit, onDone }: { onExit: () => void; onDone: (r: SessionResult) => void }) {
  const settings = useSettings();
  const cfg = settings.sing;
  const total = settings.sessionLength;
  const [task, setTask] = useState<SingTask | null>(null);
  const [idx, setIdx] = useState(0);
  const [states, setStates] = useState<NoteState[]>([]);
  const [message, setMessage] = useState<string>("");
  const [finished, setFinished] = useState(false);
  const [result, setResult] = useState<SessionResult>({ n: 0, correct: 0, missed: {} });
  const [listening, setListening] = useState(false);
  const stab = useRef(new NoteStabilizer(350));
  const recorded = useRef<boolean[]>([]);
  const firstTry = useRef<boolean[]>([]);
  const startedAt = useRef(0);
  const inst = useRef<InstrumentId>("piano");
  const count = useRef(0);

  const play = useCallback(async (events: SingTask["play"]) => {
    stab.current.reset();
    const len = await audio.play(events, inst.current);
    startedAt.current = performance.now() + len * 1000;
  }, []);

  const newTask = useCallback(() => {
    const s = getSettings();
    const t = makeSingTask(s.sing, s.voiceRange, s, { rng: Math.random, weight: makeWeight("sing", s.focusWeak) });
    inst.current = audio.state(s.instrument) === "ready" ? s.instrument : "synth";
    count.current++;
    setTask(t);
    setIdx(0);
    setStates(t.targets.map(() => "waiting"));
    recorded.current = t.targets.map(() => false);
    firstTry.current = t.targets.map(() => false);
    setMessage("");
    setFinished(false);
    setListening(true);
    void play(t.play);
  }, [play]);

  const started = useRef(false);
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    newTask();
  }, [newTask]);

  useEffect(() => () => audio.stop(), []);

  const finishTask = (t: SingTask, ok: boolean[]) => {
    setListening(false);
    setFinished(true);
    const allOk = ok.every(Boolean);
    setResult((r) => {
      const missed = { ...r.missed };
      if (!allOk) {
        t.items.forEach((id, i) => {
          if (!ok[i]) {
            const label = singItemLabel(t.mode, id);
            missed[label] = (missed[label] ?? 0) + 1;
          }
        });
      }
      return { n: r.n + 1, correct: r.correct + (allOk ? 1 : 0), missed };
    });
  };

  const record = (t: SingTask, i: number, answered: string, ms: number) => {
    if (recorded.current[i]) return;
    recorded.current[i] = true;
    firstTry.current[i] = answered === t.items[i];
    recordAttempt({ drill: "sing", part: t.mode, correctId: t.items[i], answeredId: answered, ms });
  };

  const advance = (t: SingTask, i: number, state: NoteState) => {
    setStates((st) => st.map((x, k) => (k === i ? state : x)));
    stab.current.reset();
    startedAt.current = performance.now();
    if (i + 1 < t.targets.length) setIdx(i + 1);
    else finishTask(t, firstTry.current);
  };

  const { state: micState, reading } = useMic(true, (r, t) => {
    if (!task || !listening || finished) return;
    if (audio.isPlaying()) return;
    const target = task.targets[idx];
    // Time limit.
    if (startedAt.current && t - startedAt.current > cfg.timeLimit * 1000) {
      record(task, idx, "miss", cfg.timeLimit * 1000);
      setMessage(`Time's up: it was ${task.labels[idx]}`);
      advance(task, idx, "miss");
      return;
    }
    const n = stab.current.push(r, t);
    if (!n) return;
    const sung = n.midi + n.cents / 100;
    const off = centsOff(sung, target, cfg.anyOctave);
    const ms = Math.max(0, t - startedAt.current);
    if (Math.abs(off) <= cfg.tolerance) {
      record(task, idx, task.items[idx], ms);
      setMessage(`✓ ${task.labels[idx]}${Math.abs(off) > 5 ? ` (${off > 0 ? "+" : ""}${Math.round(off)}¢)` : ""}`);
      advance(task, idx, "hit");
    } else {
      record(task, idx, sungItem(task, sung, cfg.anyOctave), ms);
      const semis = Math.abs(off) / 100;
      setMessage(
        semis < 1
          ? `Close: ${Math.round(Math.abs(off))}¢ ${off < 0 ? "flat" : "sharp"}. Try again`
          : `That was ${midiName(n.midi)}. Go ${off < 0 ? "higher" : "lower"} and try again`,
      );
      stab.current.reset();
    }
  });

  const next = () => {
    if (result.n >= total) {
      audio.stop();
      onDone(result);
      return;
    }
    newTask();
  };

  if (!task) return null;
  const target = task.targets[Math.min(idx, task.targets.length - 1)];

  return (
    <div className="drill">
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
        <span className="drill-title">Singing</span>
        <span className="muted tabular">
          {Math.min(result.n + (finished ? 0 : 1), total)} / {total}
        </span>
      </div>
      <div className="progress-bar" aria-hidden>
        <div style={{ width: `${(result.n / total) * 100}%` }} />
      </div>

      <div className="play-row">
        <button type="button" className="btn play" onClick={() => void play(task.play)}>
          <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden>
            <path d="M8 5v14l11-7z" fill="currentColor" />
          </svg>
          Replay
        </button>
        <button type="button" className="btn" onClick={() => void play(task.hear)}>
          Hear the answer
        </button>
      </div>

      <p className="prompt">{task.prompt}</p>
      {task.mode === "sightsing" && task.key && <StaffForTask keySig={task.key} midis={task.targets} states={states} current={finished ? -1 : idx} />}
      <div className="sing-targets">
        {task.labels.map((l, i) => (
          <span key={i} className={`sing-target ${states[i]} ${i === idx && !finished ? "current" : ""}`}>
            {task.mode === "sightsing" ? l.split(" ")[0] : states[i] === "waiting" && !finished ? "?" : l}
          </span>
        ))}
      </div>

      <PitchMeter reading={reading} state={micState} target={finished ? null : target} anyOctave={cfg.anyOctave} tolerance={cfg.tolerance} />
      <p className="sing-message" role="status">
        {message || (finished ? "" : "Sing when you're ready")}
      </p>

      {!finished && (
        <div className="row-buttons">
          <button
            type="button"
            className="btn"
            onClick={() => {
              record(task, idx, "miss", performance.now() - startedAt.current);
              setMessage(`Skipped: it was ${task.labels[idx]}`);
              advance(task, idx, "miss");
            }}
          >
            Skip this note
          </button>
        </div>
      )}

      {finished && (
        <div className="sticky-cta">
          <button type="button" className="btn primary big" onClick={next}>
            {result.n >= total ? "See results" : "Next"}
          </button>
        </div>
      )}
    </div>
  );
}
