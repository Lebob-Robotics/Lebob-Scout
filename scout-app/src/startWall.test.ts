import { test, expect } from "vitest";
import { FIELDS } from "./field";
import { startNearest, startSnap, startSquareFor, startXY, wallPoint } from "./startWall";

const f = FIELDS["ftc-2026"];
test("wall positions map to the wall", () => {
  expect(startXY(0)).toEqual({ x: 0.5, y: 0 });
  expect(startXY(50)).toEqual({ x: 0, y: 0 });
  expect(startXY(100)).toEqual({ x: 0, y: 0.5 });
  expect(startXY(150)).toEqual({ x: 0, y: 1 });
  expect(startXY(200)).toEqual({ x: 0.5, y: 1 });
});
test("the dot rests only where a robot may start", () => {
  expect(f.startOk).toEqual([[0, 9], [23, 67], [83, 109], [123, 200]]);
  expect(startSnap(5, f)).toBe(5);
  expect(startSnap(12, f)).toBe(9);
  expect(startSnap(20, f)).toBe(23);
  expect(startSnap(75, f)).toBe(67);     // 67 and 83 are equally far; the lower wins, as on the old site
  expect(startSnap(-40, f)).toBe(0);
  expect(startSnap(999, f)).toBe(200);
  expect(startSnap(100.4, f)).toBe(100);
});
test("a tap finds the nearest allowed spot", () => {
  expect(startNearest(0, 0.5, f)).toBe(100);
  expect(startNearest(0.9, 0.5, f)).toBe(startSnap(startNearest(0.9, 0.5, f), f));   // always allowed
});
test("blue is the same path turned a half-turn", () => {
  expect(wallPoint(100, "red")).toEqual({ x: 0, y: 0.5 });
  expect(wallPoint(100, "blue")).toEqual({ x: 1, y: 0.5 });
  expect(wallPoint(0, "blue")).toEqual({ x: 0.5, y: 1 });
});
test("the square is in the field frame", () => {
  expect(startSquareFor(105, "red", f)).toBe("A4");    // y 0.55, fourth row
  expect(startSquareFor(105, "blue", f)).toBe("F3");   // turned: x 1, y 0.45
  expect(startSquareFor(50, "red", f)).toBe("A1");
  expect(startSquareFor(150, "red", f)).toBe("A6");
  expect(startSquareFor(0, "red", f)).toBe("D1");
  expect(startSquareFor(200, "blue", f)).toBe("D1");   // turned: x 0.5, y 0
});
