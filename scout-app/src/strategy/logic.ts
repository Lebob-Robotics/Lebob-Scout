// Sums and orderings for the strategy screens. No React here, so each is tested on its own.
import type { TeamProfile } from "../api";
import type { AllianceMap, Forecast, HistoryPoint, MatchMaps, Pick, PointSplit, SquareMap, TeamMap } from "./types";

// Figures as the screens show them: ratings to one decimal, chances as whole percentages, "–" when missing.
export const one = (x: number | null | undefined) => (x == null || !Number.isFinite(x) ? "–" : (Math.round(x * 10) / 10).toFixed(1));
export const pct = (p: number | null | undefined) => (p == null || !Number.isFinite(p) ? "–" : `${Math.round(p * 100)}%`);
export const whole = (x: number | null | undefined) => (x == null || !Number.isFinite(x) ? "–" : String(Math.round(x)));

// The rating's likely range: rating ± 1.28 × standard error, the 80% range. Empty when there is no standard error.
export function rangeText(opr: number, se: number | null): string {
  if (se == null || !Number.isFinite(se)) return "";
  return `${one(opr - 1.28 * se)}–${one(opr + 1.28 * se)}`;
}

// Sort rows by one column. Blanks always go last, whichever way the column is sorted; ties keep their order.
export type SortValue = number | string | null | undefined;
export function sortRows<T>(rows: T[], value: (r: T) => SortValue, dir: "asc" | "desc"): T[] {
  const sign = dir === "asc" ? 1 : -1;
  return rows
    .map((r, i) => ({ r, i, v: value(r) }))
    .sort((a, b) => {
      const ab = a.v == null || a.v === "", bb = b.v == null || b.v === "";
      if (ab || bb) return ab === bb ? a.i - b.i : ab ? 1 : -1;
      const c = typeof a.v === "number" && typeof b.v === "number" ? a.v - b.v : String(a.v).localeCompare(String(b.v));
      return c * sign || a.i - b.i;
    })
    .map((x) => x.r);
}

// A header click: the same column flips direction; a new column starts at its natural direction.
export type Sort<K extends string> = { key: K; dir: "asc" | "desc" };
export const nextSort = <K extends string>(s: Sort<K>, key: K, natural: "asc" | "desc"): Sort<K> =>
  s.key === key ? { key, dir: s.dir === "asc" ? "desc" : "asc" } : { key, dir: natural };

const isQual = (f: { level: string }) => f.level.toLowerCase().startsWith("q");

// Qualification matches by number, then playoffs by series and number.
export function orderForecasts(fs: Forecast[]): Forecast[] {
  return [...fs].sort((a, b) =>
    Number(!isQual(a)) - Number(!isQual(b)) || (isQual(a) ? 0 : (a.series ?? a.number) - (b.series ?? b.number)) || a.number - b.number
    || a.matchUuid.localeCompare(b.matchUuid));
}

// "Q12", "P3". Playoffs whose numbers repeat (the schedule stores many as 1) go by series instead, with the number
// after a dash when a series has more than one match ("P6-2").
export function matchLabels(fs: Forecast[]): Map<string, string> {
  const playoffs = fs.filter((f) => !isQual(f));
  const repeat = new Set(playoffs.map((f) => f.number)).size !== playoffs.length;
  const perSeries = new Map<number, number>();
  playoffs.forEach((f) => { if (f.series != null) perSeries.set(f.series, (perSeries.get(f.series) ?? 0) + 1); });
  return new Map(fs.map((f) => {
    if (isQual(f)) return [f.matchUuid, `Q${f.number}`];
    if (!repeat || f.series == null) return [f.matchUuid, `P${f.number}`];
    return [f.matchUuid, (perSeries.get(f.series) ?? 0) > 1 ? `P${f.series}-${f.number}` : `P${f.series}`];
  }));
}

export type Side = "red" | "blue";
export const sideOf = (f: Forecast, team: number): Side | null => (f.red.includes(team) ? "red" : f.blue.includes(team) ? "blue" : null);
export const winChance = (f: Forecast, side: Side) => (side === "red" ? f.pRed : f.pBlue);

