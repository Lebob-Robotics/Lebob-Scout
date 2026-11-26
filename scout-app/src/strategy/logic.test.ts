import { expect, test } from "vitest";
import {
  bar, cardKey, keepShut, likely, overlapCells, pointsFigure, pointsTitle, popPlace, ratingRows, readShut, scaleMax, scoutMoreTiles, sharesByTeam,
  teamCells, tipsPerMatch,
  buildMatchMaps, defaultMatch, favouriteWon, historyChart, matchLabels, measureOf, nextOurs, nextSort, one, orderForecasts, partnersFor,
  pct, playedCount, rangeText, robotsOf, rsNeeded, scoutTiles, scoutedMatchPoints, scoutedTotal, scoutingFirst, sideOf, sortRows, splitsByMatch, whole, winChance,
} from "./logic";
import type { Forecast, Pick, TeamMap } from "./types";

const fc = (f: Partial<Forecast> = {}): Forecast => ({
  matchUuid: "m", level: "qual", number: 1, series: null, played: false, red: [1, 2], blue: [3, 4],
  redNames: ["A", "B"], blueNames: ["C", "D"], redScore: 50, blueScore: 40, redLow80: null, redHigh80: null, blueLow80: null, blueHigh80: null,
  pRed: 0.6, pBlue: 0.38, pTie: 0.02, redRp: null, blueRp: null, redBonus: [null, null, null], blueBonus: [null, null, null],
  redActual: null, blueActual: null, preHit: null, prePRed: null, prePBlue: null, preRedScore: null, preBlueScore: null, ...f,
});
const pick = (p: Partial<Pick>): Pick => ({
  teamNumber: 1, partnerNumber: 2, partnerName: "", partnerOpr: null, pickRank: null, role: null, seed: null, natural: null, free: null,
  pFinals: null, pWinEvent: null, ...p,
});

test("figures: one decimal, whole percentages, dashes for blanks", () => {
  expect(one(42.26)).toBe("42.3");
  expect(one(7)).toBe("7.0");
  expect(one(null)).toBe("–");
  expect(pct(0.625)).toBe("63%");
  expect(pct(undefined)).toBe("–");
  expect(whole(3.6)).toBe("4");
});

test("likely is rating ± 1.28 standard errors, none with no error; rangeText reads low to high", () => {
  expect(likely(50, 10)).toEqual({ low: 37.2, high: 62.8 });
  expect(likely(50, null)).toBeNull();
  expect(rangeText(45.31, 66.3)).toBe("45.3 to 66.3");
});

test("bar places the band and marker as shares of the column's track, kept on the track", () => {
  expect(bar(50, 25, 75, 100)).toEqual({ left: 25, width: 50, at: 50 });
  expect(bar(10, -5, 30, 20)).toEqual({ left: 0, width: 100, at: 50 });
  expect(bar(5, 5, 5, 0)).toEqual({ left: 0, width: 0, at: 0 });
  expect(scaleMax([12, 66.3, NaN])).toBe(66.3);
  expect(scaleMax([])).toBe(1);
});

test("pointsFigure: scouted points with the low and high match, else the official share, else nothing", () => {
  expect(pointsFigure({ matches: 2, points: 30, pointsLow: 20, pointsHigh: 40 }, [99])).toEqual({ value: 30, low: 20, high: 40, official: false });
  expect(pointsFigure({ matches: 1, points: 30 }, [])).toEqual({ value: 30, low: 30, high: 30, official: false });
  expect(pointsFigure({ matches: 0, points: 0 }, [10, 30, 20])).toEqual({ value: 20, low: 10, high: 30, official: true });
  expect(pointsFigure(undefined, [12])).toEqual({ value: 12, low: 12, high: 12, official: true });
  expect(pointsFigure(undefined, [])).toBeNull();
  expect(pointsTitle({ value: 20, low: 10, high: 30, official: true })).toBe("Official points share (not scouted)");
  expect(pointsTitle({ value: 20, low: 10, high: 30, official: false })).toBe("10.0 to 30.0 scouted");
});

test("tips per match are the HIVE rating over 20", () => {
  expect(tipsPerMatch(90)).toBe(4.5);
  expect(tipsPerMatch(null)).toBeNull();
  expect(one(tipsPerMatch(89.3))).toBe("4.5");
});

