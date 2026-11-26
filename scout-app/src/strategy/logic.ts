// Sums and orderings for the strategy screens. No React here, so each is tested on its own.
import type { TeamProfile } from "../api";
import type { AllianceMap, Forecast, HistoryPoint, MatchMaps, Pick, PointSplit, Projection, Rating, SquareMap, SquareOverlap, TeamMap } from "./types";

// Figures as the screens show them: ratings to one decimal, chances as whole percentages, "–" when missing.
export const one = (x: number | null | undefined) => (x == null || !Number.isFinite(x) ? "–" : (Math.round(x * 10) / 10).toFixed(1));
export const pct = (p: number | null | undefined) => (p == null || !Number.isFinite(p) ? "–" : `${Math.round(p * 100)}%`);
export const whole = (x: number | null | undefined) => (x == null || !Number.isFinite(x) ? "–" : String(Math.round(x)));

// The rating's likely range: rating ± 1.28 × standard error, the 80% range. Null when there is no standard error.
export function likely(opr: number, se: number | null): { low: number; high: number } | null {
  if (se == null || !Number.isFinite(se)) return null;
  return { low: opr - 1.28 * se, high: opr + 1.28 * se };
}
export const rangeText = (low: number, high: number) => `${one(low)} to ${one(high)}`;

// A range bar: a band from low to high and a marker at the value, as shares (0 to 100) of a track from 0 to max.
// Every bar in a column shares one max, so they compare. Values outside the track sit at its ends.
export function bar(value: number, low: number, high: number, max: number): { left: number; width: number; at: number } {
  const p = (v: number) => (max > 0 ? Math.max(0, Math.min(100, (v / max) * 100)) : 0);
  const l = p(Math.min(low, high)), h = p(Math.max(low, high));
  return { left: l, width: h - l, at: p(value) };
}
// A column's track length: the largest high end, never 0.
export const scaleMax = (highs: number[]) => Math.max(0, ...highs.filter(Number.isFinite)) || 1;

// Points per match for a team: what our scouts saw (with the lowest and highest scouted match), or, when nobody
// scouted it, its official points share (the point split) averaged over its played matches. Null when neither.
export type Figure = { value: number; low: number; high: number; official: boolean };
export function pointsFigure(profile: { matches: number; points: number; pointsLow?: number; pointsHigh?: number } | undefined, shares: number[]): Figure | null {
  if (profile && profile.matches > 0) {
    return { value: profile.points, low: profile.pointsLow ?? profile.points, high: profile.pointsHigh ?? profile.points, official: false };
  }
  if (!shares.length) return null;
  return { value: shares.reduce((a, b) => a + b, 0) / shares.length, low: Math.min(...shares), high: Math.max(...shares), official: true };
}
// The hover text for a points bar.
export const pointsTitle = (f: Figure) => (f.official ? "Official points share (not scouted)" : `${rangeText(f.low, f.high)} scouted`);

// TIPS per match from the model's HIVE rating (20 points a TIP).
export const tipsPerMatch = (hiveRating: number | null) => (hiveRating == null ? null : hiveRating / 20);

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
type Pick2<T, K extends keyof T> = { [P in K]: T[P] };

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

// Scouting first: a figure our scouts saw, or the model's when they saw none (marked `model`).
export type Pts = { value: number; model: boolean };
export function scoutingFirst(scouted: number | null | undefined, model: number | null | undefined): Pts | null {
  if (scouted != null && Number.isFinite(scouted)) return { value: scouted, model: false };
  if (model != null && Number.isFinite(model)) return { value: model, model: true };
  return null;
}

// A team's scouted points in one match (its scouts averaged first, from the Teams tab), found by match type and
// number; null when nobody scouted it there.
type MatchPoints = { matchType: string; matchNumber: number; points: number }[] | undefined;
export function scoutedMatchPoints(matchPoints: MatchPoints, f: Pick2<Forecast, "level" | "number">): number | null {
  const type = isQual(f) ? "qualification" : "playoff";
  return matchPoints?.find((m) => m.matchType === type && m.matchNumber === f.number)?.points ?? null;
}

// A forecast's four robots, red then blue, each with its points in that match: scouted when we have them, else its
// rating share of the alliance's score (the point split).
export type Robot = { team: number; name: string; side: Side; points: Pts | null };
export function robotsOf(f: Forecast, split?: Map<number, number>, scouted: (team: number) => number | null = () => null): Robot[] {
  const at = (team: number) => scoutingFirst(scouted(team), split?.get(team));
  return [
    ...f.red.map((team, i) => ({ team, name: f.redNames[i], side: "red" as const, points: at(team) })),
    ...f.blue.map((team, i) => ({ team, name: f.blueNames[i], side: "blue" as const, points: at(team) })),
  ];
}

