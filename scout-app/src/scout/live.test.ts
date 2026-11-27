import { test, expect } from "vitest";
import { emptyLive, liveReducer } from "./live";
import type { LiveAction } from "./live";

const run = (...a: LiveAction[]) => a.reduce(liveReducer, emptyLive);

test("a record is mode, square, count", () => {
  const s = run({ type: "mode", mode: "shoot" }, { type: "square", square: "C4", seconds: 1 }, { type: "count", count: 3, seconds: 12.3 });
  expect(s.taps).toEqual([{ seconds: 12.3, square: "C4", kind: "shoot", count: 3 }]);
  expect(s.mode).toBe("shoot");
  expect(s.square).toBeNull();
});

test("out-of-order taps record nothing", () => {
  expect(run({ type: "count", count: 2, seconds: 1 }).taps).toEqual([]);
  expect(run({ type: "square", square: "A1", seconds: 1 })).toEqual(emptyLive);
  expect(run({ type: "mode", mode: "intake" }, { type: "count", count: 2, seconds: 1 }).taps).toEqual([]);
  expect(run({ type: "undo" })).toEqual(emptyLive);
});

test("changing mode clears the square", () => {
  expect(run({ type: "mode", mode: "shoot" }, { type: "square", square: "A1", seconds: 1 }, { type: "mode", mode: "intake" }).square).toBeNull();
});

test("undo removes the last record", () => {
  const s = run({ type: "mode", mode: "intake" }, { type: "square", square: "A1", seconds: 5 },
    { type: "mode", mode: "shoot" }, { type: "square", square: "B2", seconds: 8 }, { type: "count", count: 4, seconds: 9 }, { type: "undo" });
  expect(s.taps.map(t => t.square)).toEqual(["A1"]);
});

test("a count outside 1 to 4 is ignored", () => {
  const s = run({ type: "mode", mode: "shoot" }, { type: "square", square: "A1", seconds: 1 }, { type: "count", count: 5, seconds: 1 });
  expect(s.taps).toEqual([]);
  expect(s.square).toBe("A1");
});

test("taps stay the same object when nothing is recorded", () => {
  const s = run({ type: "mode", mode: "shoot" }, { type: "square", square: "A1", seconds: 1 }, { type: "count", count: 2, seconds: 3 });
  for (const a of [{ type: "mode", mode: "intake" }, { type: "count", count: 2, seconds: 4 }] as LiveAction[]) {
    expect(liveReducer(s, a).taps).toBe(s.taps);
  }
});

test("an intake square is recorded as soon as it is tapped", () => {
  const s = run({ type: "mode", mode: "intake" }, { type: "square", square: "A1", seconds: 5 }, { type: "square", square: "B2", seconds: 6.5 });
  expect(s.taps).toEqual([{ seconds: 5, square: "A1", kind: "intake", count: 0 }, { seconds: 6.5, square: "B2", kind: "intake", count: 0 }]);
  expect(s.area).toEqual(["A1", "B2"]);
  expect(s.square).toBeNull();
});

test("tapping a square in the area again removes that record", () => {
  const s = run({ type: "mode", mode: "intake" }, { type: "square", square: "A1", seconds: 5 }, { type: "square", square: "B2", seconds: 6 }, { type: "square", square: "A1", seconds: 7 });
  expect(s.taps.map(t => t.square)).toEqual(["B2"]);
  expect(s.area).toEqual(["B2"]);
});

test("leaving Intake ends the area and keeps its records", () => {
  const s = run({ type: "mode", mode: "intake" }, { type: "square", square: "A1", seconds: 5 }, { type: "mode", mode: "shoot" });
  expect(s.area).toEqual([]);
  expect(s.taps).toHaveLength(1);
  const again = run({ type: "mode", mode: "intake" }, { type: "square", square: "A1", seconds: 5 }, { type: "mode", mode: "intake" }, { type: "square", square: "A1", seconds: 9 });
  expect(again.taps.map(t => t.seconds)).toEqual([5, 9]);   // a new area: the same square is a new record
});

test("removing a square leaves an earlier area's record of it alone", () => {
  const s = run({ type: "mode", mode: "intake" }, { type: "square", square: "A1", seconds: 5 }, { type: "mode", mode: "intake" },
    { type: "square", square: "A1", seconds: 9 }, { type: "square", square: "A1", seconds: 10 });
  expect(s.taps.map(t => t.seconds)).toEqual([5]);
  expect(s.area).toEqual([]);
});

test("a count does nothing in Intake", () => {
  expect(run({ type: "mode", mode: "intake" }, { type: "square", square: "A1", seconds: 5 }, { type: "count", count: 3, seconds: 6 }).taps).toHaveLength(1);
});

test("undo inside an area takes the square back out of it", () => {
  const s = run({ type: "mode", mode: "intake" }, { type: "square", square: "A1", seconds: 5 }, { type: "square", square: "B2", seconds: 6 }, { type: "undo" });
  expect(s.taps.map(t => t.square)).toEqual(["A1"]);
  expect(s.area).toEqual(["A1"]);
});

test("shoot is unchanged", () => {
  const s = run({ type: "mode", mode: "shoot" }, { type: "square", square: "C4", seconds: 1 }, { type: "count", count: 3, seconds: 12.3 });
  expect(s.taps).toEqual([{ seconds: 12.3, square: "C4", kind: "shoot", count: 3 }]);
});
