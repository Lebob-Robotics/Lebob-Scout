import { expect, test } from "vitest";
import { centre, crossedSquares, cycleCells, cycleTime, cyclesFigure, onMap, roundedLine, routeLabel, routeLines, routeWidth, timeParts } from "./cycles";
import type { TeamCycles } from "./types";

const team = (t: Partial<TeamCycles> = {}): TeamCycles => ({ teamNumber: 1, matches: 2, cyclesPerMatch: 4.5, squares: [], routes: [], cycles: [], ...t });

test("cycleCells shades by the measure and lists all three figures", () => {
  const cells = cycleCells([{ square: "C3", passes: 2.5, intakes: 1, shots: 0.333 }], "intakes");
  expect(cells.get("C3")).toEqual({ value: 1, lines: [["Crossed", "2.5"], ["Collect", "1"], ["Shoot", "0.33"]] });
  expect(cycleCells([{ square: "C3", passes: 2.5, intakes: 1, shots: 0 }], "passes").get("C3")!.value).toBe(2.5);
});

test("points in squares land on the heatmap overlay, and a route is rounded with its ends kept", () => {
  expect(onMap({ x: 3, y: 1.5 })).toEqual([50, 25]);
  const line = roundedLine([{ x: 0.5, y: 0.5 }, { x: 3, y: 0.5 }, { x: 3, y: 3 }]);
  expect(line[0]).toEqual([8.3, 8.3]);
  expect(line.at(-1)).toEqual([50, 50]);
  expect(line.length).toBeGreaterThan(3);
});

test("cyclesFigure gives cycles per match with its low and high match, or nothing when not scouted", () => {
  expect(cyclesFigure(team({ cyclesLow: 3, cyclesHigh: 6 }))).toEqual({ value: 4.5, low: 3, high: 6 });
  expect(cyclesFigure(team())).toEqual({ value: 4.5, low: 4.5, high: 4.5 });
  expect(cyclesFigure(team({ matches: 0, cyclesPerMatch: 0 }))).toBeNull();
  expect(cyclesFigure(undefined)).toBeNull();
});

test("cycleTime is scouted first, then the pit report's claim, never anything else", () => {
  expect(cycleTime(team({ seconds: 14.2 }), [{ claimedCycleSeconds: 9 }])).toEqual({ value: 14.2, source: "scouted" });
  expect(cycleTime(team(), [{}, { claimedCycleSeconds: 9 }])).toEqual({ value: 9, source: "pit" });
  expect(cycleTime(undefined, [{ claimedCycleSeconds: 11 }])).toEqual({ value: 11, source: "pit" });
  expect(cycleTime(undefined, [])).toBeNull();
  expect(cycleTime(team(), [{}])).toBeNull();
});

test("timeParts splits the cycle time into collect, travel and shoot shares that add up", () => {
  const parts = timeParts(team({ seconds: 20, collectSeconds: 10, travelSeconds: 7.5, shootSeconds: 2.5 }))!;
  expect(parts.map((p) => [p.name, p.seconds, p.share])).toEqual([["collect", 10, 50], ["travel", 7.5, 37.5], ["shoot", 2.5, 12.5]]);
  expect(timeParts(team({ collectSeconds: 1, travelSeconds: 1 }))).toBeNull();
  expect(timeParts(team({ collectSeconds: 0, travelSeconds: 0, shootSeconds: 0 }))!.every((p) => p.share === 0)).toBe(true);
});

test("routes: width by share, a short label, and the pop-up lines", () => {
  expect(routeWidth(0)).toBe(2);
  expect(routeWidth(0.5)).toBe(6);
  expect(routeWidth(3)).toBe(10);
  const r = { points: [], cycles: 2.5, share: 0.42, seconds: 12.34, from: "C4", via: "E2", to: "C4" };
  expect(routeLabel(r)).toBe("x2.5 · 12.3s");
  expect(routeLabel({ ...r, seconds: undefined })).toBe("x2.5");
  expect(routeLines({ ...r, from: "" })).toEqual([["From", "teleop start"], ["Via", "E2"], ["To", "C4"], ["Time", "12.3s"], ["Cycles", "2.5 (42%)"]]);
});

test("crossedSquares lists every square a line passes through, once each", () => {
  expect(crossedSquares([centre("A1"), centre("C1")]).sort()).toEqual(["A1", "B1", "C1"]);
  expect(crossedSquares([centre("B2"), centre("B2")])).toEqual(["B2"]);
  expect(crossedSquares([centre("A1"), centre("B2")]).sort()).toEqual(["A1", "B2"]);
  expect(centre("C4")).toEqual({ x: 2.5, y: 3.5 });
});
