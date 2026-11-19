import { useState, type ReactNode } from "react";
import { getTuningState, setTuningCents } from "../drills/tuning";
import { CHORDS, INTERVALS, INVERSION_NAMES, SCALES, type ChordGroup, type ScaleGroup } from "../theory/catalog";
import { COMMON_ROOTS, degreeLabel, spelledName } from "../theory/notes";
import { BACKING_SETS, CADENCES, CHORD_TONES, FUNCTIONAL_DEGREES, NUMERALS, TONIC } from "../theory/harmony";
import { resetConfig, updateConfig, useConfigs } from "../drills/config";
import { PITCH_LABELS } from "../drills/generate";
import type { DrillId } from "../drills/types";
import { updateSettings, useSettings } from "../store/settings";

function toggle<T>(list: T[], item: T): T[] {
  return list.includes(item) ? list.filter((x) => x !== item) : [...list, item];
}

function Chip({ on, onClick, children, title }: { on: boolean; onClick: () => void; children: ReactNode; title?: string }) {
  return (
    <button type="button" className={`chip ${on ? "on" : ""}`} aria-pressed={on} onClick={onClick} title={title}>
      {children}
    </button>
  );
}

function Group({ title, children, onAll, onNone }: { title: string; children: ReactNode; onAll?: () => void; onNone?: () => void }) {
  return (
    <div className="opt-group">
      <div className="opt-head">
        <span>{title}</span>
        {onAll && (
          <span className="opt-links">
            <button type="button" className="link" onClick={onAll}>
              All
            </button>
            <button type="button" className="link" onClick={onNone}>
              None
            </button>
          </span>
        )}
      </div>
      <div className="chips">{children}</div>
    </div>
  );
}

export function Switch({ checked, onChange, label, hint }: { checked: boolean; onChange: (v: boolean) => void; label: string; hint?: string }) {
  return (
    <label className="switch-row">
      <span>
        <span className="switch-label">{label}</span>
        {hint && <span className="hint">{hint}</span>}
      </span>
      <input type="checkbox" role="switch" checked={checked} onChange={(e) => onChange(e.target.checked)} />
    </label>
  );
}

/** Key and register switches, shared by every drill. */
function KeyOptions({ register = true }: { register?: boolean }) {
  const s = useSettings();
  return (
    <div className="opt-group">
      <Switch checked={s.randomKey} onChange={(v) => updateSettings({ randomKey: v })} label="Random key" hint="A new starting note every question" />
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
      {register && <Switch checked={s.randomRegister} onChange={(v) => updateSettings({ randomRegister: v })} label="Random register" hint="Move questions to different octaves" />}
    </div>
  );
}

function IntervalOptions() {
  const { intervals: c } = useConfigs();
  const simple = INTERVALS.filter((i) => !i.compound);
  const compound = INTERVALS.filter((i) => i.compound);
  const set = (enabled: string[]) => updateConfig("intervals", { enabled });
  return (
    <>
      <Group title="Intervals" onAll={() => set([...new Set([...c.enabled, ...simple.map((i) => i.id)])])} onNone={() => set(c.enabled.filter((id) => !simple.some((i) => i.id === id)))}>
        {simple.map((i) => (
          <Chip key={i.id} on={c.enabled.includes(i.id)} onClick={() => set(toggle(c.enabled, i.id))} title={i.name}>
            {i.short}
          </Chip>
        ))}
      </Group>
      <Group title="Compound (over an octave)" onAll={() => set([...new Set([...c.enabled, ...compound.map((i) => i.id)])])} onNone={() => set(c.enabled.filter((id) => !compound.some((i) => i.id === id)))}>
        {compound.map((i) => (
          <Chip key={i.id} on={c.enabled.includes(i.id)} onClick={() => set(toggle(c.enabled, i.id))} title={i.name}>
            {i.short}
          </Chip>
        ))}
      </Group>
      <Group title="Direction">
        {(
          [
            ["asc", "Ascending"],
            ["desc", "Descending"],
            ["harm", "Harmonic"],
          ] as const
        ).map(([id, name]) => (
          <Chip key={id} on={c.directions.includes(id)} onClick={() => updateConfig("intervals", { directions: toggle(c.directions, id) })}>
            {name}
          </Chip>
        ))}
      </Group>
    </>
  );
}

