import { expect, test } from "vitest";
import { MAPS_NOT_READY } from "./api";
import { createDevStrategyApi } from "./devApi";
import { addMaps } from "./logic";

const E = "dev-event-now";

test("the dev games cover every dev match and five more quals, with official scores only where played", async () => {
  const api = createDevStrategyApi();
  const [gs, ms] = await Promise.all([api.games(E), api.matches(E)]);
  expect(gs.length).toBe(ms.length + 5);
  ms.forEach((m) => expect(gs.find((g) => g.matchUuid === m.matchUuid)!.redScore != null).toBe(m.actualTime != null));
  expect(gs.filter((g) => g.level === "qual" && g.redScore == null).map((g) => g.number)).toEqual([11, 12, 13, 14, 15, 16]);
  gs.forEach((g) => expect([...g.red, ...g.blue].every((t) => t > 0)).toBe(true));
  expect(await api.games("dev-event-next")).toEqual([]);
});

test("the dev standing counts 3 RP a win, 1 a tie, 1 bonus at 70 points", async () => {
  const api = createDevStrategyApi();
  const ps = await api.projections(E);
  const bolt = ps.find((p) => p.teamNumber === 12345)!;
  // Q1 won 70 to 38 with a bonus, Q2 won 63 to 36: 7 RP over 2 quals.
  expect([bolt.rpNow, bolt.rsNow]).toEqual([7, 3.5]);
  expect(new Set(ps.map((p) => p.rankNow)).size).toBe(ps.length);
});

test("the dev match maps add the alliance's field maps", async () => {
  const api = createDevStrategyApi();
  const [maps, mm] = await Promise.all([api.fieldMaps(E), api.matchMaps(E, "dev-q11")]);
  expect(mm.label).toBe("Q11");
  expect(mm.red.robots.map((r) => r.teamNumber)).toEqual([11115, 14469]);
  expect(mm.red.squares).toEqual(addMaps(maps.filter((m) => m.teamNumber === 11115 || m.teamNumber === 14469)));
});

test("failMaps rejects the maps and splits as the real app does until they are switched on", async () => {
  const api = createDevStrategyApi({ failMaps: true });
  await expect(api.fieldMaps(E)).rejects.toThrow(MAPS_NOT_READY);
  await expect(api.pointSplits(E)).rejects.toThrow(MAPS_NOT_READY);
});

test("the dev cycles: times add up, routes share the timed cycles, and they fail like the maps when switched off", async () => {
  const cycles = await createDevStrategyApi().teamCycles(E);
  expect(cycles.map((c) => c.teamNumber)).toEqual([11115, 12345, 14469, 16021]);
  cycles.forEach((c) => {
    if (c.seconds != null) expect(c.collectSeconds! + c.travelSeconds! + c.shootSeconds!).toBeCloseTo(c.seconds, 0);
    expect(c.routes.reduce((a, r) => a + r.share, 0)).toBeLessThanOrEqual(1.01);
    c.routes.forEach((r) => expect(r.points).toHaveLength(12));
    expect(c.cyclesLow! <= c.cyclesPerMatch && c.cyclesPerMatch <= c.cyclesHigh!).toBe(true);
  });
  await expect(createDevStrategyApi({ failMaps: true }).teamCycles(E)).rejects.toThrow(MAPS_NOT_READY);
});

test("the dev cycles shoot from the upper half once mirrored, with one averaged cycle; the dev half maps stay in rows 1 to 3", async () => {
  const api = createDevStrategyApi();
  const [cycles, maps] = await Promise.all([api.teamCycles(E), api.fieldMaps(E)]);
  cycles.forEach((c) => {
    c.cycles.forEach((r) => expect(Number(r.to.slice(1))).toBeLessThanOrEqual(3));
    expect(c.average.length === 12 || (c.average.length === 0 && c.seconds == null)).toBe(true);
    expect(c.mirroredShare! >= 0 && c.mirroredShare! <= 1).toBe(true);
  });
  // 12345 shoots from C4 (row 4) on its main route: mirrored to C3.
  expect(cycles.find((c) => c.teamNumber === 12345)!.mirroredShare).toBeGreaterThan(0);
  maps.forEach((m) => m.half.forEach((s) => expect(Number(s.square.slice(1))).toBeLessThanOrEqual(3)));
});
