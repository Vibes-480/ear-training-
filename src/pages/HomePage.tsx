import { Link, useNavigate } from "react-router-dom";
import { audio } from "../audio/engine";
import { DRILL_INFO } from "../drills/config";
import { HARMONY_DRILLS, HEARING_DRILLS } from "../drills/registry";
import type { DrillId } from "../drills/types";
import { usePresets } from "../store/presets";
import { currentStreak, localDay, useProgress, type Progress } from "../store/progress";
import { useSettings } from "../store/settings";

function drillAccuracy(p: Progress, drill: string): { attempts: number; pct: number | null } {
  let attempts = 0;
  let correct = 0;
  for (const [key, stat] of Object.entries(p.items)) {
    if (!key.startsWith(drill + ":")) continue;
    attempts += stat.attempts;
    correct += stat.correct;
  }
  return { attempts, pct: attempts ? Math.round((correct / attempts) * 100) : null };
}

function GoalRing({ value, goal }: { value: number; goal: number }) {
  const r = 30;
  const c = 2 * Math.PI * r;
  const f = Math.min(1, goal ? value / goal : 0);
  return (
    <svg width="76" height="76" viewBox="0 0 76 76" role="img" aria-label={`${value} of ${goal} questions today`}>
      <circle cx="38" cy="38" r={r} className="ring-track" />
      <circle cx="38" cy="38" r={r} className="ring-fill" strokeDasharray={`${c * f} ${c}`} transform="rotate(-90 38 38)" />
      <text x="38" y="36" textAnchor="middle" className="ring-num">
        {value}
      </text>
      <text x="38" y="50" textAnchor="middle" className="ring-sub">
        of {goal}
      </text>
    </svg>
  );
}

export function DrillGrid({ drills, p }: { drills: DrillId[]; p: Progress }) {
  return (
    <div className="drill-grid">
      {drills.map((d) => {
        const acc = drillAccuracy(p, d);
        return (
          <Link key={d} to={`/drill/${d}`} className="drill-card">
            <span className="drill-card-title">{DRILL_INFO[d].title}</span>
            <span className="drill-card-blurb">{DRILL_INFO[d].blurb}</span>
            <span className="drill-card-meta">{acc.pct === null ? "Not started" : `${acc.pct}% · ${acc.attempts} answers`}</span>
          </Link>
        );
      })}
    </div>
  );
}

export function HomePage() {
  const p = useProgress();
  const settings = useSettings();
  const presets = usePresets();
  const navigate = useNavigate();
  const today = p.days[localDay()];
  const streak = currentStreak(p);
  const done = !!today?.dailyDone;

  return (
    <div className="page">
      <header className="home-head">
        <h1>Practice</h1>
      </header>

      <section className="card today-card">
        <GoalRing value={today?.questions ?? 0} goal={settings.dailyGoal} />
        <div className="today-text">
          <div className="today-title">{done ? "Daily session done ✓" : "Today's session"}</div>
          <div className="muted small">
            {streak > 0 ? `${streak}-day streak` : "Start a streak today"}
            {today?.questions ? ` · ${Math.round((today.correct / today.questions) * 100)}% accuracy today` : ""}
          </div>
          <Link to="/daily" className="btn primary" style={{ marginTop: 10 }}>
            {done ? "Practise more" : "Start daily session"}
          </Link>
        </div>
      </section>

      {presets.length > 0 && (
        <>
          <h2 className="section-title">Your presets</h2>
          <div className="chips">
            {presets.map((pr) => (
              <button
                key={pr.id}
                type="button"
                className="chip preset-chip"
                onClick={() => {
                  // Unlock audio inside the tap so the session can start straight away.
                  void audio.unlock();
                  navigate(`/drill/${pr.drill}?preset=${pr.id}&go=1`);
                }}
              >
                ▶ {pr.name}
              </button>
            ))}
          </div>
        </>
      )}

      <h2 className="section-title">Hearing</h2>
      <DrillGrid drills={HEARING_DRILLS} p={p} />

      <h2 className="section-title">Harmony</h2>
      <DrillGrid drills={HARMONY_DRILLS} p={p} />
    </div>
  );
}
