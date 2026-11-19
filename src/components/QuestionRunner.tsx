// Runs a session of choice-based questions: plays them, takes answers by button
// or piano, records progress and shows feedback. Used by free practice, presets,
// the daily session and the curriculum.

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { audio, SAMPLED_INSTRUMENTS } from "../audio/engine";
import { canSing, evaluatePiano, evaluateSung, OTHER } from "../drills/evaluate";
import { useMic } from "../audio/mic";
import { NoteStabilizer } from "../audio/pitch";
import { PitchMeter } from "./PitchMeter";
import { QuestionStaff, vexKeySig } from "./StaffLazy";
import { answerPreview } from "../drills/generate";
import { pick } from "../drills/register";
import type { PlayEvent, Question } from "../drills/types";
import { recordAttempt } from "../store/progress";
import { getSettings, useSettings, type InstrumentId } from "../store/settings";
import { degreeLabel, midiName, spelledName } from "../theory/notes";
import { Piano, type KeyMark } from "./Piano";

export interface SessionResult {
  n: number;
  correct: number;
  /** Missed items: label -> count */
  missed: Record<string, number>;
}

interface Props {
  title: string;
  total: number;
  /** Build question number `index` (0-based). */
  makeQuestion: (index: number, previousAnswer?: string) => Question;
  onExit: () => void;
  exitLabel?: string;
  onDone: (result: SessionResult) => void;
  /** Extra content under the feedback, e.g. song references. */
  renderExtra?: (q: Question, correct: boolean) => ReactNode;
}

type Phase = "asking" | "feedback";
const noFocus = (e: React.MouseEvent) => e.preventDefault();

function choiceLabel(q: Question, partIdx: number, id: string): string {
  if (id === OTHER) return "something else";
  return q.parts[partIdx].choices.find((c) => c.id === id)?.label ?? id;
}

/** Pick the instrument for the next question. */
function pickInstrument(): InstrumentId {
  const s = getSettings();
  if (!s.varyInstrument) return audio.state(s.instrument) === "ready" ? s.instrument : "synth";
  SAMPLED_INSTRUMENTS.forEach((i) => void audio.load(i));
  const ready = SAMPLED_INSTRUMENTS.filter((i) => audio.state(i) === "ready");
  return ready.length ? pick(ready, Math.random) : "synth";
}

/** Unlock audio and load the chosen instrument. Returns a warning to show, or null. */
export async function prepareAudio(): Promise<string | null> {
  await audio.unlock();
  const s = getSettings();
  audio.setVolume(s.volume);
  if (s.instrument === "synth") return null;
  const inst = await audio.load(s.instrument);
  return inst ? null : "Couldn't load the instrument samples, so the simple synth is playing instead. Check your connection.";
}

/** Lead-in, question and anything played underneath it, as one timeline. */
export function questionTimeline(q: Question): { events: PlayEvent[]; lead: number } {
  let lead = 0;
  if (q.lead?.length) lead = Math.max(...q.lead.map((e) => e.at + e.dur)) + 0.4;
  const shift = (evs: PlayEvent[]) => evs.map((e) => ({ ...e, at: e.at + lead }));
  return { events: [...(q.lead ?? []), ...shift(q.under ?? []), ...shift(q.events)], lead };
}