// An alliance's scouted points per match: its robots' scouted figures added, with the low and high ends added too.
// Null unless every robot on it has been scouted.
type Scouted = { matches: number; points: number; pointsLow?: number; pointsHigh?: number } | undefined;
export function scoutedTotal(robots: Scouted[]): { value: number; low: number; high: number } | null {
  if (!robots.length || robots.some((r) => !r || !r.matches)) return null;
  const sum = (f: (r: NonNullable<Scouted>) => number) => robots.reduce((a, r) => a + f(r!), 0);
  return { value: sum((r) => r.points), low: sum((r) => r.pointsLow ?? r.points), high: sum((r) => r.pointsHigh ?? r.points) };
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

// What a heatmap draws: per square, how strongly to shade it and the lines its pop-up shows.
export type Cell = { value: number; lines: [string, string][] };
const fig2 = (x: number) => String(Math.round(x * 100) / 100);
export const teamCells = (squares: SquareMap[], m: Measure): Map<string, Cell> => new Map(squares.map((s) => [s.square, {
  value: measureOf(s, m),
  lines: [["Auto scored", fig2(s.autoScored)], ["Teleop scored", fig2(s.teleopScored)], ["Picked up", fig2(s.pickedUp)]],
}]));
export const overlapCells = (overlap: SquareOverlap[]): Map<string, Cell> => new Map(overlap.map((o) => [o.square, {
  value: o.both, lines: [["Red use", fig2(o.red)], ["Blue use", fig2(o.blue)], ["Both", fig2(o.both)]],
}]));

// Where a square's pop-up sits on the field: at the square's centre (as shares of the whole picture, whose grid is the
// middle 75%), above it unless the square is in the top two rows, and leaning inwards near the side walls so it stays
// on the picture.
export function popPlace(col: number, row: number, cols: number, rows: number) {
  return {
    left: 12.5 + ((col + 0.5) / cols) * 75,
    top: ((row + 0.5) / rows) * 100,
    below: row < 2,
    lean: col < 2 ? "right" : col >= cols - 2 ? "left" : "middle",
  } as const;
}

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

// The scouting card's other figures: how often it left its start, parked, fouled and broke down.
export const scoutMoreTiles = (t: TeamProfile): [string, string][] => [
  ["left start in auto", pct(t.leaveRate)],
  ["parked in auto", pct(t.autoParkRate)],
  ["parked at end", pct(t.teleopParkRate)],
  ["minor fouls / match", one(t.minorFouls)],
  ["major fouls / match", one(t.majorFouls)],
  ["broke down", `${t.brokeDownMatches} of ${t.matches}`],
];

// Each card's open or shut state, kept on this device. Storage may be missing or refuse: then cards start open.
type Store = Pick2<Storage, "getItem" | "setItem" | "removeItem">;
export const cardKey = (title: string) => `lsa:card:${title}`;
export function readShut(title: string, store: () => Store = () => localStorage): boolean {
  try { return store().getItem(cardKey(title)) === "1"; } catch { return false; }
}
export function keepShut(title: string, shut: boolean, store: () => Store = () => localStorage): void {
  try {
    if (shut) store().setItem(cardKey(title), "1");
    else store().removeItem(cardKey(title));
  } catch { /* open again next time */ }
}

// The Event tab's ratings table: rating with its likely range, points per match, real rank and breakages.
export type RatingRow = {
  teamNumber: number; teamName: string; opr: number; low: number; high: number; rankNow: number | null; points: Figure | null; breakages: number;
};
export function ratingRows(
  ratings: Rating[], projections: Projection[], profile: (team: number) => { breakages: unknown[] } | undefined, points: (team: number) => Figure | null,
): RatingRow[] {
  const rank = new Map(projections.map((p) => [p.teamNumber, p.rankNow]));
  return ratings.map((r) => {
    const range = likely(r.opr, r.oprSe);
    return {
      teamNumber: r.teamNumber, teamName: r.teamName, opr: r.opr, low: range?.low ?? r.opr, high: range?.high ?? r.opr,
      rankNow: rank.get(r.teamNumber) ?? null, points: points(r.teamNumber), breakages: profile(r.teamNumber)?.breakages.length ?? 0,
    };
  });
}

// Each team's point-split points over its played matches.
export function sharesByTeam(splits: PointSplit[]): Map<number, number[]> {
  const out = new Map<number, number[]>();
  splits.forEach((s) => out.set(s.teamNumber, [...(out.get(s.teamNumber) ?? []), s.points]));
  return out;
}
