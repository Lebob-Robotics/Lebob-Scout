import type { Client } from "@osdk/client";
import {
  AlliancePick, EventRating, MatchForecast, RankProjection, RatingHistory,
  fieldMaps as fieldMapsQuery, matchMaps as matchMapsQuery, pointSplits as pointSplitsQuery,
} from "@lebob-scout/sdk";
import type { Api, EventRow, MatchRow, PresenceRow, TeamsTab } from "../api";
import type { Forecast, HistoryPoint, MatchMaps, Pick, PointSplit, Projection, Rating, TeamMap } from "./types";

export type StrategyApi = Pick2<Api, "ourEvents" | "matches" | "presences" | "teamsTab"> & {
  ratings(eventUuid: string): Promise<Rating[]>;
  history(eventUuid: string): Promise<HistoryPoint[]>;
  forecasts(eventUuid: string): Promise<Forecast[]>;
  projections(eventUuid: string): Promise<Projection[]>;
  picks(eventUuid: string): Promise<Pick[]>;
  fieldMaps(eventUuid: string): Promise<TeamMap[]>;
  matchMaps(eventUuid: string, matchUuid: string): Promise<MatchMaps>;
  pointSplits(eventUuid: string): Promise<PointSplit[]>;
};
type Pick2<T, K extends keyof T> = { [P in K]: T[P] };
export type { EventRow, MatchRow, PresenceRow, TeamsTab };

async function all<T>(rows: AsyncIterable<T>): Promise<T[]> {
  const out: T[] = [];
  for await (const r of rows) out.push(r);
  return out;
}
const n = (v: number | null | undefined) => v ?? null;

export const toRating = (r: Partial<EventRating.Props>): Rating => ({
  teamNumber: r.teamNumber ?? 0, teamName: r.teamName ?? "", opr: r.opr ?? 0, oprSe: n(r.oprSe),
  autoRating: n(r.autoRating), teleopRating: n(r.teleopRating), priorWeight: n(r.priorWeight), priorNote: r.priorNote ?? null,
  matchesFitted: n(r.matchesFitted),
});
export const toHistory = (r: Partial<RatingHistory.Props>): HistoryPoint => ({
  teamNumber: r.teamNumber ?? 0, afterMatch: r.afterMatch ?? 0, lastMatch: r.lastMatch ?? null, opr: r.opr ?? 0, oprSe: n(r.oprSe),
  ratingRank: n(r.ratingRank),
});
export const toForecast = (f: Partial<MatchForecast.Props>): Forecast => ({
  matchUuid: f.matchUuid ?? "", level: f.level ?? "qual", number: f.number ?? 0, series: n(f.series), played: f.played ?? false,
  red: [f.red1 ?? 0, f.red2 ?? 0], blue: [f.blue1 ?? 0, f.blue2 ?? 0],
  redNames: [f.red1Name ?? "", f.red2Name ?? ""], blueNames: [f.blue1Name ?? "", f.blue2Name ?? ""],
  redScore: n(f.redScore), blueScore: n(f.blueScore), redLow80: n(f.redLow80), redHigh80: n(f.redHigh80),
  blueLow80: n(f.blueLow80), blueHigh80: n(f.blueHigh80), pRed: n(f.pRed), pBlue: n(f.pBlue), pTie: n(f.pTie),
  redRp: n(f.redRp), blueRp: n(f.blueRp), redBonus: [n(f.redBonus1), n(f.redBonus2), n(f.redBonus3)],
  blueBonus: [n(f.blueBonus1), n(f.blueBonus2), n(f.blueBonus3)], redActual: n(f.redActual), blueActual: n(f.blueActual),
  preHit: f.preHit ?? null, prePRed: n(f.prePRed), prePBlue: n(f.prePBlue), preRedScore: n(f.preRedScore), preBlueScore: n(f.preBlueScore),
});
export const toProjection = (p: Partial<RankProjection.Props>): Projection => ({
  teamNumber: p.teamNumber ?? 0, teamName: p.teamName ?? "", rankNow: n(p.rankNow), rpNow: n(p.rpNow), rsNow: n(p.rsNow),
  expRank: n(p.expRank), medianRank: n(p.medianRank), expRs: n(p.expRs), pRank1: n(p.pRank1), pTop4: n(p.pTop4), pTop8: n(p.pTop8),
  remaining: n(p.remaining), rsNeededRank1: n(p.rsNeededRank1), rsNeededRank4: n(p.rsNeededRank4), rsNeededRank8: n(p.rsNeededRank8),
});
export const toPick = (p: Partial<AlliancePick.Props>): Pick => ({
  teamNumber: p.teamNumber ?? 0, partnerNumber: p.partnerNumber ?? 0, partnerName: p.partnerName ?? "", partnerOpr: n(p.partnerOpr),
  pickRank: n(p.pickRank), role: p.role ?? null, seed: n(p.seed), natural: p.natural ?? null, free: p.free ?? null,
  pFinals: n(p.pFinals), pWinEvent: n(p.pWinEvent),
});

// The three map and split functions join the SDK once they are added to the app in Developer Console; until then
// `functions` is left out and the strategy app says those parts are not ready.
export type MapFunctions = Pick2<StrategyApi, "fieldMaps" | "matchMaps" | "pointSplits">;
export const MAPS_NOT_READY = "Heatmaps and point splits are not switched on for this app yet.";
const notReady = () => Promise.reject(new Error(MAPS_NOT_READY));

export function createStrategyApi(client: Client, base: Api, functions?: MapFunctions): StrategyApi {
  const where = (eventUuid: string) => ({ eventUuid: { $eq: eventUuid } });
  return {
    ourEvents: () => base.ourEvents(),
    matches: (e) => base.matches(e),
    presences: (m) => base.presences(m),
    teamsTab: (e) => base.teamsTab(e),
    async ratings(e) { return (await all(client(EventRating).where(where(e)).asyncIter())).map(toRating); },
    async history(e) { return (await all(client(RatingHistory).where(where(e)).asyncIter())).map(toHistory); },
    async forecasts(e) { return (await all(client(MatchForecast).where(where(e)).asyncIter())).map(toForecast); },
    async projections(e) { return (await all(client(RankProjection).where(where(e)).asyncIter())).map(toProjection); },
    async picks(e) { return (await all(client(AlliancePick).where(where(e)).asyncIter())).map(toPick); },
    fieldMaps: (e) => functions?.fieldMaps(e) ?? notReady(),
    matchMaps: (e, m) => functions?.matchMaps(e, m) ?? notReady(),
    pointSplits: (e) => functions?.pointSplits(e) ?? notReady(),
  };
}

// The three functions as published in Foundry (SDK 0.7.0 on). Their result types match ./types, which mirror the
// functions' own types; the casts only drop the SDK's readonly and branded wrappers.
export const sdkMapFunctions = (client: Client): MapFunctions => ({
  fieldMaps: async (eventUuid) => (await client(fieldMapsQuery).executeFunction({ eventUuid })) as unknown as TeamMap[],
  matchMaps: async (eventUuid, matchUuid) => (await client(matchMapsQuery).executeFunction({ eventUuid, matchUuid })) as unknown as MatchMaps,
  pointSplits: async (eventUuid) => (await client(pointSplitsQuery).executeFunction({ eventUuid })) as unknown as PointSplit[],
});
