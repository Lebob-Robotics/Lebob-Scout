import { test, expect } from "vitest";
import { FIELDS } from "./field";
import { startNearest, startSnap, startSquareFor, startXY, startZoneText, wallPoint } from "./startWall";

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
});
test("a robot on the centre line is in its own half", () => {
  expect(startSquareFor(0, "red", f)).toBe("C1");
  expect(startSquareFor(200, "red", f)).toBe("C6");
  expect(startSquareFor(0, "blue", f)).toBe("D6");
  expect(startSquareFor(200, "blue", f)).toBe("D1");
});
test("off the centre line the square is as before", () => {
  // The rule before the centre-line fix: floor into the grid, capped at the last row and column.
  const before = (v: number, a: "red" | "blue") => {
    const { x, y } = wallPoint(v, a);
    return "ABCDEF"[Math.min(5, Math.floor(x * 6))] + (Math.min(5, Math.floor(y * 6)) + 1);
  };
  for (let v = 1; v <= 199; v++) for (const a of ["red", "blue"] as const) expect(startSquareFor(v, a, f)).toBe(before(v, a));
});

test("every allowed start position has the old site's stretch name", () => {
  const field = FIELDS["ftc-2026"];
  for (let v = 0; v <= 200; v++) if (field.startOk.some(([a, b]) => v >= a && v <= b)) expect(startZoneText(v)).not.toBeNull();
  expect(startZoneText(0)).toBe("LOADING side, by the centre line");
  expect(startZoneText(160)).toBe("GARDEN corner");
  expect(startZoneText(15)).toBeNull(); // not a place a robot may start
});
