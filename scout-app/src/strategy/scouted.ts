// Forecasts from our scouting, never the rating. A team's strength is its scouted points per match, or, when nobody
// scouted it, its official share of its alliances' scores. Win chances, expected scores and RP all come from these.
import type { Forecast, Projection } from "./types";

// A match from the schedule with its official result (Match and Presence objects; no model).
export type Game = {
  matchUuid: string; level: "qual" | "playoff"; number: number; time: string | null;
  red: [number, number]; blue: [number, number]; redScore: number | null; blueScore: number | null;
};
export const isPlayed = (g: Game) => g.redScore != null && g.blueScore != null;
export const label = (g: Game) => `${g.level === "qual" ? "Q" : "P"}${g.number}`;

type MatchPoints = { matchType: string; matchNumber: number; points: number }[];
export type Scouting = { matches: number; points: number; matchPoints?: MatchPoints } | undefined;
export type Strength = { mean: number; sd: number; source: "scouted" | "official" };

export const DEFAULT_SPREAD = 15;
const r1 = (x: number) => Math.round(x * 10) / 10;
const r2 = (x: number) => Math.round(x * 100) / 100;

// The standard normal's cumulative chance (Abramowitz and Stegun 7.1.26).
export function phi(z: number): number {
  if (z === Infinity) return 1;
  if (z === -Infinity) return 0;
  const t = 1 / (1 + 0.3275911 * Math.abs(z) / Math.SQRT2);
  const e = 1 - t * (0.254829592 + t * (-0.284496736 + t * (1.421413741 + t * (-1.453152027 + t * 1.061405429)))) * Math.exp(-z * z / 2);
  return z >= 0 ? (1 + e) / 2 : (1 - e) / 2;
}

const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
// The sample standard deviation; null with fewer than two values.
export function spread(xs: number[]): number | null {
  if (xs.length < 2) return null;
  const m = mean(xs);
  return Math.sqrt(xs.reduce((a, x) => a + (x - m) ** 2, 0) / (xs.length - 1));
}

// Every scouted team's matches pooled: each team's spread around its own mean, combined. DEFAULT_SPREAD when no
// team has two scouted matches.
export function pooledSpread(teams: Scouting[]): number {
  let ss = 0, df = 0;
  teams.forEach((t) => {
    const xs = (t?.matchPoints ?? []).map((m) => m.points);
    if (xs.length < 2) return;
    const m = mean(xs);
    ss += xs.reduce((a, x) => a + (x - m) ** 2, 0);
    df += xs.length - 1;
  });
  return df ? Math.sqrt(ss / df) : DEFAULT_SPREAD;
}

const typeOf = (g: Game) => (g.level === "qual" ? "qualification" : "playoff");
// A team's scouted points in one match, or null.
export const scoutedIn = (s: Scouting, g: Game) => s?.matchPoints?.find((m) => m.matchType === typeOf(g) && m.matchNumber === g.number)?.points ?? null;

// A team's official share of one played match: its alliance's score less its partner's scouted points in that match,
// or half the score when the partner was not scouted there. Null for a match not played or a team not in it.
export function officialShare(g: Game, team: number, scouting: (team: number) => Scouting): number | null {
  if (!isPlayed(g)) return null;
  const side = g.red.includes(team) ? "red" : g.blue.includes(team) ? "blue" : null;
  if (!side) return null;
  const score = side === "red" ? g.redScore! : g.blueScore!;
  const partners = (side === "red" ? g.red : g.blue).filter((t) => t !== team);
  const seen = partners.map((p) => scoutedIn(scouting(p), g));
  return seen.every((v) => v != null) ? score - seen.reduce((a, v) => a + v!, 0) : score / (partners.length + 1);
}

// Each team's strength: scouted points per match (spread from its scouted matches), else its official shares
// (mean and spread). Fewer than two figures take the event's pooled spread. A team with neither has none.
export function strengths(teams: number[], games: Game[], scouting: (team: number) => Scouting): Map<number, Strength> {
  const pooled = pooledSpread(teams.map(scouting));
  const out = new Map<number, Strength>();
  teams.forEach((t) => {
    const s = scouting(t);
    if (s && s.matches > 0) {
      out.set(t, { mean: s.points, sd: spread((s.matchPoints ?? []).map((m) => m.points)) ?? pooled, source: "scouted" });
      return;
    }
    const shares = games.map((g) => officialShare(g, t, scouting)).filter((v): v is number => v != null);
    if (shares.length) out.set(t, { mean: mean(shares), sd: spread(shares) ?? pooled, source: "official" });
  });
  return out;
}