const CHORD_GROUPS: [ChordGroup, string][] = [
  ["triad", "Triads"],
  ["seventh", "7th & 6th chords"],
  ["extended", "Extended"],
];

function ChordOptions() {
  const { chords: c } = useConfigs();
  const set = (enabled: string[]) => updateConfig("chords", { enabled });
  return (
    <>
      {CHORD_GROUPS.map(([g, title]) => {
        const items = CHORDS.filter((x) => x.group === g);
        return (
          <Group key={g} title={title} onAll={() => set([...new Set([...c.enabled, ...items.map((x) => x.id)])])} onNone={() => set(c.enabled.filter((id) => !items.some((x) => x.id === id)))}>
            {items.map((x) => (
              <Chip key={x.id} on={c.enabled.includes(x.id)} onClick={() => set(toggle(c.enabled, x.id))} title={x.name}>
                C{x.symbol}
              </Chip>
            ))}
          </Group>
        );
      })}
      <Group title="Voicings">
        {(
          [
            ["close", "Close"],
            ["open", "Open (drop-2)"],
            ["shell", "Shell (1-3-7)"],
            ["rootless", "Rootless (jazz)"],
          ] as const
        ).map(([id, name]) => (
          <Chip key={id} on={(c.voicings ?? ["close"]).includes(id)} onClick={() => updateConfig("chords", { voicings: toggle(c.voicings ?? ["close"], id) })}>
            {name}
          </Chip>
        ))}
      </Group>
      <Group title="Inversions">
        {[0, 1, 2, 3].map((i) => (
          <Chip key={i} on={c.inversions.includes(i)} onClick={() => updateConfig("chords", { inversions: toggle(c.inversions, i) })}>
            {i === 0 ? "Root" : INVERSION_NAMES[i].replace(" inversion", "")}
          </Chip>
        ))}
      </Group>
      <Group title="Playback">
        <Chip on={c.playback.includes("block")} onClick={() => updateConfig("chords", { playback: toggle(c.playback, "block") })}>
          Block
        </Chip>
        <Chip on={c.playback.includes("arp")} onClick={() => updateConfig("chords", { playback: toggle(c.playback, "arp") })}>
          Arpeggiated
        </Chip>
      </Group>
      <div className="opt-group">
        <Switch checked={c.askInversion} onChange={(v) => updateConfig("chords", { askInversion: v })} label="Also name the inversion" hint="A second question after the chord quality" />
      </div>
    </>
  );
}

const SCALE_GROUPS: [ScaleGroup, string][] = [
  ["diatonic", "Modes of the major scale"],
  ["minor", "Melodic & harmonic minor family"],
  ["pentatonic", "Pentatonic & blues"],
  ["symmetric", "Symmetric"],
];

function ScaleOptions() {
  const { scales: c } = useConfigs();
  const set = (enabled: string[]) => updateConfig("scales", { enabled });
  return (
    <>
      {SCALE_GROUPS.map(([g, title]) => {
        const items = SCALES.filter((x) => x.group === g);
        return (
          <Group key={g} title={title} onAll={() => set([...new Set([...c.enabled, ...items.map((x) => x.id)])])} onNone={() => set(c.enabled.filter((id) => !items.some((x) => x.id === id)))}>
            {items.map((x) => (
              <Chip key={x.id} on={c.enabled.includes(x.id)} onClick={() => set(toggle(c.enabled, x.id))}>
                {x.name}
              </Chip>
            ))}
          </Group>
        );
      })}
      <Group title="Direction">
        {(
          [
            ["asc", "Up"],
            ["desc", "Down"],
            ["both", "Up & down"],
          ] as const
        ).map(([id, name]) => (
          <Chip key={id} on={c.directions.includes(id)} onClick={() => updateConfig("scales", { directions: toggle(c.directions, id) })}>
            {name}
          </Chip>
        ))}
      </Group>
    </>
  );
}

