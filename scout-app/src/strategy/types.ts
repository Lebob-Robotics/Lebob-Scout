// What the strategy app shows, as plain rows. The model rows come from the old project's match model (read-only):
// EventRating, RatingHistory, MatchForecast, RankProjection, AlliancePick. The maps and splits come from our functions.

export const OUR_TEAM = 29550;

export type Rating = {
  teamNumber: number; teamName: string; opr: number; oprSe: number | null; autoRating: number | null; teleopRating: number | null; hiveRating: number | null;
  priorWeight: number | null; priorNote: string | null; matchesFitted: number | null;
};
export type HistoryPoint = { teamNumber: number; afterMatch: number; lastMatch: string | null; opr: number; oprSe: number | null; ratingRank: number | null };
export type Forecast = {
  matchUuid: string; level: string; number: number; series: number | null; played: boolean;
  red: [number, number]; blue: [number, number]; redNames: [string, string]; blueNames: [string, string];
  redScore: number | null; blueScore: number | null; redLow80: number | null; redHigh80: number | null; blueLow80: number | null; blueHigh80: number | null;
  pRed: number | null; pBlue: number | null; pTie: number | null; redRp: number | null; blueRp: number | null;
  redBonus: [number | null, number | null, number | null]; blueBonus: [number | null, number | null, number | null];
  redActual: number | null; blueActual: number | null; preHit: boolean | null;
  prePRed: number | null; prePBlue: number | null; preRedScore: number | null; preBlueScore: number | null;
  // Scouting forecasts only: robots with no strength (no figures then), and sides that lean on an official share.
  missing?: number[]; officialRed?: boolean; officialBlue?: boolean;
};
export type Projection = {
  teamNumber: number; teamName: string; rankNow: number | null; rpNow: number | null; rsNow: number | null; expRank: number | null;
  medianRank: number | null; expRs: number | null; pRank1: number | null; pTop4: number | null; pTop8: number | null; remaining: number | null;
  rsNeededRank1: number | null; rsNeededRank4: number | null; rsNeededRank8: number | null;
};
export type Pick = {
  teamNumber: number; partnerNumber: number; partnerName: string; partnerOpr: number | null; pickRank: number | null; role: string | null;
  seed: number | null; natural: boolean | null; free: boolean | null; pFinals: number | null; pWinEvent: number | null;
};

// From the functions (scout-functions/src/teams/maps.ts). Figures per match.
export type SquareMap = { square: string; autoScored: number; teleopScored: number; pickedUp: number };
// `squares` are as tapped; `half` is the same in the red alliance's view folded onto the upper half (rows 1 to 3), a
// lower-half square added onto its mirror (functions 0.9.0 on; read as empty when missing).
// squares: as tapped (in matchMaps, the aligned map placed on the side the robot plays). aligned: every match turned to
// the left-hand (red) side, shown as the yellow tracked alliance. half: aligned, folded onto the upper half.
export type TeamMap = { teamNumber: number; matches: number; squares: SquareMap[]; aligned: SquareMap[]; half: SquareMap[] };
export type AllianceMap = { robots: TeamMap[]; squares: SquareMap[] };
export type SquareOverlap = { square: string; red: number; blue: number; both: number };
export type MatchMaps = { matchUuid: string; label: string; red: AllianceMap; blue: AllianceMap; overlap: SquareOverlap[] };
export type PointSplit = { matchUuid: string; label: string; alliance: string; teamNumber: number; allianceScore: number; rating?: number; points: number };

// Cycles (scout-functions/src/teams/cycles.ts): teleop trips from a shot, through collecting pieces, to the next shot.
// Points are in squares (x 0 to 6 from column A, y 0 to 6 from row 1), in the red alliance's view: a blue match's
// squares turned half a turn. Figures per match; times are means over cycles that had a shot before them.
export type CyclePoint = { x: number; y: number };
export type CycleSquare = { square: string; passes: number; intakes: number; shots: number };
export type CycleRoute = { points: CyclePoint[]; cycles: number; share: number; seconds?: number; from: string; via: string; to: string };
export type CycleRow = {
  label: string; from?: string; via: string[]; to: string; pieces: number; points: CyclePoint[];
  seconds?: number; collectSeconds?: number; travelSeconds?: number; shootSeconds?: number; weight: number;
  // Shot from the lower half, so mirrored onto the upper half (rows 4 to 6 become 3 to 1).
  mirrored: boolean;
};
export type TeamCycles = {
  teamNumber: number; matches: number; cyclesPerMatch: number; cyclesLow?: number; cyclesHigh?: number;
  seconds?: number; collectSeconds?: number; travelSeconds?: number; shootSeconds?: number; piecesPerCycle?: number;
  squares: CycleSquare[]; routes: CycleRoute[]; cycles: CycleRow[];
  // The share of its cycles (0 to 1) shot from the lower half and mirrored, and the one averaged cycle: every timed
  // cycle's line averaged point by point (12 points; empty with none).
  mirroredShare?: number; average: CyclePoint[];
};
