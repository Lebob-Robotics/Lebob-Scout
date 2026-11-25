// TEMP: replace with the SDK's result types once @lebob-scout/sdk has teamsTab.
export interface ScoutTally {
  scoutUserId: string;
  scoutName: string;
  reports: number;
  lastAt: string;
}

export interface ReportSummary {
  observationId: string; teamNumber: number; matchType: string; matchNumber: number; alliance: string;
  scoutUserId: string; scoutName: string; createdAt: string;
  autoScored: number; teleopScored: number; cycles: number; cycleSeconds?: number;
  autoPoints: number; teleopPoints: number; parkPoints: number;
}

export interface CoverageCell { teamNumber: number; name: string; alliance: string; presenceUuid: string; teamUuid: string; reports: number }
export interface CoverageRow { matchUuid: string; matchType: string; matchNumber: number; label: string; played: boolean; scheduledTime?: string; cells: CoverageCell[] }
export interface Coverage { rows: CoverageRow[]; slots: number; have: number; duplicates: number; strays: number; unscheduled: number; playedBy: string }

export interface SquareTotal { square: string; scored: number; pickedUp: number }
export interface StartDot { alliance: string; wallPos: number; label: string }
export interface TeamProfile {
  teamNumber: number; name: string; need: boolean;
  matches: number;          // matches with a report
  played: number; toCome: number; scheduled: number;
  missing: string[]; twice: string[];   // match labels
  nextLabel?: string; nextTime?: string;
  points: number; autoPoints: number; teleopPoints: number; parkPoints: number;
  autoScored: number; cycles: number; cycleSeconds?: number; driverSkill?: number; robotSpeed?: number;
  squares: SquareTotal[]; starts: StartDot[]; reports: ReportSummary[];
}
export interface TeamsTab { teams: TeamProfile[]; coverage: Coverage; scouts: ScoutTally[]; needScouting: number }
