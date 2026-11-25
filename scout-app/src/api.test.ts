import { test, expect } from "vitest";
import { PalantirApiError } from "@osdk/client";
import { isAlreadySaved, toCreateParams, toEventRow, toModifyParams, toObservation } from "./api";
import { obs } from "./testHelpers";

// Shaped like what the spike read back: nullable properties are missing, timestamps have no milliseconds.
const fromFoundry = {
  observationId: "o1", label: "Q1 · 29550", eventUuid: "e1", matchNumber: 1, matchType: "qualification", teamNumber: 29550, alliance: "red",
  autoLeave: false, autoPark: false, teleopPark: false, brokeDown: false, minorFouls: 0, majorFouls: 0, autoPathPoints: "",
  tapSeconds: [1.5], tapKinds: ["shoot"], tapSquares: ["C4"], tapCounts: [2],
  scoutUserId: "u1", scoutName: "Sam Scout", createdAt: "2026-11-25T10:00:00Z", updatedAt: "2026-11-25T10:00:00Z",
  timerStartedAt: "2026-11-25T09:57:00Z", fieldKey: "ftc-2026", startSquare: "C4",
};

test("toObservation reads missing nullables as null and an empty path as null", () => {
  const o = toObservation(fromFoundry);
  expect(o).toEqual({
    ...fromFoundry, matchUuid: null, presenceUuid: null, teamUuid: null,
    driverSkill: null, robotSpeed: null, autoNotes: null, notes: null, autoPathPoints: null, startWallPos: null,
  });
  expect(toObservation({ ...fromFoundry, autoPathPoints: "10,20;30,40" }).autoPathPoints).toBe("10,20;30,40");
});

test("toObservation defaults missing tap lists to empty", () => {
  const { tapSeconds: _s, tapKinds: _k, tapSquares: _q, tapCounts: _c, ...rest } = fromFoundry;
  const o = toObservation(rest);
  expect([o.tapSeconds, o.tapKinds, o.tapSquares, o.tapCounts]).toEqual([[], [], [], []]);
});

test("toCreateParams writes a null path as empty text and keeps other nulls", () => {
  const p = toCreateParams(obs("o1"));
  expect(p.auto_path_points).toBe("");
  expect(p.notes).toBeNull();
  expect(p.match_uuid).toBeNull();
  expect(Object.keys(p)).toHaveLength(32);
  expect(toCreateParams(obs("o1", { autoPathPoints: "1,2" })).auto_path_points).toBe("1,2");
});

test("toModifyParams merges a patch over the stored observation and sends all fields", () => {
  const current = obs("o1", { notes: "old", driverSkill: 4, autoPathPoints: "1,2|3,4" });
  const p = toModifyParams(current, { notes: "new" }, Date.parse("2026-11-25T12:00:00.000Z"));
  expect(p).toEqual({
    "j87bj1om.match-observation": "o1",
    label: "Q1 · 29550", match_uuid: null, presence_uuid: null, team_uuid: null,
    match_number: 1, match_type: "qualification", team_number: 29550, alliance: "red",
    auto_leave: false, auto_park: false, teleop_park: false, broke_down: false, minor_fouls: 0, major_fouls: 0,
    driver_skill: 4, robot_speed: null, auto_notes: null, notes: "new", auto_path_points: "1,2|3,4",
    updated_at: "2026-11-25T12:00:00.000Z",
  });
  expect(Object.keys(p)).toHaveLength(21); // 20 fields and the object reference
  expect(toModifyParams(current, { autoPathPoints: null }, 0).auto_path_points).toBe("");
  expect(toModifyParams(current, { notes: null }, 0).notes).toBeNull(); // null clears the stored value
});

test("toCreateParams sends the stored timestamps, even an empty updatedAt, without throwing", () => {
  expect(toCreateParams(obs("o1")).updated_at).toBe("2026-01-01T00:00:00.000Z");
  expect(toCreateParams(obs("o1", { updatedAt: "" })).updated_at).toBe("");
});

test("isAlreadySaved is true only for Foundry's ObjectAlreadyExists error", () => {
  expect(isAlreadySaved(new PalantirApiError("Failed to fetch 409 Conflict", "ObjectAlreadyExists", "CONFLICT", undefined, 409))).toBe(true);
  expect(isAlreadySaved(new PalantirApiError("Failed", "ObjectNotFound", "NOT_FOUND", undefined, 404))).toBe(false);
  expect(isAlreadySaved(new Error("ObjectAlreadyExists"))).toBe(false);
  expect(isAlreadySaved(undefined)).toBe(false);
});

test("toEventRow keeps only the date of each event day", () => {
  expect(toEventRow({ eventUuid: "e1", eventCode: "AUPEQ", eventName: "WA Qualifier", dateStart: "2026-11-15T00:00:00Z", dateEnd: "2026-11-16T00:00:00Z" }))
    .toEqual({ eventUuid: "e1", eventCode: "AUPEQ", eventName: "WA Qualifier", dateStart: "2026-11-15", dateEnd: "2026-11-16" });
});

// START-WALL: the create half waits for the regenerated SDK.
test.todo("create sends the wall position once the SDK has it");
test("modify does not send the wall position", () => {
  expect("start_wall_pos" in toModifyParams(obs("a"), {}, 0)).toBe(false);
});

test("toObservation reads the wall position, and a missing one as null", () => {
  expect(toObservation({ ...fromFoundry, startWallPos: 100 } as Parameters<typeof toObservation>[0]).startWallPos).toBe(100);
  expect(toObservation(fromFoundry).startWallPos).toBeNull();
});
