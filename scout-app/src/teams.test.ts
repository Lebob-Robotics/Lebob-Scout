import { test, expect } from "vitest";
import { cellName, cellTarget, coverageLine, gapRows, noteLine, scoutLine } from "./teams";

const scout = { scoutUserId: "u1", scoutName: "Alice", reports: 3, lastAt: new Date(2026, 10, 25, 14, 5).toISOString() };

test("scoutLine gives name, reports and the latest time in the phone's own time", () => {
  expect(scoutLine(scout, "u2")).toBe("Alice · 3 match reports · last 2:05\u00a0pm");
});

test("scoutLine marks the signed-in scout, says 1 report, and shows ? for no name", () => {
  expect(scoutLine({ ...scout, reports: 1 }, "u1")).toBe("Alice (you) · 1 match report · last 2:05\u00a0pm");
  expect(scoutLine({ ...scout, scoutName: "", lastAt: new Date(2026, 10, 25, 0, 30).toISOString() }, "u2")).toBe("? · 3 match reports · last 12:30\u00a0am");
  expect(scoutLine({ ...scout, lastAt: new Date(2026, 10, 25, 12, 0).toISOString() }, "u2")).toBe("Alice · 3 match reports · last 12:00\u00a0pm");
});

test("noteLine names the event and how a match counts as played", () => {
  expect(noteLine("WA Qualifier", "times")).toBe("WA Qualifier · A match counts as played once its start time passes.");
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