function PitchOptions() {
  const { pitch: c } = useConfigs();
  const all = Array.from({ length: 12 }, (_, i) => i);
  return (
    <>
      <Group title="Notes" onAll={() => updateConfig("pitch", { enabled: all })} onNone={() => updateConfig("pitch", { enabled: [] })}>
        {all.map((pc) => (
          <Chip key={pc} on={c.enabled.includes(pc)} onClick={() => updateConfig("pitch", { enabled: toggle(c.enabled, pc).sort((a, b) => a - b) })}>
            {PITCH_LABELS[pc]}
          </Chip>
        ))}
      </Group>
      <div className="opt-group">
        <Switch checked={c.reference} onChange={(v) => updateConfig("pitch", { reference: v })} label="Play a reference note first" hint="Turn off to practise absolute pitch" />
        <label className="field-inline">
          Octave spread
          <select value={c.octaves} onChange={(e) => updateConfig("pitch", { octaves: Number(e.target.value) })}>
            {[1, 2, 3].map((n) => (
              <option key={n} value={n}>
                {n} octave{n > 1 ? "s" : ""}
              </option>
            ))}
          </select>
        </label>
      </div>
    </>
  );
}

function TonalityGroup({ value, onChange }: { value: ("major" | "minor")[]; onChange: (v: ("major" | "minor")[]) => void }) {
  return (
    <Group title="Keys">
      <Chip on={value.includes("major")} onClick={() => onChange(toggle(value, "major"))}>
        Major
      </Chip>
      <Chip on={value.includes("minor")} onClick={() => onChange(toggle(value, "minor"))}>
        Minor
      </Chip>
    </Group>
  );
}

function NumeralGroup({ tonality, value, onChange }: { tonality: "major" | "minor"; value: string[]; onChange: (v: string[]) => void }) {
  const all = NUMERALS[tonality].filter((n) => n.id !== TONIC[tonality]);
  const diatonic = all.filter((n) => !n.chromatic);
  const chromatic = all.filter((n) => n.chromatic);
  return (
    <>
      <Group title={`Chords in ${tonality} keys`} onAll={() => onChange([...new Set([...value, ...diatonic.map((n) => n.id)])])} onNone={() => onChange(value.filter((v) => !diatonic.some((n) => n.id === v)))}>
        {diatonic.map((n) => (
          <Chip key={n.id} on={value.includes(n.id)} onClick={() => onChange(toggle(value, n.id))}>
            {n.id}
          </Chip>
        ))}
      </Group>
      <Group title={`Borrowed & secondary (${tonality})`} onAll={() => onChange([...new Set([...value, ...chromatic.map((n) => n.id)])])} onNone={() => onChange(value.filter((v) => !chromatic.some((n) => n.id === v)))}>
        {chromatic.map((n) => (
          <Chip key={n.id} on={value.includes(n.id)} onClick={() => onChange(toggle(value, n.id))} title={n.hint}>
            {n.id}
            {n.hint && <span className="chip-hint"> {n.hint}</span>}
          </Chip>
        ))}
      </Group>
    </>
  );
}

