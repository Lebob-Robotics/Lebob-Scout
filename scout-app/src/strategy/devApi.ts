// Development stand-in for the strategy app: made-up model figures for the dev event, built on the scout app's dev data
// (same events, schedule, line-ups and Teams tab). In dev, team 12345 plays the part of us (see main.tsx).
import type { MatchRow, PresenceRow } from "../api";
import { createDevApi } from "../devApi";
import { DEV_TEAMS_TAB } from "../devTeamsTab";
import { MAPS_NOT_READY, type StrategyApi } from "./api";
import { buildMatchMaps, matchLabels } from "./logic";
import type { Forecast, HistoryPoint, Pick, PointSplit, Projection, Rating, TeamMap } from "./types";

export const DEV_OUR_TEAM = 12345;
const EVENT = "dev-event-now";
const wait = <T>(value: T) => new Promise<T>((resolve) => setTimeout(() => resolve(value), 200));
const fail = (why: string) => new Promise<never>((_, reject) => setTimeout(() => reject(new Error(why)), 200));
const r1 = (x: number) => Math.round(x * 10) / 10;
const r2 = (x: number) => Math.round(x * 100) / 100;

const NAMES = Object.fromEntries(DEV_TEAMS_TAB.teams.map((t) => [t.teamNumber, t.name])) as Record<number, string>;
// Rating, its standard error, and the share of it that comes from auto.
const MODEL: Record<number, [number, number, number]> = {
  11115: [42.3, 9.1, 0.3], 12345: [55.8, 8.2, 0.35], 14469: [31.0, 11.4, 0.25], 16021: [24.6, 10.2, 0.2],
  18172: [38.9, 5.1, 0.3], 19044: [47.2, 4.8, 0.28], 21230: [19.5, 5.6, 0.15], 23511: [35.1, 5.0, 0.32],
};
const TEAMS = Object.keys(MODEL).map(Number);
const SPREAD = 14; // a match score's own spread, on top of the ratings' errors

// The standard normal's cumulative chance (Abramowitz and Stegun 7.1.26).
function phi(z: number) {
  const t = 1 / (1 + 0.3275911 * Math.abs(z) / Math.SQRT2);
  const e = 1 - t * (0.254829592 + t * (-0.284496736 + t * (1.421413741 + t * (-1.453152027 + t * 1.061405429)))) * Math.exp(-z * z / 2);
  return z >= 0 ? (1 + e) / 2 : (1 - e) / 2;
}
const logistic = (x: number) => 1 / (1 + Math.exp(-x));
// The same "random" wobble every load.
const wobble = (seed: number) => Math.sin(seed * 12.9898) * 43758.5453 % 1;

type Lineup = { match: MatchRow; red: [number, number]; blue: [number, number] };
async function lineups(): Promise<Lineup[]> {
  const base = createDevApi();
  const ms = await base.matches(EVENT);
  const ps = (await Promise.all(ms.map((m) => base.presences(m.matchUuid)))).flat();
  const at = (m: MatchRow, alliance: PresenceRow["alliance"]) =>
    ps.filter((p) => p.matchUuid === m.matchUuid && p.alliance === alliance).sort((a, b) => a.station - b.station).map((p) => p.teamNumber) as [number, number];
  return ms.map((match) => ({ match, red: at(match, "red"), blue: at(match, "blue") }));
}

function forecast({ match, red, blue }: Lineup): Forecast {
  const score = (pair: number[]) => pair.reduce((s, t) => s + MODEL[t][0], 0);
  const sd = (pair: number[]) => Math.sqrt(SPREAD ** 2 + pair.reduce((s, t) => s + MODEL[t][1] ** 2, 0));
  const rs = score(red), bs = score(blue);
  const diffSd = Math.hypot(sd(red), sd(blue));
  const pTie = 0.02;
  const pRed = r2(phi((rs - bs) / diffSd) * (1 - pTie)), pBlue = r2(1 - pTie - pRed);
  const bonus = (s: number): [number, number, number] => [r2(logistic((s - 70) / 12)), r2(logistic((s - 90) / 12)), r2(logistic((s - 115) / 12))];
  const rb = bonus(rs), bb = bonus(bs);
  const played = match.actualTime != null;
  const n = match.matchNumber + (match.matchType === "playoff" ? 50 : 0);
  const redActual = played ? Math.max(0, Math.round(rs + wobble(n) * 22)) : null;
  const blueActual = played ? Math.max(0, Math.round(bs + wobble(n + 7) * 22)) : null;
  const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);
  return {
    matchUuid: match.matchUuid, level: match.matchType === "qualification" ? "qual" : "playoff", number: match.matchNumber,
    series: match.matchType === "playoff" ? match.matchNumber : null, played,
    red, blue, redNames: [NAMES[red[0]], NAMES[red[1]]], blueNames: [NAMES[blue[0]], NAMES[blue[1]]],
    redScore: r1(rs), blueScore: r1(bs),
    redLow80: r1(rs - 1.28 * sd(red)), redHigh80: r1(rs + 1.28 * sd(red)), blueLow80: r1(bs - 1.28 * sd(blue)), blueHigh80: r1(bs + 1.28 * sd(blue)),
    pRed, pBlue, pTie, redRp: r2(3 * pRed + pTie + sum(rb)), blueRp: r2(3 * pBlue + pTie + sum(bb)), redBonus: rb, blueBonus: bb,
    redActual, blueActual, preHit: played ? (pRed > pBlue ? redActual! > blueActual! : blueActual! > redActual!) : null,
    prePRed: played ? pRed : null, prePBlue: played ? pBlue : null, preRedScore: played ? r1(rs) : null, preBlueScore: played ? r1(bs) : null,
  };
}

