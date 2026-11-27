import { expect, test } from "vitest";
import { fitOpr, oprHistory, oprReady, solve, type Played } from "./opr";

const g = (label: string, red: number[], blue: number[], redScore: number, blueScore: number): Played => ({ label, red, blue, redScore, blueScore });

test("solve handles a system that needs a row swap", () => {
  const x = solve([[0, 2, 1], [1, 1, 0], [2, 0, 3]], [5, 3, 9]);
  expect(x.map((v) => Math.round(v * 1e6) / 1e6)).toEqual([1.5, 1.5, 2]);
});

test("fitOpr recovers exact OPRs when every score is the sum of its robots", () => {
  const truth: Record<number, number> = { 1: 10, 2: 20, 3: 30, 4: 40 };
  const score = (ts: number[]) => ts.reduce((a, t) => a + truth[t], 0);
  const pairs: [number[], number[]][] = [[[1, 2], [3, 4]], [[1, 3], [2, 4]], [[1, 4], [2, 3]]];
  const games = pairs.map(([r, b], i) => g(`Q${i + 1}`, r, b, score(r), score(b)));
  const fit = fitOpr(games);
  [1, 2, 3, 4].forEach((t) => expect(fit.get(t)!.opr).toBeCloseTo(truth[t], 3));
  // 6 alliance scores, 4 teams, an exact fit: the error is 0.
  expect(fit.get(1)!.se).toBeCloseTo(0, 3);
});

test("fitOpr gives no range when there are no more scores than teams, and no OPR to a team that has not played", () => {
  const fit = fitOpr([g("Q1", [1, 2], [3, 4], 50, 30)]);
  expect(fit.get(1)!.se).toBeNull();
  expect(fit.get(1)!.opr + fit.get(2)!.opr).toBeCloseTo(50, 3);
  expect(fit.has(5)).toBe(false);
  expect(fitOpr([]).size).toBe(0);
});

test("fitOpr's error grows with how badly the scores fit", () => {
  const games = [
    g("Q1", [1, 2], [3, 4], 30, 70), g("Q2", [1, 3], [2, 4], 45, 55), g("Q3", [1, 4], [2, 3], 55, 45),
    g("Q4", [1, 2], [3, 4], 36, 64),
  ];
  const fit = fitOpr(games);
  expect(fit.get(1)!.se).toBeGreaterThan(0);
  expect(fit.get(4)!.opr).toBeGreaterThan(fit.get(1)!.opr);
});

test("a team the scores cannot tell apart from its partner has no range", () => {
  // 1 and 2 only ever play together; 3, 4, 5 and 6 mix.
  const games = [g("Q1", [1, 2], [3, 4], 60, 40), g("Q2", [1, 2], [5, 6], 64, 30), g("Q3", [3, 5], [4, 6], 38, 36), g("Q4", [3, 6], [4, 5], 35, 37)];
  const fit = fitOpr(games);
  expect(fit.get(1)!.se).toBeNull();
  expect(fit.get(1)!.opr).toBeCloseTo(fit.get(2)!.opr, 3);
  expect(fit.get(3)!.se).not.toBeNull();
});

test("oprHistory refits after each match and records every team fitted so far", () => {
  const h = oprHistory([g("Q1", [1, 2], [3, 4], 50, 30), g("Q2", [1, 3], [2, 4], 40, 40), g("Q3", [5, 6], [7, 8], 20, 25)]);
  expect(h.filter((p) => p.afterMatch === 1).map((p) => p.teamNumber)).toEqual([1, 2, 3, 4]);
  // After Q3, team 1 is still there: it did not play, but the fit now has more to go on.
  expect(h.filter((p) => p.teamNumber === 1).map((p) => p.afterMatch)).toEqual([1, 2, 3]);
  expect(h.filter((p) => p.afterMatch === 3).length).toBe(8);
  expect(h.filter((p) => p.teamNumber === 1).map((p) => [p.afterMatch, p.lastMatch])).toEqual([[1, "Q1"], [2, "Q2"], [3, "Q3"]]);
  expect(h.find((p) => p.afterMatch === 1 && p.teamNumber === 1)!.oprSe).toBeNull();
  expect(new Set(h.filter((p) => p.afterMatch === 3).map((p) => p.ratingRank))).toEqual(new Set([1, 2, 3, 4, 5, 6, 7, 8]));
});

test("oprReady waits until every scheduled team has played 3 scored matches", () => {
  const g = (red: number[], blue: number[]): Played => ({ label: "Q", red, blue, redScore: 50, blueScore: 40 });
  const three = [g([1, 2], [3, 4]), g([1, 3], [2, 4]), g([1, 4], [2, 3])];
  expect(oprReady([1, 2, 3, 4], three)).toBe(true);
  expect(oprReady([1, 2, 3, 4], three.slice(0, 2))).toBe(false);          // everyone on 2
  expect(oprReady([1, 2, 3, 4, 5], three)).toBe(false);                   // team 5 is scheduled but has played none
  expect(oprReady([], three)).toBe(false);
});
