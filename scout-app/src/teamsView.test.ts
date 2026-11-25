import { test, expect } from "vitest";
import type { ReportSummary, TeamProfile } from "./api";
import { chips, reportLine, shown } from "./teamsView";

const report = (r: Partial<ReportSummary> = {}): ReportSummary => ({
  observationId: "o1", teamNumber: 11115, matchType: "qualification", matchNumber: 3, alliance: "red",
  scoutUserId: "u1", scoutName: "Sam Scout", createdAt: "", autoScored: 4, teleopScored: 21, cycles: 9,
  autoPoints: 0, teleopPoints: 0, parkPoints: 0, ...r,
});
const team = (t: Partial<TeamProfile> = {}): TeamProfile => ({
  teamNumber: 11115, name: "Gluten Free", need: false, matches: 2, played: 2, toCome: 0, scheduled: 2,
  missing: [], twice: [], points: 15.6, autoPoints: 0, teleopPoints: 0, parkPoints: 0, autoScored: 0, cycles: 0,
  squares: [], starts: [], reports: [], ...t,
});

const teams = [
  team({ reports: [report({ scoutUserId: "u1" })] }),
  team({ teamNumber: 12345, name: "Bolt", need: true }),
  team({ teamNumber: 14469, name: "Perth Modern", need: true, reports: [report({ scoutUserId: "u2" })] }),
];
const numbers = (ts: TeamProfile[]) => ts.map((t) => t.teamNumber);

test("shown matches number or name without regard to case", () => {
  expect(numbers(shown(teams, "123", "all", "u1"))).toEqual([12345]);
  expect(numbers(shown(teams, " bOLT ", "all", "u1"))).toEqual([12345]);
  expect(numbers(shown(teams, "", "all", "u1"))).toEqual([11115, 12345, 14469]);
});

test("shown keeps teams that need scouting, or teams the user reported", () => {
  expect(numbers(shown(teams, "", "need", "u1"))).toEqual([12345, 14469]);
  expect(numbers(shown(teams, "", "mine", "u1"))).toEqual([11115]);
  expect(numbers(shown(teams, "perth", "mine", "u1"))).toEqual([]);
});

const texts = (t: TeamProfile) => chips(t).map((c) => `${c.text} (${c.tone})`);

test("chips: points and matches, or not scouted", () => {
  expect(chips(team())[0]).toEqual({ text: "≈16 pts · 2 matches", tone: "ok" });
  expect(chips(team({ matches: 1 }))[0]).toEqual({ text: "≈16 pts · 1 match", tone: "ok" });
  expect(chips(team({ matches: 0 }))[0]).toEqual({ text: "not scouted", tone: "warn" });
});

test("chips: scouted over played, with matches to come and the gaps", () => {
  expect(texts(team({ matches: 1, played: 2, toCome: 1, scheduled: 3, missing: ["Q2"], twice: ["Q1"] }))).toEqual([
    "≈16 pts · 1 match (ok)", "matches 1/2 · 1 to come (warn)", "missing Q2 (warn)", "twice in Q1 (plain)",
  ]);
  expect(texts(team())[1]).toBe("matches 2/2 (ok)");
  expect(texts(team({ matches: 0, played: 3, missing: ["Q2", "Q5", "Q7"] })).slice(1)).toEqual(["matches 0/3 (warn)", "missing Q2, Q5, Q7 (warn)"]);
  expect(texts(team({ twice: ["Q1", "Q4"] })).slice(1)).toEqual(["matches 2/2 (ok)", "twice in Q1, Q4 (plain)"]);
});

test("chips: matches to come when none are played, and matches alone with no schedule", () => {
  expect(texts(team({ matches: 0, played: 0, toCome: 3, scheduled: 3 }))[1]).toBe("3 matches to come (plain)");
  expect(texts(team({ matches: 0, played: 0, toCome: 1, scheduled: 1 }))[1]).toBe("1 match to come (plain)");
  expect(texts(team({ scheduled: 0, played: 0 }))[1]).toBe("2 matches (ok)");
  expect(texts(team({ matches: 1, scheduled: 0, played: 0 }))[1]).toBe("1 match (ok)");
  expect(texts(team({ matches: 0, scheduled: 0, played: 0 }))[1]).toBe("0 matches (warn)");
});

test("reportLine gives the match, auto, cycles, teleop scored and the scout", () => {
  expect(reportLine(report())).toBe("Q3 · 4 auto · 9 cycles · 21 scored · Sam Scout");
  expect(reportLine(report({ matchType: "playoff", matchNumber: 1, scoutName: "" }))).toBe("P1 · 4 auto · 9 cycles · 21 scored");
  expect(reportLine(report({ cycles: 1 }))).toBe("Q3 · 4 auto · 1 cycle · 21 scored · Sam Scout");
});