async function forecasts() {
  return (await lineups()).map(forecast);
}

function ratings(fs: Forecast[]): Rating[] {
  return TEAMS.map((t) => {
    const [opr, se, auto] = MODEL[t];
    const fitted = fs.filter((f) => f.played && f.level === "qual" && (f.red.includes(t) || f.blue.includes(t))).length;
    const priorWeight = r2(Math.max(0.1, 1 - fitted / 4));
    return {
      teamNumber: t, teamName: NAMES[t], opr, oprSe: se, autoRating: r1(opr * auto), teleopRating: r1(opr * (1 - auto)),
      priorWeight, priorNote: priorWeight > 0.5 ? `Only ${fitted} matches played here: most of this rating still comes from its last event.` : null,
      matchesFitted: fitted,
    };
  });
}

// After each played qualification match: each of its teams' rating, moving from a first guess to the final figure.
function history(fs: Forecast[]): HistoryPoint[] {
  const order = [...TEAMS].sort((a, b) => MODEL[b][0] - MODEL[a][0]);
  return TEAMS.flatMap((t) => {
    const [opr, se] = MODEL[t];
    const own = fs.filter((f) => f.played && f.level === "qual" && (f.red.includes(t) || f.blue.includes(t))).sort((a, b) => a.number - b.number);
    const start = opr + wobble(t) * 18;
    return own.map((f, i) => {
      const k = (i + 1) / own.length;
      return {
        teamNumber: t, afterMatch: f.number, lastMatch: `Q${f.number}`, opr: r1(start + (opr - start) * k + wobble(t + i) * 2 * (1 - k)),
        oprSe: r1(se * (1 + 1.5 * (1 - k))), ratingRank: order.indexOf(t) + 1,
      };
    });
  });
}

function projections(fs: Forecast[]): Projection[] {
  const quals = fs.filter((f) => f.level === "qual");
  const rows = TEAMS.map((t) => {
    let rpNow = 0, played = 0, expRp = 0, remaining = 0;
    quals.forEach((f) => {
      const side = f.red.includes(t) ? "red" : f.blue.includes(t) ? "blue" : null;
      if (!side) return;
      const [mine, theirs] = side === "red" ? [f.redActual, f.blueActual] : [f.blueActual, f.redActual];
      const bonus = (side === "red" ? f.redBonus : f.blueBonus).filter((p) => (p ?? 0) > 0.5).length;
      const rp = side === "red" ? f.redRp ?? 0 : f.blueRp ?? 0;
      if (f.played && mine != null && theirs != null) { played++; rpNow += (mine > theirs ? 3 : mine === theirs ? 1 : 0) + bonus; } else { remaining++; expRp += rp; }
    });
    const rsNow = played ? r2(rpNow / played) : 0;
    const expRs = r2((rpNow + expRp) / Math.max(1, played + remaining));
    return { t, rpNow, rsNow, expRs, remaining };
  });
  const rankBy = (k: "rsNow" | "expRs") => [...rows].sort((a, b) => b[k] - a[k] || MODEL[b.t][0] - MODEL[a.t][0]).map((r) => r.t);
  const now = rankBy("rsNow"), exp = rankBy("expRs");
  const weights = rows.map((r) => Math.exp(-1.4 * exp.indexOf(r.t)));
  const total = weights.reduce((a, b) => a + b, 0);
  const finalRs = exp.map((t) => rows.find((r) => r.t === t)!.expRs);
  return rows.map((r, i) => {
    const expRank = exp.indexOf(r.t) + 1 + r2(Math.abs(wobble(r.t)) * 0.4);
    return {
      teamNumber: r.t, teamName: NAMES[r.t], rankNow: now.indexOf(r.t) + 1, rpNow: r.rpNow, rsNow: r.rsNow, expRank: r2(expRank),
      medianRank: Math.round(expRank), expRs: r.expRs, pRank1: r2(weights[i] / total), pTop4: r2(logistic((4.5 - expRank) * 1.6)), pTop8: 1,
      remaining: r.remaining, rsNeededRank1: r2(finalRs[0] + 0.1), rsNeededRank4: r2(finalRs[3] + 0.05), rsNeededRank8: r2(finalRs[7]),
    };
  });
}

