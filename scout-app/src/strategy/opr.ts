// Our own OPR, from this event's official scores only: no starting estimate, nothing made up. Each played alliance
// score is the sum of its robots' OPRs; the fit is least squares, solved on the normal equations by Gaussian
// elimination with partial pivoting. A tiny ridge keeps the sums stable; it is not a prior.
import type { HistoryPoint } from "./types";

export type Played = { label: string; red: number[]; blue: number[]; redScore: number; blueScore: number };
export type Opr = { opr: number; se: number | null };
const RIDGE = 1e-6;
const UNDETERMINED = 1e3;

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

// Every team's OPR from these matches, with its standard error when there are more alliance scores than teams:
// SE = sqrt(RSS / (n − p) × inv(AᵀA)ᵢᵢ). A team in none of them has no OPR. A team the scores cannot tell apart from
// another (two teams that have only ever played together) has no range either: only the tiny ridge holds its figure,
// and inv(AᵀA)ᵢᵢ runs past UNDETERMINED (a normal schedule gives about 1 or less).
export function fitOpr(games: Played[]): Map<number, Opr> {
  const teams = [...new Set(games.flatMap((g) => [...g.red, ...g.blue]))].sort((a, b) => a - b);
  const p = teams.length;
  if (!p) return new Map();
  const col = new Map(teams.map((t, i) => [t, i]));
  const rows = games.flatMap((g) => [{ teams: g.red, score: g.redScore }, { teams: g.blue, score: g.blueScore }]);
  const ata = teams.map(() => new Array<number>(p).fill(0));
  const atb = new Array<number>(p).fill(0);
  rows.forEach((r) => {
    const cs = r.teams.map((t) => col.get(t)!);
    cs.forEach((i) => { atb[i] += r.score; cs.forEach((j) => { ata[i][j] += 1; }); });
  });
  ata.forEach((row, i) => { row[i] += RIDGE; });
  const x = solve(ata, atb);
  const n = rows.length;
  const rss = rows.reduce((s, r) => s + (r.score - r.teams.reduce((a, t) => a + x[col.get(t)!], 0)) ** 2, 0);
  const se = (i: number) => {
    if (n <= p) return null;
    const unit = teams.map((_, k) => (k === i ? 1 : 0));
    const inv = solve(ata, unit)[i];
    return inv > UNDETERMINED ? null : Math.sqrt(Math.max(0, (rss / (n - p)) * inv));
  };
  return new Map(teams.map((t, i) => [t, { opr: x[i], se: se(i) }]));
}

// The OPR after each played match, in time order, refitted on every match up to it: a point for every team fitted so
// far, so a team's line moves as other matches sharpen the fit too. `afterMatch` counts played matches; ratingRank is
// the team's place among everyone fitted so far.
export function oprHistory(games: Played[]): HistoryPoint[] {
  const out: HistoryPoint[] = [];
  games.forEach((g, k) => {
    const fit = fitOpr(games.slice(0, k + 1));
    const order = [...fit].sort((a, b) => b[1].opr - a[1].opr).map(([t]) => t);
    [...fit.keys()].forEach((t) => {
      const f = fit.get(t)!;
      out.push({ teamNumber: t, afterMatch: k + 1, lastMatch: g.label, opr: r1(f.opr), oprSe: f.se == null ? null : r1(f.se), ratingRank: order.indexOf(t) + 1 });
    });
  });
  return out;
}
const r1 = (x: number) => Math.round(x * 10) / 10;
