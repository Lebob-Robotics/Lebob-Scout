// The Teams tab for the dev stand-in: eight teams, Q1 to Q10 played, Q11 to come.
// Q1: red 11115 (1 report), 12345 (2 reports); blue 14469 (none), 16021 (1).
// Q2: red 14469 (1), 16021 (1); blue 11115 (1), 12345 (1).
// Q3 to Q10: 18172, 19044, 21230 and 23511 every time, never scouted: each needs scouting, with a long missing list.
// Q11 (to come): red 11115, 14469; blue 12345, 16021.
// So 7 of 40 played robot-matches have a report, one twice; five teams need scouting (14469 has no report in Q1).
// These line-ups are the dev stand-in's schedule too (devApi), so a coverage cell opens set-up with it picked.
import type { ReportSummary, TeamsTab } from "./api";

const P = 20 / 7.5; // one piece scored, ftc-2026
const at = (minutes: number) => new Date(Date.now() + minutes * 60000).toISOString();
const Q1 = -90, Q2 = -60, Q11 = 30; // start times, minutes from now; Q3 to Q10 every 5 minutes from 55 minutes ago

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

const r7 = report({
  observationId: "dev-r7", teamNumber: 14469, matchNumber: 2, alliance: "red", scoutUserId: "dev-sam", scoutName: "Sam", createdAt: at(Q2 + 3),
  autoScored: 1, teleopScored: 3, cycles: 2, cycleSeconds: 35, autoPoints: 3 + P, teleopPoints: 3 * P, parkPoints: 5,
});
const r8 = report({
  observationId: "dev-r8", teamNumber: 12345, matchNumber: 2, alliance: "blue", scoutUserId: "dev", scoutName: "Dev Scout", createdAt: at(Q2 + 5),
  autoScored: 2, teleopScored: 8, cycles: 4, cycleSeconds: 18, autoPoints: 3 + 5 + 2 * P, teleopPoints: 8 * P, parkPoints: 5,
});

// A report's points; a match's points average its reports.
const pts = (...rs: ReportSummary[]) => rs.reduce((a, r) => a + r.autoPoints + r.teleopPoints + r.parkPoints, 0) / rs.length;
// Each scouted match's points, scouts averaged first, as the functions give them.
const mp = (matchNumber: number, ...rs: ReportSummary[]) => ({ label: `Q${matchNumber}`, matchType: "qualification", matchNumber, points: Math.round(pts(...rs) * 10) / 10 });
const note = (label: string, scoutName: string, createdAt: string, autoNotes?: string, notes?: string) =>
  ({ label, scoutName, createdAt, ...(autoNotes ? { autoNotes } : {}), ...(notes ? { notes } : {}) });

const NAMES: Record<number, string> = { 11115: "Gluten Free", 12345: "Bolt", 14469: "Perth Modern Robotics Collective", 16021: "Cogs and Sprockets",
  18172: "Wired Wombats", 19044: "Kelp Forest", 21230: "Null Pointers", 23511: "Spare Parts Society",
};
// Stations go red 1, red 2, blue 1, blue 2 in each row, as in devApi.
const cell = (teamNumber: number, alliance: string, station: number, matchNumber: number, reports: number) => ({
  teamNumber, name: NAMES[teamNumber], alliance, presenceUuid: `dev-q${matchNumber}-${alliance}${station}`, teamUuid: `dev-team-${teamNumber}`, reports,
});
const next = { nextLabel: "Q11", nextTime: at(Q11) };
const counts = { played: 2, toCome: 1, scheduled: 3 };
const UNSCOUTED = [18172, 19044, 21230, 23511];
const LATER = [3, 4, 5, 6, 7, 8, 9, 10];
const laterRow = (n: number) => {
  const [a, b, c, d] = n % 2 ? UNSCOUTED : [...UNSCOUTED.slice(2), ...UNSCOUTED.slice(0, 2)];
  return { matchUuid: `dev-q${n}`, matchType: "qualification", matchNumber: n, label: `Q${n}`, played: true, scheduledTime: at(-55 + (n - 3) * 5),
    cells: [cell(a, "red", 1, n, 0), cell(b, "red", 2, n, 0), cell(c, "blue", 1, n, 0), cell(d, "blue", 2, n, 0)] };
};

// As the functions give them: blank fields left out. They match the dev stand-in's seeded pit report and breakage.
const DEV_PIT = {
  pitReportId: "dev-pit-1", teamNumber: 12345, scout: "Alice Nguyen", createdAt: at(-60),
  drivetrain: "mecanum", archetype: "turret-shooter", canHive: true, canFloorIntake: true, notes: "Intake belt slips when hot",
};
const DEV_BREAKAGE = {
  breakageId: "dev-breakage-1", teamNumber: 16021, reporter: "Sam", createdAt: at(-60), matchKey: "DEVNOW-q2", matchLabel: "Q2",
  mechanism: "drive", component: "wheel hub", failureType: "loose-disconnected", severity: 3,
};

