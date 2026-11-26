import { expect, test } from "vitest";
import {
  buildMatchMaps, defaultMatch, favouriteWon, historyChart, matchLabels, measureOf, nextOurs, nextSort, one, orderForecasts, partnersFor,
  pct, playedCount, rangeText, robotsOf, rsNeeded, scoutTiles, sideOf, sortRows, splitsByMatch, whole, winChance,
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

test("rangeText is rating ± 1.28 standard errors, blank with no error", () => {
  expect(rangeText(50, 10)).toBe("37.2–62.8");
  expect(rangeText(50, null)).toBe("");
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
  expect(robotsOf(fc(), splits.get("m")).map((r) => [r.team, r.side, r.points])).toEqual([[1, "red", 60], [2, "red", 30], [3, "blue", null], [4, "blue", null]]);
  expect(robotsOf(fc()).every((r) => r.points === null)).toBe(true);
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
    teleopPoints: 30, parkPoints: 2.5, autoScored: 1, cycles: 3, cycleSeconds: 22.25, squares: [], starts: [], reports: [], pits: [], breakages: [],
  }));
  expect([tiles.get("points / match"), tiles.get("auto pts"), tiles.get("cycle time"), tiles.get("driver 1-5"), tiles.get("matches")])
    .toEqual(["42", "8.3", "22.3s", "–", "2"]);
});