// Each team's bonus RP per qualification match so far: RP now less 3 a win and 1 a tie, over its quals played.
export function bonusRates(games: Game[], projections: Projection[]): Map<number, number> {
  const out = new Map<number, number>();
  projections.forEach((p) => {
    let played = 0, wins = 0, ties = 0;
    games.filter((g) => g.level === "qual" && isPlayed(g)).forEach((g) => {
      const side = g.red.includes(p.teamNumber) ? "red" : g.blue.includes(p.teamNumber) ? "blue" : null;
      if (!side) return;
      played++;
      const [mine, theirs] = side === "red" ? [g.redScore!, g.blueScore!] : [g.blueScore!, g.redScore!];
      if (mine > theirs) wins++; else if (mine === theirs) ties++;
    });
    out.set(p.teamNumber, played ? Math.max(0, (p.rpNow ?? 0) - 3 * wins - ties) / played : 0);
  });
  return out;
}

// One alliance's expected score: its strengths added, with the 80% range; null if any robot has no strength.
export function allianceScore(teams: number[], st: Map<number, Strength>): { mean: number; sd: number; official: boolean } | null {
  const ss = teams.map((t) => st.get(t));
  if (ss.some((s) => !s)) return null;
  return { mean: ss.reduce((a, s) => a + s!.mean, 0), sd: Math.sqrt(ss.reduce((a, s) => a + s!.sd ** 2, 0)), official: ss.some((s) => s!.source === "official") };
}

// The chances: d = red − blue, s = sqrt(sdRed² + sdBlue²); pRed = Φ((d − 0.5)/s), pBlue = Φ((−d − 0.5)/s), pTie the rest.
export function chances(red: { mean: number; sd: number }, blue: { mean: number; sd: number }) {
  const d = red.mean - blue.mean, s = Math.hypot(red.sd, blue.sd);
  const pRed = s ? phi((d - 0.5) / s) : d > 0.5 ? 1 : 0;
  const pBlue = s ? phi((-d - 0.5) / s) : -d > 0.5 ? 1 : 0;
  return { pRed, pBlue, pTie: Math.max(0, 1 - pRed - pBlue) };
}

// Every match's scouting forecast, in the shape the screens already use. A match with a robot that has no strength
// gets no figures and lists the robots in `missing`. Played matches keep the official result, and `preHit` says
// whether the side with the higher expected score won.
export function scoutForecasts(games: Game[], st: Map<number, Strength>, rates: Map<number, number>, name: (team: number) => string): Forecast[] {
  return games.map((g) => {
    const red = allianceScore(g.red, st), blue = allianceScore(g.blue, st);
    const played = isPlayed(g);
    const base: Forecast = {
      matchUuid: g.matchUuid, level: g.level, number: g.number, series: null, played,
      red: g.red, blue: g.blue, redNames: [name(g.red[0]), name(g.red[1])], blueNames: [name(g.blue[0]), name(g.blue[1])],
      redScore: null, blueScore: null, redLow80: null, redHigh80: null, blueLow80: null, blueHigh80: null,
      pRed: null, pBlue: null, pTie: null, redRp: null, blueRp: null, redBonus: [null, null, null], blueBonus: [null, null, null],
      redActual: g.redScore, blueActual: g.blueScore, preHit: null, prePRed: null, prePBlue: null, preRedScore: null, preBlueScore: null,
      missing: [...g.red, ...g.blue].filter((t) => !st.has(t)),
    };
    if (!red || !blue) return base;
    const c = chances(red, blue);
    const bonus = (ts: number[]) => ts.reduce((a, t) => a + (rates.get(t) ?? 0), 0) / ts.length;
    const qual = g.level === "qual";
    const winner = red.mean > blue.mean ? "red" : blue.mean > red.mean ? "blue" : null;
    return {
      ...base,
      redScore: r1(red.mean), blueScore: r1(blue.mean),
      redLow80: r1(red.mean - 1.28 * red.sd), redHigh80: r1(red.mean + 1.28 * red.sd),
      blueLow80: r1(blue.mean - 1.28 * blue.sd), blueHigh80: r1(blue.mean + 1.28 * blue.sd),
      pRed: r2(c.pRed), pBlue: r2(c.pBlue), pTie: r2(c.pTie),
      redRp: qual ? r2(3 * c.pRed + c.pTie + bonus(g.red)) : null, blueRp: qual ? r2(3 * c.pBlue + c.pTie + bonus(g.blue)) : null,
      preHit: played && winner ? (winner === "red" ? g.redScore! > g.blueScore! : g.blueScore! > g.redScore!) : null,
      officialRed: red.official, officialBlue: blue.official,
    };
  });
}
