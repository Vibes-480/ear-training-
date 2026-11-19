import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, Navigate, useParams } from "react-router-dom";
import { audio, SAMPLED_INSTRUMENTS } from "../audio/engine";
import { configProblem, DrillOptions } from "../components/DrillOptions";
import { Piano, type KeyMark } from "../components/Piano";
import { DRILL_INFO, useConfigs } from "../drills/config";
import { evaluatePiano, OTHER } from "../drills/evaluate";
import { answerPreview, generate } from "../drills/generate";
import { pick } from "../drills/register";
import type { DrillId, PlayEvent, Question } from "../drills/types";
import { getProgress, itemKey, recentAccuracy, recordAttempt, recordSession } from "../store/progress";
import { getSettings, useSettings, type InstrumentId } from "../store/settings";
import { degreeLabel, midiName, spelledName } from "../theory/notes";

type Phase = "setup" | "asking" | "feedback" | "summary";

interface SessionState {
  n: number;
  correct: number;
  /** Missed items: label -> count */
  missed: Record<string, number>;
}

const DRILLS: DrillId[] = ["intervals", "chords", "scales", "pitch"];
const noFocus = (e: React.MouseEvent) => e.preventDefault();

function pianoRange(q: Question, compound: boolean): [number, number] {
  if (q.drill === "pitch") return [48, 84];
  const g = q.piano?.given[0] ?? 60;
  const c = g - (((g % 12) + 12) % 12);
  if (q.piano?.mode === "interval") {
    if (q.piano.direction === "down") return [c - (compound ? 24 : 12), c + 12];
    return [c, c + (compound ? 36 : 24)];
  }
  return [c, c + 24];
}

function choiceLabel(q: Question, partIdx: number, id: string): string {
  if (id === OTHER) return "something else";
  return q.parts[partIdx].choices.find((c) => c.id === id)?.label ?? id;
}

