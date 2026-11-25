import { test, expect } from "vitest";
import { clamp100, decPath, encPath, simplifyPath } from "./autoPath";
import type { Stroke } from "./autoPath";

test("text format matches the current site", () => {
  expect(encPath([[[0, 50], [20, 50]], [[20, 50], [20, 80]]])).toBe("0,50 20,50|20,50 20,80");
  expect(encPath([])).toBeNull();
  expect(decPath("0,50 20,50|20,50 20,80")).toEqual([[[0, 50], [20, 50]], [[20, 50], [20, 80]]]);
  expect(decPath(null)).toEqual([]);
  expect(decPath("junk")).toEqual([]);
});
test("a long stroke is cut to 30 points and keeps its ends", () => {
  const long: Stroke = Array.from({ length: 200 }, (_, i) => [i / 2, 50 + 10 * Math.sin(i / 5)]);
  const out = simplifyPath([long]);
  expect(out.flat().length).toBeLessThanOrEqual(30);
  expect(out[0][0]).toEqual(long[0]);
  expect(out[0].at(-1)).toEqual(long.at(-1));
});
test("clamp", () => {
  expect(clamp100(-0.2)).toBe(0);
  expect(clamp100(0.5)).toBe(50);
  expect(clamp100(1.3)).toBe(100);
});
