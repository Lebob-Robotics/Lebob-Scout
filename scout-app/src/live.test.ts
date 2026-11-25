import { test, expect } from "vitest";
import { emptyLive, liveReducer } from "./live";
import type { LiveAction } from "./live";

const run = (...a: LiveAction[]) => a.reduce(liveReducer, emptyLive);

test("a record is mode, square, count", () => {
  const s = run({ type: "mode", mode: "shoot" }, { type: "square", square: "C4" }, { type: "count", count: 3, seconds: 12.3 });
  expect(s.taps).toEqual([{ seconds: 12.3, square: "C4", kind: "shoot", count: 3 }]);
  expect(s.mode).toBe("shoot");
  expect(s.square).toBeNull();
});

test("out-of-order taps record nothing", () => {
  expect(run({ type: "count", count: 2, seconds: 1 }).taps).toEqual([]);
  expect(run({ type: "square", square: "A1" }).square).toBeNull();
  expect(run({ type: "mode", mode: "intake" }, { type: "count", count: 2, seconds: 1 }).taps).toEqual([]);
  expect(run({ type: "undo" })).toEqual(emptyLive);
});

test("changing mode clears the square", () => {
  expect(run({ type: "mode", mode: "shoot" }, { type: "square", square: "A1" }, { type: "mode", mode: "intake" }).square).toBeNull();
});

test("undo removes the last record", () => {
  const s = run({ type: "mode", mode: "intake" }, { type: "square", square: "A1" }, { type: "count", count: 1, seconds: 5 },
    { type: "square", square: "B2" }, { type: "count", count: 4, seconds: 9 }, { type: "undo" });
  expect(s.taps.map(t => t.square)).toEqual(["A1"]);
});

test("a count outside 1 to 4 is ignored", () => {
  const s = run({ type: "mode", mode: "shoot" }, { type: "square", square: "A1" }, { type: "count", count: 5, seconds: 1 });
  expect(s.taps).toEqual([]);
  expect(s.square).toBe("A1");
});
