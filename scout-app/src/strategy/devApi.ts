// Development stand-in for the strategy app, built on the scout app's dev data (same events, schedule, line-ups and
// Teams tab): official scores for the played matches, five more qualifications still to play, the standing now, and
// the model's HIVE figures (all that is read from it). In dev, team 12345 plays the part of us (see main.tsx).
import type { MatchRow, PresenceRow } from "../api";
import { createDevApi } from "../devApi";
import { DEV_TEAMS_TAB } from "../devTeamsTab";
import { MAPS_NOT_READY, type StrategyApi } from "./api";
import { resample } from "./autos";
import { averageCycle, centre, crossedSquares, mirrorCycle } from "./cycles";
import { buildMatchMaps, foldHalf } from "./logic";
import { isPlayed, label, type Game } from "./scouted";
import type { CycleRoute, CycleRow, CycleSquare, PointSplit, Projection, Rating, TeamCycles, TeamMap } from "./types";

export const DEV_OUR_TEAM = 12345;
const EVENT = "dev-event-now";
const wait = <T>(value: T) => new Promise<T>((resolve) => setTimeout(() => resolve(value), 200));
const fail = (why: string) => new Promise<never>((_, reject) => setTimeout(() => reject(new Error(why)), 200));
const r1 = (x: number) => Math.round(x * 10) / 10;
const r2 = (x: number) => Math.round(x * 100) / 100;

const NAMES = Object.fromEntries(DEV_TEAMS_TAB.teams.map((t) => [t.teamNumber, t.name])) as Record<number, string>;
// How many points each team really adds (hidden; the official scores come from it) and the model's HIVE figure.
const TRUE: Record<number, [number, number]> = {
  11115: [30, 68], 12345: [40, 89], 14469: [20, 50], 16021: [15, 39], 18172: [40, 62], 19044: [45, 76], 21230: [20, 31], 23511: [35, 56],
};
const TEAMS = Object.keys(TRUE).map(Number);
// The same "random" wobble every load.
const wobble = (seed: number) => Math.sin(seed * 12.9898) * 43758.5453 % 1;
// Q1 and Q2 have scouted robots, so their scores sit near what the scouts saw.
const KNOWN: Record<number, [number, number]> = { 1: [70, 38], 2: [36, 63] };
// Qualifications still to play after Q11, so the Alliance tab has something to play out.
const LATER: [number, [number, number], [number, number]][] = [
  [12, [12345, 18172], [19044, 21230]], [13, [11115, 23511], [14469, 12345]], [14, [16021, 19044], [18172, 11115]],
  [15, [21230, 14469], [23511, 16021]], [16, [12345, 23511], [11115, 19044]],
];

async function games(): Promise<Game[]> {
  const base = createDevApi();
  const ms = await base.matches(EVENT);
  const ps = (await Promise.all(ms.map((m) => base.presences(m.matchUuid)))).flat();
  const at = (m: MatchRow, alliance: PresenceRow["alliance"]) =>
    ps.filter((p) => p.matchUuid === m.matchUuid && p.alliance === alliance).sort((a, b) => a.station - b.station).map((p) => p.teamNumber) as [number, number];
  const score = (ts: number[], seed: number) => Math.max(0, Math.round(ts.reduce((a, t) => a + TRUE[t][0], 0) + wobble(seed) * 9));
  const now: Game[] = ms.map((m) => {
    const red = at(m, "red"), blue = at(m, "blue");
    const qual = m.matchType === "qualification";
    const played = m.actualTime != null;
    const known = qual ? KNOWN[m.matchNumber] : undefined;
    return {
      matchUuid: m.matchUuid, level: qual ? "qual" : "playoff", number: m.matchNumber, time: m.actualTime ?? m.scheduledTime, red, blue,
      redScore: played ? known?.[0] ?? score(red, m.matchNumber) : null, blueScore: played ? known?.[1] ?? score(blue, m.matchNumber + 30) : null,
    };
  });
  const later: Game[] = LATER.map(([n, red, blue]) => ({ matchUuid: `dev-q${n}`, level: "qual", number: n, time: null, red, blue, redScore: null, blueScore: null }));
  return [...now, ...later];
}

// The model's EventRating, read only for its HIVE figure and names.
const ratings = (): Rating[] => TEAMS.map((t) => ({
  teamNumber: t, teamName: NAMES[t], opr: 0, oprSe: null, autoRating: null, teleopRating: null, hiveRating: TRUE[t][1],
  priorWeight: null, priorNote: null, matchesFitted: null,
}));

