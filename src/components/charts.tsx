// Small, dependency-free SVG charts. One series per chart (titles name them, so no
// legend box), thin 2px lines, recessive grid, a hover crosshair + tooltip.

import { useEffect, useRef, useState, type ReactNode } from "react";

function useWidth<T extends HTMLElement>(): [React.RefObject<T>, number] {
  const ref = useRef<T>(null);
  const [w, setW] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    setW(Math.max(200, Math.round(el.getBoundingClientRect().width)));
    const ro = new ResizeObserver(([entry]) => setW(Math.max(200, Math.round(entry.contentRect.width))));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, w];
}

function Tooltip({ x, y, children, containerWidth }: { x: number; y: number; children: ReactNode; containerWidth: number }) {
  const left = Math.min(Math.max(8, x + 12), containerWidth - 168);
  return (
    <div className="chart-tip" style={{ left, top: Math.max(0, y - 10) }} role="status">
      {children}
    </div>
  );
}

// ---------------------------------------------------------------------------

export interface LinePoint {
  label: string;
  /** null = no data that day (a gap). */
  value: number | null;
  detail?: string;
}

export function LineChart({
  points,
  yMax,
  format,
  height = 180,
  ariaLabel,
}: {
  points: LinePoint[];
  yMax?: number;
  format: (v: number) => string;
  height?: number;
  ariaLabel: string;
}) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);
  const pad = { l: 40, r: 12, t: 12, b: 26 };
  const vals = points.map((p) => p.value).filter((v): v is number => v !== null);
  const max = yMax ?? Math.max(1, ...vals) * 1.15;
  const iw = width - pad.l - pad.r;
  const ih = height - pad.t - pad.b;
  const x = (i: number) => pad.l + (points.length <= 1 ? iw / 2 : (i / (points.length - 1)) * iw);
  const y = (v: number) => pad.t + ih - (v / max) * ih;

  // Split into runs so missing days show as gaps, not invented slopes.
  const runs: { i: number; v: number }[][] = [];
  let cur: { i: number; v: number }[] = [];
  points.forEach((p, i) => {
    if (p.value === null) {
      if (cur.length) runs.push(cur);
      cur = [];
    } else cur.push({ i, v: p.value });
  });
  if (cur.length) runs.push(cur);

  const ticks = [0, 0.5, 1].map((f) => f * max);
  const labelEvery = Math.ceil(points.length / Math.max(2, Math.floor(iw / 70)));

  const onMove = (e: React.PointerEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const px = e.clientX - rect.left;
    const i = Math.round(((px - pad.l) / iw) * (points.length - 1));
    setHover(Math.max(0, Math.min(points.length - 1, i)));
  };

  const hp = hover !== null ? points[hover] : null;

  return (
    <div className="chart" ref={ref} style={{ minHeight: height }}>
      {width > 0 && (
      <svg width={width} height={height} role="img" aria-label={ariaLabel} onPointerMove={onMove} onPointerLeave={() => setHover(null)}>
        {ticks.map((t) => (
          <g key={t}>
            <line x1={pad.l} x2={width - pad.r} y1={y(t)} y2={y(t)} className="grid" />
            <text x={pad.l - 6} y={y(t)} className="axis" textAnchor="end" dominantBaseline="middle">
              {format(t)}
            </text>
          </g>
        ))}
        {points.map((p, i) =>
          i % labelEvery === 0 || i === points.length - 1 ? (
            <text key={i} x={x(i)} y={height - 6} className="axis" textAnchor="middle">
              {p.label}
            </text>
          ) : null,
        )}
        {runs.map((run, k) =>
          run.length === 1 ? (
            <circle key={k} cx={x(run[0].i)} cy={y(run[0].v)} r={4} className="series-dot" />
          ) : (
            <path key={k} d={run.map((p, j) => `${j ? "L" : "M"}${x(p.i)},${y(p.v)}`).join(" ")} className="series-line" />
          ),
        )}
        {hover !== null && (
          <>
            <line x1={x(hover)} x2={x(hover)} y1={pad.t} y2={pad.t + ih} className="crosshair" />
            {hp?.value !== null && hp?.value !== undefined && <circle cx={x(hover)} cy={y(hp.value)} r={5} className="series-dot hover" />}
          </>
        )}
      </svg>
      )}
      {hp && hover !== null && width > 0 && (
        <Tooltip x={x(hover)} y={hp.value !== null ? y(hp.value) : pad.t} containerWidth={width}>
          <strong>{hp.label}</strong>
          <div>{hp.value === null ? "No practice" : format(hp.value)}</div>
          {hp.detail && <div className="muted">{hp.detail}</div>}
        </Tooltip>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------

export interface HeatDay {
  date: string;
  count: number;
}

/** Practice calendar: weeks as columns, Monday at the top. Intensity = share of the daily goal. */
export function CalendarHeatmap({ days, goal, weeks = 18 }: { days: Record<string, number>; goal: number; weeks?: number }) {
  const [hover, setHover] = useState<{ x: number; y: number; date: string; count: number } | null>(null);
  const [ref, width] = useWidth<HTMLDivElement>();
  const cell = 13;
  const gap = 3;
  const today = new Date();
  today.setHours(12, 0, 0, 0);
  const dow = (today.getDay() + 6) % 7; // Monday = 0
  const start = new Date(today);
  start.setDate(start.getDate() - dow - (weeks - 1) * 7);

  const cols: { date: string; count: number; future: boolean }[][] = [];
  const d = new Date(start);
  for (let w = 0; w < weeks; w++) {
    const col = [];
    for (let i = 0; i < 7; i++) {
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      col.push({ date: key, count: days[key] ?? 0, future: d > today });
      d.setDate(d.getDate() + 1);
    }
    cols.push(col);
  }

  const level = (c: number) => (c <= 0 ? 0 : c >= goal ? 4 : c >= goal * 0.5 ? 3 : c >= goal * 0.25 ? 2 : 1);
  const svgW = weeks * (cell + gap) + 24;
  const svgH = 7 * (cell + gap) + 18;
  const months = cols.map((col, i) => {
    const first = new Date(col[0].date + "T12:00:00");
    const prev = i > 0 ? new Date(cols[i - 1][0].date + "T12:00:00") : null;
    return !prev || prev.getMonth() !== first.getMonth() ? first.toLocaleString(undefined, { month: "short" }) : "";
  });

  return (
    <div className="chart heatmap" ref={ref}>
      <div className="heatmap-scroll">
        <svg width={svgW} height={svgH} role="img" aria-label="Practice calendar" onPointerLeave={() => setHover(null)}>
          {["M", "", "W", "", "F", "", ""].map((l, i) => (
            <text key={i} x={0} y={18 + i * (cell + gap) + cell / 2} className="axis" dominantBaseline="middle">
              {l}
            </text>
          ))}
          {months.map((m, i) =>
            m ? (
              <text key={i} x={24 + i * (cell + gap)} y={10} className="axis">
                {m}
              </text>
            ) : null,
          )}
          {cols.map((col, w) =>
            col.map((c, i) =>
              c.future ? null : (
                <rect
                  key={c.date}
                  x={24 + w * (cell + gap)}
                  y={18 + i * (cell + gap)}
                  width={cell}
                  height={cell}
                  rx={3}
                  className={`heat l${level(c.count)}`}
                  onPointerEnter={() => setHover({ x: 24 + w * (cell + gap), y: 18 + i * (cell + gap), date: c.date, count: c.count })}
                />
              ),
            ),
          )}
        </svg>
      </div>
      <div className="heat-legend" aria-hidden>
        <span className="muted small">Less</span>
        {[0, 1, 2, 3, 4].map((l) => (
          <span key={l} className={`heat-swatch l${l}`} />
        ))}
        <span className="muted small">Goal met</span>
      </div>
      {hover && (
        <Tooltip x={hover.x} y={hover.y} containerWidth={width}>
          <strong>{new Date(hover.date + "T12:00:00").toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })}</strong>
          <div>
            {hover.count} question{hover.count === 1 ? "" : "s"}
            {hover.count >= goal ? " · goal met" : ""}
          </div>
        </Tooltip>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------

export interface ConfusionData {
  ids: string[];
  short: (id: string) => string;
  long: (id: string) => string;
  /** Times each item was asked. */
  asked: Record<string, number>;
  /** Times each item was answered correctly. */
  correct: Record<string, number>;
  /** confusions[asked][answered] */
  confusions: Record<string, Record<string, number>>;
}

/** Rows = what was played, columns = what you answered. Shade = share of that row. */
export function ConfusionGrid({ data }: { data: ConfusionData }) {
  const [hover, setHover] = useState<{ r: string; c: string; x: number; y: number } | null>(null);
  const [ref, width] = useWidth<HTMLDivElement>();
  const rows = data.ids.filter((id) => (data.asked[id] ?? 0) > 0);
  const answered = new Set<string>(rows);
  rows.forEach((r) => Object.keys(data.confusions[r] ?? {}).forEach((c) => answered.add(c)));
  const cols = data.ids.filter((id) => answered.has(id)).concat([...answered].filter((id) => !data.ids.includes(id)));
  if (!rows.length) return <p className="muted">No answers yet.</p>;

  const cell = 34;
  const labelW = 64;
  const top = 46;
  const value = (r: string, c: string) => (r === c ? data.correct[r] ?? 0 : data.confusions[r]?.[c] ?? 0);
  const share = (r: string, c: string) => value(r, c) / (data.asked[r] || 1);

  return (
    <div className="chart" ref={ref}>
      <div className="heatmap-scroll">
        <svg width={labelW + cols.length * cell + 4} height={top + rows.length * cell + 4} role="img" aria-label="Confusion grid" onPointerLeave={() => setHover(null)}>
          <text x={labelW} y={10} className="axis">
            You answered →
          </text>
          {cols.map((c, j) => (
            <text key={c} x={labelW + j * cell + cell / 2} y={top - 8} className="axis" textAnchor="middle">
              {data.short(c)}
            </text>
          ))}
          {rows.map((r, i) => (
            <g key={r}>
              <text x={labelW - 8} y={top + i * cell + cell / 2} className="axis" textAnchor="end" dominantBaseline="middle">
                {data.short(r)}
              </text>
              {cols.map((c, j) => {
                const v = value(r, c);
                const s = share(r, c);
                const diag = r === c;
                const x = labelW + j * cell;
                const y = top + i * cell;
                return (
                  <g key={c} onPointerEnter={() => setHover({ r, c, x, y })}>
                    <rect
                      x={x + 1}
                      y={y + 1}
                      width={cell - 2}
                      height={cell - 2}
                      rx={4}
                      className={diag ? "conf-diag" : "conf-cell"}
                      style={diag ? undefined : { ["--s" as string]: `${Math.round(Math.min(1, s * 2) * 100)}%` }}
                    />
                    {v > 0 && (
                      <text x={x + cell / 2} y={y + cell / 2} className={`conf-num ${!diag && s >= 0.3 ? "on-dark" : ""}`} textAnchor="middle" dominantBaseline="middle">
                        {Math.round(s * 100)}
                      </text>
                    )}
                  </g>
                );
              })}
            </g>
          ))}
        </svg>
      </div>
      {hover && (
        <Tooltip x={hover.x + cell} y={hover.y} containerWidth={width}>
          <strong>Played {data.long(hover.r)}</strong>
          <div>
            {hover.r === hover.c ? "Answered correctly" : `Answered ${data.long(hover.c)}`}: {value(hover.r, hover.c)} of {data.asked[hover.r]} (
            {Math.round(share(hover.r, hover.c) * 100)}%)
          </div>
        </Tooltip>
      )}
    </div>
  );
}
