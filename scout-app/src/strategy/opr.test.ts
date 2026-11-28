import { expect, test } from "vitest";
import { START_WEIGHT, carryOpr, fitOpr, invert, oprHistory, solve, type Played, type Start } from "./opr";

const g = (label: string, red: number[], blue: number[], redScore: number, blueScore: number): Played => ({ label, red, blue, redScore, blueScore });
const starts = (o: Record<number, number>, event = "PREV"): Map<number, Start> => new Map(Object.entries(o).map(([t, opr]) => [Number(t), { opr, event }]));
// Every pairing of four teams, `times` over, each score the sum of its robots' true OPRs.
const truth: Record<number, number> = { 1: 10, 2: 20, 3: 30, 4: 40 };
const score = (ts: number[]) => ts.reduce((a, t) => a + truth[t], 0);
const pairs: [number[], number[]][] = [[[1, 2], [3, 4]], [[1, 3], [2, 4]], [[1, 4], [2, 3]]];
const rounds = (times: number) => Array.from({ length: times }, (_, k) => pairs.map(([r, b], i) => g(`Q${k * 3 + i + 1}`, r, b, score(r), score(b)))).flat();

test("solve handles a system that needs a row swap", () => {
  const x = solve([[0, 2, 1], [1, 1, 0], [2, 0, 3]], [5, 3, 9]);
  expect(x.map((v) => Math.round(v * 1e6) / 1e6)).toEqual([1.5, 1.5, 2]);
});

test("invert gives the inverse, with a row swap", () => {
  const m = [[0, 2, 1], [1, 1, 0], [2, 0, 3]];
  const inv = invert(m);
  m.forEach((row, i) => m.forEach((_, j) => {
    expect(row.reduce((s, v, k) => s + v * inv[k][j], 0)).toBeCloseTo(i === j ? 1 : 0, 9);
  }));
});

test("before any match, a team's OPR is what it carried in, and a team with nothing carried has none", () => {
  const fit = fitOpr([], starts({ 1: 30, 2: 50 }), [1, 2, 3]);
  expect(fit.get(1)!.opr).toBeCloseTo(30, 9);
  expect(fit.get(2)!.opr).toBeCloseTo(50, 9);
  expect(fit.has(3)).toBe(false);
  // Its range before playing: noise (a third of a typical alliance score, 2 × 40) over the root of the start's weight.
  expect(fit.get(1)!.se).toBeCloseTo((0.33 * 80) / Math.sqrt(START_WEIGHT), 6);
  expect(fitOpr([], new Map(), [1, 2]).size).toBe(0);
  // Only scheduled teams are fitted from a carried OPR.
  expect(fitOpr([], starts({ 9: 30 }), [1]).size).toBe(0);
});

test("this event's scores take over from the carried OPR as matches are played", () => {
  // Everyone carried 25 in; the truth here is 10, 20, 30, 40.
  const start = starts({ 1: 25, 2: 25, 3: 25, 4: 25 });
  const off = (times: number) => {
    const fit = fitOpr(rounds(times), start, [1, 2, 3, 4]);
    return Math.max(...[1, 2, 3, 4].map((t) => Math.abs(fit.get(t)!.opr - truth[t])));
  };
  expect(off(1)).toBeGreaterThan(off(2));
  expect(off(2)).toBeGreaterThan(off(6));
  expect(off(6)).toBeLessThan(2);
  // After one round the order is already right.
  const one = fitOpr(rounds(1), start, [1, 2, 3, 4]);
  expect([1, 2, 3, 4].sort((a, b) => one.get(a)!.opr - one.get(b)!.opr)).toEqual([1, 2, 3, 4]);
});

test("a carried OPR tells partners apart from the first match", () => {
  // One match: 1 and 2 scored 60 together. 1 carried 45 in, 2 carried 15.
  const fit = fitOpr([g("Q1", [1, 2], [3, 4], 60, 40)], starts({ 1: 45, 2: 15, 3: 20, 4: 20 }), [1, 2, 3, 4]);
  expect(fit.get(1)!.opr).toBeCloseTo(45, 6);
  expect(fit.get(2)!.opr).toBeCloseTo(15, 6);
  // With nothing carried, the same match can only share the score evenly.
  const plain = fitOpr([g("Q1", [1, 2], [3, 4], 60, 40)]);
  expect(plain.get(1)!.opr).toBeCloseTo(plain.get(2)!.opr, 9);
  expect(plain.get(1)!.opr + plain.get(2)!.opr).toBeGreaterThan(50);
});

