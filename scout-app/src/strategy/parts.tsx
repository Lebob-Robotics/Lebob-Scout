// Pieces the strategy screens share: cards, loading, tables that sort, range bars, heatmaps, auto paths and the rating chart.
import { useEffect, useId, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import type { ReactNode } from "react";
import type { StartDot } from "../api";
import { FieldPicture } from "../components/FieldPicture";
import { CURRENT_FIELD_KEY, FIELDS, squareName } from "../field";
import { wallPoint } from "../startWall";
import { shade } from "../teamsView";
import { MAPS_NOT_READY } from "./api";
import { hitIndex, matchName, ratingChart } from "./chart";
import { bar, keepShut, likely, nextSort, one, popPlace, rangeText, readShut, sortRows } from "./logic";
import type { Cell, Pts, Sort, SortValue } from "./logic";
import { PATH_COLOURS, asDrawn, averagedAutos, shotMarks, type Auto, type AutoPath } from "./autos";
import type { HistoryPoint } from "./types";
import type { Load } from "./useLoad";

// A card that folds shut from its title row. Open unless this device shut it last time. A change of `openKey`
// opens it (the Event table's breakage button uses this). `control` sits at the right of the title row.
export function Card({ title, id, control, openKey, className, tone, children }: {
  title: string; id?: string; control?: ReactNode; openKey?: number; className?: string; tone?: "red" | "blue"; children: ReactNode;
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
        <h2><button type="button" className="card-toggle" aria-expanded={!shut} onClick={toggle}><span className="chev" aria-hidden="true" />{tone ? <span className={`ally ${tone}`}>{title}</span> : title}</button></h2>
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

// A heatmap on the field picture: red's wall on the left, a shade per square (or, smooth, soft spots that blend into
// each other), start spots as dots. No numbers: hovering a square with a mouse, or tapping it, shows its figures in a
// pop-up; tapping anywhere else closes it. `tone` picks the colour: scoring yellow, pick-ups teal, the overlap orange.
// `overlay` is drawn over the shading in the same 0 to 100 frame (the cycle routes); `children` sit on the field (a
// route's pop-up); `hidePop` hides the square's pop-up while another one shows. `half` shows only the upper half of
// the field (rows 1 to 3), for a map folded onto it.
export function HeatField({ cells, tone, starts = [], label, small = false, smooth = false, overlay, children, hidePop = false, half = false }: {
  cells: Map<string, Cell>; tone: "scored" | "pickedUp" | "both" | "cross"; starts?: StartDot[]; label: string; small?: boolean; smooth?: boolean;
  overlay?: ReactNode; children?: ReactNode; hidePop?: boolean; half?: boolean;
}) {
  const field = FIELDS[CURRENT_FIELD_KEY];
  const gid = `heat${useId().replace(/[^a-zA-Z0-9]/g, "")}`;
  const [open, setOpen] = useState<{ col: number; row: number } | null>(null);
  const wrap = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (e: PointerEvent) => { if (!wrap.current?.contains(e.target as Node)) setOpen(null); };
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, [open]);

  const w = 100 / field.cols, h = 100 / field.rows;
  const rows = half ? field.rows / 2 : field.rows;
  const max = Math.max(0, ...[...cells.values()].map((c) => c.value));
  const at = (i: number) => ({ col: i % field.cols, row: Math.floor(i / field.cols) });
  const value = (col: number, row: number) => cells.get(squareName(col, row))?.value ?? 0;
  const squares = Array.from({ length: field.cols * rows }, (_, i) => {
    const { col, row } = at(i);
    const here = open?.col === col && open.row === row;
    return (
      <rect key={i} className={here ? "on" : undefined} x={col * w} y={row * h} width={w} height={h} fillOpacity={smooth ? 0 : shade(value(col, row), max)}
        onPointerEnter={(e) => { if (e.pointerType === "mouse") setOpen({ col, row }); }}
        onPointerDown={(e) => { if (e.pointerType !== "mouse") setOpen(here ? null : { col, row }); }} />
    );
  });
  const pop = open && popPlace(open.col, open.row, field.cols, rows);
  const name = open && squareName(open.col, open.row);
  const cell = name ? cells.get(name) : undefined;
  return (
    <div ref={wrap} className={small ? "heat small" : "heat"}>
      <div className={half ? "field half" : "field"}>
        <FieldPicture fieldKey={CURRENT_FIELD_KEY} flipped={false} />
        <svg className={`map-overlay ${tone}`} viewBox={`0 0 100 ${rows * h}`} role="img" aria-label={label}
          onPointerLeave={(e) => { if (e.pointerType === "mouse") setOpen(null); }}>
          {smooth && (
            <>
              <defs>
                <radialGradient id={`${gid}g`}><stop offset="0" className="hs-in" /><stop offset="1" className="hs-out" /></radialGradient>
                <clipPath id={`${gid}c`}><rect width="100" height={rows * h} /></clipPath>
              </defs>
              <g clipPath={`url(#${gid}c)`} className="heat-soft">
                {Array.from({ length: field.cols * rows }, (_, i) => {
                  const { col, row } = at(i);
                  const v = value(col, row);
                  return v > 0 && <circle key={i} cx={(col + 0.5) * w} cy={(row + 0.5) * h} r={w * 1.3} fill={`url(#${gid}g)`} opacity={Math.min(1, shade(v, max) * 1.15)} />;
                })}
              </g>
            </>
          )}
          {squares}
          {overlay}
          {!half && starts.map((s, i) => {
            const p = wallPoint(s.wallPos, s.alliance === "blue" ? "blue" : "red");
            return <circle key={i} className={s.alliance} cx={inset(p.x)} cy={inset(p.y)} r="3.5"><title>{s.label}</title></circle>;
          })}
        </svg>
        {pop && !hidePop && (
          <div className={`heat-pop ${pop.below ? "below" : "above"} lean-${pop.lean}`} style={{ left: `${pop.left}%`, top: `${pop.top}%` }} role="status">
            <b>{name}</b>
            {cell ? <dl>{cell.lines.map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}</dl> : <span>Nothing here</span>}
          </div>
        )}
        {children}
      </div>
    </div>
  );
}

// A team's autos on one field: averaged (similar autos merged into one rounded path, "x3") or every path as drawn.
// Points are stored as the scout app draws them (0 to 100 across the grid area, red's wall on the left), so they are
// drawn as stored. Each auto has its own colour: its drive path, the spots a scout marked, and a filled marker on
// each square it shot from, sized and labelled by the count. Start spots from set-up show as alliance dots.
const count = (n: number) => String(Math.round(n * 10) / 10);
export function AutoPaths({ paths, starts = [], averaged }: { paths: AutoPath[]; starts?: StartDot[]; averaged: boolean }) {
  const autos = (averaged ? averagedAutos(paths) : asDrawn(paths)).map((a, i) => ({ ...a, colour: PATH_COLOURS[i % PATH_COLOURS.length] }));
  const marks = shotMarks(autos);
  // Two scouts in one match give two autos with the same label: name each match once, with how many autos merged.
  const name = (a: Auto) => `${[...new Set(a.labels)].join(", ")}${a.labels.length > 1 ? ` x${a.labels.length}` : ""}`;
  return (
    <>
      <div className="heat">
        <div className="field">
          <FieldPicture fieldKey={CURRENT_FIELD_KEY} flipped={false} />
          <svg className="path-overlay" viewBox="0 0 100 100" role="img" aria-label={`${autos.length} auto${autos.length === 1 ? "" : "s"}, with shooting squares and start spots`}>
            {starts.map((s, i) => {
              const p = wallPoint(s.wallPos, s.alliance === "blue" ? "blue" : "red");
              return <circle key={`s${i}`} className={`wall ${s.alliance}`} cx={inset(p.x)} cy={inset(p.y)} r="3"><title>{`Start ${s.label}`}</title></circle>;
            })}
            {autos.map((a, i) => {
              const first = a.lines[0]?.[0] ?? a.dots[0];
              return (
                <g key={i} style={{ color: a.colour }}>
                  {a.lines.map((l, j) => <polyline key={j} points={l.map((q) => q.join(",")).join(" ")} />)}
                  {a.dots.map(([x, y], j) => <circle key={`d${j}`} className="pspot" cx={x} cy={y} r="1.6" />)}
                  {first && <circle className="pstart" cx={first[0]} cy={first[1]} r="2.6"><title>{`${name(a)} (${a.alliance})`}</title></circle>}
                </g>
              );
            })}
            {marks.map((m, i) => (
              <g key={`m${i}`} className="shot" style={{ color: autos[m.auto].colour }}>
                <circle cx={m.x} cy={m.y} r={m.r}><title>{`${name(autos[m.auto])}: ${count(m.count)} from ${m.square}`}</title></circle>
                <text x={m.x} y={m.y}>{count(m.count)}</text>
              </g>
            ))}
          </svg>
        </div>
      </div>
      {autos.length > 0 && (
        <ul className="path-legend">
          {autos.map((a, i) => <li key={i}><span className="swatch" style={{ background: a.colour }} />{name(a)} <span className={`ally ${a.alliance}`}>{a.alliance}</span></li>)}
        </ul>
      )}
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

// Our OPR after each played match: the line over its ± one standard error band (clipped to the plot), round ticks with
// light grid lines, and match labels that never crowd. One surface covers the plot: hovering, tapping or dragging
// anywhere picks the nearest match and shows its figures, so the target is the whole chart at any width. One pop-up
// at a time; a tap elsewhere closes it.
export function RatingChart({ points }: { points: HistoryPoint[] }) {
  const W = 320, H = 170;
  const c = ratingChart(points, W, H);
  const id = `chart${useId().replace(/[^a-zA-Z0-9]/g, "")}`;
  const [open, setOpen] = useState<number | null>(null);
  const wrap = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (open == null) return;
    const close = (e: PointerEvent) => { if (!wrap.current?.contains(e.target as Node)) setOpen(null); };
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, [open]);
  if (!c) return <p className="caption">No played matches yet.</p>;
  const dot = open != null ? c.dots[open] : null;
  // The nearest match to a pointer: its x in the chart's own units, then the strip it falls in.
  const at = (e: ReactPointerEvent<SVGRectElement>) => {
    const svg = e.currentTarget.ownerSVGElement!, m = svg.getScreenCTM();
    const x = m ? new DOMPoint(e.clientX, e.clientY).matrixTransform(m.inverse()).x : 0;
    return hitIndex(c.hits, x);
  };
  const range = dot && likely(dot.point.opr, dot.point.oprSe);
  const lean = dot ? (dot.x < W * 0.3 ? "right" : dot.x > W * 0.7 ? "left" : "middle") : "middle";
  return (
    <div ref={wrap} className="rating-chart-wrap">
      <svg className="rating-chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="OPR after each played match, with one standard error either side"
        onPointerLeave={(e) => { if (e.pointerType === "mouse") setOpen(null); }}>
        <defs><clipPath id={id}><rect x={c.plot.x} y={c.plot.y} width={c.plot.w} height={c.plot.h} /></clipPath></defs>
        {c.ticks.map((t) => (
          <g key={t.label} className="tick">
            <line x1={c.plot.x} x2={c.plot.x + c.plot.w} y1={t.y} y2={t.y} />
            <text x={c.plot.x - 5} y={t.y}>{t.label}</text>
          </g>
        ))}
        <g clipPath={`url(#${id})`}>
          <path className="band" d={c.band} />
          <path className="line" d={c.line} />
        </g>
        {c.dots.map((d, i) => <circle key={i} className={open === i ? "dot on" : "dot"} cx={d.x} cy={d.y} r={open === i ? 4.5 : 3} />)}
        {c.labels.map((l) => <text key={l.text} className="axis" x={l.x} y={H - 6}>{l.text}</text>)}
        <rect className="hit" x={c.plot.x} y={c.plot.y} width={c.plot.w} height={c.plot.h}
          onPointerMove={(e) => { if (e.pointerType === "mouse" || e.buttons) setOpen(at(e)); }}
          onPointerDown={(e) => {
            if (e.pointerType === "mouse") return;
            const i = at(e);
            setOpen(open === i ? null : i);
          }} />
      </svg>
      {dot && (
        <div className={`heat-pop chart-pop ${dot.y < H * 0.4 ? "below" : "above"} lean-${lean}`} style={{ left: `${(dot.x / W) * 100}%`, top: `${(dot.y / H) * 100}%` }} role="status">
          <b>{matchName(dot.point)}</b>
          <dl>
            <div><dt>OPR after</dt><dd>{one(dot.point.opr)}</dd></div>
            <div><dt>Likely</dt><dd>{range ? rangeText(range.low, range.high) : "–"}</dd></div>
            {dot.point.ratingRank != null && <div><dt>OPR rank</dt><dd>{dot.point.ratingRank}</dd></div>}
          </dl>
        </div>
      )}
    </div>
  );
}

// A scouting-first figure: plain when our scouts saw it; in italics, tagged "official", when it is the official
// share (the alliance's score less its scouted partner, or half).
export function PtsFig({ pts, tag = true, round = false }: { pts: Pts | null; tag?: boolean; round?: boolean }) {
  if (!pts) return <>–</>;
  const text = round ? String(Math.round(pts.value)) : one(pts.value);
  if (!pts.official) return <span className="fig" title="Scouted">{text}</span>;
  return <span className="fig model" title="Official share: the alliance's score less its scouted partner, or half. Not scouted">{text}{tag && <small> official</small>}</span>;
}

export const Tiles = ({ tiles }: { tiles: [string, ReactNode][] }) => (
  <dl className="tiles">{tiles.map(([l, v]) => <div key={l}><dt>{l}</dt><dd>{v}</dd></div>)}</dl>
);
