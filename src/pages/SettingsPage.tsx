import { useSyncExternalStore } from "react";
import { audio } from "../audio/engine";
import { Switch } from "../components/DrillOptions";
import { COMMON_ROOTS, midiName, spelledName } from "../theory/notes";
import { Link } from "react-router-dom";
import { AccountCard } from "../components/AccountCard";
import { INTERVALS } from "../theory/catalog";
import { SONG_REFS } from "../theory/songs";
import { useState } from "react";
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

      <AccountCard />

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
        <h2 className="card-title">Musical context</h2>
        <label className="field">
          <span>Set the key before each question</span>
          <select value={s.context} onChange={(e) => updateSettings({ context: e.target.value as Settings["context"] })}>
            <option value="off">Off</option>
            <option value="cadence">Play a cadence (I–IV–V–I)</option>
            <option value="drone">Play a drone underneath</option>
          </select>
          <span className="hint">Applies to intervals and scales. You hear notes in a key, the way they appear in real music.</span>
        </label>
        <Switch checked={s.songRefs} onChange={(v) => updateSettings({ songRefs: v })} label="Song references" hint="After an interval, show a famous song that starts with it" />
        {s.songRefs && <SongRefEditor />}
      </section>

      <section className="card">
        <h2 className="card-title">Daily goal</h2>
        <label className="field">
          <span>Questions per day</span>
          <select value={s.dailyGoal} onChange={(e) => updateSettings({ dailyGoal: Number(e.target.value) })}>
            {[20, 30, 40, 60, 80, 100, 150].map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </label>
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
            <option value="sing">Singing (where possible)</option>
          </select>
        </label>
        <label className="field">
          <span>Show notes as</span>
          <select value={s.noteNames} onChange={(e) => updateSettings({ noteNames: e.target.value as Settings["noteNames"] })}>
            <option value="letters">Letter names (C, E♭, G)</option>
            <option value="degrees">Scale degrees (1, ♭3, 5)</option>
          </select>
        </label>
        <Switch checked={s.showStaff} onChange={(v) => updateSettings({ showStaff: v })} label="Show answers on a staff" hint="Music notation under each answer" />
        <div className="field-inline">
          <span>
            Voice range: <strong>{s.voiceRange ? `${midiName(s.voiceRange.lo)} – ${midiName(s.voiceRange.hi)}` : "not set"}</strong>
          </span>
          <Link to="/sing" className="link">
            {s.voiceRange ? "Check again in Singing" : "Set up in Singing"}
          </Link>
        </div>
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

function SongRefEditor() {
  const s = useSettings();
  const [open, setOpen] = useState(false);
  if (!open)
    return (
      <button type="button" className="link" onClick={() => setOpen(true)}>
        Edit song references
      </button>
    );
  const set = (id: string, dir: "asc" | "desc", value: string) =>
    updateSettings({ songRefEdits: { ...s.songRefEdits, [id]: { ...s.songRefEdits[id], [dir]: value } } });
  return (
    <div className="song-editor">
      <p className="hint">Use songs you know well. Leave a box empty to show nothing for that interval.</p>
      <div className="song-grid">
        <span className="muted small">Interval</span>
        <span className="muted small">Up</span>
        <span className="muted small">Down</span>
        {INTERVALS.filter((i) => !i.compound).map((i) => (
          <SongRow key={i.id} id={i.id} name={i.short} edits={s.songRefEdits} set={set} />
        ))}
      </div>
      <div className="row-buttons">
        <button type="button" className="link" onClick={() => updateSettings({ songRefEdits: {} })}>
          Restore the built-in songs
        </button>
        <button type="button" className="link" onClick={() => setOpen(false)}>
          Done
        </button>
      </div>
    </div>
  );
}

function SongRow({
  id,
  name,
  edits,
  set,
}: {
  id: string;
  name: string;
  edits: Settings["songRefEdits"];
  set: (id: string, dir: "asc" | "desc", value: string) => void;
}) {
  return (
    <>
      <span className="song-name">{name}</span>
      {(["asc", "desc"] as const).map((dir) => (
        <input
          key={dir}
          className="text-input"
          value={edits[id]?.[dir] ?? SONG_REFS[id]?.[dir] ?? ""}
          onChange={(e) => set(id, dir, e.target.value)}
          aria-label={`${name} ${dir === "asc" ? "up" : "down"}`}
        />
      ))}
    </>
  );
}
