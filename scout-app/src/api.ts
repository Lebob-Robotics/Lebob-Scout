import { PalantirApiError } from "@osdk/client";
import type { Client } from "@osdk/client";
import { Users } from "@osdk/foundry.admin";
import { Event, Match, MatchObservation, Presence, Team, createMatchObservation, modifyMatchObservation, teamsTab } from "@lebob-scout/sdk";
import type { FinalPage, Observation, Target } from "./observation";

// The Teams tab's result types come from the SDK, so they cannot drift from the function.
export type TeamsTab = teamsTab.ReturnType;
export type TeamProfile = TeamsTab["teams"][number];
export type ReportSummary = TeamProfile["reports"][number];
export type SquareTotal = TeamProfile["squares"][number];
export type StartDot = TeamProfile["starts"][number];
export type Coverage = TeamsTab["coverage"];
export type CoverageRow = Coverage["rows"][number];
export type CoverageCell = CoverageRow["cells"][number];
export type ScoutTally = TeamsTab["scouts"][number];

export type EventRow = { eventUuid: string; eventCode: string; eventName: string; dateStart: string; dateEnd: string };
export type MatchRow = { matchUuid: string; matchNumber: number; matchType: "qualification" | "playoff"; scheduledTime: string | null; actualTime: string | null };
export type PresenceRow = { presenceUuid: string; matchUuid: string; teamUuid: string; teamNumber: number; alliance: "red" | "blue"; station: number };
export type Patch = Partial<Omit<Target, "eventUuid"> & FinalPage> & { label?: string };
export type Api = {
  currentUser(): Promise<{ id: string; name: string }>;
  ourEvents(): Promise<EventRow[]>;
  matches(eventUuid: string): Promise<MatchRow[]>;
  presences(matchUuid: string): Promise<PresenceRow[]>;
  findPresence(eventUuid: string, matchType: string, matchNumber: number, teamNumber: number): Promise<PresenceRow | null>;
  findTeamUuid(teamNumber: number): Promise<string | null>;
  exists(observationId: string): Promise<boolean>;
  create(o: Observation): Promise<void>;
  modify(observationId: string, patch: Patch, nowMs: number): Promise<void>;
  observations(eventUuid: string): Promise<Observation[]>;
  observation(observationId: string): Promise<Observation>;
  teamsTab(eventUuid: string): Promise<TeamsTab>;
};

// The real server. Shapes below follow what scripts/spike.mjs saw Foundry do (see the task 3/8b report).

// matchType and alliance are stored lower case, exactly as the app uses them, so no casing rule is needed.
type MatchType = MatchRow["matchType"];
type Alliance = PresenceRow["alliance"];

// Nullable properties come back missing (undefined), not null. autoPathPoints is not nullable in Foundry: "" means no path.
export const toObservation = (o: Partial<MatchObservation.Props>): Observation => ({
  observationId: o.observationId ?? "", label: o.label ?? "", eventUuid: o.eventUuid ?? "",
  matchUuid: o.matchUuid ?? null, presenceUuid: o.presenceUuid ?? null, teamUuid: o.teamUuid ?? null,
  matchNumber: o.matchNumber ?? 0, matchType: o.matchType as MatchType, teamNumber: o.teamNumber ?? 0, alliance: o.alliance as Alliance,
  autoLeave: o.autoLeave ?? false, autoPark: o.autoPark ?? false, teleopPark: o.teleopPark ?? false, brokeDown: o.brokeDown ?? false,
  minorFouls: o.minorFouls ?? 0, majorFouls: o.majorFouls ?? 0, driverSkill: o.driverSkill ?? null, robotSpeed: o.robotSpeed ?? null,
  autoNotes: o.autoNotes ?? null, notes: o.notes ?? null, autoPathPoints: o.autoPathPoints || null,
  tapSeconds: [...(o.tapSeconds ?? [])], tapKinds: [...(o.tapKinds ?? [])], tapSquares: [...(o.tapSquares ?? [])], tapCounts: [...(o.tapCounts ?? [])],
  scoutUserId: o.scoutUserId ?? "", scoutName: o.scoutName ?? "",
  createdAt: o.createdAt ?? "", updatedAt: o.updatedAt ?? "", timerStartedAt: o.timerStartedAt ?? "",
  fieldKey: o.fieldKey ?? "", startSquare: o.startSquare ?? "",
  startWallPos: o.startWallPos ?? null,
});

// 19 of the 20 fields modifyMatchObservation takes; each caller adds updated_at.
// Foundry refuses a modify that leaves any required one out.
const editable = (o: Observation) => ({
  label: o.label, match_uuid: o.matchUuid, presence_uuid: o.presenceUuid, team_uuid: o.teamUuid,
  match_number: o.matchNumber, match_type: o.matchType, team_number: o.teamNumber, alliance: o.alliance,
  auto_leave: o.autoLeave, auto_park: o.autoPark, teleop_park: o.teleopPark, broke_down: o.brokeDown,
  minor_fouls: o.minorFouls, major_fouls: o.majorFouls, driver_skill: o.driverSkill, robot_speed: o.robotSpeed,
  auto_notes: o.autoNotes, notes: o.notes, auto_path_points: o.autoPathPoints ?? "",
});

