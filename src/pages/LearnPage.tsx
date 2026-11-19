import { Link, useNavigate } from "react-router-dom";
import { audio } from "../audio/engine";
import { CURRICULUM, PACKS, type Level } from "../drills/packs";
import { isPassed, isUnlocked, useCurriculum } from "../store/curriculum";

export function LearnPage() {
  const state = useCurriculum();
  const navigate = useNavigate();
  const units = [...new Set(CURRICULUM.map((l) => l.unit))];
  const passed = CURRICULUM.filter((l) => isPassed(state, l.id)).length;
  const nextLevel = CURRICULUM.find((l) => !isPassed(state, l.id));

  const open = (l: Level) => {
    void audio.unlock();
    navigate(`/drill/${l.drill}?level=${l.id}&go=1`);
  };

  return (
    <div className="page">
      <Link to="/" className="back">
        ← Home
      </Link>
      <h1>Levels</h1>
      <p className="lede">
        A step-by-step path from first intervals to jazz chord tones. Pass a level to unlock the next. {passed} of {CURRICULUM.length} passed.
      </p>
      <div className="progress-bar" aria-hidden style={{ marginBottom: 20 }}>
        <div style={{ width: `${(passed / CURRICULUM.length) * 100}%` }} />
      </div>
      {nextLevel && (
        <button type="button" className="btn primary big" style={{ marginBottom: 20 }} onClick={() => open(nextLevel)}>
          Continue: {nextLevel.title}
        </button>
      )}

      {units.map((u) => (
        <section key={u} className="card">
          <h2 className="card-title">{u}</h2>
          <ol className="level-list">
            {CURRICULUM.filter((l) => l.unit === u).map((l) => {
              const done = isPassed(state, l.id);
              const unlocked = isUnlocked(state, l.id);
              const best = state.best[l.id];
              return (
                <li key={l.id}>
                  <button type="button" className={`level ${done ? "done" : unlocked ? "open" : "locked"}`} disabled={!unlocked} onClick={() => open(l)}>
                    <span className="level-icon" aria-hidden>
                      {done ? "✓" : unlocked ? "▶" : "🔒"}
                    </span>
                    <span className="level-text">
                      <span className="level-title">{l.title}</span>
                      <span className="muted small">{l.blurb}</span>
                    </span>
                    <span className="level-score muted small">{best ? `best ${Math.round(best.pct * 100)}%` : `${Math.round(l.pass * 100)}% to pass`}</span>
                  </button>
                </li>
              );
            })}
          </ol>
        </section>
      ))}
    </div>
  );
}

export function PacksPage() {
  const navigate = useNavigate();
  return (
    <div className="page">
      <Link to="/" className="back">
        ← Home
      </Link>
      <h1>Genre packs</h1>
      <p className="lede">Ready-made drills built around the sounds of each style. They don't change your own drill options.</p>
      {PACKS.map((p) => (
        <section key={p.id} className="card">
          <h2 className="card-title">{p.name}</h2>
          <p className="muted small" style={{ marginTop: -6 }}>
            {p.blurb}
          </p>
          <div className="module-list">
            {p.modules.map((mod) => (
              <button
                key={mod.id}
                type="button"
                className="module"
                onClick={() => {
                  void audio.unlock();
                  navigate(`/drill/${mod.drill}?pack=${p.id}&module=${mod.id}`);
                }}
              >
                <span className="level-title">{mod.title}</span>
                <span className="muted small">{mod.blurb}</span>
              </button>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
