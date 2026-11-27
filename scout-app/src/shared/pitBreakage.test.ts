import { test, expect } from "vitest";
import {
  breakageFormOf, breakageMatch, buildBreakage, buildPit, emptyBreakageForm, emptyPitForm, formMatchValue, matchFromValue, matchKey,
  matchOptionLabel, myPit, optionLabel, parseMatchKey, pitFormOf,
} from "./pitBreakage";
import type { BreakageReport, PitReport } from "./pitBreakage";

const pitBase = { pitReportId: "p1", eventCode: "AUCMP", scout: "Ann", createdAt: "2026-12-05T01:00:00.000Z" };
const brkBase = { breakageId: "b1", eventCode: "AUCMP", reporter: "Bo", createdAt: "2026-12-05T02:00:00.000Z" };

test("optionLabel turns hyphens into spaces and capitalises", () => {
  expect(optionLabel("tank-traction")).toBe("Tank traction");
  expect(optionLabel("unknown")).toBe("Unknown");
});

test("buildPit saves blanks as null and yes/no as booleans, with no photos by default", () => {
  const f = { ...emptyPitForm(" 12345 "), drivetrain: "mecanum", canHive: "yes", canFlower: "no", notes: "  " };
  const p = buildPit(f, pitBase);
  expect(p).toMatchObject({ ...pitBase, teamNumber: 12345, drivetrain: "mecanum", canHive: true, canFlower: false, canNectar: null, notes: null, archetype: null, images: [], photoIds: [] });
});

test("buildPit carries the photos kept and the new ones, as copies", () => {
  const photos = { images: ["ri.a.1"], photoIds: ["n1", "n2"] };
  const p = buildPit(emptyPitForm("7"), pitBase, photos);
  expect(p).toMatchObject(photos);
  expect(p.photoIds).not.toBe(photos.photoIds);
});

test("buildPit refuses a missing or bad team number", () => {
  expect(() => buildPit(emptyPitForm(""), pitBase)).toThrow("team number");
  expect(() => buildPit(emptyPitForm("12a"), pitBase)).toThrow("team number");
});

test("a pit report comes back to the same form", () => {
  const f = { ...emptyPitForm("7"), archetype: "turret-shooter", canNectar: "no", canFlowerIntake: "yes", notes: "Chain slips" };
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
  const f = { ...emptyBreakageForm("29550"), matchNumber: "4", matchType: "p" as const, severity: "0", component: "belt", notes: "Severe" };
  expect(buildBreakage(f, brkBase, "t-uuid")).toMatchObject({ teamNumber: 29550, teamUuid: "t-uuid", matchKey: "AUCMP-p4", severity: 0, component: "belt", notes: "Severe", mechanism: null });
  expect(buildBreakage({ ...f, matchNumber: "" }, brkBase, null).matchKey).toBeNull();
  expect(() => buildBreakage({ ...f, matchNumber: "0" }, brkBase, null)).toThrow("Match number");
});

test("a breakage comes back to the same form", () => {
  const f = { ...emptyBreakageForm("7"), matchNumber: "12", failureType: "jammed", severity: "3", notes: "Jammed on a flower" };
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

test("the match dropdown's value and the form's match boxes convert both ways", () => {
  expect(formMatchValue({ matchNumber: "12", matchType: "q" })).toBe("q12");
  expect(formMatchValue({ matchNumber: "", matchType: "p" })).toBe("");
  expect(formMatchValue({ matchNumber: "0", matchType: "q" })).toBe("");
  expect(matchFromValue("p3")).toEqual({ matchType: "p", matchNumber: "3" });
  expect(matchFromValue("")).toEqual({ matchType: "q", matchNumber: "" });
  expect(matchOptionLabel({ matchType: "qualification", matchNumber: 4, actualTime: null })).toBe("Q4");
  expect(matchOptionLabel({ matchType: "playoff", matchNumber: 2, actualTime: "x" })).toBe("P2 (played)");
});

test("pitParams turns field names into the actions' snake_case and keeps null", async () => {
  const { pitParams } = await import("./api");
  const p = buildPit({ ...emptyPitForm("7"), canFloorIntake: "yes" }, pitBase, { images: ["ri.a.1"], photoIds: ["n1"] });
  const params = pitParams(p, ["ri.a.1", "upload"]);
  expect(params).toMatchObject({ pit_report_id: "p1", event_code: "AUCMP", team_number: 7, can_floor_intake: true, can_hive: null, created_at: pitBase.createdAt, images: ["ri.a.1", "upload"] });
  expect("photo_ids" in params).toBe(false); // the ids of photos on the phone are not a Foundry field
});

test("pit and breakage parameters come from the kept fields only, so a report queued by an older build still sends", async () => {
  const { pitParams, breakageParams } = await import("./api");
  const oldPit = { ...buildPit(emptyPitForm("7"), pitBase), canDefend: true, claimedCycleSeconds: 9, knownIssues: "x" } as PitReport;
  expect(Object.keys(pitParams(oldPit, [])).sort()).toEqual(
    ["archetype", "can_floor_intake", "can_flower", "can_flower_intake", "can_hive", "can_nectar", "created_at", "drivetrain", "event_code", "images", "notes", "pit_report_id", "scout", "team_number"]);
  const oldBreakage = { ...buildBreakage(emptyBreakageForm("7"), brkBase, null), phase: "teleop", cause: "wear", recovered: true } as BreakageReport;
  expect(Object.keys(breakageParams(oldBreakage)).sort()).toEqual(
    ["breakage_id", "component", "created_at", "event_code", "failure_type", "match_key", "mechanism", "notes", "reporter", "severity", "team_number", "team_uuid"]);
  const bare = { pitReportId: "p", eventCode: "E", teamNumber: 7, scout: "A", createdAt: "t" } as PitReport; // no photo fields at all
  expect(pitParams(bare, []).drivetrain).toBeNull();
});
