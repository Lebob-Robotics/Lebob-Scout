// Pieces the strategy screens share: cards, loading, tables that sort, range bars, heatmaps, auto paths and the rating chart.
import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import type { StartDot } from "../api";
import { splitPath } from "../autoPath";
import { FieldPicture } from "../components/FieldPicture";
import { CURRENT_FIELD_KEY, FIELDS, squareName } from "../field";
import { wallPoint } from "../startWall";
import { shade } from "../teamsView";
import { MAPS_NOT_READY } from "./api";
import { bar, historyChart, keepShut, nextSort, one, popPlace, readShut, sortRows } from "./logic";
import type { Cell, Sort, SortValue } from "./logic";
import type { HistoryPoint } from "./types";
import type { Load } from "./useLoad";

// A card that folds shut from its title row. Open unless this device shut it last time. A change of `openKey`
// opens it (the Event table's breakage button uses this). `control` sits at the right of the title row.
export function Card({ title, id, control, openKey, className, children }: {
  title: string; id?: string; control?: ReactNode; openKey?: number; className?: string; children: ReactNode;
}) {
  const [shut, setShut] = useState(() => readShut(title));
  const [seen, setSeen] = useState(openKey);
  if (openKey !== seen) {
    setSeen(openKey);
    setShut(false);
  }
  const toggle = () => { keepShut(title, !shut); setShut(!shut); };
  return (
    <section className={["card", "scard", shut && "shut", className].filter(Boolean).join(" ")} id={id}>
      <div className="card-head">
        <h2><button type="button" className="card-toggle" aria-expanded={!shut} onClick={toggle}><span className="chev" aria-hidden="true" />{title}</button></h2>
        {control && <div className="card-control">{control}</div>}
      </div>
      {!shut && children}
    </section>
  );
}

// What shows in place of something that is loading or failed. The maps and splits say plainly when they are not
// switched on yet; anything else offers Retry.
export function Waiting({ load, what, retry }: { load: Load<unknown>; what: string; retry(): void }) {
  if (load.state === "loading") return <p>Loading…</p>;
  if (load.state === "failed" && load.why === MAPS_NOT_READY) return <p className="caption">{MAPS_NOT_READY}</p>;
  return <p>Couldn't load {what}. <button type="button" onClick={retry}>Retry</button></p>;
}

