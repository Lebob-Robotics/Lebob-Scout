import type { Client } from "@osdk/client";
import {
  Event, EventRating, Match, Presence, RankProjection,
  fieldMaps as fieldMapsQuery, matchMaps as matchMapsQuery, pointSplits as pointSplitsQuery, teamCycles as teamCyclesQuery,
} from "@lebob-scout/sdk";
import type { Api, EventRow, MatchRow, PresenceRow, TeamsTab } from "../shared/api";
import { numbered } from "../shared/schedule";
import type { Game } from "./scouted";
import type { MatchMaps, PointSplit, Projection, Rating, TeamCycles, TeamMap } from "./types";

export type StrategyApi = Pick2<Api, "ourEvents" | "matches" | "presences" | "teamsTab" | "pitPhoto" | "pitPhotoIds"> & {
  // The model's EventRating: only its HIVE figure (TIPS per match) and team names are used.
  ratings(eventUuid: string): Promise<Rating[]>;
  // RankProjection: only the standing now (rank, RP, RS) is used.
  projections(eventUuid: string): Promise<Projection[]>;
  // Every match with its alliances and official scores (Match and Presence objects).
  games(eventUuid: string): Promise<Game[]>;
  // The earlier events this event's OPRs start from, oldest first: every event in the same country that began before
  // it, within the season. Empty when the event has no country or nothing came before it.
  earlier(eventUuid: string): Promise<Earlier[]>;
  fieldMaps(eventUuid: string): Promise<TeamMap[]>;
  matchMaps(eventUuid: string, matchUuid: string): Promise<MatchMaps>;
  pointSplits(eventUuid: string): Promise<PointSplit[]>;
  teamCycles(eventUuid: string): Promise<TeamCycles[]>;
};
type Pick2<T, K extends keyof T> = { [P in K]: T[P] };
export type Earlier = { code: string; games: Game[] };
// An earlier event counts when it began before this one and no more than this long before: a season, not last year's.
export const SEASON_DAYS = 300;
type EventDates = Pick2<Event.Props, "eventUuid" | "eventCode" | "country" | "dateStart">;
// Our made-up events (LBBEST, and LBPRAC and LBTOP before it) replay other events' matches: never an earlier event.
export const MADE_UP = /^LB/i;
// Which of `all` are earlier events of `event`, oldest first (same start: by code, so the order never changes).
export function earlierEvents<T extends EventDates>(event: EventDates | undefined, all: T[]): T[] {
  const at = (e: EventDates) => (e.dateStart ? Date.parse(e.dateStart) : NaN);
  const t = event ? at(event) : NaN;
  if (!event?.country || !Number.isFinite(t)) return [];
  return all.filter((e) => e.eventUuid !== event.eventUuid && !MADE_UP.test(e.eventCode ?? "") && e.country === event.country && at(e) < t && at(e) >= t - SEASON_DAYS * 86_400_000)
    .sort((a, b) => at(a) - at(b) || (a.eventCode ?? "").localeCompare(b.eventCode ?? ""));
}
export type { EventRow, MatchRow, PresenceRow, TeamsTab };

async function all<T>(rows: AsyncIterable<T>): Promise<T[]> {
  const out: T[] = [];
  for await (const r of rows) out.push(r);
  return out;
}
const n = (v: number | null | undefined) => v ?? null;

export const toRating = (r: Partial<EventRating.Props>): Rating => ({
  teamNumber: r.teamNumber ?? 0, teamName: r.teamName ?? "", opr: r.opr ?? 0, oprSe: n(r.oprSe),
  autoRating: n(r.autoRating), teleopRating: n(r.teleopRating), hiveRating: n(r.hiveRating), priorWeight: n(r.priorWeight), priorNote: r.priorNote ?? null,
  matchesFitted: n(r.matchesFitted),
});
export const toProjection = (p: Partial<RankProjection.Props>): Projection => ({
  teamNumber: p.teamNumber ?? 0, teamName: p.teamName ?? "", rankNow: n(p.rankNow), rpNow: n(p.rpNow), rsNow: n(p.rsNow),
  expRank: n(p.expRank), medianRank: n(p.medianRank), expRs: n(p.expRs), pRank1: n(p.pRank1), pTop4: n(p.pTop4), pTop8: n(p.pTop8),
  remaining: n(p.remaining), rsNeededRank1: n(p.rsNeededRank1), rsNeededRank4: n(p.rsNeededRank4), rsNeededRank8: n(p.rsNeededRank8),
});
// Matches as games: playoffs numbered as the scout app numbers them, each alliance its two robots by station, the
// official scores when the match has them. A match without two robots a side is left out.
type MatchProps = Pick2<Match.Props, "matchUuid" | "matchNumber" | "matchType" | "scheduledTime" | "actualTime" | "redScore" | "blueScore">;
type PresenceProps = Pick2<Presence.Props, "matchUuid" | "alliance" | "station" | "teamNumber">;
export function toGames(ms: MatchProps[], ps: PresenceProps[]): Game[] {
  const rows: MatchRow[] = ms.map((m) => ({
    matchUuid: m.matchUuid, matchNumber: m.matchNumber ?? 0, matchType: m.matchType as MatchRow["matchType"],
    scheduledTime: m.scheduledTime ?? null, actualTime: m.actualTime ?? null,
  }));
  const byId = new Map(ms.map((m) => [m.matchUuid, m]));
  const side = (id: string, alliance: string) => ps.filter((p) => p.matchUuid === id && p.alliance === alliance)
    .sort((a, b) => (a.station ?? 0) - (b.station ?? 0)).map((p) => p.teamNumber ?? 0).filter((t) => t > 0);
  return numbered(rows).flatMap((r): Game[] => {
    const red = side(r.matchUuid, "red"), blue = side(r.matchUuid, "blue");
    if (red.length !== 2 || blue.length !== 2) return [];
    const m = byId.get(r.matchUuid)!;
    return [{
      matchUuid: r.matchUuid, level: r.matchType === "qualification" ? "qual" : "playoff", number: r.matchNumber, time: r.actualTime ?? r.scheduledTime,
      red: [red[0], red[1]], blue: [blue[0], blue[1]], redScore: m.redScore ?? null, blueScore: m.blueScore ?? null,
    }];
  });
}

