// The public strategy page (lebob.com.au/strategy): the same strategy app, reading a copy of our Foundry data that
// scripts/export-public.mjs writes to static files every 15 minutes, with every scout's name blanked. Read-only, and
// no Foundry account. Each read goes through the same converters as the real app (toGames, toRating, toProjection,
// toMatchRow, toPresenceRow), so the two show the same figures.
import type { Event, EventRating, Match, Presence, RankProjection } from "@lebob-scout/sdk";
import { toEventRow, toMatchRow, toPresenceRow, type TeamsTab } from "../shared/api";
import { numbered } from "../shared/schedule";
import { MAPS_NOT_READY, toGames, toProjection, toRating, type StrategyApi } from "./api";
import type { MatchMaps, PointSplit, TeamCycles, TeamMap } from "./types";

// One event's export (see scripts/export-public.mjs). A function that failed when it ran is null.
export type EventFile = {
  matches: Match.Props[]; presences: Presence.Props[]; ratings: Partial<EventRating.Props>[]; projections: Partial<RankProjection.Props>[];
  teamsTab: TeamsTab | null; fieldMaps: TeamMap[] | null; pointSplits: PointSplit[] | null; teamCycles: TeamCycles[] | null;
  matchMaps: Record<string, MatchMaps>; pitImages: Record<string, string[]>;
};
export type IndexFile = { exportedAt: string; events: Pick<Event.Props, "eventUuid" | "eventCode" | "eventName" | "dateStart" | "dateEnd">[] };

const NO_SCHEDULE: TeamsTab = { teams: [], scouts: [], needScouting: 0, coverage: { rows: [], slots: 0, have: 0, duplicates: 0, strays: 0, unscheduled: 0, playedBy: "none" } };

// `base` is where the data folder is served (with a trailing slash); `get` is fetch, swapped out in tests.
export function createPublicStrategyApi(base: string, get: typeof fetch = fetch): StrategyApi & { exportedAt(): Promise<string | null> } {
  const json = async <T>(file: string): Promise<T> => {
    const r = await get(`${base}${file}`, { cache: "no-cache" });
    if (!r.ok) throw new Error(`Couldn't load ${file} (${r.status})`);
    return r.json() as Promise<T>;
  };
  let index: Promise<IndexFile> | null = null;
  const loadIndex = () => (index ??= json<IndexFile>("index.json").catch((e) => { index = null; throw e; }));
  const files = new Map<string, Promise<EventFile>>();
  const event = (e: string) => {
    let f = files.get(e);
    if (!f) { f = json<EventFile>(`${e}.json`).catch((err) => { files.delete(e); throw err; }); files.set(e, f); }
    return f;
  };
  const byMatch = new Map<string, string>(); // matchUuid -> eventUuid, filled as events load
  const remember = (e: string, f: EventFile) => f.matches.forEach((m) => byMatch.set(m.matchUuid, e));
  const fn = async <T>(e: string, pick: (f: EventFile) => T | null): Promise<T> => {
    const v = pick(await event(e));
    if (v == null) throw new Error(MAPS_NOT_READY);
    return v;
  };
  const known = async (e: string) => (await loadIndex()).events.some((x) => x.eventUuid === e);
  return {
    exportedAt: async () => (await loadIndex().catch(() => null))?.exportedAt ?? null,
    ourEvents: async () => (await loadIndex()).events.map(toEventRow),
    async matches(e) {
      if (!(await known(e))) return [];
      const f = await event(e); remember(e, f);
      return numbered(f.matches.map(toMatchRow));
    },
    async presences(m) {
      const e = byMatch.get(m);
      if (!e) return [];
      return (await event(e)).presences.filter((p) => p.matchUuid === m).map(toPresenceRow);
    },
    async teamsTab(e) { return (await known(e)) ? (await event(e)).teamsTab ?? Promise.reject(new Error("Teams unavailable")) : NO_SCHEDULE; },
    async pitPhoto(imageId) {
      const r = await get(`${base}photos/${encodeURIComponent(imageId)}`);
      if (!r.ok) throw new Error("Couldn't load the photo");
      return r.blob();
    },
    async pitPhotoIds(pitReportIds) {
      const want = new Set(pitReportIds);
      const all = await Promise.all((await loadIndex()).events.map((x) => event(x.eventUuid).catch(() => null)));
      return all.flatMap((f) => Object.entries(f?.pitImages ?? {}).filter(([id]) => want.has(id)).flatMap(([, ids]) => ids));
    },
    async ratings(e) { return (await known(e)) ? (await event(e)).ratings.map(toRating) : []; },
    async projections(e) { return (await known(e)) ? (await event(e)).projections.map(toProjection) : []; },
    async games(e) {
      if (!(await known(e))) return [];
      const f = await event(e); remember(e, f);
      return toGames(f.matches, f.presences);
    },
    fieldMaps: (e) => fn(e, (f) => f.fieldMaps),
    async matchMaps(e, m) {
      const v = (await event(e)).matchMaps[m];
      if (!v) throw new Error(MAPS_NOT_READY);
      return v;
    },
    pointSplits: (e) => fn(e, (f) => f.pointSplits),
    teamCycles: (e) => fn(e, (f) => f.teamCycles),
  };
}