export const DEV_TEAMS_TAB: TeamsTab = {
  needScouting: 5,
  scouts: [
    { scoutUserId: "dev-alice", scoutName: "Alice Nguyen", reports: 3, pitReports: 1, breakages: 0, lastAt: at(Q1 + 5) },
    { scoutUserId: "dev", scoutName: "Dev Scout", reports: 3, pitReports: 0, breakages: 0, lastAt: at(Q2 + 5) },
    { scoutUserId: "dev-sam", scoutName: "Sam", reports: 2, pitReports: 0, breakages: 1, lastAt: at(Q2 + 3) },
  ],
  coverage: {
    slots: 40, have: 7, duplicates: 1, strays: 0, unscheduled: 0, playedBy: "times",
    rows: [
      { matchUuid: "dev-q1", matchType: "qualification", matchNumber: 1, label: "Q1", played: true, scheduledTime: at(Q1),
        cells: [cell(11115, "red", 1, 1, 1), cell(12345, "red", 2, 1, 2), cell(14469, "blue", 1, 1, 0), cell(16021, "blue", 2, 1, 1)] },
      { matchUuid: "dev-q2", matchType: "qualification", matchNumber: 2, label: "Q2", played: true, scheduledTime: at(Q2),
        cells: [cell(14469, "red", 1, 2, 1), cell(16021, "red", 2, 2, 1), cell(11115, "blue", 1, 2, 1), cell(12345, "blue", 2, 2, 1)] },
      ...LATER.map(laterRow),
      { matchUuid: "dev-q11", matchType: "qualification", matchNumber: 11, label: "Q11", played: false, scheduledTime: at(Q11),
        cells: [cell(11115, "red", 1, 11, 0), cell(14469, "red", 2, 11, 0), cell(12345, "blue", 1, 11, 0), cell(16021, "blue", 2, 11, 0)] },
    ],
  },
  teams: [
    {
      teamNumber: 11115, name: NAMES[11115], need: false, matches: 2, ...counts, missing: [], twice: [], ...next,
      autoPoints: (r1.autoPoints + r2.autoPoints) / 2, teleopPoints: (r1.teleopPoints + r2.teleopPoints) / 2, parkPoints: 2.5,
      points: (r1.autoPoints + r2.autoPoints + r1.teleopPoints + r2.teleopPoints) / 2 + 2.5,
      autoScored: 1.5, cycles: 2.5, cycleSeconds: 27.75, driverSkill: 4, robotSpeed: 3.5,
      pointsLow: Math.min(pts(r1), pts(r2)), pointsHigh: Math.max(pts(r1), pts(r2)),
      leaveRate: 1, autoParkRate: 0.5, teleopParkRate: 0.5, minorFouls: 0.5, majorFouls: 0, brokeDownMatches: 0,
      notes: [
        note("Q2", "Dev Scout", r2.createdAt, "Left, shot one, parked", "Slow to line up at the HIVE, missed two late shots"),
        note("Q1", "Alice Nguyen", r1.createdAt, undefined, "Good driver, picks up from the far corner every time"),
      ],
      autoPaths: [
        { label: "Q1", alliance: "red", points: "4,22 16,26 30,38 40,46|38,44", shots: [{ square: "C3", count: 2 }] },
        { label: "Q2", alliance: "blue", points: "96,74 84,70 70,60 62,52|62,52", shots: [{ square: "D4", count: 1 }] },
      ],
      matchPoints: [mp(1, r1), mp(2, r2)],
      squares: [
        { square: "A1", scored: 0, pickedUp: 2 }, { square: "B2", scored: 2, pickedUp: 0 }, { square: "C3", scored: 4, pickedUp: 0 },
        { square: "D4", scored: 4, pickedUp: 0 }, { square: "F6", scored: 0, pickedUp: 3 },
      ],
      starts: [{ alliance: "red", wallPos: 30, label: "Q1" }, { alliance: "blue", wallPos: 120, label: "Q2" }],
      reports: [r1, r2], pits: [], breakages: [],
    },
    {
      // Two reports in Q1, one in Q2: each figure averages Q1's two reports first, then the two matches.
      teamNumber: 12345, name: NAMES[12345], need: false, matches: 2, ...counts, missing: [], twice: ["Q1"], ...next,
      autoPoints: ((r3.autoPoints + r4.autoPoints) / 2 + r8.autoPoints) / 2, teleopPoints: ((r3.teleopPoints + r4.teleopPoints) / 2 + r8.teleopPoints) / 2, parkPoints: 5,
      points: ((r3.autoPoints + r4.autoPoints + r3.teleopPoints + r4.teleopPoints) / 2 + r8.autoPoints + r8.teleopPoints) / 2 + 5,
      autoScored: 2.25, cycles: 3.75, cycleSeconds: 19.5, driverSkill: 3, robotSpeed: 4,
      pointsLow: Math.min(pts(r3, r4), pts(r8)), pointsHigh: Math.max(pts(r3, r4), pts(r8)),
      leaveRate: 1, autoParkRate: 1, teleopParkRate: 1, minorFouls: 0.25, majorFouls: 0.5, brokeDownMatches: 0,
      notes: [
        note("Q2", "Dev Scout", r8.createdAt, "Three in auto, very quick", "Fastest cycles here. Got a major for pinning"),
        note("Q1", "Sam", r4.createdAt, undefined, "Turret keeps shooting while it drives"),
        note("Q1", "Alice Nguyen", r3.createdAt, "Clean auto"),
      ],
      autoPaths: [
        { label: "Q1", alliance: "red", points: "6,40 22,42 40,50 52,54|46,50|50,56", shots: [{ square: "C4", count: 2 }, { square: "D3", count: 1 }] },
        { label: "Q1", alliance: "red", points: "5,42 20,44 38,51 50,56", shots: [{ square: "C4", count: 2 }] },
        { label: "Q2", alliance: "blue", points: "94,30 80,36 66,46 58,52|60,50", shots: [{ square: "D4", count: 2 }] },
      ],
      matchPoints: [mp(1, r3, r4), mp(2, r8)],
      squares: [{ square: "C4", scored: 7, pickedUp: 0 }, { square: "D3", scored: 3, pickedUp: 0 }, { square: "E2", scored: 0, pickedUp: 2.5 }, { square: "E5", scored: 0, pickedUp: 2 }],
      starts: [{ alliance: "red", wallPos: 60, label: "Q1" }, { alliance: "blue", wallPos: 140, label: "Q2" }],
      reports: [r3, r4, r8], pits: [DEV_PIT], breakages: [],
    },
    {
      teamNumber: 14469, name: NAMES[14469], need: true, matches: 1, ...counts, missing: ["Q1"], twice: [], ...next,
      autoPoints: r7.autoPoints, teleopPoints: r7.teleopPoints, parkPoints: 5, points: r7.autoPoints + r7.teleopPoints + 5,
      autoScored: 1, cycles: 2, cycleSeconds: 35, pointsLow: pts(r7), pointsHigh: pts(r7),
      leaveRate: 1, autoParkRate: 0, teleopParkRate: 1, minorFouls: 1, majorFouls: 0, brokeDownMatches: 0,
      notes: [note("Q2", "Sam", r7.createdAt, undefined, "Tipped a little on the ramp but carried on")],
      autoPaths: [{ label: "Q2", alliance: "red", points: "4,30 18,34 30,40", shots: [{ square: "B3", count: 1 }] }],
      matchPoints: [mp(2, r7)],
      squares: [{ square: "B3", scored: 3, pickedUp: 0 }, { square: "E4", scored: 0, pickedUp: 2 }],
      starts: [{ alliance: "red", wallPos: 40, label: "Q2" }],
      reports: [r7], pits: [], breakages: [],
    },
    {
      teamNumber: 16021, name: NAMES[16021], need: false, matches: 2, ...counts, missing: [], twice: [], ...next,
      autoPoints: (r5.autoPoints + r6.autoPoints) / 2, teleopPoints: (r5.teleopPoints + r6.teleopPoints) / 2, parkPoints: 2.5,
      points: (r5.autoPoints + r6.autoPoints + r5.teleopPoints + r6.teleopPoints) / 2 + 2.5,
      autoScored: 0.5, cycles: 1.5, cycleSeconds: 40, driverSkill: 2, robotSpeed: 2.5,
      pointsLow: Math.min(pts(r5), pts(r6)), pointsHigh: Math.max(pts(r5), pts(r6)),
      leaveRate: 0.5, autoParkRate: 0.5, teleopParkRate: 0.5, minorFouls: 1.5, majorFouls: 0.5, brokeDownMatches: 1,
      notes: [
        note("Q2", "Dev Scout", r6.createdAt, undefined, "Wheel came off with a minute to go, sat still after that"),
        note("Q1", "Alice Nguyen", r5.createdAt, "Did not move in auto"),
      ],
      autoPaths: [],
      matchPoints: [mp(1, r5), mp(2, r6)],
      squares: [{ square: "B5", scored: 3, pickedUp: 0 }, { square: "E5", scored: 2, pickedUp: 1 }],
      starts: [{ alliance: "blue", wallPos: 170, label: "Q1" }, { alliance: "red", wallPos: 100, label: "Q2" }],
      reports: [r5, r6], pits: [], breakages: [DEV_BREAKAGE],
    },
    ...UNSCOUTED.map((teamNumber) => ({
      teamNumber, name: NAMES[teamNumber], need: true, matches: 0, played: 8, toCome: 0, scheduled: 8, missing: LATER.map((n) => `Q${n}`), twice: [],
      points: 0, autoPoints: 0, teleopPoints: 0, parkPoints: 0, autoScored: 0, cycles: 0,
      squares: [], starts: [], reports: [], pits: [], breakages: [], brokeDownMatches: 0, notes: [], autoPaths: [],
    })),
  ],
};