test("sortRows sorts either way and keeps blanks last", () => {
  const rows = [{ v: 2 }, { v: null }, { v: 5 }, { v: 1 }];
  expect(sortRows(rows, (r) => r.v, "asc").map((r) => r.v)).toEqual([1, 2, 5, null]);
  expect(sortRows(rows, (r) => r.v, "desc").map((r) => r.v)).toEqual([5, 2, 1, null]);
  expect(sortRows([{ v: "b" }, { v: "a" }], (r) => r.v, "asc").map((r) => r.v)).toEqual(["a", "b"]);
});

test("nextSort flips the same column and starts a new one at its natural direction", () => {
  expect(nextSort({ key: "a", dir: "desc" }, "a", "desc")).toEqual({ key: "a", dir: "asc" });
  expect(nextSort<"a" | "b">({ key: "a", dir: "asc" }, "b", "desc")).toEqual({ key: "b", dir: "desc" });
});

test("orderForecasts puts qualifications by number, then playoffs by series", () => {
  const fs = [fc({ matchUuid: "p2", level: "playoff", number: 1, series: 2 }), fc({ matchUuid: "q10", number: 10 }),
    fc({ matchUuid: "p1", level: "playoff", number: 1, series: 1 }), fc({ matchUuid: "q2", number: 2 })];
  expect(orderForecasts(fs).map((f) => f.matchUuid)).toEqual(["q2", "q10", "p1", "p2"]);
});

test("matchLabels uses the number, or the series when playoff numbers repeat", () => {
  expect([...matchLabels([fc({ matchUuid: "a", number: 7 }), fc({ matchUuid: "b", level: "playoff", number: 2, series: 2 })]).values()])
    .toEqual(["Q7", "P2"]);
  const repeats = [
    fc({ matchUuid: "s1", level: "playoff", number: 1, series: 1 }), fc({ matchUuid: "s2", level: "playoff", number: 1, series: 2 }),
    fc({ matchUuid: "f1", level: "playoff", number: 1, series: 6 }), fc({ matchUuid: "f2", level: "playoff", number: 2, series: 6 }),
  ];
  expect([...matchLabels(repeats).values()]).toEqual(["P1", "P2", "P6-1", "P6-2"]);
});

test("sideOf and winChance read a team's side", () => {
  const f = fc();
  expect(sideOf(f, 3)).toBe("blue");
  expect(sideOf(f, 9)).toBeNull();
  expect(winChance(f, "red")).toBe(0.6);
});

test("defaultMatch: our next unplayed, else the next unplayed, else the last", () => {
  const fs = [fc({ matchUuid: "q1", number: 1, played: true, red: [9, 2] }), fc({ matchUuid: "q2", number: 2 }), fc({ matchUuid: "q3", number: 3, blue: [9, 4] })];
  expect(defaultMatch(fs, 9)?.matchUuid).toBe("q3");
  expect(nextOurs(fs, 9)?.matchUuid).toBe("q3");
  expect(defaultMatch(fs, 7)?.matchUuid).toBe("q2");
  expect(defaultMatch(fs.map((f) => ({ ...f, played: true })), 9)?.matchUuid).toBe("q3");
  expect(defaultMatch([], 9)).toBeNull();
});

test("favouriteWon takes the model's answer, else compares the before-match chances with the result", () => {
  expect(favouriteWon(fc())).toBeNull();
  expect(favouriteWon(fc({ played: true, redActual: 30, blueActual: 60, preHit: true }))).toBe(true);
  expect(favouriteWon(fc({ played: true, redActual: 30, blueActual: 60 }))).toBe(false);
  expect(favouriteWon(fc({ played: true, redActual: 30, blueActual: 60, prePRed: 0.3, prePBlue: 0.7 }))).toBe(true);
});

