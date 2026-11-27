import { expect, test } from "vitest";
import { CUSTOM, customGame, fourText, placeTeam, startTeams, swapSides, type Four } from "./custom";
import { buildMatchMaps } from "./logic";
import { scoutForecasts, type Strength } from "./scouted";
import type { TeamMap } from "./types";

const four: Four = [1, 2, 3, 4];

test("a custom match starts from the match on screen, else us and the lowest numbers", () => {
  expect(startTeams({ red: [5, 6], blue: [7, 8] }, [1, 2, 3], 1)).toEqual([5, 6, 7, 8]);
  expect(startTeams(null, [40, 10, 30, 20, 50], 30)).toEqual([30, 10, 20, 40]);
  expect(startTeams(null, [40, 10, 30, 20], 99)).toEqual([10, 20, 30, 40]);
  expect(startTeams(null, [1, 2, 3], 1)).toBeNull();
});

test("a team put in a slot swaps with a slot it already holds, so no team plays twice", () => {
  expect(placeTeam(four, 0, 9)).toEqual([9, 2, 3, 4]);
  expect(placeTeam(four, 0, 3)).toEqual([3, 2, 1, 4]);
  expect(placeTeam(four, 2, 3)).toEqual(four);
  expect(new Set(placeTeam(four, 1, 4)).size).toBe(4);
});

test("swapping sides keeps each pair's order", () => {
  expect(swapSides(four)).toEqual([3, 4, 1, 2]);
  expect(fourText(four)).toBe("1 2 v 3 4");
});

test("a custom match is forecast as a qualification still to play", () => {
  const st = new Map<number, Strength>([[1, { mean: 30, sd: 5, source: "scouted" }], [2, { mean: 20, sd: 5, source: "scouted" }],
    [3, { mean: 10, sd: 5, source: "scouted" }], [4, { mean: 10, sd: 5, source: "official" }]]);
  const [f] = scoutForecasts([customGame(four)], st, new Map([[1, 1]]), String);
  expect(f).toMatchObject({ matchUuid: CUSTOM, played: false, red: [1, 2], blue: [3, 4], redScore: 50, blueScore: 20, officialBlue: true, missing: [] });
  expect(f.pRed).toBeGreaterThan(0.99);
  expect(f.redRp).not.toBeNull();
  const [none] = scoutForecasts([customGame([1, 2, 3, 9])], st, new Map(), String);
  expect(none.missing).toEqual([9]);
  expect(none.pRed).toBeNull();
});

test("a custom match's maps put each robot's map on its side", () => {
  const map = (teamNumber: number, square: string): TeamMap => ({
    teamNumber, matches: 1, squares: [], half: [], aligned: [{ square, autoScored: 0, teleopScored: 2, pickedUp: 0 }],
  });
  const m = buildMatchMaps(CUSTOM, "Custom", [1, 2], [3, 4], [map(1, "A1"), map(3, "A1")]);
  expect(m.red.squares.map((s) => s.square)).toEqual(["A1"]);
  expect(m.blue.squares.map((s) => s.square)).toEqual(["F6"]);
  expect(m.red.robots.map((r) => r.teamNumber)).toEqual([1, 2]);
});