export const toCreateParams = (o: Observation) => ({
  ...editable(o),
  observation_id: o.observationId, event_uuid: o.eventUuid,
  tap_seconds: o.tapSeconds, tap_kinds: o.tapKinds, tap_squares: o.tapSquares, tap_counts: o.tapCounts,
  scout_user_id: o.scoutUserId, scout_name: o.scoutName,
  created_at: o.createdAt, updated_at: o.updatedAt, timer_started_at: o.timerStartedAt,
  field_key: o.fieldKey, start_square: o.startSquare,
  start_wall_pos: o.startWallPos ?? null, // reports queued by an older version have none
});

// The object reference takes the primary key (the object itself also works). Sending null clears a nullable value.
export const toModifyParams = (current: Observation, patch: Patch, nowMs: number) => ({
  "j87bj1om.match-observation": current.observationId,
  ...editable({ ...current, ...patch }),
  updated_at: new Date(nowMs).toISOString(),
});

// Creating an id that already exists fails with PalantirApiError errorName "ObjectAlreadyExists" (409 CONFLICT)
// and leaves the stored object untouched, so the report is already saved.
export const isAlreadySaved = (e: unknown): boolean => e instanceof PalantirApiError && e.errorName === "ObjectAlreadyExists";

// Event days are stored as midnight timestamps; the app compares plain dates.
export const toEventRow = (e: Pick<Event.Props, "eventUuid" | "eventCode" | "eventName" | "dateStart" | "dateEnd">): EventRow => ({
  eventUuid: e.eventUuid, eventCode: e.eventCode ?? "", eventName: e.eventName ?? "",
  dateStart: (e.dateStart ?? "").slice(0, 10), dateEnd: (e.dateEnd ?? "").slice(0, 10),
});
const toMatchRow = (m: Match.Props): MatchRow => ({
  matchUuid: m.matchUuid, matchNumber: m.matchNumber ?? 0, matchType: m.matchType as MatchType,
  scheduledTime: m.scheduledTime ?? null, actualTime: m.actualTime ?? null,
});
const toPresenceRow = (p: Presence.Props): PresenceRow => ({
  presenceUuid: p.presenceUuid, matchUuid: p.matchUuid ?? "", teamUuid: p.teamUuid ?? "",
  teamNumber: p.teamNumber ?? 0, alliance: p.alliance as Alliance, station: p.station ?? 0,
});

// asyncIter follows nextPageToken until the last page.
async function all<T>(rows: AsyncIterable<T>): Promise<T[]> {
  const out: T[] = [];
  for await (const r of rows) out.push(r);
  return out;
}

export function createApi(client: Client): Api {
  const findMatch = async (eventUuid: string, matchType: string, matchNumber: number) =>
    (await client(Match).where({ eventUuid: { $eq: eventUuid }, matchType: { $eq: matchType }, matchNumber: { $eq: matchNumber } }).fetchPage({ $pageSize: 1 })).data[0];
  return {
    async currentUser() {
      const u = await Users.getCurrent(client);
      return { id: u.id, name: [u.givenName, u.familyName].filter(Boolean).join(" ") || u.username };
    },
    async ourEvents() {
      return (await all(client(Event).where({ ourEvent: { $eq: true } }).asyncIter())).map(toEventRow);
    },
    async matches(eventUuid) {
      return (await all(client(Match).where({ eventUuid: { $eq: eventUuid } }).asyncIter())).map(toMatchRow);
    },
    async presences(matchUuid) {
      return (await all(client(Presence).where({ matchUuid: { $eq: matchUuid } }).asyncIter())).map(toPresenceRow);
    },
    async findPresence(eventUuid, matchType, matchNumber, teamNumber) {
      const m = await findMatch(eventUuid, matchType, matchNumber);
      if (!m) return null;
      const p = (await client(Presence).where({ matchUuid: { $eq: m.matchUuid }, teamNumber: { $eq: teamNumber } }).fetchPage({ $pageSize: 1 })).data[0];
      return p ? toPresenceRow(p) : null;
    },
    async findTeamUuid(teamNumber) {
      return (await client(Team).where({ teamNumber: { $eq: teamNumber } }).fetchPage({ $pageSize: 1 })).data[0]?.teamUuid ?? null;
    },
    async exists(observationId) {
      return (await client(MatchObservation).where({ observationId: { $eq: observationId } }).fetchPage({ $pageSize: 1 })).data.length > 0;
    },
    async create(o) {
      try {
        await client(createMatchObservation).applyAction(toCreateParams(o));
      } catch (e) {
        if (!isAlreadySaved(e)) throw e;
      }
    },
    async modify(observationId, patch, nowMs) {
      // fetchOne throws when the object is missing.
      const current = toObservation(await client(MatchObservation).fetchOne(observationId));
      await client(modifyMatchObservation).applyAction(toModifyParams(current, patch, nowMs));
    },
    async observations(eventUuid) {
      const rows = await all(client(MatchObservation).where({ eventUuid: { $eq: eventUuid } }).asyncIter({ $orderBy: { createdAt: "desc" } }));
      return rows.map(toObservation);
    },
    async observation(observationId) {
      return toObservation(await client(MatchObservation).fetchOne(observationId));
    },
    teamsTab(eventUuid) {
      return client(teamsTab).executeFunction({ eventUuid });
    },
  };
}