test("splits join a match's robots, red then blue", () => {
  const splits = splitsByMatch([
    { matchUuid: "m", label: "Q1", alliance: "red", teamNumber: 1, allianceScore: 90, points: 60 },
    { matchUuid: "m", label: "Q1", alliance: "red", teamNumber: 2, allianceScore: 90, points: 30 },
  ]);
  const model = (value: number) => ({ value, model: true });
  expect(robotsOf(fc(), splits.get("m")).map((r) => [r.team, r.side, r.points])).toEqual([[1, "red", model(60)], [2, "red", model(30)], [3, "blue", null], [4, "blue", null]]);
  expect(robotsOf(fc()).every((r) => r.points === null)).toBe(true);
  // Scouting first: a scouted figure wins over the split.
  const scouted = (t: number) => (t === 2 ? 41.5 : t === 4 ? 12 : null);
  expect(robotsOf(fc(), splits.get("m"), scouted).map((r) => r.points)).toEqual([model(60), { value: 41.5, model: false }, null, { value: 12, model: false }]);
});

test("partnersFor keeps one team's picks, best chance of winning first", () => {
  const ps = [pick({ partnerNumber: 5, pWinEvent: 0.1 }), pick({ teamNumber: 2, partnerNumber: 1, pWinEvent: 0.9 }),
    pick({ partnerNumber: 6, pWinEvent: 0.4 }), pick({ partnerNumber: 7 })];
  expect(partnersFor(ps, 1).map((p) => p.partnerNumber)).toEqual([6, 5, 7]);
});

test("historyChart scales the line and band into the box", () => {
  const c = historyChart([
    { teamNumber: 1, afterMatch: 5, lastMatch: null, opr: 20, oprSe: 5, ratingRank: null },
    { teamNumber: 1, afterMatch: 1, lastMatch: null, opr: 10, oprSe: 5, ratingRank: null },
  ], 100, 50, { left: 0, right: 0, top: 0, bottom: 0 })!;
  expect([c.yMin, c.yMax, c.xMin, c.xMax]).toEqual([5, 25, 1, 5]);
  expect(c.line).toBe("M0 37.5 L100 12.5");
  expect(c.band).toBe("M0 25 L100 0 L100 25 L0 50 Z");
  expect(historyChart([], 100, 50)).toBeNull();
  // One point sits in the middle.
  expect(historyChart([{ teamNumber: 1, afterMatch: 3, lastMatch: null, opr: 10, oprSe: null, ratingRank: null }], 100, 50,
    { left: 0, right: 0, top: 0, bottom: 0 })!.dots).toEqual([{ x: 50, y: 25 }]);
});

test("measureOf picks auto, teleop, both scored, or pick-ups", () => {
  const s = { square: "A1", autoScored: 1, teleopScored: 2, pickedUp: 4 };
  expect(["auto", "teleop", "scored", "pickedUp"].map((m) => measureOf(s, m as never))).toEqual([1, 2, 3, 4]);
});

test("buildMatchMaps adds each alliance's robots and scores the overlap by the smaller use", () => {
  const maps: TeamMap[] = [
    { teamNumber: 1, matches: 2, squares: [{ square: "A1", autoScored: 1, teleopScored: 2, pickedUp: 0 }, { square: "B2", autoScored: 0, teleopScored: 1, pickedUp: 0 }] },
    { teamNumber: 2, matches: 1, squares: [{ square: "A1", autoScored: 0, teleopScored: 1, pickedUp: 1 }] },
    { teamNumber: 3, matches: 1, squares: [{ square: "A1", autoScored: 0, teleopScored: 0, pickedUp: 2 }, { square: "C3", autoScored: 0, teleopScored: 5, pickedUp: 0 }] },
  ];
  const mm = buildMatchMaps("m", "Q1", [1, 2], [3, 4], maps);
  expect(mm.red.squares).toEqual([{ square: "A1", autoScored: 1, teleopScored: 3, pickedUp: 1 }, { square: "B2", autoScored: 0, teleopScored: 1, pickedUp: 0 }]);
  expect(mm.blue.robots.map((r) => r.matches)).toEqual([1, 0]);
  expect(mm.overlap).toEqual([{ square: "A1", red: 5, blue: 2, both: 2 }]);
});

test("rsNeeded takes the first figure given", () => {
  expect(rsNeeded([{ rsNeededRank1: null, rsNeededRank4: null, rsNeededRank8: null }, { rsNeededRank1: 3, rsNeededRank4: 2, rsNeededRank8: 1 }]))
    .toEqual({ rank1: 3, rank4: 2, rank8: 1 });
});