// The three map and split functions join the SDK once they are added to the app in Developer Console; until then
// `functions` is left out and the strategy app says those parts are not ready.
export type MapFunctions = Pick2<StrategyApi, "fieldMaps" | "matchMaps" | "pointSplits" | "teamCycles">;
export const MAPS_NOT_READY = "Heatmaps and point splits are not switched on for this app yet.";
const notReady = () => Promise.reject(new Error(MAPS_NOT_READY));

export function createStrategyApi(client: Client, base: Api, functions?: MapFunctions): StrategyApi {
  const where = (eventUuid: string) => ({ eventUuid: { $eq: eventUuid } });
  const presencesOf = async (ms: { matchUuid: string }[]) => {
    const ids = ms.map((m) => m.matchUuid);
    const ps: Presence.Props[] = [];
    for (let i = 0; i < ids.length; i += 200) ps.push(...await all(client(Presence).where({ matchUuid: { $in: ids.slice(i, i + 200) } }).asyncIter()));
    return ps;
  };
  return {
    ourEvents: () => base.ourEvents(),
    matches: (e) => base.matches(e),
    presences: (m) => base.presences(m),
    teamsTab: (e) => base.teamsTab(e),
    pitPhoto: (id) => base.pitPhoto(id),
    pitPhotoIds: (ids) => base.pitPhotoIds(ids),
    async ratings(e) { return (await all(client(EventRating).where(where(e)).asyncIter())).map(toRating); },
    async projections(e) { return (await all(client(RankProjection).where(where(e)).asyncIter())).map(toProjection); },
    async games(e) {
      const ms = await all(client(Match).where(where(e)).asyncIter());
      return toGames(ms, await presencesOf(ms));
    },
    async earlier(e) {
      const [event] = await all(client(Event).where(where(e)).asyncIter());
      if (!event?.country) return [];
      const before = earlierEvents(event, await all(client(Event).where({ country: { $eq: event.country } }).asyncIter()));
      if (!before.length) return [];
      const ms = await all(client(Match).where({ eventUuid: { $in: before.map((x) => x.eventUuid) } }).asyncIter());
      const ps = await presencesOf(ms);
      return before.map((x) => {
        const mine = ms.filter((m) => m.eventUuid === x.eventUuid), ids = new Set(mine.map((m) => m.matchUuid));
        return { code: x.eventCode ?? "", games: toGames(mine, ps.filter((q) => q.matchUuid != null && ids.has(q.matchUuid))) };
      });
    },
    fieldMaps: (e) => functions?.fieldMaps(e) ?? notReady(),
    matchMaps: (e, m) => functions?.matchMaps(e, m) ?? notReady(),
    pointSplits: (e) => functions?.pointSplits(e) ?? notReady(),
    teamCycles: (e) => functions?.teamCycles(e) ?? notReady(),
  };
}

// The map, split and cycle functions as published in Foundry (SDK 0.7.0 on; teamCycles from 0.10.0). Their result types match ./types, which mirror the
// functions' own types; the casts only drop the SDK's readonly and branded wrappers.
export const sdkMapFunctions = (client: Client): MapFunctions => ({
  fieldMaps: async (eventUuid) => (await client(fieldMapsQuery).executeFunction({ eventUuid })) as unknown as TeamMap[],
  matchMaps: async (eventUuid, matchUuid) => (await client(matchMapsQuery).executeFunction({ eventUuid, matchUuid })) as unknown as MatchMaps,
  pointSplits: async (eventUuid) => (await client(pointSplitsQuery).executeFunction({ eventUuid })) as unknown as PointSplit[],
  teamCycles: async (eventUuid) => (await client(teamCyclesQuery).executeFunction({ eventUuid })) as unknown as TeamCycles[],
});
