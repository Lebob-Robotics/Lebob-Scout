import { test, expect } from "vitest";
import { FIELDS } from "./field";
import { checkTaps, toLists } from "./taps";
import type { Tap } from "./taps";

const f = FIELDS["ftc-2026"];

test("lists stay in step", () => {
  const taps: Tap[] = [{ seconds: 5, square: "A1", kind: "intake", count: 1 }, { seconds: 9, square: "B2", kind: "shoot", count: 4 }];
  expect(toLists(taps)).toEqual({ tapSeconds: [5, 9], tapSquares: ["A1", "B2"], tapKinds: ["intake", "shoot"], tapCounts: [1, 4] });
  expect(checkTaps(taps, f)).toEqual([]);
});

test("bad taps are reported", () => {
  expect(checkTaps([{ seconds: 5, square: "Z9", kind: "shoot", count: 1 }], f)).toHaveLength(1);
  expect(checkTaps([{ seconds: 5, square: "A1", kind: "shoot", count: 0 }], f)).toHaveLength(1);
  expect(checkTaps([{ seconds: 5, square: "A1", kind: "shoot", count: 5 }], f)).toHaveLength(1);
  expect(checkTaps([{ seconds: -1, square: "A1", kind: "shoot", count: 1 }], f)).toHaveLength(1);
});

test("bad kind and fractional count are reported", () => {
  expect(checkTaps([{ seconds: 5, square: "A1", kind: "dance" as never, count: 1 }], f)).toHaveLength(1);
  expect(checkTaps([{ seconds: 5, square: "A1", kind: "shoot", count: 1.5 }], f)).toHaveLength(1);
});
