import type { ReactNode } from "react";
import { CHORDS, INTERVALS, INVERSION_NAMES, SCALES, type ChordGroup, type ScaleGroup } from "../theory/catalog";
import { COMMON_ROOTS, spelledName } from "../theory/notes";
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
function KeyOptions() {
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
      <Switch checked={s.randomRegister} onChange={(v) => updateSettings({ randomRegister: v })} label="Random register" hint="Move questions to different octaves" />
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

export function DrillOptions({ drill }: { drill: DrillId }) {
  return (
    <div className="drill-options">
      {drill === "intervals" && <IntervalOptions />}
      {drill === "chords" && <ChordOptions />}
      {drill === "scales" && <ScaleOptions />}
      {drill === "pitch" && <PitchOptions />}
      <KeyOptions />
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
      return null;
    case "scales":
      if (cfgs.scales.enabled.length < 2) return "Pick at least two scales.";
      if (!cfgs.scales.directions.length) return "Pick at least one direction.";
      return null;
    case "pitch":
      if (cfgs.pitch.enabled.length < 2) return "Pick at least two notes.";
      return null;
  }
}