// The standing now, as RankProjection gives it: 3 RP a win, 1 a tie, 1 bonus for 70 points or more.
function projections(gs: Game[]): Projection[] {
  const rows = TEAMS.map((t) => {
    let rp = 0, played = 0;
    gs.filter((g) => g.level === "qual" && isPlayed(g)).forEach((g) => {
      const side = g.red.includes(t) ? "red" : g.blue.includes(t) ? "blue" : null;
      if (!side) return;
      played++;
      const [mine, theirs] = side === "red" ? [g.redScore!, g.blueScore!] : [g.blueScore!, g.redScore!];
      rp += (mine > theirs ? 3 : mine === theirs ? 1 : 0) + (mine >= 70 ? 1 : 0);
    });
    return { t, rp, rs: played ? r2(rp / played) : 0 };
  });
  const order = [...rows].sort((a, b) => b.rs - a.rs || a.t - b.t).map((r) => r.t);
  return rows.map((r) => ({
    teamNumber: r.t, teamName: NAMES[r.t], rankNow: order.indexOf(r.t) + 1, rpNow: r.rp, rsNow: r.rs, expRank: null, medianRank: null, expRs: null,
    pRank1: null, pTop4: null, pTop8: null, remaining: null, rsNeededRank1: null, rsNeededRank4: null, rsNeededRank8: null,
  }));
}

// Heatmaps for the scouted teams, from the Teams tab's teleop squares plus a little auto, so the two apps agree.
const AUTO: Record<number, [string, number][]> = { 11115: [["B2", 1], ["C3", 0.5]], 12345: [["C4", 1.5], ["D3", 0.75]], 14469: [["B3", 1]], 16021: [["B5", 0.5]] };
const FIELD_MAPS: TeamMap[] = DEV_TEAMS_TAB.teams.filter((t) => t.matches > 0).map((t) => {
  const squares = new Map(t.squares.map((s) => [s.square, { square: s.square, autoScored: 0, teleopScored: s.scored, pickedUp: s.pickedUp }]));
  (AUTO[t.teamNumber] ?? []).forEach(([sq, n]) => {
    const s = squares.get(sq) ?? { square: sq, autoScored: 0, teleopScored: 0, pickedUp: 0 };
    squares.set(sq, { ...s, autoScored: n });
  });
  const all = [...squares.values()].sort((a, b) => a.square.localeCompare(b.square));
  // The dev squares stand in red's view; folded onto the upper half as the functions fold theirs.
  return { teamNumber: t.teamNumber, matches: t.matches, squares: all, half: foldHalf(all) };
});

// Each played match's score shared evenly, standing in for the pointSplits function (the app no longer shows it).
function pointSplits(gs: Game[]): PointSplit[] {
  return gs.filter(isPlayed).flatMap((g) => (["red", "blue"] as const).flatMap((alliance) => {
    const teams = alliance === "red" ? g.red : g.blue;
    const score = (alliance === "red" ? g.redScore : g.blueScore)!;
    return teams.map((t) => ({ matchUuid: g.matchUuid, label: label(g), alliance, teamNumber: t, allianceScore: score, points: r2(score / teams.length) }));
  }));
}

// failModel makes the model figures fail; failMaps makes the maps and splits fail as the real app does until they are
// switched on; failTeams makes the Teams tab fail. Any other event has no figures.
// Cycles for the scouted teams, summed the way teamCycles does: per match, routes grouped by where they start, collect
// and shoot. Each trip: match, the square it shot from before (none for teleop's first), where it collected, where it
// shot, and its collect, travel and shoot seconds. Squares are in red's view.
type Trip = { label: string; from?: string; via: string[]; to: string; collect: number; travel: number; shoot: number; pieces: number };
const trip = (label: string, from: string | undefined, via: string[], to: string, collect: number, travel: number, shoot: number, pieces = 2): Trip =>
  ({ label, from, via, to, collect, travel, shoot, pieces });