test("a team with no earlier event is pulled to this event's average robot", () => {
  // Average alliance score 50, so the average robot is 25. Team 5 has played once, in an alliance that scored 90.
  const games = [...rounds(1), g("Q4", [5, 1], [2, 3], 90, 50)];
  const fit = fitOpr(games, starts({ 1: 10, 2: 20, 3: 30, 4: 40 }), [1, 2, 3, 4, 5]);
  expect(fit.get(5)!.opr).toBeGreaterThan(40);
  expect(fit.get(5)!.opr).toBeLessThan(80);
  // It has played less than the others, so its range is wider.
  expect(fit.get(5)!.se).toBeGreaterThan(fit.get(1)!.se);
});

test("the range narrows with every match, and widens when the scores fit badly", () => {
  const start = starts(truth);
  const se = (games: Played[]) => fitOpr(games, start, [1, 2, 3, 4]).get(1)!.se;
  expect(se(rounds(1))).toBeLessThan(se([]));
  expect(se(rounds(3))).toBeLessThan(se(rounds(1)));
  const noisy = rounds(3).map((x, i) => ({ ...x, redScore: x.redScore + (i % 2 ? 25 : -25) }));
  expect(se(noisy)).toBeGreaterThan(se(rounds(3)));
});

test("carryOpr takes each team's OPR at its last earlier event, on that event's scores alone", () => {
  const first = { code: "ONE", games: rounds(3) };
  // At the second event team 1 has improved to 30; team 4 is not there, and team 5 is new.
  const now: Record<number, number> = { 1: 30, 2: 20, 3: 30, 5: 15 };
  const sc = (ts: number[]) => ts.reduce((a, t) => a + now[t], 0);
  const second = { code: "TWO", games: [g("Q1", [1, 2], [3, 5], sc([1, 2]), sc([3, 5])), g("Q2", [1, 3], [2, 5], sc([1, 3]), sc([2, 5])), g("Q3", [1, 5], [2, 3], sc([1, 5]), sc([2, 3]))] };
  const after1 = carryOpr([first]);
  // Nine matches at 40 a match, still held a little towards the average robot (25).
  expect(after1.get(4)!.event).toBe("ONE");
  expect(after1.get(4)!.opr).toBeGreaterThan(36);
  expect(after1.get(4)!.opr).toBeLessThan(40);
  const after2 = carryOpr([first, second, { code: "EMPTY", games: [] }]);
  // Team 4 keeps what it carried out of ONE; the others carry out of TWO.
  expect(after2.get(4)).toEqual(after1.get(4));
  expect(after2.get(5)!.event).toBe("TWO");
  expect(after2.get(1)!.event).toBe("TWO");
  // Team 1 is about 30 now: TWO alone decides it, with nothing held over from ONE (where it was about 10).
  expect(after1.get(1)!.opr).toBeLessThan(15);
  expect(after2.get(1)!.opr).toBeGreaterThan(27);
  expect(after2.get(1)!.opr).toEqual(fitOpr(second.games).get(1)!.opr);
  expect(carryOpr([]).size).toBe(0);
});

test("oprHistory starts from the carried OPRs, then refits after each match", () => {
  const games = [g("Q1", [1, 2], [3, 4], 50, 30), g("Q2", [1, 3], [2, 4], 40, 40), g("Q3", [5, 6], [7, 8], 20, 25)];
  const h = oprHistory(games, starts({ 1: 30, 2: 20 }, "AUBRQ2"), [1, 2, 3, 4, 5, 6, 7, 8]);
  // Before any match: only the teams that carried an OPR in, named after that event.
  expect(h.filter((p) => p.afterMatch === 0).map((p) => [p.teamNumber, p.lastMatch, p.opr])).toEqual([[1, "AUBRQ2", 30], [2, "AUBRQ2", 20]]);
  expect(h.filter((p) => p.afterMatch === 1).map((p) => p.teamNumber)).toEqual([1, 2, 3, 4]);
  // After Q3, team 1 is still there: it did not play, but the fit now has more to go on.
  expect(h.filter((p) => p.teamNumber === 1).map((p) => [p.afterMatch, p.lastMatch])).toEqual([[0, "AUBRQ2"], [1, "Q1"], [2, "Q2"], [3, "Q3"]]);
  expect(h.filter((p) => p.teamNumber === 5).map((p) => p.afterMatch)).toEqual([3]);
  expect(h.filter((p) => p.afterMatch === 3).length).toBe(8);
  expect(h.every((p) => p.oprSe != null && p.oprSe > 0)).toBe(true);
  expect(new Set(h.filter((p) => p.afterMatch === 3).map((p) => p.ratingRank))).toEqual(new Set([1, 2, 3, 4, 5, 6, 7, 8]));
  // With nothing carried in, the history starts at the first match.
  expect(oprHistory(games).some((p) => p.afterMatch === 0)).toBe(false);
});
