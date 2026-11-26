import { expect, test } from "vitest";
import {
  DEFAULT_SPREAD, allianceScore, bonusRates, chances, officialShare, phi, pooledSpread, scoutForecasts, spread, strengths, type Game, type Scouting,
} from "./scouted";
import type { Projection } from "./types";

const game = (number: number, red: [number, number], blue: [number, number], redScore: number | null = null, blueScore: number | null = null, level: "qual" | "playoff" = "qual"): Game =>
  ({ matchUuid: `m${number}`, level, number, time: null, red, blue, redScore, blueScore });
const mp = (matchNumber: number, points: number) => ({ matchType: "qualification", matchNumber, points });
const proj = (teamNumber: number, rpNow: number): Projection => ({
  teamNumber, teamName: "", rankNow: null, rpNow, rsNow: null, expRank: null, medianRank: null, expRs: null, pRank1: null, pTop4: null, pTop8: null,
  remaining: null, rsNeededRank1: null, rsNeededRank4: null, rsNeededRank8: null,
});

test("phi is the standard normal's cumulative chance", () => {
  expect(phi(0)).toBeCloseTo(0.5, 6);
  expect(phi(1.2816)).toBeCloseTo(0.9, 3);
  expect(phi(-1.96)).toBeCloseTo(0.025, 3);
});

test("spread and the pooled spread: own matches, else every scouted team's, else 15", () => {
  expect(spread([10, 20, 30])).toBe(10);
  expect(spread([10])).toBeNull();
  const a: Scouting = { matches: 3, points: 20, matchPoints: [mp(1, 10), mp(2, 20), mp(3, 30)] };
  const b: Scouting = { matches: 2, points: 50, matchPoints: [mp(1, 48), mp(2, 52)] };
  // (200 + 8) over (2 + 1) degrees of freedom.
  expect(pooledSpread([a, b, undefined])).toBeCloseTo(Math.sqrt(208 / 3), 6);
  expect(pooledSpread([{ matches: 1, points: 5, matchPoints: [mp(1, 5)] }])).toBe(DEFAULT_SPREAD);
});

test("officialShare: the alliance score less the scouted partner in that match, else half", () => {
  const sc = (t: number): Scouting => (t === 2 ? { matches: 1, points: 30, matchPoints: [mp(1, 35)] } : undefined);
  const g = game(1, [1, 2], [3, 4], 90, 60);
  expect(officialShare(g, 1, sc)).toBe(55);
  expect(officialShare(g, 3, sc)).toBe(30);
  expect(officialShare(game(2, [1, 2], [3, 4], 80, 40), 1, sc)).toBe(40); // 2 was not scouted in match 2
  expect(officialShare(game(3, [1, 2], [3, 4]), 1, sc)).toBeNull();
  expect(officialShare(g, 9, sc)).toBeNull();
});

test("strengths: scouted first, then the official share (marked), no strength for a team with neither", () => {
  const sc = (t: number): Scouting => (t === 1 ? { matches: 2, points: 40, matchPoints: [mp(1, 30), mp(2, 50)] } : t === 2 ? { matches: 1, points: 25, matchPoints: [mp(1, 25)] } : undefined);
  const games = [game(1, [1, 3], [2, 4], 70, 60), game(2, [3, 5], [1, 2], 50, 66), game(3, [5, 6], [1, 2])];
  const st = strengths([1, 2, 3, 4, 5, 6], games, sc);
  expect(st.get(1)).toEqual({ mean: 40, sd: spread([30, 50]), source: "scouted" });
  expect(st.get(2)).toEqual({ mean: 25, sd: spread([30, 50]), source: "scouted" }); // one match: the pooled spread
  // 3: match 1, 70 less 1's 30 = 40; match 2, half of 50 = 25.
  expect(st.get(3)).toEqual({ mean: 32.5, sd: spread([40, 25]), source: "official" });
  expect(st.get(4)!.mean).toBe(35); // 60 less 2's 25
  expect(st.has(6)).toBe(false);
});

test("bonusRates: RP now less 3 a win and 1 a tie, over quals played", () => {
  const games = [game(1, [1, 2], [3, 4], 80, 50), game(2, [1, 3], [2, 4], 40, 40), game(3, [1, 4], [2, 3]), game(4, [1, 2], [3, 4], 70, 10, "playoff")];
  const rates = bonusRates(games, [proj(1, 6), proj(3, 0), proj(9, 4)]);
  expect(rates.get(1)).toBe(1); // 6 RP, a win and a tie: 2 bonus over 2 quals
  expect(rates.get(3)).toBe(0); // never below 0
  expect(rates.get(9)).toBe(0); // no quals played
});

test("chances and expected scores follow the rule, with ties when the sides are level", () => {
  const c = chances({ mean: 60, sd: 6 }, { mean: 50, sd: 8 });
  expect(c.pRed).toBeCloseTo(phi(9.5 / 10), 6);
  expect(c.pBlue).toBeCloseTo(phi(-10.5 / 10), 6);
  expect(c.pRed + c.pBlue + c.pTie).toBeCloseTo(1, 9);
  expect(chances({ mean: 50, sd: 0 }, { mean: 50, sd: 0 })).toEqual({ pRed: 0, pBlue: 0, pTie: 1 });
  const st = new Map([[1, { mean: 30, sd: 3, source: "scouted" as const }], [2, { mean: 20, sd: 4, source: "official" as const }]]);
  expect(allianceScore([1, 2], st)).toEqual({ mean: 50, sd: 5, official: true });
  expect(allianceScore([1, 3], st)).toBeNull();
});

test("scoutForecasts: figures from strengths, RP with bonus, no figures when a robot has no data, hits judged on the forecast", () => {
  const st = new Map([1, 2, 3, 4].map((t) => [t, { mean: t * 10, sd: 5, source: "scouted" as const }]));
  const rates = new Map([[1, 1], [2, 0], [3, 0], [4, 0]]);
  const [played, coming, unknown] = scoutForecasts(
    [game(1, [3, 4], [1, 2], 60, 70), game(2, [1, 2], [3, 4]), game(3, [1, 9], [3, 4])], st, rates, (t) => `T${t}`,
  );
  expect([played.redScore, played.blueScore, played.redActual, played.blueActual]).toEqual([70, 30, 60, 70]);
  expect(played.preHit).toBe(false); // red was forecast to win and lost
  expect(coming.pBlue! > 0.99 && coming.redRp! < coming.blueRp!).toBe(true);
  expect(coming.redRp).toBeCloseTo(3 * coming.pRed! + coming.pTie! + 0.5, 2); // 1 and 2's bonus rates average 0.5
  expect(coming.redLow80).toBeCloseTo(30 - 1.28 * Math.sqrt(50), 1);
  expect(coming.redNames).toEqual(["T1", "T2"]);
  expect([unknown.redScore, unknown.pRed, unknown.missing]).toEqual([null, null, [9]]);
});