// For every team that might pick, every possible partner: chances from the pair's ratings against the field.
function picks(ps: Projection[]): Pick[] {
  const expRank = new Map(ps.map((p) => [p.teamNumber, p.expRank ?? 8]));
  const best = Math.max(...TEAMS.map((a) => Math.max(...TEAMS.filter((b) => b !== a).map((b) => MODEL[a][0] + MODEL[b][0]))));
  return TEAMS.flatMap((t) => {
    const partners = TEAMS.filter((p) => p !== t).map((p) => {
      const pair = MODEL[t][0] + MODEL[p][0];
      const pWinEvent = r2(0.55 * Math.exp((pair - best) / 14));
      return { p, pWinEvent, pFinals: r2(Math.min(0.95, pWinEvent * 1.7 + 0.05)) };
    }).sort((a, b) => b.pWinEvent - a.pWinEvent);
    const natural = partners.find((x) => (expRank.get(x.p) ?? 8) > 4)?.p;
    return partners.map((x, i) => ({
      teamNumber: t, partnerNumber: x.p, partnerName: NAMES[x.p], partnerOpr: MODEL[x.p][0], pickRank: i + 1,
      role: (expRank.get(t) ?? 8) <= 4 ? "captain" : "partner", seed: Math.min(4, Math.round(Math.min(expRank.get(t)!, expRank.get(x.p)!))),
      natural: x.p === natural, free: (expRank.get(x.p) ?? 8) > 4, pFinals: x.pFinals, pWinEvent: x.pWinEvent,
    }));
  });
}

// Heatmaps for the scouted teams, from the Teams tab's teleop squares plus a little auto, so the two apps agree.
const AUTO: Record<number, [string, number][]> = { 11115: [["B2", 1], ["C3", 0.5]], 12345: [["C4", 1.5], ["D3", 0.75]], 14469: [["B3", 1]], 16021: [["B5", 0.5]] };
const FIELD_MAPS: TeamMap[] = DEV_TEAMS_TAB.teams.filter((t) => t.matches > 0).map((t) => {
  const squares = new Map(t.squares.map((s) => [s.square, { square: s.square, autoScored: 0, teleopScored: s.scored, pickedUp: s.pickedUp }]));
  (AUTO[t.teamNumber] ?? []).forEach(([sq, n]) => {
    const s = squares.get(sq) ?? { square: sq, autoScored: 0, teleopScored: 0, pickedUp: 0 };
    squares.set(sq, { ...s, autoScored: n });
  });
  return { teamNumber: t.teamNumber, matches: t.matches, squares: [...squares.values()].sort((a, b) => a.square.localeCompare(b.square)) };
});

// Each played match's score shared between its robots by rating, as the pointSplits function does.
function pointSplits(fs: Forecast[]): PointSplit[] {
  const labels = matchLabels(fs);
  return fs.filter((f) => f.played).flatMap((f) => (["red", "blue"] as const).flatMap((alliance) => {
    const teams = alliance === "red" ? f.red : f.blue;
    const score = (alliance === "red" ? f.redActual : f.blueActual) ?? 0;
    const sum = teams.reduce((s, t) => s + Math.max(0, MODEL[t][0]), 0);
    return teams.map((t) => ({
      matchUuid: f.matchUuid, label: labels.get(f.matchUuid) ?? "", alliance, teamNumber: t, allianceScore: score, rating: MODEL[t][0],
      points: r2(sum > 0 ? score * Math.max(0, MODEL[t][0]) / sum : score / teams.length),
    }));
  }));
}


// failModel makes the model figures fail; failMaps makes the maps and splits fail as the real app does until they are
// switched on; failTeams makes the Teams tab fail. Any other event has no figures.
export function createDevStrategyApi({ failModel = false, failMaps = false, failTeams = false } = {}): StrategyApi {
  const base = createDevApi({ failTeams });
  const ours = (e: string) => e === EVENT;
  const model = async <T>(e: string, f: (fs: Forecast[]) => T, empty: T): Promise<T> => {
    if (failModel) return fail("Model unavailable");
    return wait(ours(e) ? f(await forecasts()) : empty);
  };
  return {
    ourEvents: () => base.ourEvents(),
    matches: (e) => base.matches(e),
    presences: (m) => base.presences(m),
    teamsTab: (e) => base.teamsTab(e),
    ratings: (e) => model(e, ratings, []),
    history: (e) => model(e, history, []),
    forecasts: (e) => model(e, (fs) => fs, []),
    projections: (e) => model(e, projections, []),
    picks: (e) => model(e, (fs) => picks(projections(fs)), []),
    fieldMaps: (e) => (failMaps ? fail(MAPS_NOT_READY) : wait(ours(e) ? FIELD_MAPS : [])),
    async matchMaps(e, m) {
      if (failMaps) return fail(MAPS_NOT_READY);
      const fs = ours(e) ? await forecasts() : [];
      const f = fs.find((x) => x.matchUuid === m);
      if (!f) return fail(`No match ${m}`);
      return wait(buildMatchMaps(m, matchLabels(fs).get(m) ?? "", f.red, f.blue, FIELD_MAPS));
    },
    pointSplits: (e) => (failMaps ? fail(MAPS_NOT_READY) : model(e, pointSplits, [])),
  };
}
