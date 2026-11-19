import { useSyncExternalStore } from "react";
import { audio } from "../audio/engine";
import { Switch } from "../components/DrillOptions";
import { COMMON_ROOTS, spelledName } from "../theory/notes";
import { INSTRUMENTS, updateSettings, useSettings, type InstrumentId, type Settings } from "../store/settings";

function useLoadState(id: InstrumentId) {
  return useSyncExternalStore(
    (l) => audio.subscribe(l),
    () => audio.state(id),
    () => audio.state(id),
  );
}

export function SettingsPage() {
  const s = useSettings();
  const loadState = useLoadState(s.instrument);

  const preview = async () => {
    await audio.unlock();
    audio.setVolume(s.volume);
    await audio.load(s.instrument);
    const id = audio.state(s.instrument) === "ready" ? s.instrument : "synth";
    void audio.play(
      [
        { midi: [60], at: 0, dur: 0.4 },
        { midi: [64], at: 0.35, dur: 0.4 },
        { midi: [67], at: 0.7, dur: 0.4 },
        { midi: [60, 64, 67, 72], at: 1.1, dur: 1.6 },
      ],
      id,
    );
  };

  return (
    <div className="page">
      <h1>Settings</h1>

      <section className="card">
        <h2 className="card-title">Sound</h2>
        <label className="field">
          <span>Instrument</span>
          <div className="field-row">
            <select value={s.instrument} onChange={(e) => updateSettings({ instrument: e.target.value as InstrumentId })}>
              {INSTRUMENTS.map((i) => (
                <option key={i.id} value={i.id}>
                  {i.name}
                </option>
              ))}
            </select>
            <button type="button" className="btn" onClick={preview}>
              {loadState === "loading" ? "Loading…" : "Preview"}
            </button>
          </div>
          {loadState === "failed" && <span className="warn">Couldn't load these samples. The synth will play instead.</span>}
        </label>
        <Switch checked={s.varyInstrument} onChange={(v) => updateSettings({ varyInstrument: v })} label="Vary the instrument" hint="A different sampled instrument each question, so you learn the sound itself and not one timbre" />
        <label className="field">
          <span>Volume</span>
          <input type="range" min={0} max={1} step={0.05} value={s.volume} onChange={(e) => updateSettings({ volume: Number(e.target.value) })} />
        </label>
        <label className="field">
          <span>Melodic speed: {s.tempo} BPM</span>
          <input type="range" min={40} max={200} step={5} value={s.tempo} onChange={(e) => updateSettings({ tempo: Number(e.target.value) })} />
        </label>
      </section>

      <section className="card">
        <h2 className="card-title">Key & register</h2>
        <Switch checked={s.randomKey} onChange={(v) => updateSettings({ randomKey: v })} label="Random key" hint="A new starting note every question. Turn off to always start on one key." />
        {!s.randomKey && (
          <label className="field-inline">
            Key
            <select value={s.fixedRoot} onChange={(e) => updateSettings({ fixedRoot: Number(e.target.value) })}>
              {COMMON_ROOTS.map((r, i) => (
                <option key={i} value={i}>
                  {spelledName(r)}
                </option>
              ))}
            </select>
          </label>
        )}
        <Switch checked={s.randomRegister} onChange={(v) => updateSettings({ randomRegister: v })} label="Random register" hint="Move questions to different octaves. Turn off to stay in the middle range." />
      </section>

      <section className="card">
        <h2 className="card-title">Practice</h2>
        <label className="field">
          <span>Questions per session</span>
          <select value={s.sessionLength} onChange={(e) => updateSettings({ sessionLength: Number(e.target.value) })}>
            {[10, 20, 30, 50, 100].map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>Answer with</span>
          <select value={s.inputMode} onChange={(e) => updateSettings({ inputMode: e.target.value as Settings["inputMode"] })}>
            <option value="buttons">Buttons</option>
            <option value="piano">Piano</option>
          </select>
        </label>
        <label className="field">
          <span>Show notes as</span>
          <select value={s.noteNames} onChange={(e) => updateSettings({ noteNames: e.target.value as Settings["noteNames"] })}>
            <option value="letters">Letter names (C, E♭, G)</option>
            <option value="degrees">Scale degrees (1, ♭3, 5)</option>
          </select>
        </label>
        <Switch checked={s.focusWeak} onChange={(v) => updateSettings({ focusWeak: v })} label="Focus on weak spots" hint="Ask the things you miss more often" />
        <Switch checked={s.autoAdvance} onChange={(v) => updateSettings({ autoAdvance: v })} label="Auto-advance" hint="Go to the next question right after a correct answer" />
      </section>

      <section className="card">
        <h2 className="card-title">Appearance</h2>
        <label className="field">
          <span>Theme</span>
          <select value={s.theme} onChange={(e) => updateSettings({ theme: e.target.value as Settings["theme"] })}>
            <option value="system">Match system</option>
            <option value="light">Light</option>
            <option value="dark">Dark</option>
          </select>
        </label>
      </section>
    </div>
  );
}