test("playedCount uses forecasts, else the schedule", () => {
  expect(playedCount([fc({ played: true }), fc()], [])).toEqual({ played: 1, total: 2 });
  expect(playedCount([], [{ actualTime: "x" }, { actualTime: null }, { actualTime: null }])).toEqual({ played: 1, total: 3 });
});

test("scoutTiles shows the Teams tab figures, dashes for missing ones", () => {
  const tiles = new Map(scoutTiles({
    teamNumber: 1, name: "", need: false, matches: 2, played: 2, toCome: 0, scheduled: 2, missing: [], twice: [], points: 41.6, autoPoints: 8.25,
    teleopPoints: 30, parkPoints: 2.5, autoScored: 1, cycles: 3, cycleSeconds: 22.25, squares: [], starts: [], reports: [], pits: [], breakages: [], brokeDownMatches: 0, notes: [], autoPaths: [],
  }));
  expect([tiles.get("points / match"), tiles.get("auto pts"), tiles.get("driver 1-5"), tiles.get("matches")]).toEqual(["42", "8.3", "–", "2"]);
  // Cycles live on the Cycles card now.
  expect(tiles.has("cycles") || tiles.has("cycle time")).toBe(false);
});

test("scoutMoreTiles shows the rates as whole percentages, fouls to one decimal, and breakdowns of matches", () => {
  const tiles = new Map(scoutMoreTiles({
    teamNumber: 1, name: "", need: false, matches: 4, played: 4, toCome: 0, scheduled: 4, missing: [], twice: [], points: 0, autoPoints: 0,
    teleopPoints: 0, parkPoints: 0, autoScored: 0, cycles: 0, squares: [], starts: [], reports: [], pits: [], breakages: [],
    brokeDownMatches: 1, notes: [], autoPaths: [], leaveRate: 0.75, teleopParkRate: 1, minorFouls: 0.25,
  }));
  expect([tiles.get("left start in auto"), tiles.get("parked in auto"), tiles.get("parked at end"), tiles.get("minor fouls / match"),
    tiles.get("major fouls / match"), tiles.get("broke down")]).toEqual(["75%", "–", "100%", "0.3", "–", "1 of 4"]);
});

test("card state is kept per title, and a missing or refusing storage leaves cards open", () => {
  const kept = new Map<string, string>();
  const store = () => ({ getItem: (k: string) => kept.get(k) ?? null, setItem: (k: string, v: string) => { kept.set(k, v); }, removeItem: (k: string) => { kept.delete(k); } });
  expect(readShut("Ratings", store)).toBe(false);
  keepShut("Ratings", true, store);
  expect(kept.get(cardKey("Ratings"))).toBe("1");
  expect(readShut("Ratings", store)).toBe(true);
  expect(readShut("Breakages", store)).toBe(false);
  keepShut("Ratings", false, store);
  expect(readShut("Ratings", store)).toBe(false);
  const refuses = () => { throw new Error("blocked"); };
  expect(readShut("Ratings", refuses)).toBe(false);
  expect(() => keepShut("Ratings", true, refuses)).not.toThrow();
  const full = () => ({ getItem: () => null, setItem: () => { throw new Error("full"); }, removeItem: () => {} });
  expect(() => keepShut("Ratings", true, full)).not.toThrow();
});