export function DrillPage() {
  const { id } = useParams();
  const drill = DRILLS.includes(id as DrillId) ? (id as DrillId) : null;
  const settings = useSettings();
  const cfgs = useConfigs();

  const [phase, setPhase] = useState<Phase>("setup");
  const [q, setQ] = useState<Question | null>(null);
  const [partIdx, setPartIdx] = useState(0);
  const [picks, setPicks] = useState<string[]>([]);
  const [inputMode, setInputMode] = useState(settings.inputMode);
  const [selected, setSelected] = useState<number[]>([]);
  const [session, setSession] = useState<SessionState>({ n: 0, correct: 0, missed: {} });
  const [loading, setLoading] = useState(false);
  const [soundNote, setSoundNote] = useState<string | null>(null);

  const askedAt = useRef(0);
  const instrument = useRef<InstrumentId>(settings.instrument);
  const previous = useRef<string | undefined>(undefined);
  const advanceTimer = useRef<number | undefined>(undefined);

  useEffect(() => audio.setVolume(settings.volume), [settings.volume]);
  useEffect(() => () => {
    window.clearTimeout(advanceTimer.current);
    audio.stop();
  }, []);

  const playEvents = useCallback(async (events: PlayEvent[]) => {
    await audio.play(events, instrument.current);
  }, []);

  const playQuestion = useCallback(
    async (question: Question) => {
      let events = question.events;
      let lead = 0;
      if (question.reference) {
        lead = Math.max(...question.reference.map((e) => e.at + e.dur)) + 0.5;
        events = [...question.reference, ...question.events.map((e) => ({ ...e, at: e.at + lead }))];
      }
      askedAt.current = performance.now() + lead * 1000;
      await playEvents(events);
    },
    [playEvents],
  );

  const pickInstrument = (): InstrumentId => {
    const s = getSettings();
    if (!s.varyInstrument) return audio.state(s.instrument) === "ready" ? s.instrument : "synth";
    // Start loading every sampled instrument, use any that are ready.
    SAMPLED_INSTRUMENTS.forEach((i) => void audio.load(i));
    const ready = SAMPLED_INSTRUMENTS.filter((i) => audio.state(i) === "ready");
    return ready.length ? pick(ready, Math.random) : "synth";
  };

  const newQuestion = useCallback(() => {
    if (!drill) return;
    window.clearTimeout(advanceTimer.current);
    const s = getSettings();
    const progress = getProgress();
    const weight = s.focusWeak
      ? (part: string, itemId: string) => 0.25 + (1 - recentAccuracy(progress.items[itemKey(drill, part, itemId)])) * 2
      : () => 1;
    const question = generate(drill, cfgs, s, { rng: Math.random, weight, previous: previous.current });
    instrument.current = pickInstrument();
    setQ(question);
    setPartIdx(0);
    setPicks([]);
    setSelected([]);
    setPhase("asking");
    void playQuestion(question);
  }, [drill, cfgs, playQuestion]);

  const start = async () => {
    setLoading(true);
    setSoundNote(null);
    try {
      await audio.unlock();
      const s = getSettings();
      if (s.instrument !== "synth") {
        const inst = await audio.load(s.instrument);
        if (!inst) setSoundNote("Couldn't load the instrument samples, so the simple synth is playing instead. Check your connection.");
      }
    } finally {
      setLoading(false);
    }
    setSession({ n: 0, correct: 0, missed: {} });
    setInputMode(getSettings().inputMode);
    newQuestion();
  };

  const finishQuestion = (question: Question, allPicks: string[]) => {
    const allCorrect = question.parts.every((p, i) => allPicks[i] === p.answer);
    previous.current = question.parts[0].answer;
    setSession((s) => {
      const missed = { ...s.missed };
      if (!allCorrect) {
        const label = question.parts.map((p) => p.choices.find((c) => c.id === p.answer)?.label ?? p.answer).join(", ");
        missed[label] = (missed[label] ?? 0) + 1;
      }
      return { n: s.n + 1, correct: s.correct + (allCorrect ? 1 : 0), missed };
    });
    setPhase("feedback");
    if (allCorrect && getSettings().autoAdvance) {
      advanceTimer.current = window.setTimeout(() => nextRef.current(), 1100);
    }
  };

  const answer = (answerId: string) => {
    if (phase !== "asking" || !q || !drill) return;
    const part = q.parts[partIdx];
    const ms = Math.max(0, performance.now() - askedAt.current);
    recordAttempt({ drill, part: part.key, correctId: part.answer, answeredId: answerId, ms });
    const nextPicks = [...picks, answerId];
    setPicks(nextPicks);
    if (partIdx + 1 < q.parts.length) {
      setPartIdx(partIdx + 1);
      askedAt.current = performance.now();
      return;
    }
    finishQuestion(q, nextPicks);
  };

  const next = () => {
    if (!drill) return;
    const s = getSettings();
    if (session.n >= s.sessionLength) {
      recordSession({ at: Date.now(), drill, total: session.n, correct: session.correct });
      audio.stop();
      setPhase("summary");
      return;
    }
    newQuestion();
  };
  const nextRef = useRef(next);
  nextRef.current = next;

  const checkPiano = () => {
    if (!q || selected.length === 0) return;
    answer(evaluatePiano(q, selected));
  };

  const onKey = (midi: number) => {
    void audio.tap(midi, instrument.current);
    if (phase !== "asking" || inputMode !== "piano" || partIdx !== 0 || !q?.piano) return;
    if (q.piano.mode === "set") setSelected((sel) => (sel.includes(midi) ? sel.filter((m) => m !== midi) : [...sel, midi]));
    else setSelected([midi]);
  };

  const replay = () => {
    if (q) void playQuestion(q);
  };

  // Keyboard shortcuts: Space = replay, Enter = check / next, 1–9 = answer.
  const handlers = useRef({ replay, next, checkPiano, answer, start, phase, partIdx, q, inputMode });
  handlers.current = { replay, next, checkPiano, answer, start, phase, partIdx, q, inputMode };
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && ["INPUT", "SELECT", "TEXTAREA", "BUTTON"].includes(t.tagName)) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const h = handlers.current;
      if (e.key === " ") {
        e.preventDefault();
        if (h.phase === "asking" || h.phase === "feedback") h.replay();
      } else if (e.key === "Enter") {
        e.preventDefault();
        if (h.phase === "feedback") h.next();
        else if (h.phase === "asking" && h.inputMode === "piano" && h.partIdx === 0) h.checkPiano();
      } else if (/^[1-9]$/.test(e.key) && h.phase === "asking" && h.q && (h.inputMode === "buttons" || h.partIdx > 0)) {
        const choice = h.q.parts[h.partIdx].choices[Number(e.key) - 1];
        if (choice) h.answer(choice.id);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const compound = drill === "intervals" && cfgs.intervals.enabled.some((i) => /^(m9|M9|m10|M10|P11|A11|P12|m13|M13)$/.test(i));
  const range = useMemo(() => (q ? pianoRange(q, compound) : ([48, 72] as [number, number])), [q, compound]);

  if (!drill) return <Navigate to="/" replace />;
  const info = DRILL_INFO[drill];
  const problem = configProblem(drill, cfgs);

  // ----- Setup -----
  if (phase === "setup") {
    return (
      <div className="page">
        <Link to="/" className="back">
          ← Home
        </Link>
        <h1>{info.title}</h1>
        <p className="lede">{info.blurb}</p>
        <section className="card">
          <h2 className="card-title">What to practise</h2>
          <DrillOptions drill={drill} />
        </section>
        <div className="sticky-cta">
          {problem && <p className="warn">{problem}</p>}
          <button type="button" className="btn primary big" disabled={!!problem || loading} onClick={start}>
            {loading ? "Loading sounds…" : `Start ${settings.sessionLength} questions`}
          </button>
        </div>
      </div>
    );
  }

  // ----- Summary -----
  if (phase === "summary") {
    const pct = session.n ? Math.round((session.correct / session.n) * 100) : 0;
    const missed = Object.entries(session.missed).sort((a, b) => b[1] - a[1]);
    return (
      <div className="page">
        <h1>Session done</h1>
        <div className="summary-score">
          <span className="big-num">{pct}%</span>
          <span className="muted">
            {session.correct} of {session.n} correct
          </span>
        </div>
        {missed.length > 0 ? (
          <section className="card">
            <h2 className="card-title">Worth another look</h2>
            <ul className="plain-list">
              {missed.map(([label, n]) => (
                <li key={label}>
                  <span>{label}</span>
                  <span className="muted">missed {n}×</span>
                </li>
              ))}
            </ul>
          </section>
        ) : (
          <p className="lede">A perfect session. Try adding harder items or turning on random register.</p>
        )}
        <div className="row-buttons">
          <button type="button" className="btn primary" onClick={start}>
            Go again
          </button>
          <button type="button" className="btn" onClick={() => setPhase("setup")}>
            Change options
          </button>
          <Link to="/" className="btn">
            Home
          </Link>
        </div>
      </div>
    );
  }

  if (!q) return null;

  // ----- Asking / feedback -----
  const part = q.parts[partIdx];
  const allCorrect = phase === "feedback" && q.parts.every((p, i) => picks[i] === p.answer);
  const usingPiano = inputMode === "piano" && partIdx === 0 && phase === "asking" && !!q.piano;

  const marks: Record<number, KeyMark> = {};
  if (phase === "asking") {
    if (inputMode === "piano") q.piano?.given.forEach((m) => (marks[m] = "given"));
    selected.forEach((m) => (marks[m] = "selected"));
  } else {
    if (inputMode === "piano") selected.forEach((m) => (marks[m] = "wrong"));
    q.notes.forEach((n) => (marks[n.midi] = "answer"));
    if (inputMode === "piano") {
      const correctPcs = new Set(q.notes.map((n) => n.midi % 12));
      selected.forEach((m) => {
        if (q.piano?.mode === "set" ? correctPcs.has(m % 12) : q.notes.some((n) => n.midi === m) || (q.drill === "pitch" && correctPcs.has(m % 12)))
          marks[m] = "correct";
      });
    }
  }

  return (
    <div className="page drill">
      <div className="drill-top">
        <button
          type="button"
          className="link"
          onClick={() => {
            audio.stop();
            setPhase("setup");
          }}
        >
          ← Options
        </button>
        <span className="drill-title">{info.title}</span>
        <span className="muted tabular">
          {Math.min(session.n + (phase === "asking" ? 1 : 0), settings.sessionLength)} / {settings.sessionLength}
        </span>
      </div>
      <div className="progress-bar" aria-hidden>
        <div style={{ width: `${(session.n / settings.sessionLength) * 100}%` }} />
      </div>

      {soundNote && <p className="warn">{soundNote}</p>}

      <div className="play-row">
        <button type="button" className="btn play" onMouseDown={noFocus} onClick={replay} aria-label="Replay question">
          <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden>
            <path d="M8 5v14l11-7z" fill="currentColor" />
          </svg>
          Replay
        </button>
        {q.piano && partIdx === 0 && phase === "asking" && (
          <div className="segmented" role="tablist" aria-label="Answer with">
            <button type="button" role="tab" aria-selected={inputMode === "buttons"} className={inputMode === "buttons" ? "on" : ""} onMouseDown={noFocus} onClick={() => setInputMode("buttons")}>
              Buttons
            </button>
            <button type="button" role="tab" aria-selected={inputMode === "piano"} className={inputMode === "piano" ? "on" : ""} onMouseDown={noFocus} onClick={() => setInputMode("piano")}>
              Piano
            </button>
          </div>
        )}
      </div>

      {phase === "asking" && (
        <>
          <p className="prompt">{usingPiano ? q.piano!.instruction : part.prompt}</p>
          {partIdx > 0 && (
            <p className={`part-result ${picks[0] === q.parts[0].answer ? "ok" : "bad"}`}>
              {picks[0] === q.parts[0].answer ? "✓" : "✗"} {choiceLabel(q, 0, q.parts[0].answer)}
            </p>
          )}
        </>
      )}

      {phase === "feedback" && (
        <div className={`feedback ${allCorrect ? "ok" : "bad"}`} role="status">
          <div className="feedback-head">{allCorrect ? "Correct" : "Not quite"}</div>
          <div className="feedback-reveal">{q.reveal}</div>
          {q.parts.map((p, i) =>
            picks[i] !== p.answer ? (
              <div key={p.key} className="feedback-line">
                <span>
                  {i === 0 && picks[i] === OTHER && selected.length ? (
                    <>
                      You played <strong>{[...selected].sort((a, z) => a - z).map((m) => midiName(m)).join(" ")}</strong>
                    </>
                  ) : (
                    <>
                      You said <strong>{choiceLabel(q, i, picks[i])}</strong>
                    </>
                  )}
                  {q.parts.length > 1 && ` (${p.key})`}
                </span>
                {(() => {
                  const ev = answerPreview(q, p.key, picks[i], settings.tempo);
                  return ev ? (
                    <button type="button" className="btn small" onMouseDown={noFocus} onClick={() => void playEvents(ev)}>
                      Hear yours
                    </button>
                  ) : null;
                })()}
              </div>
            ) : null,
          )}
          <div className="note-chips">
            {q.notes.map((n, i) => (
              <span key={i} className="note-chip">
                <span>{settings.noteNames === "letters" ? spelledName(n.spelled) : degreeLabel(n.degree)}</span>
                <span className="muted small">{settings.noteNames === "letters" ? degreeLabel(n.degree) : spelledName(n.spelled)}</span>
              </span>
            ))}
          </div>
        </div>
      )}

      {(usingPiano || (phase === "feedback" && inputMode === "piano" && q.piano)) && (
        <div className="piano-wrap">
          <Piano lo={range[0]} hi={range[1]} marks={marks} onKey={onKey} keyboard={usingPiano} focusMidi={q.piano?.given[0]} />
          {usingPiano && (
            <div className="piano-actions">
              <span className="hint">Keys A–; play notes · Z / X change octave</span>
              <button type="button" className="btn primary" onMouseDown={noFocus} disabled={selected.length === 0} onClick={checkPiano}>
                Check
              </button>
            </div>
          )}
        </div>
      )}

      {!usingPiano && (
        <div className={`answers ${part.choices.length > 8 ? "dense" : ""}`}>
          {(phase === "feedback" ? q.parts[q.parts.length - 1] : part).choices.map((c, i) => {
            const shownPart = phase === "feedback" ? q.parts.length - 1 : partIdx;
            const p = q.parts[shownPart];
            let cls = "";
            if (phase === "feedback") {
              if (c.id === p.answer) cls = "is-correct";
              else if (c.id === picks[shownPart]) cls = "is-wrong";
            }
            return (
              <button
                key={c.id}
                type="button"
                className={`answer ${cls}`}
                disabled={phase !== "asking"}
                onMouseDown={noFocus}
                onClick={() => answer(c.id)}
              >
                <span className="answer-label">{c.label}</span>
                {c.sub && <span className="answer-sub">{c.sub}</span>}
                {i < 9 && phase === "asking" && <kbd>{i + 1}</kbd>}
              </button>
            );
          })}
        </div>
      )}

      {phase === "feedback" && (
        <div className="sticky-cta">
          <button type="button" className="btn primary big" onMouseDown={noFocus} onClick={next}>
            {session.n >= settings.sessionLength ? "See results" : "Next"} <kbd>Enter</kbd>
          </button>
        </div>
      )}
    </div>
  );
}