// The Match screen's first match: our next one still to play, else the next to play, else the last.
export function defaultMatch(fs: Forecast[], ourTeam: number): Forecast | null {
  const ordered = orderForecasts(fs);
  return ordered.find((f) => !f.played && sideOf(f, ourTeam)) ?? ordered.find((f) => !f.played) ?? ordered.at(-1) ?? null;
}

// Our next match still to play, or null.
export const nextOurs = (fs: Forecast[], ourTeam: number) => orderForecasts(fs).find((f) => !f.played && sideOf(f, ourTeam)) ?? null;

// Whether the side favoured before the match won it. The model's own answer when it gives one.
export function favouriteWon(f: Forecast): boolean | null {
  if (!f.played || f.redActual == null || f.blueActual == null) return null;
  if (f.preHit != null) return f.preHit;
  const pRed = f.prePRed ?? f.pRed, pBlue = f.prePBlue ?? f.pBlue;
  if (pRed == null || pBlue == null || pRed === pBlue) return null;
  return pRed > pBlue ? f.redActual > f.blueActual : f.blueActual > f.redActual;
}

// Each played match's split points by team, for the match lists.
export function splitsByMatch(splits: PointSplit[]): Map<string, Map<number, number>> {
  const out = new Map<string, Map<number, number>>();
  splits.forEach((s) => {
    const m = out.get(s.matchUuid) ?? new Map<number, number>();
    m.set(s.teamNumber, s.points);
    out.set(s.matchUuid, m);
  });
  return out;
}

// A forecast's four robots, red then blue, with their split points when the match has them.
export type Robot = { team: number; name: string; side: Side; points: number | null };
export function robotsOf(f: Forecast, split?: Map<number, number>): Robot[] {
  const at = (team: number) => split?.get(team) ?? null;
  return [
    ...f.red.map((team, i) => ({ team, name: f.redNames[i], side: "red" as const, points: at(team) })),
    ...f.blue.map((team, i) => ({ team, name: f.blueNames[i], side: "blue" as const, points: at(team) })),
  ];
}

// A team's partners when it picks, best chance of winning the event first.
export function partnersFor(picks: Pick[], team: number): Pick[] {
  return sortRows(picks.filter((p) => p.teamNumber === team), (p) => p.pWinEvent, "desc");
}

// The rating history chart: the rating line and its ± one standard error band, scaled into a w × h box with a margin
// for the axis labels. Points in match order.
export type Chart = { line: string; band: string; yMin: number; yMax: number; xMin: number; xMax: number; dots: { x: number; y: number }[] };
export function historyChart(points: HistoryPoint[], w: number, h: number, pad = { left: 30, right: 8, top: 8, bottom: 18 }): Chart | null {
  const ps = [...points].sort((a, b) => a.afterMatch - b.afterMatch);
  if (!ps.length) return null;
  const lo = (p: HistoryPoint) => p.opr - (p.oprSe ?? 0), hi = (p: HistoryPoint) => p.opr + (p.oprSe ?? 0);
  let yMin = Math.min(...ps.map(lo)), yMax = Math.max(...ps.map(hi));
  if (yMax - yMin < 1) { yMin -= 1; yMax += 1; }
  const xMin = ps[0].afterMatch, xMax = ps.at(-1)!.afterMatch;
  const x = (v: number) => pad.left + (xMax === xMin ? 0.5 : (v - xMin) / (xMax - xMin)) * (w - pad.left - pad.right);
  const y = (v: number) => pad.top + (1 - (v - yMin) / (yMax - yMin)) * (h - pad.top - pad.bottom);
  const r = (v: number) => Math.round(v * 10) / 10;
  const path = (xs: [number, number][]) => xs.map(([a, b], i) => `${i ? "L" : "M"}${r(a)} ${r(b)}`).join(" ");
  const dots = ps.map((p) => ({ x: r(x(p.afterMatch)), y: r(y(p.opr)) }));
  return {
    line: path(ps.map((p) => [x(p.afterMatch), y(p.opr)])),
    band: `${path([...ps.map((p): [number, number] => [x(p.afterMatch), y(hi(p))]), ...[...ps].reverse().map((p): [number, number] => [x(p.afterMatch), y(lo(p))])])} Z`,
    yMin, yMax, xMin, xMax, dots,
  };
}

