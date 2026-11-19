import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, Navigate, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { configProblem, DrillOptions } from "../components/DrillOptions";
import { prepareAudio, QuestionRunner, SessionSummary, type SessionResult } from "../components/QuestionRunner";
import { DRILL_INFO, getConfigs, updateConfig, useConfigs } from "../drills/config";
import { makeWeight } from "../drills/weights";
import { generate } from "../drills/generate";
import type { DrillConfigs, DrillId } from "../drills/types";
import { deletePreset, savePreset, usePresets } from "../store/presets";
import { recordSession } from "../store/progress";
import { getSettings, useSettings } from "../store/settings";
import { renderSongRefs } from "../components/SongRefs";

type Phase = "setup" | "running" | "summary";

export function DrillPage() {
  const { id } = useParams();
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const drill = id && id in DRILL_INFO ? (id as DrillId) : null;
  const settings = useSettings();
  const cfgs = useConfigs();
  const presets = usePresets();

  const presetId = params.get("preset");
  const preset = presets.find((p) => p.id === presetId && p.drill === drill) ?? null;

  const [phase, setPhase] = useState<Phase>("setup");
  const [loading, setLoading] = useState(false);
  const [soundNote, setSoundNote] = useState<string | null>(null);
  const [result, setResult] = useState<SessionResult | null>(null);
  const [runKey, setRunKey] = useState(0);
  const [presetName, setPresetName] = useState("");
  const [savingPreset, setSavingPreset] = useState(false);

  // A preset runs with its own options, leaving the drill's saved options alone.
  const effective: DrillConfigs = useMemo(
    () => (preset && drill ? { ...cfgs, [drill]: preset.config } : cfgs),
    [preset, drill, cfgs],
  );

  const makeQuestion = useCallback(
    (_i: number, previous?: string) => {
      const s = getSettings();
      return generate(drill!, effective, s, { rng: Math.random, weight: makeWeight(drill!, s.focusWeak), previous });
    },
    [drill, effective],
  );

  const start = async () => {
    setLoading(true);
    try {
      setSoundNote(await prepareAudio());
    } finally {
      setLoading(false);
    }
    setRunKey((k) => k + 1);
    setPhase("running");
  };

  // One-tap start from a preset link (?go=1).
  const startRef = useRef(start);
  startRef.current = start;
  useEffect(() => {
    if (params.get("go") !== "1" || !drill) return;
    const next = new URLSearchParams(params);
    next.delete("go");
    setParams(next, { replace: true });
    void startRef.current();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!drill) return <Navigate to="/" replace />;
  const info = DRILL_INFO[drill];
  const problem = configProblem(drill, effective);
  const drillPresets = presets.filter((p) => p.drill === drill);
  const title = preset ? preset.name : info.title;

  if (phase === "running") {
    return (
      <div className="page">
        {soundNote && <p className="warn">{soundNote}</p>}
        <QuestionRunner
          key={runKey}
          title={title}
          total={settings.sessionLength}
          makeQuestion={makeQuestion}
          onExit={() => setPhase("setup")}
          onDone={(r) => {
            recordSession({ at: Date.now(), drill, total: r.n, correct: r.correct });
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

  return (
    <div className="page">
      <Link to="/" className="back">
        ← Home
      </Link>
      <h1>{title}</h1>
      <p className="lede">{preset ? `Preset for ${info.title.toLowerCase()}` : info.blurb}</p>

      {(drillPresets.length > 0 || preset) && (
        <section className="card">
          <h2 className="card-title">Presets</h2>
          <div className="chips">
            <button type="button" className={`chip ${!preset ? "on" : ""}`} onClick={() => setParams({})}>
              My options
            </button>
            {drillPresets.map((p) => (
              <button key={p.id} type="button" className={`chip ${preset?.id === p.id ? "on" : ""}`} onClick={() => setParams({ preset: p.id })}>
                {p.name}
              </button>
            ))}
          </div>
          {preset && (
            <div className="row-buttons">
              <button
                type="button"
                className="link"
                onClick={() => {
                  updateConfig(drill, preset.config as never);
                  setParams({});
                }}
              >
                Edit a copy of these options
              </button>
              <button
                type="button"
                className="link danger-link"
                onClick={() => {
                  if (confirm(`Delete the preset "${preset.name}"?`)) {
                    deletePreset(preset.id);
                    navigate(`/drill/${drill}`, { replace: true });
                  }
                }}
              >
                Delete preset
              </button>
            </div>
          )}
        </section>
      )}

      {!preset && (
        <section className="card">
          <h2 className="card-title">What to practise</h2>
          <DrillOptions drill={drill} />
          <div className="save-preset">
            {savingPreset ? (
              <form
                className="field-row"
                onSubmit={(e) => {
                  e.preventDefault();
                  const p = savePreset(drill, presetName, getConfigs()[drill]);
                  setSavingPreset(false);
                  setPresetName("");
                  setParams({ preset: p.id });
                }}
              >
                <input className="text-input" autoFocus placeholder="Preset name, e.g. Jazz 7ths" value={presetName} onChange={(e) => setPresetName(e.target.value)} maxLength={40} />
                <button type="submit" className="btn primary" disabled={!presetName.trim() || !!problem}>
                  Save
                </button>
                <button type="button" className="btn" onClick={() => setSavingPreset(false)}>
                  Cancel
                </button>
              </form>
            ) : (
              <button type="button" className="link" onClick={() => setSavingPreset(true)}>
                Save these options as a preset
              </button>
            )}
          </div>
        </section>
      )}

      <div className="sticky-cta">
        {problem && <p className="warn">{problem}</p>}
        <button type="button" className="btn primary big" disabled={!!problem || loading} onClick={start}>
          {loading ? "Loading sounds…" : `Start ${settings.sessionLength} questions`}
        </button>
      </div>
    </div>
  );
}
