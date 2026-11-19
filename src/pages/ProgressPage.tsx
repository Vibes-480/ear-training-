import { useMemo, useRef, useState } from "react";
import { CalendarHeatmap, ConfusionGrid, LineChart, type LinePoint } from "../components/charts";
import { DRILL_INFO } from "../drills/config";
import { itemLabel, shortLabel } from "../drills/labels";
import { exportAll, importAll } from "../store/backup";
import { currentStreak, localDay, recentAccuracy, resetProgress, useProgress, type Progress } from "../store/progress";
import { useSettings } from "../store/settings";

interface Row {
  part: string;
  id: string;
  label: string;
  attempts: number;
  overall: number;
  recent: number;
  weakness: number;
  avgMs: number | null;
  confusedWith: { label: string; n: number }[];
}

function drillTitle(d: string): string {
  return (DRILL_INFO as Record<string, { title: string }>)[d]?.title ?? d.charAt(0).toUpperCase() + d.slice(1);
}

function bestStreak(p: Progress): number {
  const keys = Object.keys(p.days).filter((k) => p.days[k].questions > 0).sort();
  let best = 0;
  let run = 0;
  let prev: Date | null = null;
  for (const k of keys) {
    const d = new Date(k + "T12:00:00");
    run = prev && Math.round((d.getTime() - prev.getTime()) / 86_400_000) === 1 ? run + 1 : 1;
    best = Math.max(best, run);
    prev = d;
  }
  return best;
}

function lastDays(n: number): string[] {
  const out: string[] = [];
  const d = new Date();
  d.setHours(12, 0, 0, 0);
  d.setDate(d.getDate() - (n - 1));
  for (let i = 0; i < n; i++) {
    out.push(localDay(d.getTime()));
    d.setDate(d.getDate() + 1);
  }
  return out;
}

const shortDate = (k: string) => new Date(k + "T12:00:00").toLocaleDateString(undefined, { month: "short", day: "numeric" });