// The figure a heatmap shows for each square.
export type Measure = "auto" | "teleop" | "scored" | "pickedUp";
export const measureOf = (s: SquareMap, m: Measure) =>
  m === "auto" ? s.autoScored : m === "teleop" ? s.teleopScored : m === "scored" ? s.autoScored + s.teleopScored : s.pickedUp;
export const squareValues = (squares: SquareMap[], m: Measure) => new Map(squares.map((s) => [s.square, measureOf(s, m)]));

// The same sums as the matchMaps function (scout-functions/src/teams/maps.ts), for the dev stand-in: each alliance's
// robots added square by square, and the overlap scored by the smaller of the two alliances' use of a square.
const round2 = (x: number) => Math.round(x * 100) / 100;
export function addMaps(maps: TeamMap[]): SquareMap[] {
  const total = new Map<string, SquareMap>();
  maps.flatMap((m) => m.squares).forEach((s) => {
    const t = total.get(s.square) ?? { square: s.square, autoScored: 0, teleopScored: 0, pickedUp: 0 };
    total.set(s.square, {
      square: s.square, autoScored: round2(t.autoScored + s.autoScored), teleopScored: round2(t.teleopScored + s.teleopScored),
      pickedUp: round2(t.pickedUp + s.pickedUp),
    });
  });
  return [...total.values()].sort((a, b) => a.square.localeCompare(b.square));
}
const use = (s: SquareMap) => s.autoScored + s.teleopScored + s.pickedUp;
export function buildMatchMaps(matchUuid: string, label: string, red: number[], blue: number[], maps: TeamMap[]): MatchMaps {
  const byTeam = new Map(maps.map((m) => [m.teamNumber, m]));
  const side = (teams: number[]): AllianceMap => {
    const robots = teams.map((t) => byTeam.get(t) ?? { teamNumber: t, matches: 0, squares: [] });
    return { robots, squares: addMaps(robots) };
  };
  const r = side(red), b = side(blue);
  const blueUse = new Map(b.squares.map((s) => [s.square, use(s)]));
  const overlap = r.squares
    .filter((s) => blueUse.has(s.square))
    .map((s) => ({ square: s.square, red: round2(use(s)), blue: round2(blueUse.get(s.square)!), both: round2(Math.min(use(s), blueUse.get(s.square)!)) }))
    .filter((o) => o.both > 0)
    .sort((x, y) => y.both - x.both || x.square.localeCompare(y.square));
  return { matchUuid, label, red: r, blue: b, overlap };
}

// The first figure the model gives for the ranking score needed for 1st, 4th and 8th (the same on every row).
export function rsNeeded<T extends { rsNeededRank1: number | null; rsNeededRank4: number | null; rsNeededRank8: number | null }>(rows: T[]) {
  const first = (k: keyof T) => rows.map((r) => r[k] as number | null).find((v) => v != null) ?? null;
  return { rank1: first("rsNeededRank1"), rank4: first("rsNeededRank4"), rank8: first("rsNeededRank8") };
}

// Matches played and in all: from the forecasts, or from the schedule when there are none.
export function playedCount(fs: Forecast[], matches: { actualTime: string | null }[]): { played: number; total: number } {
  if (fs.length) return { played: fs.filter((f) => f.played).length, total: fs.length };
  return { played: matches.filter((m) => m.actualTime).length, total: matches.length };
}

const oneFig = (x: number) => String(Math.round(x * 10) / 10);
const maybe = (x: number | undefined, unit = "") => (x == null ? "–" : oneFig(x) + unit);
// The Teams tab's figures for a team, as its profile tiles show them.
export const scoutTiles = (t: TeamProfile): [string, string][] => [
  ["points / match", String(Math.round(t.points))],
  ["auto pts", oneFig(t.autoPoints)],
  ["teleop pts", oneFig(t.teleopPoints)],
  ["park pts", oneFig(t.parkPoints)],
  ["cycles", oneFig(t.cycles)],
  ["cycle time", maybe(t.cycleSeconds, "s")],
  ["driver 1-5", maybe(t.driverSkill)],
  ["speed 1-5", maybe(t.robotSpeed)],
  ["matches", String(t.matches)],
];
