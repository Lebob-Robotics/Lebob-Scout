import { expect, test } from "vitest";
import { ordinal, ourView, playOut } from "./playout";
import type { Game, Strength } from "./scouted";
import type { Projection } from "./types";

const game = (number: number, red: [number, number], blue: [number, number], redScore: number | null = null, blueScore: number | null = null): Game =>
  ({ matchUuid: `m${number}`, level: "qual", number, time: null, red, blue, redScore, blueScore });
const proj = (teamNumber: number, rpNow: number, rankNow: number): Projection => ({
  teamNumber, teamName: "", rankNow, rpNow, rsNow: null, expRank: null, medianRank: null, expRs: null, pRank1: null, pTop4: null, pTop8: null,
  remaining: null, rsNeededRank1: null, rsNeededRank4: null, rsNeededRank8: null,
});
const st = (means: Record<number, number>) => new Map(Object.entries(means).map(([t, m]): [number, Strength] => [Number(t), { mean: m, sd: 5, source: "scouted" }]));

// Six teams; one match each played, one each to come.
const games = [
  game(1, [1, 2], [3, 4], 90, 50), game(2, [5, 6], [1, 3], 40, 70),
  game(3, [1, 4], [2, 5]), game(4, [3, 6], [2, 4]),
];
const projections = [proj(1, 6, 1), proj(2, 3, 2), proj(3, 3, 3), proj(4, 0, 4), proj(5, 0, 5), proj(6, 0, 6)];
const strength = st({ 1: 50, 2: 30, 3: 40, 4: 10, 5: 20, 6: 25 });

test("playOut gives each remaining qual to the higher scouted alliance, with bonus RP, and ranks by RS", () => {
  const p = playOut(games, projections, strength, new Map([[1, 1]]), 2);
  expect(p.finished).toBe(false);
  expect(p.remaining).toBe(2);
  const row = (t: number) => p.rows.find((r) => r.teamNumber === t)!;
  // Q3: 1+4 = 60 beats 2+5 = 50, and 1 and 4's bonus rates (1 and 0) average 0.5. Team 1 played Q1 and Q2 already.
  expect([row(1).predRp, row(1).predPlayed, row(1).predRs]).toEqual([9.5, 3, 3.17]);
  expect(row(4).predRp).toBe(3.5);
  // Q4: 3+6 = 65 beats 2+4 = 40.
  expect(row(3).predRp).toBe(6);
  expect(row(2).predRp).toBe(3);
  // RS: 1 9.5/3, 3 6/3, 6 3/2, 4 3.5/3, 2 3/3, 5 0/2.
  expect(p.rows.map((r) => r.teamNumber)).toEqual([1, 3, 6, 4, 2, 5]);
  expect(p.rows.map((r) => r.predRank)).toEqual([1, 2, 3, 4, 5, 6]);
});

test("alliance selection: captains by predicted rank, each picking the strongest free team, a captain can be picked", () => {
  const p = playOut(games, projections, strength, new Map(), 2);
  // 1 captains and picks 3, the next captain in line; 6 moves up to captain and picks 2 (30, the strongest left).
  expect(p.alliances.map((a) => [a.seed, a.captain, a.pick, a.strength])).toEqual([[1, 1, 3, 90], [2, 6, 2, 55]]);
  expect(p.alliances.map((a) => a.finish)).toEqual([1, 2]);
});

test("a level match, or one with a robot of no strength, gives 1 RP each", () => {
  const p = playOut([game(1, [1, 2], [3, 4])], [proj(1, 0, 1), proj(2, 0, 2), proj(3, 0, 3), proj(4, 0, 4)], st({ 1: 20, 2: 20, 3: 30 }), new Map(), 2);
  expect(p.rows.every((r) => r.predRp === 1)).toBe(true);
  const q = playOut([game(1, [1, 2], [3, 4])], [proj(1, 0, 1), proj(2, 0, 2), proj(3, 0, 3), proj(4, 0, 4)], st({ 1: 20, 2: 20, 3: 30, 4: 10 }), new Map(), 2);
  expect(q.rows.every((r) => r.predRp === 1)).toBe(true);
});

test("with no qualification left the last standings stand", () => {
  const done = [game(1, [1, 2], [3, 4], 90, 50)];
  const p = playOut(done, [proj(1, 3, 2), proj(2, 3, 1), proj(3, 0, 3), proj(4, 0, 4)], strength, new Map(), 2);
  expect(p.finished).toBe(true);
  expect(p.rows.map((r) => r.teamNumber)).toEqual([2, 1, 3, 4]);
  expect(p.rows[0].predRs).toBe(3);
});

test("ourView finds our alliance, partner, the alliance most likely to beat us, and the winner", () => {
  const p = playOut(games, projections, strength, new Map(), 2);
  expect(ourView(p, 2)).toMatchObject({ captain: false, partner: 6, threat: { seed: 1 }, winner: { seed: 1 } });
  expect(ourView(p, 1)).toMatchObject({ captain: true, partner: 3, threat: null });
  expect(ourView(p, 5)).toMatchObject({ alliance: null, partner: null, threat: null });
});

test("ordinal reads ranks as words do", () => {
  expect([1, 2, 3, 4, 11, 12, 13, 21, 22, 23, 101, 111].map(ordinal)).toEqual(["1st", "2nd", "3rd", "4th", "11th", "12th", "13th", "21st", "22nd", "23rd", "101st", "111th"]);
});
