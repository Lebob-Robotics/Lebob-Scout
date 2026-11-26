import { test, expect } from "vitest";
import {
  breakageFormOf, breakageMatch, buildBreakage, buildPit, emptyBreakageForm, emptyPitForm, matchKey, myPit, optionLabel,
  parseMatchKey, pitFormOf,
} from "./pitBreakage";
import type { PitReport } from "./pitBreakage";

const pitBase = { pitReportId: "p1", eventCode: "AUCMP", scout: "Ann", createdAt: "2026-12-05T01:00:00.000Z" };
const brkBase = { breakageId: "b1", eventCode: "AUCMP", reporter: "Bo", createdAt: "2026-12-05T02:00:00.000Z" };

test("optionLabel turns hyphens into spaces and capitalises", () => {
  expect(optionLabel("tank-traction")).toBe("Tank traction");
  expect(optionLabel("unknown")).toBe("Unknown");
});

test("buildPit saves blanks as null, yes/no as booleans and numbers as numbers", () => {
  const f = { ...emptyPitForm(" 12345 "), drivetrain: "mecanum", canHive: "yes", canDefend: "no", weightKg: "12.5", autoTipsClaimed: "0", notes: "  " };
  const p = buildPit(f, pitBase);
  expect(p).toMatchObject({ ...pitBase, teamNumber: 12345, drivetrain: "mecanum", canHive: true, canDefend: false, canFlower: null, weightKg: 12.5, autoTipsClaimed: 0, notes: null, archetype: null });
});

test("buildPit refuses a missing or bad team number", () => {
  expect(() => buildPit(emptyPitForm(""), pitBase)).toThrow("team number");
  expect(() => buildPit(emptyPitForm("12a"), pitBase)).toThrow("team number");
});

test("a pit report comes back to the same form", () => {
  const f = { ...emptyPitForm("7"), archetype: "turret-shooter", canNectar: "no", heightInches: "18", knownIssues: "Chain slips" };
  expect(pitFormOf(buildPit(f, pitBase))).toEqual(f);
});

test("matchKey and parseMatchKey", () => {
  expect(matchKey("AUCMP", "q", 12)).toBe("AUCMP-q12");
  expect(matchKey("AUCMP", "p", 3)).toBe("AUCMP-p3");
  expect(matchKey("AUCMP", "q", null)).toBeNull();
  expect(parseMatchKey("AUPEQ-q4")).toEqual({ matchType: "q", matchNumber: 4 });
  expect(parseMatchKey(null)).toBeNull();
  expect(breakageMatch("AUCMP-p2")).toBe("P2");
  expect(breakageMatch(null)).toBe("pit/practice");
});

test("buildBreakage keys the match, keeps blank for pit or practice, and refuses a bad match number", () => {
  const f = { ...emptyBreakageForm("29550"), matchNumber: "4", matchType: "p" as const, severity: "0", recovered: "yes", component: "belt" };
  expect(buildBreakage(f, brkBase, "t-uuid")).toMatchObject({ teamNumber: 29550, teamUuid: "t-uuid", matchKey: "AUCMP-p4", severity: 0, recovered: true, component: "belt", cause: null });
  expect(buildBreakage({ ...f, matchNumber: "" }, brkBase, null).matchKey).toBeNull();
  expect(() => buildBreakage({ ...f, matchNumber: "0" }, brkBase, null)).toThrow("Match number");
});

test("a breakage comes back to the same form", () => {
  const f = { ...emptyBreakageForm("7"), matchNumber: "12", phase: "teleop", severity: "3", happenedBefore: "no", recurrence: "low" };
  expect(breakageFormOf(buildBreakage(f, brkBase, null))).toEqual(f);
});

test("myPit finds this scout's other report for the team at this event", () => {
  const pit = (over: Partial<PitReport>) => ({ ...buildPit(emptyPitForm("7"), pitBase), ...over });
  const pits = [pit({ pitReportId: "a" }), pit({ pitReportId: "b", scout: "Bo" }), pit({ pitReportId: "c", eventCode: "AUPEQ" })];
  expect(myPit(pits, 7, "Ann", "AUCMP")?.pitReportId).toBe("a");
  expect(myPit(pits, 7, "Ann", "AUCMP", "a")).toBeNull();
  expect(myPit(pits, 8, "Ann", "AUCMP")).toBeNull();
  expect(myPit(pits, null, "Ann", "AUCMP")).toBeNull();
});

test("toParams turns field names into the actions' snake_case and keeps null", async () => {
  const { toParams } = await import("./api");
  const p = buildPit({ ...emptyPitForm("7"), canFloorIntake: "yes" }, pitBase);
  expect(toParams(p)).toMatchObject({ pit_report_id: "p1", event_code: "AUCMP", team_number: 7, can_floor_intake: true, claimed_tips_per_match: null, created_at: pitBase.createdAt });
});
