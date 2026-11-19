import { Link } from "react-router-dom";
import { DRILL_INFO } from "../drills/config";
import type { DrillId } from "../drills/types";
import { currentStreak, localDay, useProgress, type Progress } from "../store/progress";

const DRILLS: DrillId[] = ["intervals", "chords", "scales", "pitch"];

function drillAccuracy(p: Progress, drill: DrillId): { attempts: number; pct: number | null } {
  let attempts = 0;
  let correct = 0;
  for (const [key, stat] of Object.entries(p.items)) {
    if (!key.startsWith(drill + ":")) continue;
    attempts += stat.attempts;
    correct += stat.correct;
  }
  return { attempts, pct: attempts ? Math.round((correct / attempts) * 100) : null };
}

const COMING = [
  "Smart daily session that targets your weak spots",
  "Chord progressions, functional ear training and chord tones over a backing track",
  "Singing with live pitch detection, tuning drills",
  "Melody and rhythm dictation on a staff",
  "Login and cloud sync",
];

export function HomePage() {
  const p = useProgress();
  const today = p.days[localDay()];
  const streak = currentStreak(p);

  return (
    <div className="page">
      <header className="home-head">
        <h1>Ear Trainer</h1>
        <div className="stat-row">
          <div className="stat">
            <span className="stat-num">{today?.questions ?? 0}</span>
            <span className="stat-label">questions today</span>
          </div>
          <div className="stat">
            <span className="stat-num">{today && today.questions ? Math.round((today.correct / today.questions) * 100) + "%" : "–"}</span>
            <span className="stat-label">accuracy today</span>
          </div>
          <div className="stat">
            <span className="stat-num">{streak}</span>
            <span className="stat-label">day streak</span>
          </div>
        </div>
      </header>

      <h2 className="section-title">Drills</h2>
      <div className="drill-grid">
        {DRILLS.map((d) => {
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

      <h2 className="section-title">Coming next</h2>
      <ul className="coming">
        {COMING.map((c) => (
          <li key={c}>{c}</li>
        ))}
      </ul>
    </div>
  );
}
