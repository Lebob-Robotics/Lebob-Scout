// Our own OPR, from official scores only. Each played alliance score is the sum of its robots' OPRs, fitted by least
// squares. One system from before the first match to the last: every team starts from its OPR at its latest earlier
// event this season (that event's scores alone), and this event's scores take over as matches are played.
//
// The weights come from replaying every event of the 2026 season in Foundry (400 events, 8,652 matches, 28 Nov
// 2026), forecasting each qualification from the matches before it:
//   - the carried OPR counts as START_WEIGHT matches' worth of evidence. 1 to 2 forecast best (a flat optimum; 1.5
//     taken); forecasts were better than this event's scores alone at every stage, most of all in the first rounds
//     (in matches where every team had an earlier event, alliance score error 24 against 35 before a team's first
//     match, 19 against 20 at its fifth, and 21 against 28 over the whole event). Events have 5 or 6
//     qualifications a team, so a start still carries about a quarter of the weight at a team's last match.
//   - a team with no earlier event is pulled to this event's average robot, worth NEW_WEIGHT matches.
//   - a team's starting OPR is its OPR at its last earlier event only, fitted on that event's scores alone. Carrying a
//     rating through every event forecast about the same (21.2 against 21.4) and is harder to explain.
// The ± is the fit's own standard error, sqrt(noise² × inv(AᵀA + weights)ᵢᵢ): about 15 points before a team plays,
// 8 after three matches. Replayed, the forecasts' 68% ranges held 72% of real scores and the 95% ranges 94%.
import type { HistoryPoint } from "./types";

export type Played = { label: string; red: number[]; blue: number[]; redScore: number; blueScore: number };
export type Opr = { opr: number; se: number };
// A team's OPR at its latest earlier event, and that event's code.
export type Start = { opr: number; event: string };

export const START_WEIGHT = 1.5;
export const NEW_WEIGHT = 1;
// Match noise (the spread of an alliance score around its robots' OPRs) starts at this share of a typical alliance
// score, counted as NOISE_ROWS alliance scores, and moves to what this event's own scores show.
const NOISE_SHARE = 0.33;
const NOISE_ROWS = 8;

// Solves m x = v (m square) by Gaussian elimination with partial pivoting. m and v are not changed.
export function solve(m: number[][], v: number[]): number[] {
  const n = v.length;
  const a = m.map((row, i) => [...row, v[i]]);
  for (let c = 0; c < n; c++) {
    let p = c;
    for (let r = c + 1; r < n; r++) if (Math.abs(a[r][c]) > Math.abs(a[p][c])) p = r;
    [a[c], a[p]] = [a[p], a[c]];
    const d = a[c][c] || 1e-12;
    for (let r = c + 1; r < n; r++) {
      const f = a[r][c] / d;
      if (f) for (let k = c; k <= n; k++) a[r][k] -= f * a[c][k];
    }
  }
  const x = new Array<number>(n).fill(0);
  for (let r = n - 1; r >= 0; r--) {
    let s = a[r][n];
    for (let k = r + 1; k < n; k++) s -= a[r][k] * x[k];
    x[r] = s / (a[r][r] || 1e-12);
  }
  return x;
}

// The inverse of m (square, positive definite here) by Gauss-Jordan with partial pivoting. m is not changed.
export function invert(m: number[][]): number[][] {
  const n = m.length;
  const a = m.map((row, i) => [...row, ...row.map((_, j) => (i === j ? 1 : 0))]);
  for (let c = 0; c < n; c++) {
    let p = c;
    for (let r = c + 1; r < n; r++) if (Math.abs(a[r][c]) > Math.abs(a[p][c])) p = r;
    [a[c], a[p]] = [a[p], a[c]];
    const d = a[c][c] || 1e-12;
    for (let k = c; k < 2 * n; k++) a[c][k] /= d;
    for (let r = 0; r < n; r++) {
      const f = r === c ? 0 : a[r][c];
      if (f) for (let k = c; k < 2 * n; k++) a[r][k] -= f * a[c][k];
    }
  }
  return a.map((row) => row.slice(n));
}

