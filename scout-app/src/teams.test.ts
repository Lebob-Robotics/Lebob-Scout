import { test, expect } from "vitest";
import { noteLine, scoutLine } from "./teams";

const scout = { scoutUserId: "u1", scoutName: "Alice", reports: 3, lastAt: new Date(2026, 10, 25, 14, 5).toISOString() };

test("scoutLine gives name, reports and the latest time in the phone's own time", () => {
  expect(scoutLine(scout, "u2")).toBe("Alice · 3 match reports · last 2:05 pm");
});

test("scoutLine marks the signed-in scout, says 1 report, and shows ? for no name", () => {
  expect(scoutLine({ ...scout, reports: 1 }, "u1")).toBe("Alice (you) · 1 match report · last 2:05 pm");
  expect(scoutLine({ ...scout, scoutName: "", lastAt: new Date(2026, 10, 25, 0, 30).toISOString() }, "u2")).toBe("? · 3 match reports · last 12:30 am");
  expect(scoutLine({ ...scout, lastAt: new Date(2026, 10, 25, 12, 0).toISOString() }, "u2")).toBe("Alice · 3 match reports · last 12:00 pm");
});

test("noteLine names the event and how a match counts as played", () => {
  expect(noteLine("WA Qualifier", "times")).toBe("WA Qualifier · A match counts as played once its start time passes.");
  expect(noteLine("WA Qualifier", "scouted")).toBe("WA Qualifier · The schedule has no start times, so matches up to the last one anyone scouted count as played.");
  expect(noteLine("WA Qualifier", "none")).toBe("WA Qualifier · No schedule for this event yet.");
});
