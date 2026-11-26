import { expect, test } from "vitest";
import { fitAxis, hitIndex, matchName, niceStep, niceTicks, pickLabels, ratingChart } from "./chart";
import type { HistoryPoint } from "./types";

const pt = (afterMatch: number, opr: number, oprSe: number | null = 2, ratingRank: number | null = null): HistoryPoint =>
  ({ teamNumber: 1, afterMatch, lastMatch: `Q${afterMatch}`, opr, oprSe, ratingRank });

test("niceStep rounds to 1, 2, 2.5 or 5 times a power of ten", () => {
  expect([niceStep(0.7), niceStep(1.4), niceStep(2.3), niceStep(3.1), niceStep(7), niceStep(14), niceStep(0)]).toEqual([1, 2, 2.5, 5, 10, 20, 1]);
});

test("niceTicks covers the range with round ticks", () => {
  expect(niceTicks(41.3, 58.9)).toEqual({ min: 40, max: 60, ticks: [40, 45, 50, 55, 60] });
  expect(niceTicks(10, 10).ticks).toEqual([9, 9.5, 10, 10.5, 11]);
  expect(niceTicks(0, 4).ticks).toEqual([0, 1, 2, 3, 4]);
});

test("fitAxis fits the line, not the band: room is a quarter of the spread, some of the error (capped), or 2", () => {
  expect(fitAxis([pt(1, 40, 8), pt(2, 44, 8)])).toEqual({ lo: 34, hi: 50 }); // 0.75 × 8 = 6, not the full ±8
  expect(fitAxis([pt(1, 40, 20), pt(2, 44, 20)])).toEqual({ lo: 30, hi: 54 }); // a huge error is capped at 10
  expect(fitAxis([pt(1, 40, 3000), pt(2, 44, 3000), pt(3, 42, 1)])).toEqual({ lo: 30, hi: 54 }); // the median, capped
  expect(fitAxis([pt(1, 20, null), pt(2, 60, null)])).toEqual({ lo: 10, hi: 70 });
  expect(fitAxis([pt(1, 30, null)])).toEqual({ lo: 28, hi: 32 });
});

test("pickLabels keeps labels apart and always shows the first and last", () => {
  expect(pickLabels([0, 10, 20, 30, 40, 50], 24)).toEqual([0, 5]); // 30 and 50 would touch: the last one wins
  expect(pickLabels([0, 30, 60], 24)).toEqual([0, 1, 2]);
  expect(pickLabels([0, 10, 20, 30, 40, 50, 55], 24)).toEqual([0, 3, 6]);
  expect(pickLabels([5], 24)).toEqual([0]);
});

test("ratingChart scales dots into the plot, clips nothing it needs, and gives each match a strip", () => {
  const c = ratingChart([pt(9, 50, 4, 2), pt(1, 40), pt(5, 45)], 320, 160, { left: 30, right: 10, top: 10, bottom: 20 })!;
  expect(c.plot).toEqual({ x: 30, y: 10, w: 280, h: 130 });
  expect(c.dots.map((d) => d.x)).toEqual([30, 170, 310]);
  expect(c.dots.every((d) => d.y > 10 && d.y < 140)).toBe(true); // the line sits inside, not on an edge
  expect(c.hits).toEqual([{ x: 30, w: 70 }, { x: 100, w: 140 }, { x: 240, w: 70 }]);
  expect(c.ticks.map((t) => t.label)).toEqual(["35", "40", "45", "50", "55"]);
  expect(c.labels.map((l) => l.text)).toEqual(["Q1", "Q5", "Q9"]);
  expect(c.band.endsWith("Z")).toBe(true);
  expect(ratingChart([], 320, 160)).toBeNull();
  const one = ratingChart([pt(3, 30)], 320, 160, { left: 30, right: 10, top: 10, bottom: 20 })!;
  expect(one.dots[0].x).toBe(170);
  expect(one.hits).toEqual([{ x: 30, w: 280 }]);
});

test("matchName uses the stored label, else the match number", () => {
  expect(matchName(pt(4, 1))).toBe("Q4");
  expect(matchName({ ...pt(4, 1), lastMatch: null })).toBe("Q4");
  expect(matchName({ ...pt(4, 1), lastMatch: "P2" })).toBe("P2");
});

test("hitIndex finds the strip a point falls in", () => {
  const hits = [{ x: 30, w: 70 }, { x: 100, w: 140 }, { x: 240, w: 70 }];
  expect([hitIndex(hits, 10), hitIndex(hits, 99), hitIndex(hits, 100), hitIndex(hits, 300), hitIndex(hits, 999)]).toEqual([0, 0, 1, 2, 2]);
});
