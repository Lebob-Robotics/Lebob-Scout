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
export type TeamMap = { teamNumber: number; matches: number; squares: SquareMap[] };
export type AllianceMap = { robots: TeamMap[]; squares: SquareMap[] };
export type SquareOverlap = { square: string; red: number; blue: number; both: number };
export type MatchMaps = { matchUuid: string; label: string; red: AllianceMap; blue: AllianceMap; overlap: SquareOverlap[] };
export type PointSplit = { matchUuid: string; label: string; alliance: string; teamNumber: number; allianceScore: number; rating?: number; points: number };
