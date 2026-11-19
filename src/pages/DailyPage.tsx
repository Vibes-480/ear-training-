import { useCallback, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { prepareAudio, QuestionRunner, SessionSummary, type SessionResult } from "../components/QuestionRunner";
import { renderSongRefs } from "../components/SongRefs";
import { DRILL_INFO, useConfigs } from "../drills/config";
import { buildDailyPlan, type DailyPlan } from "../drills/daily";
import { generate } from "../drills/generate";
import { configProblem } from "../components/DrillOptions";
import { makeWeight } from "../drills/weights";
import type { DrillId } from "../drills/types";
import { getProgress, localDay, markDailyDone, recordSession, useProgress } from "../store/progress";
import { getSettings, updateSettings, useSettings } from "../store/settings";
import { DAILY_DRILLS } from "../drills/registry";

type Phase = "plan" | "running" | "summary";

export function DailyPage() {
  const settings = useSettings();
  const cfgs = useConfigs();
  const progress = useProgress();
  const [phase, setPhase] = useState<Phase>("plan");
  const [plan, setPlan] = useState<DailyPlan | null>(null);
  const [soundNote, setSoundNote] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<SessionResult | null>(null);

  const drills = (settings.dailyDrills as DrillId[]).filter((d) => DAILY_DRILLS.includes(d) && !configProblem(d, cfgs));
  const preview = useMemo(
    () => buildDailyPlan(progress, cfgs, drills, settings.dailyLength, Date.now(), () => 0.5),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [cfgs, drills.join(","), settings.dailyLength, phase],
  );
  const doneToday = !!progress.days[localDay()]?.dailyDone;

  const start = async () => {
    setLoading(true);
    try {
      setSoundNote(await prepareAudio());
    } finally {
      setLoading(false);
    }
    setPlan(buildDailyPlan(getProgress(), cfgs, drills, getSettings().dailyLength, Date.now(), Math.random));
    setPhase("running");
  };

  const makeQuestion = useCallback(
    (i: number, previous?: string) => {
      const entry = plan!.queue[i % plan!.queue.length];
      const s = getSettings();
      return generate(entry.drill, cfgs, s, { rng: Math.random, weight: makeWeight(entry.drill, s.focusWeak), previous, force: entry.item });
    },
    [plan, cfgs],
  );

  if (phase === "running" && plan) {
    return (
      <div className="page">
        {soundNote && <p className="warn">{soundNote}</p>}
        <QuestionRunner
          title="Daily session"
          total={plan.queue.length}
          makeQuestion={makeQuestion}
          exitLabel="← Stop"
          onExit={() => setPhase("plan")}
          onDone={(r) => {
            markDailyDone();
            recordSession({ at: Date.now(), drill: "daily", total: r.n, correct: r.correct });
            setResult(r);
            setPhase("summary");
          }}
          renderExtra={renderSongRefs}
        />
      </div>
    );
  }

  if (phase === "summary" && result) {
    return (
      <div className="page">
        <SessionSummary result={result}>
          <Link to="/" className="btn primary">
            Done
          </Link>
          <button type="button" className="btn" onClick={start}>
            Another round
          </button>
          <Link to="/progress" className="btn">
            See progress
          </Link>
        </SessionSummary>
      </div>
    );
  }

  return (
    <div className="page">
      <Link to="/" className="back">
        ← Home
      </Link>
      <h1>Daily session</h1>
      <p className="lede">
        A mix built from what's due for review, a few new items and your weakest spots.
        {doneToday && " You've already done today's session, but another round never hurts."}
      </p>

      <section className="card">
        <h2 className="card-title">Today's plan</h2>
        {drills.length === 0 ? (
          <p className="warn">Pick at least one drill below.</p>
        ) : (
          <div className="plan-stats">
            <div>
              <span className="stat-num">{preview.dueCount}</span>
              <span className="stat-label">reviews due</span>
            </div>
            <div>
              <span className="stat-num">{preview.newCount}</span>
              <span className="stat-label">new</span>
            </div>
            <div>
              <span className="stat-num">{preview.weakCount}</span>
              <span className="stat-label">weak spots</span>
            </div>
          </div>
        )}
        <div className="opt-group" style={{ marginTop: 16 }}>
          <div className="opt-head">
            <span>Drills to include</span>
          </div>
          <div className="chips">
            {DAILY_DRILLS.map((d) => {
              const on = settings.dailyDrills.includes(d);
              return (
                <button
                  key={d}
                  type="button"
                  className={`chip ${on ? "on" : ""}`}
                  aria-pressed={on}
                  onClick={() => updateSettings({ dailyDrills: on ? settings.dailyDrills.filter((x) => x !== d) : [...settings.dailyDrills, d] })}
                >
                  {DRILL_INFO[d].title}
                </button>
              );
            })}
          </div>
          <p className="hint" style={{ marginTop: 8 }}>
            Each drill uses the items you've selected in its own options.
          </p>
        </div>
        <label className="field-inline">
          Length
          <select value={settings.dailyLength} onChange={(e) => updateSettings({ dailyLength: Number(e.target.value) })}>
            {[10, 20, 30, 40].map((n) => (
              <option key={n} value={n}>
                {n} questions
              </option>
            ))}
          </select>
        </label>
      </section>

      <div className="sticky-cta">
        <button type="button" className="btn primary big" disabled={!drills.length || loading} onClick={start}>
          {loading ? "Loading sounds…" : "Start daily session"}
        </button>
      </div>
    </div>
  );
}
