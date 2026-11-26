import { expect, test } from "vitest";
import { MAPS_NOT_READY } from "./api";
import { createDevStrategyApi } from "./devApi";
import { addMaps } from "./logic";

const E = "dev-event-now";

test("the dev forecasts cover every dev match, with results for the played ones", async () => {
  const api = createDevStrategyApi();
  const [fs, ms] = await Promise.all([api.forecasts(E), api.matches(E)]);
  expect(fs.map((f) => f.matchUuid).sort()).toEqual(ms.map((m) => m.matchUuid).sort());
  fs.forEach((f) => expect(f.played).toBe(f.redActual != null));
  expect(await api.forecasts("dev-event-next")).toEqual([]);
});

test("the dev point splits add up to each alliance's score", async () => {
  const api = createDevStrategyApi();
  const [fs, splits] = await Promise.all([api.forecasts(E), api.pointSplits(E)]);
  fs.filter((f) => f.played).forEach((f) => {
    const red = splits.filter((s) => s.matchUuid === f.matchUuid && s.alliance === "red").reduce((a, s) => a + s.points, 0);
    expect(red).toBeCloseTo(f.redActual!, 1);
  });
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