export function ProgressPage() {
  const p = useProgress();
  const settings = useSettings();
  const [msg, setMsg] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const drills = useMemo(() => {
    const set = new Set<string>();
    Object.keys(p.items).forEach((k) => set.add(k.split(":")[0]));
    return [...set];
  }, [p.items]);
  const [drillSel, setDrillSel] = useState<string>("all");
  const [range, setRange] = useState(30);
  const drill = drills.includes(drillSel) ? drillSel : "all";

  const parts = useMemo(() => {
    if (drill === "all") return [];
    const set = new Set<string>();
    Object.keys(p.items).forEach((k) => {
      const [d, part] = k.split(":");
      if (d === drill) set.add(part);
    });
    return [...set];
  }, [p.items, drill]);
  const [partSel, setPartSel] = useState<string>("");
  const part = parts.includes(partSel) ? partSel : parts[0] ?? "";

  // ---- Trend data ----
  const days = lastDays(range);
  const acc: LinePoint[] = days.map((k) => {
    const day = p.days[k];
    let q = 0;
    let c = 0;
    if (day) {
      if (drill === "all") {
        q = day.questions;
        c = day.correct;
      } else {
        q = day.byDrill?.[drill]?.q ?? 0;
        c = day.byDrill?.[drill]?.c ?? 0;
      }
    }
    return { label: shortDate(k), value: q ? c / q : null, detail: q ? `${c} of ${q} correct` : undefined };
  });
  const speed: LinePoint[] = days.map((k) => {
    const by = p.days[k]?.byDrill ?? {};
    const entries = drill === "all" ? Object.values(by) : by[drill] ? [by[drill]] : [];
    const c = entries.reduce((a, e) => a + e.c, 0);
    const ms = entries.reduce((a, e) => a + e.ms, 0);
    return { label: shortDate(k), value: c ? ms / c / 1000 : null, detail: c ? `over ${c} correct answers` : undefined };
  });

  // ---- Item rows & confusion ----
  const rows: Row[] = useMemo(() => {
    if (drill === "all") return [];
    const out: Row[] = [];
    for (const [key, stat] of Object.entries(p.items)) {
      const [d, pt, id] = key.split(":");
      if (d !== drill || pt !== part) continue;
      const conf = p.confusions[`${d}:${pt}`]?.[id] ?? {};
      out.push({
        part: pt,
        id,
        label: itemLabel(d, pt, id),
        attempts: stat.attempts,
        overall: stat.correct / stat.attempts,
        recent: stat.recent.length ? stat.recent.reduce((a, b) => a + b, 0) / stat.recent.length : 0,
        weakness: recentAccuracy(stat),
        avgMs: stat.correct ? stat.totalMs / stat.correct : null,
        confusedWith: Object.entries(conf)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 2)
          .map(([other, n]) => ({ label: itemLabel(d, pt, other), n })),
      });
    }
    return out.sort((a, b) => a.weakness - b.weakness);
  }, [p, drill, part]);

  const confusionData = useMemo(() => {
    if (drill === "all" || !part) return null;
    const prefix = `${drill}:${part}:`;
    const asked: Record<string, number> = {};
    const correct: Record<string, number> = {};
    const ids: string[] = [];
    for (const [key, stat] of Object.entries(p.items)) {
      if (!key.startsWith(prefix)) continue;
      const id = key.slice(prefix.length);
      ids.push(id);
      asked[id] = stat.attempts;
      correct[id] = stat.correct;
    }
    // Keep a stable musical order where the ids are numeric (notes, inversions) or catalog-ordered.
    ids.sort((a, b) => (isNaN(Number(a)) || isNaN(Number(b)) ? 0 : Number(a) - Number(b)));
    return {
      ids,
      asked,
      correct,
      confusions: p.confusions[`${drill}:${part}`] ?? {},
      short: (id: string) => shortLabel(drill, part, id),
      long: (id: string) => itemLabel(drill, part, id),
    };
  }, [p, drill, part]);

  const heat = useMemo(() => Object.fromEntries(Object.entries(p.days).map(([k, v]) => [k, v.questions])), [p.days]);
  const today = p.days[localDay()];
  const any = Object.keys(p.items).length > 0;

  const download = () => {
    const blob = new Blob([exportAll()], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `ear-trainer-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const onImport = async (file: File) => {
    try {
      importAll(await file.text());
      setMsg("Backup restored.");
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Couldn't read that file.");
    }
  };

  return (
    <div className="page">
      <h1>Progress</h1>

      <div className="stat-row">
        <div className="stat">
          <span className="stat-num">{currentStreak(p)}</span>
          <span className="stat-label">day streak</span>
        </div>
        <div className="stat">
          <span className="stat-num">{bestStreak(p)}</span>
          <span className="stat-label">best streak</span>
        </div>
        <div className="stat">
          <span className="stat-num">
            {today?.questions ?? 0}
            <span className="muted small">/{settings.dailyGoal}</span>
          </span>
          <span className="stat-label">today's goal</span>
        </div>
      </div>

      <section className="card">
        <h2 className="card-title">Practice calendar</h2>
        <CalendarHeatmap days={heat} goal={settings.dailyGoal} />
      </section>

      {!any ? (
        <p className="lede">Answer a few questions and your trends, confusions and weak spots will show up here.</p>
      ) : (
        <>
          <div className="filter-row">
            <div className="chips" role="tablist" aria-label="Drill">
              <button type="button" className={`chip ${drill === "all" ? "on" : ""}`} onClick={() => setDrillSel("all")}>
                All drills
              </button>
              {drills.map((d) => (
                <button key={d} type="button" className={`chip ${drill === d ? "on" : ""}`} onClick={() => setDrillSel(d)}>
                  {drillTitle(d)}
                </button>
              ))}
            </div>
            <select value={range} onChange={(e) => setRange(Number(e.target.value))} aria-label="Time range">
              <option value={14}>2 weeks</option>
              <option value={30}>30 days</option>
              <option value={90}>90 days</option>
            </select>
          </div>

          <section className="card">
            <h2 className="card-title">Accuracy {drill === "all" ? "(all drills)" : `– ${drillTitle(drill)}`}</h2>
            <LineChart points={acc} yMax={1} format={(v) => `${Math.round(v * 100)}%`} ariaLabel="Daily accuracy" />
          </section>
          <section className="card">
            <h2 className="card-title">Average answer time {drill === "all" ? "(all drills)" : `– ${drillTitle(drill)}`}</h2>
            <LineChart points={speed} format={(v) => `${v.toFixed(1)}s`} ariaLabel="Average answer time per day" />
          </section>

          {drill !== "all" && (
            <>
              {parts.length > 1 && (
                <div className="chips" style={{ marginBottom: 12 }}>
                  {parts.map((pt) => (
                    <button key={pt} type="button" className={`chip ${pt === part ? "on" : ""}`} onClick={() => setPartSel(pt)}>
                      {pt.charAt(0).toUpperCase() + pt.slice(1)}
                    </button>
                  ))}
                </div>
              )}
              {confusionData && (
                <section className="card">
                  <h2 className="card-title">What you mix up</h2>
                  <p className="muted small">Each row is what was played. Numbers are the % of times you answered each column. The diagonal is correct.</p>
                  <ConfusionGrid data={confusionData} />
                </section>
              )}
              <section className="card">
                <h2 className="card-title">Items, weakest first</h2>
                <div className="table-scroll">
                  <table className="stats">
                    <thead>
                      <tr>
                        <th>Item</th>
                        <th className="num">Recent</th>
                        <th className="num">All time</th>
                        <th className="num">Avg time</th>
                        <th>Often heard as</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((r) => (
                        <tr key={r.part + r.id}>
                          <td>{r.label}</td>
                          <td className="num">
                            <span className="acc-bar" style={{ ["--acc" as string]: `${Math.round(r.recent * 100)}%` }}>
                              {Math.round(r.recent * 100)}%
                            </span>
                          </td>
                          <td className="num muted">
                            {Math.round(r.overall * 100)}% <span className="small">({r.attempts})</span>
                          </td>
                          <td className="num muted">{r.avgMs === null ? "–" : `${(r.avgMs / 1000).toFixed(1)}s`}</td>
                          <td className="muted">{r.confusedWith.length ? r.confusedWith.map((c) => `${c.label} (${c.n})`).join(", ") : "–"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            </>
          )}
        </>
      )}

      <section className="card">
        <h2 className="card-title">Backup</h2>
        <p className="muted">Download your progress, settings and presets as a file, or restore them from one.</p>
        <div className="row-buttons">
          <button type="button" className="btn" onClick={download}>
            Download backup
          </button>
          <button type="button" className="btn" onClick={() => fileRef.current?.click()}>
            Restore from file
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="application/json,.json"
            hidden
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void onImport(f);
              e.target.value = "";
            }}
          />
          <button
            type="button"
            className="btn danger"
            disabled={!any}
            onClick={() => {
              if (confirm("Delete all progress? This can't be undone unless you have a backup.")) resetProgress();
            }}
          >
            Reset progress
          </button>
        </div>
        {msg && <p className="muted">{msg}</p>}
      </section>
    </div>
  );
}