// A table whose headers sort it. Blanks always sort last.
export type Col<T> = { key: string; label: ReactNode; title?: string; value(r: T): SortValue; show?(r: T): ReactNode; natural?: "asc" | "desc"; num?: boolean };
export function SortTable<T>({ rows, cols, initial, rowKey, onRow, label }: {
  rows: T[]; cols: Col<T>[]; initial: Sort<string>; rowKey(r: T): string | number; onRow?(r: T): void; label: string;
}) {
  const [sort, setSort] = useState(initial);
  const col = cols.find((c) => c.key === sort.key) ?? cols[0];
  const sorted = sortRows(rows, col.value, sort.dir);
  return (
    <div className="table-wrap">
      <table className="stable" aria-label={label}>
        <thead>
          <tr>
            {cols.map((c) => (
              <th key={c.key} className={c.num ? "num" : undefined} aria-sort={c.key === sort.key ? (sort.dir === "asc" ? "ascending" : "descending") : undefined}>
                <button type="button" title={c.title} onClick={() => setSort(nextSort(sort, c.key, c.natural ?? "desc"))}>
                  {c.label}{c.key === sort.key ? (sort.dir === "asc" ? " ▲" : " ▼") : ""}
                </button>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sorted.map((r) => (
            <tr key={rowKey(r)} className={onRow ? "pick" : undefined} onClick={onRow && (() => onRow(r))}>
              {cols.map((c) => <td key={c.key} className={c.num ? "num" : undefined}>{c.show ? c.show(r) : c.value(r)}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// A team's number and name; a button when it opens the team. The number turns yellow on hover and focus.
export function TeamName({ team, name, onOpen }: { team: number; name?: string; onOpen?(team: number): void }) {
  const body = <><b>{team}</b>{name && <span>{name}</span>}</>;
  return onOpen
    ? <button type="button" className="team-link" onClick={(e) => { e.stopPropagation(); onOpen(team); }}>{body}</button>
    : <span className="team-link">{body}</span>;
}

// A figure with its range bar: the value, then a track from 0 to the column's max with a band from low to high and
// a marker at the value. Grey for a fallback figure.
export function RangeBar({ value, low, high, max, title, grey = false }: { value: number; low: number; high: number; max: number; title: string; grey?: boolean }) {
  const b = bar(value, low, high, max);
  return (
    <span className={grey ? "rcell grey" : "rcell"} title={title}>
      <span className="rval">{one(value)}</span>
      <span className="rbar" aria-hidden="true">
        <span className="rbar-band" style={{ left: `${b.left}%`, width: `${b.width}%` }} />
        <span className="rbar-mark" style={{ left: `${b.at}%` }} />
      </span>
    </span>
  );
}

// The breakage button: a warning sign and the count; opens the team's Breakages card.
export function BreakButton({ count, onOpen }: { count: number; onOpen(): void }) {
  return (
    <button type="button" className="break-btn" aria-label={`${count} breakage${count === 1 ? "" : "s"}, open`} title="Breakages"
      onClick={(e) => { e.stopPropagation(); onOpen(); }}>
      <BreakIcon />{count}
    </button>
  );
}
export const BreakIcon = () => (
  <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true">
    <path d="M8 1.5 15 14H1Z" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
    <path d="M8 6v4.2M8 11.6v1.2" stroke="currentColor" strokeWidth="1.6" />
  </svg>
);

const EDGE = 0.02;
const inset = (c: number) => (EDGE + c * (1 - 2 * EDGE)) * 100;

// A heatmap on the field picture: red's wall on the left, a shaded square per value, start spots as dots. No numbers:
// hovering a square with a mouse, or tapping it, shows its figures in a pop-up; tapping anywhere else closes it.
// `tone` picks the colour: scoring yellow, pick-ups teal, the overlap orange.
export function HeatField({ cells, tone, starts = [], label, small = false }: {
  cells: Map<string, Cell>; tone: "scored" | "pickedUp" | "both"; starts?: StartDot[]; label: string; small?: boolean;
}) {
  const field = FIELDS[CURRENT_FIELD_KEY];
  const [open, setOpen] = useState<{ col: number; row: number } | null>(null);
  const wrap = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (e: PointerEvent) => { if (!wrap.current?.contains(e.target as Node)) setOpen(null); };
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, [open]);

  const w = 100 / field.cols, h = 100 / field.rows;
  const max = Math.max(0, ...[...cells.values()].map((c) => c.value));
  const squares = Array.from({ length: field.cols * field.rows }, (_, i) => {
    const col = i % field.cols, row = Math.floor(i / field.cols);
    const v = cells.get(squareName(col, row))?.value ?? 0;
    const here = open?.col === col && open.row === row;
    return (
      <rect key={i} className={here ? "on" : undefined} x={col * w} y={row * h} width={w} height={h} fillOpacity={shade(v, max)}
        onPointerEnter={(e) => { if (e.pointerType === "mouse") setOpen({ col, row }); }}
        onPointerDown={(e) => { if (e.pointerType !== "mouse") setOpen(here ? null : { col, row }); }} />
    );
  });
  const pop = open && popPlace(open.col, open.row, field.cols, field.rows);
  const name = open && squareName(open.col, open.row);
  const cell = name ? cells.get(name) : undefined;
  return (
    <div ref={wrap} className={small ? "heat small" : "heat"}>
      <div className="field">
        <FieldPicture fieldKey={CURRENT_FIELD_KEY} flipped={false} />
        <svg className={`map-overlay ${tone}`} viewBox="0 0 100 100" role="img" aria-label={label}
          onPointerLeave={(e) => { if (e.pointerType === "mouse") setOpen(null); }}>
          {squares}
          {starts.map((s, i) => {
            const p = wallPoint(s.wallPos, s.alliance === "blue" ? "blue" : "red");
            return <circle key={i} className={s.alliance} cx={inset(p.x)} cy={inset(p.y)} r="3.5"><title>{s.label}</title></circle>;
          })}
        </svg>
        {pop && (
          <div className={`heat-pop ${pop.below ? "below" : "above"} lean-${pop.lean}`} style={{ left: `${pop.left}%`, top: `${pop.top}%` }} role="status">
            <b>{name}</b>
            {cell ? <dl>{cell.lines.map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}</dl> : <span>Nothing here</span>}
          </div>
        )}
      </div>
    </div>
  );
}

// Every auto path a team's scouts drew, on one field. Points are stored as the scout app draws them: 0 to 100 across
// the grid area, red's wall on the left, whatever the alliance, so they are drawn as stored. Lines are drive paths,
// single points are shooting spots; each match has its own colour and its start dot names the match on hover.
const PATH_COLOURS = ["#fde68a", "#a5f3fc", "#f9a8d4", "#bbf7d0", "#c4b5fd", "#fed7aa", "#e5e7eb"];
export function AutoPaths({ paths }: { paths: { label: string; alliance: string; points: string }[] }) {
  const drawn = paths.map((p, i) => ({ ...p, colour: PATH_COLOURS[i % PATH_COLOURS.length], ...splitPath(p.points) }));
  return (
    <>
      <div className="heat">
        <div className="field">
          <FieldPicture fieldKey={CURRENT_FIELD_KEY} flipped={false} />
          <svg className="path-overlay" viewBox="0 0 100 100" role="img" aria-label={`${paths.length} auto paths`}>
            {drawn.map((p, i) => {
              const first = p.lines[0]?.[0] ?? p.dots[0];
              return (
                <g key={i} style={{ color: p.colour }}>
                  {p.lines.map((l, j) => <polyline key={j} points={l.map((q) => q.join(",")).join(" ")} />)}
                  {p.dots.map(([x, y], j) => <circle key={`d${j}`} className="pspot" cx={x} cy={y} r="1.6" />)}
                  {first && <circle className="pstart" cx={first[0]} cy={first[1]} r="2.6"><title>{`${p.label} (${p.alliance})`}</title></circle>}
                </g>
              );
            })}
          </svg>
        </div>
      </div>
      <ul className="path-legend">
        {drawn.map((p, i) => <li key={i}><span className="swatch" style={{ background: p.colour }} />{p.label} <span className={`alliance ${p.alliance}`}>{p.alliance}</span></li>)}
      </ul>
    </>
  );
}

// A row of small switch buttons for a card's title row.
export function Switch<K extends string>({ value, options, onChange, label }: { value: K; options: [K, string][]; onChange(k: NoInfer<K>): void; label: string }) {
  return (
    <div className="mini-seg" role="group" aria-label={label}>
      {options.map(([k, l]) => <button key={k} type="button" aria-pressed={value === k} onClick={() => onChange(k)}>{l}</button>)}
    </div>
  );
}

// The rating after each match, with its ± one standard error band.
export function RatingChart({ points }: { points: HistoryPoint[] }) {
  const W = 320, H = 140;
  const c = historyChart(points, W, H);
  if (!c) return <p className="caption">No rating history yet.</p>;
  return (
    <svg className="rating-chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Rating after each match, with one standard error either side">
      <path className="band" d={c.band} />
      <path className="line" d={c.line} />
      {c.dots.map((d, i) => <circle key={i} cx={d.x} cy={d.y} r="2.5" />)}
      <text x="26" y="12" className="axis to-right">{one(c.yMax)}</text>
      <text x="26" y={H - 20} className="axis to-right">{one(c.yMin)}</text>
      <text x="30" y={H - 4} className="axis">Q{c.xMin}</text>
      <text x={W - 8} y={H - 4} className="axis to-right">Q{c.xMax}</text>
    </svg>
  );
}

export const Tiles = ({ tiles }: { tiles: [string, ReactNode][] }) => (
  <dl className="tiles">{tiles.map(([l, v]) => <div key={l}><dt>{l}</dt><dd>{v}</dd></div>)}</dl>
);
