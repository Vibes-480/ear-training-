import { useRef, useState } from "react";
import { CHORDS, INTERVALS, INVERSION_NAMES, SCALES } from "../theory/catalog";
import { DRILL_INFO } from "../drills/config";
import { PITCH_LABELS } from "../drills/generate";
import type { DrillId } from "../drills/types";
import { exportProgress, importProgress, recentAccuracy, resetProgress, useProgress } from "../store/progress";

const DRILLS: DrillId[] = ["intervals", "chords", "scales", "pitch"];

function itemLabel(drill: string, part: string, id: string): string {
  if (id === "other") return "something else";
  if (drill === "intervals") return INTERVALS.find((i) => i.id === id)?.name ?? id;
  if (drill === "chords" && part === "quality") return CHORDS.find((c) => c.id === id)?.name ?? id;
  if (drill === "chords" && part === "inversion") return INVERSION_NAMES[Number(id)] ?? id;
  if (drill === "scales") return SCALES.find((s) => s.id === id)?.name ?? id;
  if (drill === "pitch") return PITCH_LABELS[Number(id)] ?? id;
  return id;
}

interface Row {
  part: string;
  id: string;
  label: string;
  attempts: number;
  overall: number;
  recent: number;
  /** Smoothed accuracy used for sorting, weakest first. */
  weakness: number;
  avgMs: number | null;
  confusedWith: { label: string; n: number }[];
}

export function ProgressPage() {
  const p = useProgress();
  const [msg, setMsg] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const rowsFor = (drill: DrillId): Row[] => {
    const rows: Row[] = [];
    for (const [key, stat] of Object.entries(p.items)) {
      const [d, part, id] = key.split(":");
      if (d !== drill) continue;
      const conf = p.confusions[`${d}:${part}`]?.[id] ?? {};
      rows.push({
        part,
        id,
        label: itemLabel(d, part, id),
        attempts: stat.attempts,
        overall: stat.correct / stat.attempts,
        recent: stat.recent.length ? stat.recent.reduce((a, b) => a + b, 0) / stat.recent.length : 0,
        weakness: recentAccuracy(stat),
        avgMs: stat.correct ? stat.totalMs / stat.correct : null,
        confusedWith: Object.entries(conf)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 2)
          .map(([other, n]) => ({ label: itemLabel(d, part, other), n })),
      });
    }
    return rows.sort((a, b) => a.weakness - b.weakness);
  };

  const download = () => {
    const blob = new Blob([exportProgress()], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `ear-trainer-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const onImport = async (file: File) => {
    try {
      importProgress(await file.text());
      setMsg("Backup restored.");
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Couldn't read that file.");
    }
  };

  const any = Object.keys(p.items).length > 0;

  return (
    <div className="page">
      <h1>Progress</h1>
      {!any && <p className="lede">Answer a few questions and your stats will show up here, weakest items first.</p>}

      {DRILLS.map((drill) => {
        const rows = rowsFor(drill);
        if (!rows.length) return null;
        return (
          <section key={drill} className="card">
            <h2 className="card-title">{DRILL_INFO[drill].title}</h2>
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
                      <td>
                        {r.label}
                        {r.part === "inversion" && <span className="muted small"> (inversion)</span>}
                      </td>
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
        );
      })}

      <section className="card">
        <h2 className="card-title">Backup</h2>
        <p className="muted">Progress is saved in this browser. Download a backup to keep it safe or move it to another device.</p>
        <div className="row-buttons">
          <button type="button" className="btn" onClick={download} disabled={!any}>
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
