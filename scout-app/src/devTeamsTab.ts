// The Teams tab for the dev stand-in: four teams, Q1 and Q2 played, Q3 to come.
// Q1: red 11115 (1 report), 12345 (2 reports); blue 14469 (none), 16021 (1).
// Q2: red 14469 (none), 16021 (1); blue 11115 (1), 12345 (none).
// So 5 of 8 played robot-matches have a report, one twice; 12345 and 14469 need scouting.
import type { ReportSummary, TeamsTab } from "./api";

const P = 20 / 7.5; // one piece scored, ftc-2026
const at = (minutes: number) => new Date(Date.now() + minutes * 60000).toISOString();
const Q1 = -90, Q2 = -60, Q3 = 30; // start times, minutes from now

const report = (r: Omit<ReportSummary, "matchType">): ReportSummary => ({ ...r, matchType: "qualification" });
const r1 = report({
  observationId: "dev-r1", teamNumber: 11115, matchNumber: 1, alliance: "red", scoutUserId: "dev-alice", scoutName: "Alice Nguyen", createdAt: at(Q1 + 4),
  autoScored: 2, teleopScored: 6, cycles: 3, cycleSeconds: 24.5, autoPoints: 3 + 2 * P, teleopPoints: 6 * P, parkPoints: 5,
});
const r2 = report({
  observationId: "dev-r2", teamNumber: 11115, matchNumber: 2, alliance: "blue", scoutUserId: "dev", scoutName: "Dev Scout", createdAt: at(Q2 + 3),
  autoScored: 1, teleopScored: 4, cycles: 2, cycleSeconds: 31, autoPoints: 3 + 5 + P, teleopPoints: 4 * P, parkPoints: 0,
});
const r3 = report({
  observationId: "dev-r3", teamNumber: 12345, matchNumber: 1, alliance: "red", scoutUserId: "dev-alice", scoutName: "Alice Nguyen", createdAt: at(Q1 + 5),
  autoScored: 3, teleopScored: 9, cycles: 4, cycleSeconds: 20, autoPoints: 3 + 5 + 3 * P, teleopPoints: 9 * P, parkPoints: 5,
});
const r4 = report({
  observationId: "dev-r4", teamNumber: 12345, matchNumber: 1, alliance: "red", scoutUserId: "dev-sam", scoutName: "Sam", createdAt: at(Q1 + 6),
  autoScored: 2, teleopScored: 7, cycles: 3, cycleSeconds: 22, autoPoints: 3 + 2 * P, teleopPoints: 7 * P, parkPoints: 5,
});
const r5 = report({
  observationId: "dev-r5", teamNumber: 16021, matchNumber: 1, alliance: "blue", scoutUserId: "dev-alice", scoutName: "Alice Nguyen", createdAt: at(Q1 + 5),
  autoScored: 0, teleopScored: 2, cycles: 1, autoPoints: 3 + 5, teleopPoints: 2 * P, parkPoints: 0,
});
const r6 = report({
  observationId: "dev-r6", teamNumber: 16021, matchNumber: 2, alliance: "red", scoutUserId: "dev", scoutName: "Dev Scout", createdAt: at(Q2 + 4),
  autoScored: 1, teleopScored: 3, cycles: 2, cycleSeconds: 40, autoPoints: P, teleopPoints: 3 * P, parkPoints: 5,
});

const NAMES: Record<number, string> = { 11115: "Gluten Free", 12345: "Bolt", 14469: "Perth Modern Robotics Collective", 16021: "Cogs and Sprockets" };
const cell = (teamNumber: number, alliance: string, matchNumber: number, reports: number) => ({
  teamNumber, name: NAMES[teamNumber], alliance, presenceUuid: `dev-q${matchNumber}-${teamNumber}`, teamUuid: `dev-team-${teamNumber}`, reports,
});
const next = { nextLabel: "Q3", nextTime: at(Q3) };
const counts = { played: 2, toCome: 1, scheduled: 3 };