// Every team's OPR and standard error from these matches and the OPRs carried in. Fitted: every team in a match, and
// every team in `scheduled` that carried an OPR in (so it has a figure before it plays). A team with neither has none.
export function fitOpr(games: Played[], start: Map<number, Start> = new Map(), scheduled: number[] = []): Map<number, Opr> {
  const inGames = new Set(games.flatMap((g) => [...g.red, ...g.blue]));
  const teams = [...new Set([...inGames, ...scheduled.filter((t) => start.has(t))])].sort((a, b) => a - b);
  const p = teams.length;
  if (!p) return new Map();
  const col = new Map(teams.map((t, i) => [t, i]));
  const rows = games.flatMap((g) => [{ teams: g.red, score: g.redScore }, { teams: g.blue, score: g.blueScore }]);
  const n = rows.length;
  const carried = teams.flatMap((t) => (start.has(t) ? [start.get(t)!.opr] : []));
  const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
  // The average robot: half this event's average alliance score, or the average carried OPR before anyone has played.
  const robot = n ? mean(rows.map((r) => r.score)) / 2 : mean(carried);
  const pull = teams.map((t) => (start.has(t) ? { w: START_WEIGHT, to: start.get(t)!.opr } : { w: NEW_WEIGHT, to: robot }));
  const ata = teams.map(() => new Array<number>(p).fill(0));
  const atb = new Array<number>(p).fill(0);
  rows.forEach((r) => {
    const cs = r.teams.map((t) => col.get(t)!);
    cs.forEach((i) => { atb[i] += r.score; cs.forEach((j) => { ata[i][j] += 1; }); });
  });
  pull.forEach(({ w, to }, i) => { ata[i][i] += w; atb[i] += w * to; });
  const inv = invert(ata);
  const x = inv.map((row) => row.reduce((s, v, j) => s + v * atb[j], 0));
  const rss = rows.reduce((s, r) => s + (r.score - r.teams.reduce((a, t) => a + x[col.get(t)!], 0)) ** 2, 0);
  const moved = pull.reduce((s, { w, to }, i) => s + w * (x[i] - to) ** 2, 0);
  const guess = NOISE_SHARE * 2 * Math.max(robot, 5);
  const noise2 = (NOISE_ROWS * guess * guess + rss + moved) / (NOISE_ROWS + n);
  return new Map(teams.map((t, i) => [t, { opr: x[i], se: Math.sqrt(Math.max(0, noise2 * inv[i][i])) }]));
}

// Each team's OPR at its latest earlier event, given the events oldest first: every event is fitted on its own scores
// alone, and a later event replaces an earlier one for the teams that played in it. An event with no scored match
// changes nothing.
export function carryOpr(events: { code: string; games: Played[] }[]): Map<number, Start> {
  const start = new Map<number, Start>();
  events.forEach((e) => {
    if (!e.games.length) return;
    fitOpr(e.games).forEach((f, t) => start.set(t, { opr: f.opr, event: e.code }));
  });
  return start;
}

// The OPR over the event: first what each scheduled team carried in (afterMatch 0, named after that earlier event),
// then after each played match in time order, refitted on every match up to it, so a team's line moves as other
// matches sharpen the fit too. ratingRank is the team's place among everyone fitted so far.
export function oprHistory(games: Played[], start: Map<number, Start> = new Map(), scheduled: number[] = []): HistoryPoint[] {
  const out: HistoryPoint[] = [];
  for (let k = 0; k <= games.length; k++) {
    const fit = fitOpr(games.slice(0, k), start, scheduled);
    const order = [...fit].sort((a, b) => b[1].opr - a[1].opr).map(([t]) => t);
    fit.forEach((f, t) => {
      out.push({ teamNumber: t, afterMatch: k, lastMatch: k ? games[k - 1].label : start.get(t)?.event ?? null, opr: r1(f.opr), oprSe: r1(f.se), ratingRank: order.indexOf(t) + 1 });
    });
  }
  return out;
}
const r1 = (x: number) => Math.round(x * 10) / 10;
