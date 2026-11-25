import { test, expect } from "vitest";
import { buildObservation } from "./observation";
import { draft, tap } from "./testHelpers";

test("observation", () => {
  const o = buildObservation(draft({ startedAtMs: 1_000_000, taps: [tap(12.3)], matchType: "qualification", matchNumber: 12, teamNumber: 29550 }), { id: "u1", name: "Sam Scout" }, 1_200_000);
  expect(o.label).toBe("Q12 · 29550");
  expect(o.tapSeconds).toEqual([12.3]);
  expect(o.timerStartedAt).toBe(new Date(1_000_000).toISOString());
  expect(o.createdAt).toBe(new Date(1_200_000).toISOString());
  expect(o.updatedAt).toBe(o.createdAt);
  expect(o.scoutUserId).toBe("u1");
  expect(() => buildObservation(draft({ taps: [{ seconds: 1, square: "Z9", kind: "shoot", count: 1 }] }), { id: "u1", name: "x" }, 0)).toThrow();
  expect(() => buildObservation(draft({ fieldKey: "nope" }), { id: "u1", name: "x" }, 0)).toThrow();
});

test("playoff label", () => {
  const o = buildObservation(draft({ matchType: "playoff", matchNumber: 3 }), { id: "u1", name: "x" }, 0);
  expect(o.label).toBe("P3 · 29550");
});