export function QuestionRunner({ title, total, makeQuestion, onExit, exitLabel = "← Options", onDone, renderExtra }: Props) {
  const settings = useSettings();
  const [q, setQ] = useState<Question | null>(null);
  const [phase, setPhase] = useState<Phase>("asking");
  const [partIdx, setPartIdx] = useState(0);
  const [picks, setPicks] = useState<string[]>([]);
  const [inputMode, setInputMode] = useState(settings.inputMode);
  const [selected, setSelected] = useState<number[]>([]);
  const [result, setResult] = useState<SessionResult>({ n: 0, correct: 0, missed: {} });

  const askedAt = useRef(0);
  const instrument = useRef<InstrumentId>(settings.instrument);
  const previous = useRef<string | undefined>(undefined);
  const advanceTimer = useRef<number | undefined>(undefined);
  const index = useRef(0);

  const playQuestion = useCallback(async (question: Question) => {
    const { events, lead } = questionTimeline(question);
    askedAt.current = performance.now() + lead * 1000;
    await audio.play(events, instrument.current);
  }, []);

  const newQuestion = useCallback(() => {
    window.clearTimeout(advanceTimer.current);
    const question = makeQuestion(index.current, previous.current);
    index.current++;
    instrument.current = pickInstrument();
    setQ(question);
    setPartIdx(0);
    setPicks([]);
    setSelected([]);
    setPhase("asking");
    void playQuestion(question);
  }, [makeQuestion, playQuestion]);

  // First question on mount.
  const started = useRef(false);
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    newQuestion();
  }, [newQuestion]);

  useEffect(
    () => () => {
      window.clearTimeout(advanceTimer.current);
      audio.stop();
    },
    [],
  );

  const finishQuestion = (question: Question, allPicks: string[]) => {
    const allCorrect = question.parts.every((p, i) => allPicks[i] === p.answer);
    question.onResult?.(allCorrect);
    previous.current = question.parts[0].answer;
    setResult((r) => {
      const missed = { ...r.missed };
      if (!allCorrect) {
        const label = question.parts.map((p) => p.choices.find((c) => c.id === p.answer)?.label ?? p.answer).join(", ");
        missed[label] = (missed[label] ?? 0) + 1;
      }
      return { n: r.n + 1, correct: r.correct + (allCorrect ? 1 : 0), missed };
    });
    setPhase("feedback");
    if (allCorrect && getSettings().autoAdvance) advanceTimer.current = window.setTimeout(() => nextRef.current(), 1100);
  };

  const answer = (answerId: string) => {
    if (phase !== "asking" || !q) return;
    const part = q.parts[partIdx];
    const ms = Math.max(0, performance.now() - askedAt.current);
    recordAttempt({ drill: q.drill, part: part.key, correctId: part.answer, answeredId: answerId, ms });
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
    if (result.n >= total) {
      audio.stop();
      onDone(result);
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

  // Singing: listen while a sung answer is possible, answer on the first steady note.
  const singing = inputMode === "sing" && phase === "asking" && partIdx === 0 && !!q && canSing(q);
  const stab = useRef(new NoteStabilizer(350));
  useEffect(() => stab.current.reset(), [q, singing]);
  const { state: micState, reading } = useMic(inputMode === "sing" && !!q && canSing(q), (r, t) => {
    if (!singing || !q) return;
    const n = stab.current.push(r, t);
    if (!n) return;
    stab.current.reset();
    setSelected([n.midi]);
    answer(evaluateSung(q, n.midi));
  });

  // Keyboard shortcuts: Space = replay, Enter = check / next, 1–9 = answer.
  const handlers = useRef({ replay, next, checkPiano, answer, phase, partIdx, q, inputMode });
  handlers.current = { replay, next, checkPiano, answer, phase, partIdx, q, inputMode };
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && ["INPUT", "SELECT", "TEXTAREA", "BUTTON"].includes(t.tagName)) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const h = handlers.current;
      if (e.key === " ") {
        e.preventDefault();
        h.replay();
      } else if (e.key === "Enter") {
        e.preventDefault();
        if (h.phase === "feedback") h.next();
        else if (h.phase === "asking" && h.inputMode === "piano" && h.partIdx === 0) h.checkPiano();
      } else if (/^[1-9]$/.test(e.key) && h.phase === "asking" && h.q && (h.inputMode === "buttons" || h.partIdx > 0 || !h.q.piano)) {
        const choice = h.q.parts[h.partIdx].choices[Number(e.key) - 1];
        if (choice) h.answer(choice.id);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  if (!q) return null;

  const part = q.parts[partIdx];
  const allCorrect = phase === "feedback" && q.parts.every((p, i) => picks[i] === p.answer);
  const usingPiano = inputMode === "piano" && partIdx === 0 && phase === "asking" && !!q.piano;
  const usingSing = inputMode === "sing" && partIdx === 0 && phase === "asking" && canSing(q);
  const singPrompt =
    q.piano?.mode === "interval"
      ? `Sing the second note (any octave)`
      : q.piano?.mode === "degree"
        ? "Sing the note you heard (any octave)"
        : "Sing the note you heard (any octave)";
  const shownCount = Math.min(result.n + (phase === "asking" ? 1 : 0), total);

  const marks: Record<number, KeyMark> = {};
  if (phase === "asking") {
    if (inputMode === "piano") q.piano?.given.forEach((m) => (marks[m] = "given"));
    selected.forEach((m) => (marks[m] = "selected"));
  } else {
    if (inputMode !== "buttons") selected.forEach((m) => (marks[m] = "wrong"));
    q.notes.forEach((n) => (marks[n.midi] = "answer"));
    if (inputMode !== "buttons") {
      const correctPcs = new Set(q.notes.map((n) => ((n.midi % 12) + 12) % 12));
      selected.forEach((m) => {
        const pcOk = correctPcs.has(((m % 12) + 12) % 12);
        if (q.piano?.mode === "set" || q.piano?.mode === "single" ? pcOk : q.notes.some((n) => n.midi === m)) marks[m] = "correct";
      });
    }
  }

  const lastPartIdx = phase === "feedback" ? q.parts.length - 1 : partIdx;

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
          {exitLabel}
        </button>
        <span className="drill-title">{title}</span>
        <span className="muted tabular">
          {shownCount} / {total}
        </span>
      </div>
      <div className="progress-bar" aria-hidden>
        <div style={{ width: `${(result.n / total) * 100}%` }} />
      </div>

      <div className="play-row">
        <button type="button" className="btn play" onMouseDown={noFocus} onClick={replay} aria-label="Replay question">
          <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden>
            <path d="M8 5v14l11-7z" fill="currentColor" />
          </svg>
          Replay
        </button>
        {q.piano && partIdx === 0 && phase === "asking" && (
          <div className="segmented" role="tablist" aria-label="Answer with">
            {(canSing(q) ? (["buttons", "piano", "sing"] as const) : (["buttons", "piano"] as const)).map((m) => (
              <button key={m} type="button" role="tab" aria-selected={inputMode === m} className={inputMode === m ? "on" : ""} onMouseDown={noFocus} onClick={() => setInputMode(m)}>
                {m === "buttons" ? "Buttons" : m === "piano" ? "Piano" : "Sing"}
              </button>
            ))}
          </div>
        )}
      </div>

      {phase === "asking" && (
        <>
          <p className="prompt">{usingSing ? singPrompt : usingPiano ? q.piano!.instruction : part.prompt}</p>
          {partIdx > 0 && (
            <div className="part-results">
              {q.parts.slice(0, partIdx).map((p, i) => (
                <span key={i} className={`part-result ${picks[i] === p.answer ? "ok" : "bad"}`}>
                  {picks[i] === p.answer ? "✓" : "✗"} {choiceLabel(q, i, p.answer)}
                </span>
              ))}
            </div>
          )}
        </>
      )}

      {phase === "feedback" && (
        <div className={`feedback ${allCorrect ? "ok" : "bad"}`} role="status">
          <div className="feedback-head">{allCorrect ? "Correct" : "Not quite"}</div>
          <div className="feedback-reveal">{q.reveal}</div>
          {q.parts.map((p, i) =>
            picks[i] !== p.answer ? (
              <div key={p.key + i} className="feedback-line">
                <span>
                  {i === 0 && picks[i] === OTHER && selected.length ? (
                    <>
                      You {inputMode === "sing" ? "sang" : "played"} <strong>{[...selected].sort((a, z) => a - z).map((m) => midiName(m)).join(" ")}</strong>
                    </>
                  ) : (
                    <>
                      {q.parts.length > 1 && <span className="muted">{p.short ?? p.prompt.replace(/\?$/, "")}: </span>}
                      You said <strong>{choiceLabel(q, i, picks[i])}</strong>, it was <strong>{choiceLabel(q, i, p.answer)}</strong>
                    </>
                  )}
                </span>
                {(() => {
                  const ev = answerPreview(q, p.key, picks[i], settings.tempo, i);
                  return ev ? (
                    <button type="button" className="btn small" onMouseDown={noFocus} onClick={() => void audio.play(ev, instrument.current)}>
                      Hear yours
                    </button>
                  ) : null;
                })()}
              </div>
            ) : null,
          )}
          {q.notes.length > 0 && (
            <div className="note-chips">
              {q.notes.map((n, i) => (
                <span key={i} className="note-chip">
                  <span>{settings.noteNames === "letters" ? spelledName(n.spelled) : degreeLabel(n.degree)}</span>
                  <span className="muted small">{settings.noteNames === "letters" ? degreeLabel(n.degree) : spelledName(n.spelled)}</span>
                </span>
              ))}
            </div>
          )}
          {settings.showStaff && q.notes.length > 0 && (
            <QuestionStaff
              notes={q.notes}
              harmonic={q.events.length === 1 && q.events[0].midi.length > 1}
              keySig={q.drill === "functional" ? vexKeySig(q.root.spelled, q.meta?.tonality === "minor") : "C"}
            />
          )}
          {renderExtra?.(q, allCorrect)}
        </div>
      )}

      {(usingPiano || (phase === "feedback" && inputMode !== "buttons" && q.piano)) && q.piano && (
        <div className="piano-wrap">
          <Piano lo={q.piano.range[0]} hi={q.piano.range[1]} marks={marks} onKey={onKey} keyboard={usingPiano} focusMidi={q.piano.given[0]} />
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

      {usingSing && (
        <div className="sing-answer">
          <PitchMeter reading={reading} state={micState} />
          <p className="hint">Hold a steady note for a moment. The app ignores the mic while it is playing.</p>
        </div>
      )}

      {!usingPiano && !usingSing && (
        <div className={`answers ${q.parts[lastPartIdx].choices.length > 8 ? "dense" : ""}`}>
          {q.parts[lastPartIdx].choices.map((c, i) => {
            const p = q.parts[lastPartIdx];
            let cls = "";
            if (phase === "feedback") {
              if (c.id === p.answer) cls = "is-correct";
              else if (c.id === picks[lastPartIdx]) cls = "is-wrong";
            }
            return (
              <button key={c.id} type="button" className={`answer ${cls}`} disabled={phase !== "asking"} onMouseDown={noFocus} onClick={() => answer(c.id)}>
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
            {result.n >= total ? "See results" : "Next"} <kbd>Enter</kbd>
          </button>
        </div>
      )}
    </div>
  );
}

export function SessionSummary({ result, children }: { result: SessionResult; children?: ReactNode }) {
  const pct = result.n ? Math.round((result.correct / result.n) * 100) : 0;
  const missed = Object.entries(result.missed).sort((a, b) => b[1] - a[1]);
  return (
    <>
      <h1>Session done</h1>
      <div className="summary-score">
        <span className="big-num">{pct}%</span>
        <span className="muted">
          {result.correct} of {result.n} correct
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
        <p className="lede">A perfect session.</p>
      )}
      <div className="row-buttons">{children}</div>
    </>
  );
}
