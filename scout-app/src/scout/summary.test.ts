import { describe, expect, it } from "vitest";
import { CURRENT_FIELD_KEY, FIELDS } from "../shared/field";
import { matchSummary, unsentNote } from "./summary";

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

describe("unsentNote", () => {
  it("is empty when nothing waits", () => {
    expect(unsentNote(true, 0, null)).toBe("");
    expect(unsentNote(false, 0, null)).toBe("");
  });

  it("counts the reports and says internet is needed", () => {
    expect(unsentNote(false, 1, null)).toBe("1 report hasn't been sent yet. This phone has no internet. Reports need internet to send, and send by themselves once it is back online.");
    expect(unsentNote(false, 3, "x")).toContain("3 reports haven't been sent yet. This phone has no internet.");
  });

  it("when online, says the last failure", () => {
    expect(unsentNote(true, 2, "timed out")).toBe("2 reports haven't been sent yet. They need internet to send. The last try failed: timed out. They try again by themselves.");
    expect(unsentNote(true, 2, null)).toContain("sending now");
  });
});
