import { describe, expect, it } from "vitest";
import { CURRENT_FIELD_KEY, FIELDS } from "./field";
import { matchSummary, queuePill } from "./summary";

const field = FIELDS[CURRENT_FIELD_KEY];

describe("matchSummary", () => {
  it("splits scored pieces at the end of auto and counts intake squares", () => {
    expect(matchSummary([
      { seconds: 5, square: "A1", kind: "shoot", count: 3 },
      { seconds: 29.9, square: "A2", kind: "shoot", count: 1 },
      { seconds: 30, square: "B1", kind: "shoot", count: 2 },
      { seconds: 33, square: "C1", kind: "intake", count: 0 },
      { seconds: 90, square: "C2", kind: "intake", count: 0 },
    ], field)).toEqual({ autoScored: 4, teleopScored: 2, intakeSquares: 2 });
  });

  it("is all zeros with no taps", () => {
    expect(matchSummary([], field)).toEqual({ autoScored: 0, teleopScored: 0, intakeSquares: 0 });
  });
});

describe("queuePill", () => {
  it("shows the waiting count, and Offline when there is no signal", () => {
    expect(queuePill(true, 0)).toBe("0 unsent");
    expect(queuePill(true, 2)).toBe("2 unsent");
    expect(queuePill(false, 0)).toBe("Offline");
    expect(queuePill(false, 3)).toBe("Offline · 3 unsent");
  });
});
