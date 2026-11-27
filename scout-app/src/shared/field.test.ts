import { test, expect } from "vitest";
import { FIELDS, squareName, flipSquare, isSquare } from "./field";

const f = FIELDS["ftc-2026"];

test("squares", () => {
  expect(squareName(0, 0)).toBe("A1");
  expect(squareName(5, 5)).toBe("F6");
  expect(flipSquare("A1", f)).toBe("F6");
  expect(flipSquare("C4", f)).toBe("D3");
  expect(isSquare("F6", f)).toBe(true);
  expect(isSquare("G1", f)).toBe(false);
  expect(isSquare("A7", f)).toBe(false);
});
