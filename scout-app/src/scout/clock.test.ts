import { test, expect } from "vitest";
import { FIELDS } from "../shared/field";
import { matchSeconds, phaseAt, skipToTeleop } from "./clock";

const f = FIELDS["ftc-2026"];

test("phases", () => {
  expect(phaseAt(0, f)).toEqual({ phase: "auto", remaining: 30 });
  expect(phaseAt(30, f)).toEqual({ phase: "changeover", remaining: 8 });
  expect(phaseAt(38, f)).toEqual({ phase: "teleop", remaining: 120 });
  expect(phaseAt(98, f)).toEqual({ phase: "endgame", remaining: 60 });
  expect(phaseAt(158, f)).toEqual({ phase: "over", remaining: 0 });
  expect(phaseAt(200, f).phase).toBe("over");
});

test("clock", () => {
  expect(matchSeconds(1000, 13_340)).toBe(12.3);
  expect(skipToTeleop(100_000, f)).toBe(62_000);
});

test("the clock never reads below 0", () => {
  expect(matchSeconds(5000, 1000)).toBe(0); // the phone's clock went back
  expect(matchSeconds(1000, 950)).toBe(0);
});