export const DEV_TEAMS_TAB: TeamsTab = {
  needScouting: 2,
  scouts: [
    { scoutUserId: "dev-alice", scoutName: "Alice Nguyen", reports: 3, lastAt: at(Q1 + 5) },
    { scoutUserId: "dev", scoutName: "Dev Scout", reports: 2, lastAt: at(Q2 + 4) },
    { scoutUserId: "dev-sam", scoutName: "Sam", reports: 1, lastAt: at(Q1 + 6) },
  ],
  coverage: {
    slots: 8, have: 5, duplicates: 1, strays: 0, unscheduled: 0, playedBy: "times",
    rows: [
      { matchUuid: "dev-q1", matchType: "qualification", matchNumber: 1, label: "Q1", played: true, scheduledTime: at(Q1),
        cells: [cell(11115, "red", 1, 1), cell(12345, "red", 1, 2), cell(14469, "blue", 1, 0), cell(16021, "blue", 1, 1)] },
      { matchUuid: "dev-q2", matchType: "qualification", matchNumber: 2, label: "Q2", played: true, scheduledTime: at(Q2),
        cells: [cell(14469, "red", 2, 0), cell(16021, "red", 2, 1), cell(11115, "blue", 2, 1), cell(12345, "blue", 2, 0)] },
      { matchUuid: "dev-q3", matchType: "qualification", matchNumber: 3, label: "Q3", played: false, scheduledTime: at(Q3),
        cells: [cell(11115, "red", 3, 0), cell(14469, "red", 3, 0), cell(12345, "blue", 3, 0), cell(16021, "blue", 3, 0)] },
    ],
  },
  teams: [
    {
      teamNumber: 11115, name: NAMES[11115], need: false, matches: 2, ...counts, missing: [], twice: [], ...next,
      autoPoints: (r1.autoPoints + r2.autoPoints) / 2, teleopPoints: (r1.teleopPoints + r2.teleopPoints) / 2, parkPoints: 2.5,
      points: (r1.autoPoints + r2.autoPoints + r1.teleopPoints + r2.teleopPoints) / 2 + 2.5,
      autoScored: 1.5, cycles: 2.5, cycleSeconds: 27.75, driverSkill: 4, robotSpeed: 3.5,
      squares: [
        { square: "A1", scored: 0, pickedUp: 2 }, { square: "B2", scored: 2, pickedUp: 0 }, { square: "C3", scored: 4, pickedUp: 0 },
        { square: "D4", scored: 4, pickedUp: 0 }, { square: "F6", scored: 0, pickedUp: 3 },
      ],
      starts: [{ alliance: "red", wallPos: 30, label: "Q1" }, { alliance: "blue", wallPos: 120, label: "Q2" }],
      reports: [r1, r2],
    },
    {
      // Two reports in Q1, none in Q2: each figure is the mean of Q1's two reports.
      teamNumber: 12345, name: NAMES[12345], need: true, matches: 1, ...counts, missing: ["Q2"], twice: ["Q1"], ...next,
      autoPoints: (r3.autoPoints + r4.autoPoints) / 2, teleopPoints: (r3.teleopPoints + r4.teleopPoints) / 2, parkPoints: 5,
      points: (r3.autoPoints + r4.autoPoints + r3.teleopPoints + r4.teleopPoints) / 2 + 5,
      autoScored: 2.5, cycles: 3.5, cycleSeconds: 21, driverSkill: 3, robotSpeed: 4,
      squares: [{ square: "C4", scored: 5, pickedUp: 0 }, { square: "D3", scored: 3, pickedUp: 0 }, { square: "E2", scored: 0, pickedUp: 2.5 }],
      starts: [{ alliance: "red", wallPos: 60, label: "Q1" }],
      reports: [r3, r4],
    },
    {
      teamNumber: 14469, name: NAMES[14469], need: true, matches: 0, ...counts, missing: ["Q1", "Q2"], twice: [], ...next,
      points: 0, autoPoints: 0, teleopPoints: 0, parkPoints: 0, autoScored: 0, cycles: 0,
      squares: [], starts: [], reports: [],
    },
    {
      teamNumber: 16021, name: NAMES[16021], need: false, matches: 2, ...counts, missing: [], twice: [], ...next,
      autoPoints: (r5.autoPoints + r6.autoPoints) / 2, teleopPoints: (r5.teleopPoints + r6.teleopPoints) / 2, parkPoints: 2.5,
      points: (r5.autoPoints + r6.autoPoints + r5.teleopPoints + r6.teleopPoints) / 2 + 2.5,
      autoScored: 0.5, cycles: 1.5, cycleSeconds: 40, driverSkill: 2, robotSpeed: 2.5,
      squares: [{ square: "B5", scored: 3, pickedUp: 0 }, { square: "E5", scored: 2, pickedUp: 1 }],
      starts: [{ alliance: "blue", wallPos: 170, label: "Q1" }, { alliance: "red", wallPos: 100, label: "Q2" }],
      reports: [r5, r6],
    },
  ],
};
