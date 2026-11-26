import { expect, test } from "vitest";
import { SAME_AUTO, asDrawn, averagedAutos, chaikin, meanDistance, onOurSide, resample, shotMarks, turn, type AutoPath, type Pt } from "./autos";

const path = (label: string, alliance: string, points: string, shots?: AutoPath["shots"]): AutoPath => ({ label, alliance, points, ...(shots ? { shots } : {}) });

test("resample spreads points evenly by distance, keeping both ends", () => {
  expect(resample([[0, 0], [10, 0], [10, 10]], 5)).toEqual([[0, 0], [5, 0], [10, 0], [10, 5], [10, 10]]);
  expect(resample([[3, 4]], 3)).toEqual([[3, 4], [3, 4], [3, 4]]);
  expect(resample([[0, 0], [0, 0], [4, 0]], 3)).toEqual([[0, 0], [2, 0], [4, 0]]);
  expect(resample([], 4)).toEqual([]);
});

test("chaikin rounds the corners and keeps the ends", () => {
  const out = chaikin([[0, 0], [10, 0], [10, 10]], 1);
  expect(out).toEqual([[0, 0], [2.5, 0], [7.5, 0], [10, 2.5], [10, 7.5], [10, 10]]);
  expect(chaikin([[0, 0], [5, 5]], 3)).toEqual([[0, 0], [5, 5]]);
});

test("turn is the field's half-turn: a blue auto in red's frame", () => {
  expect(turn([4, 26])).toEqual([96, 74]);
  expect(meanDistance([[0, 0], [0, 10]], [[3, 4], [3, 14]])).toBe(5);
});

test("the dev data: the same route run on both sides is close, a different start is far", () => {
  const line = (p: string, blue = false) => resample(asDrawn([path("", "red", p)])[0].lines.flat().map((q) => (blue ? turn(q) : q)), 24);
  const same = meanDistance(line("4,22 16,26 30,38 40,46"), line("96,74 84,70 70,60 62,52", true));
  const other = meanDistance(line("6,40 22,42 40,50 52,54"), line("94,30 80,36 66,46 58,52", true));
  expect(same).toBeLessThan(SAME_AUTO);
  expect(other).toBeGreaterThan(SAME_AUTO * 2);
});

test("averagedAutos merges similar autos into one rounded path with averaged shots, on the side most ran", () => {
  const autos = averagedAutos([
    path("Q1", "red", "4,22 16,26 30,38 40,46|38,44", [{ square: "C3", count: 2 }]),
    path("Q2", "blue", "96,74 84,70 70,60 62,52", [{ square: "D4", count: 1 }]), // C3 turned is D4
    path("Q3", "red", "6,24 18,28 32,40 42,46", [{ square: "C3", count: 3 }, { square: "B2", count: 1 }]),
    path("Q4", "red", "6,70 30,80 50,90"),
    path("Q5", "blue", "", [{ square: "E5", count: 1 }]),
  ]);
  expect(autos.map((a) => a.labels)).toEqual([["Q1", "Q2", "Q3"], ["Q4"], ["Q5"]]);
  const merged = autos[0];
  expect(merged.alliance).toBe("red");
  expect(merged.lines).toHaveLength(1);
  expect(merged.lines[0][0][0]).toBeCloseTo(4.7, 0);
  expect(merged.lines[0].length).toBeGreaterThan(24); // rounded
  expect(merged.dots).toEqual([]);
  expect(merged.shots).toEqual([{ square: "B2", count: 0.3 }, { square: "C3", count: 2 }]);
  expect(autos[1].lines).toEqual([[[6, 70], [30, 80], [50, 90]]]); // a one-off stays as drawn
  expect(autos[2]).toEqual({ labels: ["Q5"], alliance: "blue", lines: [], dots: [], shots: [{ square: "E5", count: 1 }] });
});

test("a group mostly run on blue is drawn on blue's side, its shots turned with it", () => {
  const autos = averagedAutos([
    path("Q1", "blue", "96,74 84,70 70,60 62,52", [{ square: "D4", count: 2 }]),
    path("Q2", "blue", "96,76 84,72 70,62 62,54", [{ square: "D4", count: 2 }]),
    path("Q3", "red", "4,22 16,26 30,38 40,46", [{ square: "C3", count: 2 }]),
  ]);
  expect(autos).toHaveLength(1);
  expect(autos[0].alliance).toBe("blue");
  expect(autos[0].lines[0][0][0]).toBeGreaterThan(90);
  expect(autos[0].shots).toEqual([{ square: "D4", count: 2 }]);
});

test("asDrawn keeps every path, its spots and only real shots", () => {
  const [a] = asDrawn([path("Q1", "red", "4,22 16,26|38,44", [{ square: "C3", count: 2 }, { square: "Z9", count: 1 }, { square: "A1", count: 0 }])]);
  expect(a).toEqual({ labels: ["Q1"], alliance: "red", lines: [[[4, 22], [16, 26]]], dots: [[38, 44]], shots: [{ square: "C3", count: 2 }] });
});

test("shotMarks sits on the square's centre, side by side when autos share it, larger for more", () => {
  const auto = (shots: { square: string; count: number }[]) => ({ labels: [""], alliance: "red" as const, lines: [] as Pt[][], dots: [] as Pt[], shots });
  const marks = shotMarks([auto([{ square: "A1", count: 1 }, { square: "C3", count: 4 }]), auto([{ square: "C3", count: 1 }])]);
  expect(marks.map((m) => [m.auto, m.square, m.x, m.y])).toEqual([[0, "A1", 8.3, 8.3], [0, "C3", 38.7, 41.7], [1, "C3", 44.7, 41.7]]);
  expect(marks[1].r).toBeGreaterThan(marks[0].r);
});

test("onOurSide turns a blue auto to the left-hand side, shots and all, and leaves a red one", () => {
  const blue = { labels: ["Q1"], alliance: "blue" as const, lines: [[[90, 80], [70, 60]] as Pt[]], dots: [[60, 50] as Pt], shots: [{ square: "E4", count: 2 }] };
  expect(onOurSide(blue)).toEqual({ labels: ["Q1"], alliance: "red", lines: [[[10, 20], [30, 40]]], dots: [[40, 50]], shots: [{ square: "B3", count: 2 }] });
  const red = { ...blue, alliance: "red" as const };
  expect(onOurSide(red)).toBe(red);
});
