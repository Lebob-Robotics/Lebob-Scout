import { test, expect } from "vitest";
import { obs } from "../shared/testHelpers";
import { changes, sortReports } from "./reports";

test("own reports first, newest first within each group", () => {
  const list = [
    obs("theirs-old", { scoutUserId: "u2", createdAt: "2026-01-01T09:00:00.000Z" }),
    obs("mine-old", { scoutUserId: "me", createdAt: "2026-01-01T08:00:00.000Z" }),
    obs("theirs-new", { scoutUserId: "u2", createdAt: "2026-01-01T11:00:00.000Z" }),
    obs("mine-new", { scoutUserId: "me", createdAt: "2026-01-01T10:00:00.000Z" }),
  ];
  expect(sortReports(list, "me").map((o) => o.observationId)).toEqual(["mine-new", "mine-old", "theirs-new", "theirs-old"]);
});

test("patch holds only changed fields, with a new label when the team changes", () => {
  const report = obs("o1", { tapSeconds: [3], tapSquares: ["C4"], tapKinds: ["shoot"], tapCounts: [1] });
  expect(changes(report, { ...report, teamNumber: 12345 }, { ...report, notes: "fast" }))
    .toEqual({ teamNumber: 12345, notes: "fast", label: "Q1 · 12345" });
});

test("no label when only answers change, empty when nothing changed", () => {
  const report = obs("o1");
  expect(changes(report, report, { ...report, brokeDown: true })).toEqual({ brokeDown: true });
  expect(changes(report, report, report)).toEqual({});
});