function ProgressionOptions() {
  const { progressions: c } = useConfigs();
  const set = (patch: Partial<typeof c>) => updateConfig("progressions", patch);
  return (
    <>
      <Group title="Exercise">
        <Chip on={c.mode === "numerals"} onClick={() => set({ mode: "numerals" })}>
          Name every chord
        </Chip>
        <Chip on={c.mode === "cadences"} onClick={() => set({ mode: "cadences" })}>
          Name the cadence
        </Chip>
      </Group>
      <TonalityGroup value={c.tonalities} onChange={(tonalities) => set({ tonalities })} />
      {c.mode === "numerals" ? (
        <>
          {c.tonalities.includes("major") && <NumeralGroup tonality="major" value={c.major} onChange={(major) => set({ major })} />}
          {c.tonalities.includes("minor") && <NumeralGroup tonality="minor" value={c.minor} onChange={(minor) => set({ minor })} />}
          <Group title="Progressions">
            <Chip on={c.style === "common"} onClick={() => set({ style: "common" })}>
              Common ones from real music
            </Chip>
            <Chip on={c.style === "random"} onClick={() => set({ style: "random" })}>
              Random
            </Chip>
          </Group>
          {c.style === "random" && (
            <label className="field-inline">
              Chords per progression
              <select value={c.length} onChange={(e) => set({ length: Number(e.target.value) })}>
                {[3, 4, 5, 6, 8].map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            </label>
          )}
          {c.style === "common" && <p className="hint">Uses well-known progressions made only of the chords you selected. Falls back to random if none fit.</p>}
        </>
      ) : (
        <Group title="Cadences">
          {CADENCES.map((cad) => (
            <Chip key={cad.id} on={c.cadences.includes(cad.id)} onClick={() => set({ cadences: toggle(c.cadences, cad.id) })}>
              {cad.name} <span className="chip-hint">{cad.sub}</span>
            </Chip>
          ))}
        </Group>
      )}
      <div className="opt-group">
        <Switch checked={c.sevenths} onChange={(v) => set({ sevenths: v })} label="Use 7th chords" hint="Jazz-style four-note chords instead of triads" />
      </div>
    </>
  );
}

function FunctionalOptions() {
  const { functional: c } = useConfigs();
  const set = (patch: Partial<typeof c>) => updateConfig("functional", patch);
  const degreeGroup = (tonality: "major" | "minor") => {
    const value = tonality === "major" ? c.major : c.minor;
    const onChange = (v: string[]) => set(tonality === "major" ? { major: v } : { minor: v });
    return (
      <Group key={tonality} title={`Degrees in ${tonality} keys`} onAll={() => onChange(FUNCTIONAL_DEGREES.map((d) => d.id))} onNone={() => onChange([])}>
        {FUNCTIONAL_DEGREES.map((d) => (
          <Chip key={d.id} on={value.includes(d.id)} onClick={() => onChange(toggle(value, d.id))} title={d.name}>
            {degreeLabel(d.id)}
          </Chip>
        ))}
      </Group>
    );
  };
  return (
    <>
      <TonalityGroup value={c.tonalities} onChange={(tonalities) => set({ tonalities })} />
      {c.tonalities.includes("major") && degreeGroup("major")}
      {c.tonalities.includes("minor") && degreeGroup("minor")}
      <Group title="Register">
        {(
          [
            ["bass", "Bass line"],
            ["mid", "Middle"],
            ["high", "High"],
          ] as const
        ).map(([id, name]) => (
          <Chip key={id} on={c.registers.includes(id)} onClick={() => set({ registers: toggle(c.registers, id) })}>
            {name}
          </Chip>
        ))}
      </Group>
      <label className="field-inline">
        Notes per question
        <select value={c.notes} onChange={(e) => set({ notes: Number(e.target.value) })}>
          {[1, 2, 3, 4].map((n) => (
            <option key={n} value={n}>
              {n}
            </option>
          ))}
        </select>
      </label>
      <p className="hint">A cadence sets the key first, then you name each note's scale degree.</p>
    </>
  );
}

function ChordToneOptions() {
  const { chordtones: c } = useConfigs();
  const set = (patch: Partial<typeof c>) => updateConfig("chordtones", patch);
  return (
    <>
      <Group title="Backing tracks" onAll={() => set({ sets: BACKING_SETS.map((b) => b.id) })} onNone={() => set({ sets: [] })}>
        {BACKING_SETS.map((b) => (
          <Chip key={b.id} on={c.sets.includes(b.id)} onClick={() => set({ sets: toggle(c.sets, b.id) })}>
            {b.name}
          </Chip>
        ))}
      </Group>
      <Group title="Chord tones">
        {CHORD_TONES.map((t) => (
          <Chip key={t.id} on={c.tones.includes(t.id)} onClick={() => set({ tones: toggle(c.tones, t.id) })}>
            {t.name}
          </Chip>
        ))}
      </Group>
      <p className="hint">A 4-bar loop plays with a louder note on beat 2 of each bar. Name that note's role in the chord shown.</p>
    </>
  );
}

function TuningOptions() {
  const { tuning: c } = useConfigs();
  const [level, setLevel] = useState(getTuningState().cents);
  return (
    <>
      <Group title="How the notes play">
        <Chip on={c.modes.includes("sequence")} onClick={() => updateConfig("tuning", { modes: toggle(c.modes, "sequence") })}>
          One after the other
        </Chip>
        <Chip on={c.modes.includes("together")} onClick={() => updateConfig("tuning", { modes: toggle(c.modes, "together") })}>
          Together (listen for beating)
        </Chip>
      </Group>
      <div className="opt-group">
        <Switch checked={c.inTune} onChange={(v) => updateConfig("tuning", { inTune: v })} label="Include in-tune pairs" />
        <div className="field-inline">
          <span>
            Current difference: <strong>{level}¢</strong>
          </span>
          <button
            type="button"
            className="link"
            onClick={() => {
              setTuningCents(30);
              setLevel(30);
            }}
          >
            Reset to 30¢
          </button>
        </div>
        <p className="hint">Two right answers in a row shrink the difference; a miss widens it. Under 10¢ is very good, under 5¢ is excellent.</p>
      </div>
    </>
  );
}

export function DrillOptions({ drill }: { drill: DrillId }) {
  return (
    <div className="drill-options">
      {drill === "intervals" && <IntervalOptions />}
      {drill === "chords" && <ChordOptions />}
      {drill === "scales" && <ScaleOptions />}
      {drill === "pitch" && <PitchOptions />}
      {drill === "progressions" && <ProgressionOptions />}
      {drill === "functional" && <FunctionalOptions />}
      {drill === "chordtones" && <ChordToneOptions />}
      {drill === "tuning" && <TuningOptions />}
      {drill !== "tuning" && <KeyOptions register={["intervals", "chords", "scales", "pitch"].includes(drill)} />}
      <button type="button" className="link" onClick={() => resetConfig(drill)}>
        Reset this drill to defaults
      </button>
    </div>
  );
}

/** Why a drill can't start with the current options, or null if it can. */
export function configProblem(drill: DrillId, cfgs: ReturnType<typeof useConfigs>): string | null {
  switch (drill) {
    case "intervals":
      if (cfgs.intervals.enabled.length < 2) return "Pick at least two intervals.";
      if (!cfgs.intervals.directions.length) return "Pick at least one direction.";
      return null;
    case "chords":
      if (cfgs.chords.enabled.length < 2) return "Pick at least two chord types.";
      if (!cfgs.chords.inversions.length) return "Pick at least one inversion.";
      if (!cfgs.chords.playback.length) return "Pick block or arpeggiated playback.";
      if (!(cfgs.chords.voicings ?? ["close"]).length) return "Pick at least one voicing.";
      return null;
    case "scales":
      if (cfgs.scales.enabled.length < 2) return "Pick at least two scales.";
      if (!cfgs.scales.directions.length) return "Pick at least one direction.";
      return null;
    case "pitch":
      if (cfgs.pitch.enabled.length < 2) return "Pick at least two notes.";
      return null;
    case "progressions": {
      const c = cfgs.progressions;
      if (!c.tonalities.length) return "Pick major, minor or both.";
      if (c.mode === "cadences") return c.cadences.length < 2 ? "Pick at least two cadences." : null;
      if (c.tonalities.includes("major") && c.major.length < 1) return "Pick at least one chord for major keys.";
      if (c.tonalities.includes("minor") && c.minor.length < 1) return "Pick at least one chord for minor keys.";
      return null;
    }
    case "functional": {
      const c = cfgs.functional;
      if (!c.tonalities.length) return "Pick major, minor or both.";
      if (c.tonalities.includes("major") && c.major.length < 2) return "Pick at least two degrees for major keys.";
      if (c.tonalities.includes("minor") && c.minor.length < 2) return "Pick at least two degrees for minor keys.";
      if (!c.registers.length) return "Pick at least one register.";
      return null;
    }
    case "tuning":
      return cfgs.tuning.modes.length ? null : "Pick at least one way to play the notes.";
    case "chordtones":
      if (!cfgs.chordtones.sets.length) return "Pick at least one backing track.";
      if (cfgs.chordtones.tones.length < 2) return "Pick at least two chord tones.";
      return null;
  }
}