const repeat = (n: number, t: Trip) => Array.from({ length: n }, (_, i): Trip => ({ ...t, collect: t.collect + (i % 3) * 0.8, travel: t.travel + ((i + 1) % 2) * 0.6 }));
function devCycles(teamNumber: number, trips: Trip[]): TeamCycles {
  const labels = [...new Set(trips.map((t) => t.label))];
  const matches = labels.length;
  const counts = labels.map((l) => trips.filter((t) => t.label === l).length);
  // Each cycle shot from the lower half is mirrored onto the upper half first, as the functions do.
  const rows: CycleRow[] = trips.map((t) => mirrorCycle({
    label: t.label, ...(t.from ? { from: t.from } : {}), via: t.via, to: t.to, pieces: t.pieces,
    points: [...(t.from ? [centre(t.from)] : []), ...t.via.map(centre), centre(t.to)],
    ...(t.from ? { seconds: r1(t.collect + t.travel + t.shoot), collectSeconds: r1(t.collect) } : {}),
    travelSeconds: r1(t.travel), shootSeconds: r1(t.shoot), weight: 1,
  }));
  const timed = rows.filter((r) => r.seconds != null);
  const mean = (f: (r: CycleRow) => number | undefined, of = timed) => (of.length ? r1(of.reduce((a, r) => a + (f(r) ?? 0), 0) / of.length) : undefined);
  const squares = new Map<string, CycleSquare>();
  const at = (sq: string) => squares.get(sq) ?? squares.set(sq, { square: sq, passes: 0, intakes: 0, shots: 0 }).get(sq)!;
  rows.forEach((r) => {
    crossedSquares(r.points).forEach((sq) => { at(sq).passes++; });
    r.via.forEach((sq) => { at(sq).intakes++; });
    at(r.to).shots++;
  });
  const groups = new Map<string, CycleRow[]>();
  timed.forEach((r) => { const k = `${r.from}|${r.via[0]}|${r.to}`; groups.set(k, [...(groups.get(k) ?? []), r]); });
  const routes: CycleRoute[] = [...groups.values()].sort((a, b) => b.length - a.length).slice(0, 6).map((g) => ({
    points: resample(g[0].points.map((q): [number, number] => [q.x, q.y]), 12).map(([x, y]) => ({ x: r2(x), y: r2(y) })),
    cycles: g.length, share: r2(g.length / timed.length), seconds: mean((r) => r.seconds, g), from: g[0].from ?? "", via: g[0].via[0], to: g[0].to,
  }));
  return {
    teamNumber, matches, cyclesPerMatch: r2(rows.length / matches), cyclesLow: Math.min(...counts), cyclesHigh: Math.max(...counts),
    seconds: mean((r) => r.seconds), collectSeconds: mean((r) => r.collectSeconds), travelSeconds: mean((r) => r.travelSeconds),
    shootSeconds: mean((r) => r.shootSeconds), piecesPerCycle: r2(rows.reduce((a, r) => a + r.pieces, 0) / rows.length),
    squares: [...squares.values()].map((q) => ({ square: q.square, passes: r2(q.passes / matches), intakes: r2(q.intakes / matches), shots: r2(q.shots / matches) }))
      .sort((a, b) => a.square.localeCompare(b.square)),
    routes, cycles: rows,
    mirroredShare: r2(rows.filter((r) => r.mirrored).length / rows.length), average: averageCycle(rows),
  };
}
const DEV_CYCLES: TeamCycles[] = [
  devCycles(11115, [
    trip("Q1", undefined, ["A1"], "B2", 0, 7, 1), ...repeat(2, trip("Q1", "B2", ["A1"], "B2", 9, 6, 2)), trip("Q1", "B2", ["F6"], "D4", 11, 8, 2, 3),
    trip("Q2", undefined, ["A1"], "B2", 0, 6, 1), ...repeat(2, trip("Q2", "B2", ["A1", "A2"], "C3", 10, 6, 2)),
  ]),
  devCycles(12345, [
    trip("Q1", undefined, ["E2"], "C4", 0, 4, 1), ...repeat(4, trip("Q1", "C4", ["E2"], "C4", 6, 4, 1.5)), ...repeat(2, trip("Q1", "C4", ["E5"], "D3", 7, 5, 2, 3)),
    trip("Q2", undefined, ["E2"], "C4", 0, 4, 1), ...repeat(3, trip("Q2", "C4", ["E2"], "C4", 6.5, 4, 1.5)), trip("Q2", "C4", ["E5", "E4"], "D3", 8, 5, 2, 3),
  ]),
  devCycles(14469, [trip("Q2", undefined, ["E4"], "B3", 0, 8, 2), ...repeat(2, trip("Q2", "B3", ["E4"], "B3", 11, 8, 3))]),
  devCycles(16021, [
    trip("Q1", undefined, ["E5"], "B5", 0, 9, 3, 1),
    trip("Q2", undefined, ["E5"], "B5", 0, 9, 3, 1), trip("Q2", "B5", ["E5"], "E5", 14, 3, 3, 1),
  ]),
];

// failModel makes the read figures fail; failMaps makes the maps, splits and cycles fail as the real app does until
// they are switched on; failTeams makes the Teams tab fail. Any other event has no figures.
export function createDevStrategyApi({ failModel = false, failMaps = false, failTeams = false } = {}): StrategyApi {
  const base = createDevApi({ failTeams });
  const ours = (e: string) => e === EVENT;
  const read = async <T>(e: string, f: (gs: Game[]) => T, empty: T): Promise<T> => {
    if (failModel) return fail("Model unavailable");
    return wait(ours(e) ? f(await games()) : empty);
  };
  return {
    ourEvents: () => base.ourEvents(),
    matches: (e) => base.matches(e),
    presences: (m) => base.presences(m),
    teamsTab: (e) => base.teamsTab(e),
    ratings: (e) => read(e, ratings, []),
    projections: (e) => read(e, projections, []),
    games: (e) => read(e, (gs) => gs, []),
    fieldMaps: (e) => (failMaps ? fail(MAPS_NOT_READY) : wait(ours(e) ? FIELD_MAPS : [])),
    async matchMaps(e, m) {
      if (failMaps) return fail(MAPS_NOT_READY);
      const g = (ours(e) ? await games() : []).find((x) => x.matchUuid === m);
      if (!g) return fail(`No match ${m}`);
      return wait(buildMatchMaps(m, label(g), g.red, g.blue, FIELD_MAPS));
    },
    pointSplits: (e) => (failMaps ? fail(MAPS_NOT_READY) : read(e, pointSplits, [])),
    teamCycles: (e) => (failMaps ? fail(MAPS_NOT_READY) : wait(ours(e) ? DEV_CYCLES : [])),
  };
}
