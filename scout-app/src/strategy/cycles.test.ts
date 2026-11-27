import { expect, test } from "vitest";
import { arrowHead, loopLine, averageCycle, averageLabel, centre, crossedSquares, alignCycle, foldNote, cycleCells, cycleTime, cyclesFigure, onMap, roundedLine, routeLabel, routeLines, routeWidth, timeParts } from "./cycles";
import type { TeamCycles } from "./types";

const team = (t: Partial<TeamCycles> = {}): TeamCycles => ({ teamNumber: 1, matches: 2, cyclesPerMatch: 4.5, squares: [], routes: [], cycles: [], average: [], ...t });

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

test("alignCycle mirrors a cycle whole so its shot is on the upper half, and folds the shot before", () => {
  // Shot from D5 (lower), collected at E2 and E6, starting from the shot before at C2 (upper): a swap of sides.
  const swap = { from: "C2", via: ["E2", "E6"], to: "D5", points: [centre("C2"), centre("E2"), centre("E6"), centre("D5")] };
  const f = alignCycle(swap);
  expect([f.from, f.via, f.to, f.mirrored]).toEqual(["C2", ["E5", "E1"], "D2", true]);
  expect(f.points).toEqual([centre("C2"), centre("E5"), centre("E1"), centre("D2")]);
  // Shot from the upper half: nothing mirrored, and what it collected below stays below (the map is the full field).
  const up = alignCycle({ via: ["A5", "A2"], to: "C3", points: [centre("A5"), centre("C3")] });
  expect([up.via, up.mirrored, up.points[0]]).toEqual([["A5", "A2"], false, centre("A5")]);
});

test("averageCycle averages every timed cycle's line by weight into 12 points", () => {
  const line = (y: number) => [{ x: 0, y }, { x: 6, y }];
  const avg = averageCycle([
    { points: line(1), seconds: 10, weight: 1 },
    { points: line(2), seconds: 12, weight: 0.5 },
    { points: line(2), seconds: 12, weight: 0.5 },
    { points: line(5), weight: 1 }, // the first cycle of teleop: no time, left out
  ]);
  expect(avg).toHaveLength(12);
  expect(avg[0]).toEqual({ x: 0, y: 1.5 });
  expect(avg[11]).toEqual({ x: 6, y: 1.5 });
  expect(averageCycle([{ points: line(1), weight: 1 }])).toEqual([]);
});

test("the averaged cycle's label and the fold note", () => {
  const rows = [{ seconds: 10, weight: 1 }, { seconds: 12, weight: 0.5 }, { weight: 1 }].map((r) => ({ label: "Q1", via: [], to: "C3", pieces: 1, points: [], mirrored: false, ...r }));
  expect(averageLabel({ seconds: 13.44, cycles: rows })).toBe("13.4s · 1.5 cycles");
  expect(averageLabel({ seconds: undefined, cycles: rows.slice(0, 1) })).toBe("1 cycle");
  expect(foldNote(0.4)).toBe("The yellow alliance's side. Each cycle is flipped so its shot is on the upper half (shot from the lower half: 40%).");
  expect(foldNote(0)).toBe("The yellow alliance's side. Each cycle is flipped so its shot is on the upper half (shot from the lower half: 0%).");
  expect(foldNote(undefined)).toBe("The yellow alliance's side. Each cycle is flipped so its shot is on the upper half.");
});

test("loopLine draws a trip back to its start as a loop, and leaves other trips alone", () => {
  // Shoot C1, collect D1 next to it, shoot C1: out and back on the same line.
  const loop = loopLine([centre("C1"), centre("D1"), centre("C1")]);
  expect(loop.length).toBeGreaterThan(20);
  expect(loop[0]).toEqual(centre("C1"));
  expect(loop[loop.length - 1].x).toBeCloseTo(2.5, 1);
  // The way out and the way back sit on opposite sides of the C1 to D1 line (y = 0.5).
  const out = loop[Math.round(loop.length * 0.25)], back = loop[Math.round(loop.length * 0.75)];
  expect(Math.sign(out.y - 0.5)).toBe(-Math.sign(back.y - 0.5));
  // A trip that never leaves its square is a small circle.
  const still = loopLine([centre("C1"), centre("C1")]);
  expect(Math.max(...still.map((p) => p.y)) - Math.min(...still.map((p) => p.y))).toBeCloseTo(0.6, 1);
  // A trip that ends somewhere else is drawn as it is.
  const open = [centre("C1"), centre("E4"), centre("B2")];
  expect(loopLine(open)).toEqual(open);
});

test("arrowHead points the way the line arrives", () => {
  const head = arrowHead([[0, 50], [50, 50], [100, 50]], 4)!;
  expect(head[0]).toEqual([100, 50]);
  expect(head[1][0]).toBeCloseTo(96, 0);
  expect(head[2][0]).toBeCloseTo(96, 0);
  expect(Math.abs(head[1][1] - head[2][1])).toBeGreaterThan(3);
  expect(arrowHead([[1, 1]])).toBeNull();
});
