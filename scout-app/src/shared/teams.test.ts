import { test, expect } from "vitest";
import { cellName, cellTarget, clockTime, coverageLine, gapRows, noteLine } from "./teams";

const now = new Date(2026, 10, 25, 18, 0).getTime(); // a Wednesday evening, phone's own time

test("clockTime adds the short weekday only for a time on another day", () => {
  expect(clockTime(new Date(2026, 10, 25, 9, 0).toISOString(), now)).toBe("9:00\u00a0am");
  expect(clockTime(new Date(2026, 10, 25, 23, 59).toISOString(), now)).toBe("11:59\u00a0pm");
  expect(clockTime(new Date(2026, 10, 22, 9, 0).toISOString(), now)).toBe("Sun 9:00\u00a0am");
  expect(clockTime(new Date(2026, 10, 21, 16, 10).toISOString(), now)).toBe("Sat 4:10\u00a0pm");
  expect(clockTime(new Date(2026, 10, 26, 0, 5).toISOString(), now)).toBe("Thu 12:05\u00a0am");
});

test("noteLine names the event and how a match counts as played", () => {
  expect(noteLine("WA Qualifier", "times")).toBe("WA Qualifier · A match counts as played once it is scouted or its start time passes.");
  expect(noteLine("WA Qualifier", "scouted")).toBe("WA Qualifier · The schedule has no start times, so matches up to the last one anyone scouted count as played.");
  expect(noteLine("WA Qualifier", "none")).toBe("WA Qualifier · No schedule for this event yet.");
});

const cov = { rows: [], slots: 8, have: 5, duplicates: 1, strays: 0, unscheduled: 0, playedBy: "times" };

test("coverageLine counts from the figures given, adding strays and unscheduled only above zero", () => {
  expect(coverageLine(cov)).toBe("5 of 8 robot-matches have a report · 3 missing · 1 with more than one");
  expect(coverageLine({ ...cov, strays: 2, unscheduled: 1 })).toBe(
    "5 of 8 robot-matches have a report · 3 missing · 1 with more than one · 2 for a team not in that match (check team numbers) · 1 for matches not in the schedule",
  );
  expect(coverageLine({ ...cov, unscheduled: 3 })).toBe("5 of 8 robot-matches have a report · 3 missing · 1 with more than one · 3 for matches not in the schedule");
});

const cell = (reports: number, alliance = "red") => ({ teamNumber: 12345, name: "Bolt", alliance, presenceUuid: "p1", teamUuid: "t1", reports });
const row = (label: string, played: boolean, reports: number[]) => ({
  matchUuid: `m-${label}`, matchType: "qualification", matchNumber: Number(label.slice(1)), label, played, cells: reports.map((n) => cell(n)),
});

test("gapRows keeps played rows where some robot has no report or more than one", () => {
  const rows = [row("Q1", true, [1, 2, 1, 1]), row("Q2", true, [1, 1, 1, 1]), row("Q3", true, [1, 0, 1, 1]), row("Q4", false, [0, 0, 0, 0])];
  expect(gapRows(rows).map((r) => r.label)).toEqual(["Q1", "Q3"]);
  expect(gapRows([rows[1], rows[3]])).toEqual([]);
});

test("cellTarget builds the robot's target, empty ids becoming null", () => {
  const r = row("Q3", false, [0]);
  expect(cellTarget("e1", r, r.cells[0])).toEqual({
    eventUuid: "e1", matchUuid: "m-Q3", presenceUuid: "p1", teamUuid: "t1",
    matchNumber: 3, matchType: "qualification", teamNumber: 12345, alliance: "red",
  });
  const bare = { ...r, matchUuid: "", matchType: "playoff" };
  expect(cellTarget("e1", bare, { ...cell(0, "blue"), presenceUuid: "", teamUuid: "" })).toMatchObject({
    matchUuid: null, presenceUuid: null, teamUuid: null, matchType: "playoff", alliance: "blue",
  });
});

test("cellTarget refuses a match type or alliance it does not know", () => {
  const r = row("Q3", false, [0]);
  expect(cellTarget("e1", { ...r, matchType: "practice" }, r.cells[0])).toBeNull();
  expect(cellTarget("e1", r, cell(0, "Red"))).toBeNull();
});

test("cellName says the match, alliance, team, reports and what a tap does", () => {
  const r = row("Q3", false, [0]);
  expect(cellName(r, r.cells[0])).toBe("Q3, red, 12345 Bolt, no report, scout this robot");
  expect(cellName(r, cell(1, "blue"))).toBe("Q3, blue, 12345 Bolt, 1 report, scout this robot");
  expect(cellName(r, cell(3))).toBe("Q3, red, 12345 Bolt, 3 reports, scout this robot");
  expect(cellName(r, cell(3), false)).toBe("Q3, red, 12345 Bolt, 3 reports");
});

test("clockTime reads a moment on the event's clock when given its zone", () => {
  const at = Date.parse("2026-12-04T22:00:00Z"); // 9:00 am Saturday in Sydney, 6:00 am Saturday in Perth
  expect(clockTime("2026-12-04T22:00:00Z", at, "Australia/Sydney")).toBe("9:00 am");
  expect(clockTime("2026-12-04T22:00:00Z", at, "Australia/Perth")).toBe("6:00 am");
  expect(clockTime("2026-12-05T13:30:00Z", at, "Australia/Sydney")).toBe("Sun 12:30 am");
});

test("clockTime gives nothing for an empty or unreadable time, with or without a zone", () => {
  const at = Date.parse("2026-12-04T22:00:00Z");
  expect(clockTime("", now)).toBe("");
  expect(clockTime("", at, "Australia/Sydney")).toBe("");
  expect(clockTime("not a time", at, "Australia/Sydney")).toBe("");
});

test("clockTime reads a time with no zone as UTC, as the old site wrote them", () => {
  const at = Date.parse("2026-12-04T22:00:00Z");
  expect(clockTime("2026-12-04T22:00:00", at, "Australia/Sydney")).toBe("9:00 am");
});

test("noteLine says whose clock the times are on", () => {
  expect(noteLine("Australia Championship", "times", "Australia/Sydney"))
    .toBe("Australia Championship · A match counts as played once it is scouted or its start time passes. · Times are Sydney time.");
  expect(noteLine("Dev", "none")).toBe("Dev · No schedule for this event yet.");
});
