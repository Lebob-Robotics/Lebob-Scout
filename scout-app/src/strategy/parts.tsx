// Pieces the strategy screens share: loading, tables that sort, the heatmap field and the rating chart.
import { useState } from "react";
import type { ReactNode } from "react";
import type { StartDot } from "../api";
import { FieldPicture } from "../components/FieldPicture";
import { CURRENT_FIELD_KEY, FIELDS, squareName } from "../field";
import { wallPoint } from "../startWall";
import { shade } from "../teamsView";
import { MAPS_NOT_READY } from "./api";
import { historyChart, nextSort, one, sortRows } from "./logic";
import type { Sort, SortValue } from "./logic";
import type { HistoryPoint } from "./types";
import type { Load } from "./useLoad";

// What shows in place of something that is loading or failed. The maps and splits say plainly when they are not
// switched on yet; anything else offers Retry.
export function Waiting({ load, what, retry }: { load: Load<unknown>; what: string; retry(): void }) {
  if (load.state === "loading") return <p>Loading…</p>;
  if (load.state === "failed" && load.why === MAPS_NOT_READY) return <p className="caption">{MAPS_NOT_READY}</p>;
  return <p>Couldn't load {what}. <button type="button" onClick={retry}>Retry</button></p>;
}

// A table whose headers sort it. Blanks always sort last.
export type Col<T> = { key: string; label: string; title?: string; value(r: T): SortValue; show?(r: T): ReactNode; natural?: "asc" | "desc"; num?: boolean };
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

// A team's number and name; a button when it opens the team.
export function TeamName({ team, name, onOpen }: { team: number; name?: string; onOpen?(team: number): void }) {
  const body = <><b>{team}</b>{name && <span>{name}</span>}</>;
  return onOpen
    ? <button type="button" className="team-link" onClick={(e) => { e.stopPropagation(); onOpen(team); }}>{body}</button>
    : <span className="team-link">{body}</span>;
}

const EDGE = 0.02;
const inset = (c: number) => (EDGE + c * (1 - 2 * EDGE)) * 100;

// A heatmap on the field picture, drawn as the Teams tab's profile map: red's wall on the left, a shaded square per
// value, start spots as dots. `tone` picks the colour: scoring yellow, pick-ups teal, the overlap orange.
export function HeatField({ values, tone, starts = [], label, small = false }: {
  values: Map<string, number>; tone: "scored" | "pickedUp" | "both"; starts?: StartDot[]; label: string; small?: boolean;
}) {
  const field = FIELDS[CURRENT_FIELD_KEY];
  const w = 100 / field.cols, h = 100 / field.rows;
  const max = Math.max(0, ...values.values());
  const cells = [];
  for (let row = 0; row < field.rows; row++) {
    for (let col = 0; col < field.cols; col++) {
      const v = Math.round((values.get(squareName(col, row)) ?? 0) * 10) / 10;
      cells.push(
        <g key={`${col}-${row}`}>
          <rect x={col * w} y={row * h} width={w} height={h} fillOpacity={shade(v, max)} />
          {v > 0 && <text x={(col + 0.5) * w} y={(row + 0.5) * h}>{v}</text>}
        </g>,
      );
    }
  }
  return (
    <div className={small ? "heat small" : "heat"}>
      <div className="field">
        <FieldPicture fieldKey={CURRENT_FIELD_KEY} flipped={false} />
        <svg className={`map-overlay ${tone}`} viewBox="0 0 100 100" role="img" aria-label={label}>
          {cells}
          {starts.map((s, i) => {
            const p = wallPoint(s.wallPos, s.alliance === "blue" ? "blue" : "red");
            return <circle key={i} className={s.alliance} cx={inset(p.x)} cy={inset(p.y)} r="3.5"><title>{s.label}</title></circle>;
          })}
        </svg>
      </div>
    </div>
  );
}

// A row of switch buttons, as the profile map's.
export function Switch<K extends string>({ value, options, onChange }: { value: K; options: [K, string][]; onChange(k: NoInfer<K>): void }) {
  return (
    <div className="map-switch" style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}>
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
    <svg className="rating-chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Rating after each match">
      <path className="band" d={c.band} />
      <path className="line" d={c.line} />
      {c.dots.map((d, i) => <circle key={i} cx={d.x} cy={d.y} r="2.5" />)}
      <text x="26" y="12" className="axis end">{one(c.yMax)}</text>
      <text x="26" y={H - 20} className="axis end">{one(c.yMin)}</text>
      <text x="30" y={H - 4} className="axis">Q{c.xMin}</text>
      <text x={W - 8} y={H - 4} className="axis end">Q{c.xMax}</text>
    </svg>
  );
}

export const Tiles = ({ tiles }: { tiles: [string, ReactNode][] }) => (
  <dl className="tiles">{tiles.map(([l, v]) => <div key={l}><dt>{l}</dt><dd>{v}</dd></div>)}</dl>
);