test("ratingRows joins rating range, rank, points and breakages, and sorts by breakage count", () => {
  const rows = ratingRows(
    [{ teamNumber: 1, teamName: "A", opr: 50, oprSe: 10, autoRating: null, teleopRating: null, hiveRating: null, priorWeight: null, priorNote: null, matchesFitted: null },
      { teamNumber: 2, teamName: "B", opr: 30, oprSe: null, autoRating: null, teleopRating: null, hiveRating: null, priorWeight: null, priorNote: null, matchesFitted: null },
      { teamNumber: 3, teamName: "C", opr: 20, oprSe: 1, autoRating: null, teleopRating: null, hiveRating: null, priorWeight: null, priorNote: null, matchesFitted: null }],
    [{ teamNumber: 2, teamName: "B", rankNow: 1, rpNow: null, rsNow: null, expRank: null, medianRank: null, expRs: null, pRank1: null, pTop4: null,
      pTop8: null, remaining: null, rsNeededRank1: null, rsNeededRank4: null, rsNeededRank8: null }],
    (t) => (t === 1 ? { breakages: [{}] } : t === 3 ? { breakages: [{}, {}] } : undefined),
    (t) => (t === 1 ? { value: 9, low: 8, high: 10, official: false } : null),
  );
  expect(rows[0]).toEqual({ teamNumber: 1, teamName: "A", opr: 50, low: 37.2, high: 62.8, rankNow: null, points: { value: 9, low: 8, high: 10, official: false }, breakages: 1 });
  expect([rows[1].low, rows[1].high, rows[1].rankNow, rows[1].breakages]).toEqual([30, 30, 1, 0]);
  expect(sortRows(rows, (r) => r.breakages, "desc").map((r) => r.teamNumber)).toEqual([3, 1, 2]);
});

test("sharesByTeam gathers each team's split points", () => {
  const split = (teamNumber: number, points: number) => ({ matchUuid: "m", label: "", alliance: "red", teamNumber, allianceScore: 0, points });
  expect([...sharesByTeam([split(1, 10), split(2, 5), split(1, 20)])]).toEqual([[1, [10, 20]], [2, [5]]]);
});

test("heat cells shade by the measure and list the square's figures", () => {
  const c = teamCells([{ square: "A1", autoScored: 1, teleopScored: 2.333, pickedUp: 0 }], "scored").get("A1")!;
  expect(c.value).toBeCloseTo(3.333);
  expect(c.lines).toEqual([["Auto scored", "1"], ["Teleop scored", "2.33"], ["Picked up", "0"]]);
  expect(overlapCells([{ square: "B2", red: 3, blue: 1.5, both: 1.5 }]).get("B2")).toEqual({ value: 1.5, lines: [["Red use", "3"], ["Blue use", "1.5"], ["Both", "1.5"]] });
});

test("popPlace keeps a square's pop-up on the picture", () => {
  expect(popPlace(0, 0, 6, 6)).toMatchObject({ left: 18.75, below: true, lean: "right" });
  expect(popPlace(0, 0, 6, 6).top).toBeCloseTo(8.333);
  expect(popPlace(5, 5, 6, 6)).toMatchObject({ left: 81.25, below: false, lean: "left" });
  expect(popPlace(2, 3, 6, 6).lean).toBe("middle");
});

test("scoutingFirst takes the scouted figure, else the model's marked as such, else nothing", () => {
  expect(scoutingFirst(30, 50)).toEqual({ value: 30, model: false });
  expect(scoutingFirst(0, 50)).toEqual({ value: 0, model: false });
  expect(scoutingFirst(null, 50)).toEqual({ value: 50, model: true });
  expect(scoutingFirst(undefined, NaN)).toBeNull();
});

test("scoutedMatchPoints finds a match by type and number", () => {
  const mp = [{ label: "Q2", matchType: "qualification", matchNumber: 2, points: 31.5 }, { label: "P2", matchType: "playoff", matchNumber: 2, points: 60 }];
  expect(scoutedMatchPoints(mp, { level: "qual", number: 2 })).toBe(31.5);
  expect(scoutedMatchPoints(mp, { level: "playoff", number: 2 })).toBe(60);
  expect(scoutedMatchPoints(mp, { level: "qual", number: 3 })).toBeNull();
  expect(scoutedMatchPoints(undefined, { level: "qual", number: 2 })).toBeNull();
});

test("scoutedTotal adds an alliance's scouted figures only when every robot was scouted", () => {
  expect(scoutedTotal([{ matches: 2, points: 30, pointsLow: 20, pointsHigh: 40 }, { matches: 1, points: 10 }])).toEqual({ value: 40, low: 30, high: 50 });
  expect(scoutedTotal([{ matches: 2, points: 30 }, { matches: 0, points: 0 }])).toBeNull();
  expect(scoutedTotal([{ matches: 2, points: 30 }, undefined])).toBeNull();
  expect(scoutedTotal([])).toBeNull();
});
