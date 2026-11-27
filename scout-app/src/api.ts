import { PalantirApiError, createAttachmentUpload } from "@osdk/client";
import type { Attachment, Client } from "@osdk/client";
import { Users } from "@osdk/foundry.admin";
import {
  BreakageReport, Event, Match, MatchObservation, Participation, PitSurvey, Presence, Team, createBreakageReport, createMatchObservation, createPitSurvey,
  modifyBreakageReport, modifyMatchObservation, modifyPitSurvey, teamsTab,
} from "@lebob-scout/sdk";
import type { FinalPage, Observation, Target } from "./observation";
import type { BreakageReport as BreakageReportRow, PitReport } from "./pitBreakage";
import { numbered } from "./schedule";

// The Teams tab's result types come from the SDK, so they cannot drift from the function.
export type TeamsTab = teamsTab.ReturnType;
export type TeamProfile = TeamsTab["teams"][number];
export type ReportSummary = TeamProfile["reports"][number];
export type SquareTotal = TeamProfile["squares"][number];
export type StartDot = TeamProfile["starts"][number];
export type PitSummary = TeamProfile["pits"][number];
export type BreakageSummary = TeamProfile["breakages"][number];
export type Coverage = TeamsTab["coverage"];
export type CoverageRow = Coverage["rows"][number];
export type CoverageCell = CoverageRow["cells"][number];
export type ScoutTally = TeamsTab["scouts"][number];

export type EventRow = { eventUuid: string; eventCode: string; eventName: string; dateStart: string; dateEnd: string };
export type MatchRow = { matchUuid: string; matchNumber: number; matchType: "qualification" | "playoff"; scheduledTime: string | null; actualTime: string | null };
export type PresenceRow = { presenceUuid: string; matchUuid: string; teamUuid: string; teamNumber: number; alliance: "red" | "blue"; station: number };
// A team of the event, for the Pit and Breakage dropdowns.
export type TeamOption = { teamNumber: number; teamUuid: string | null; name: string };
// A new pit photo to send: its id on the phone, a file name, and the shrunk JPEG.
export type PitUpload = { id: string; name: string; blob: Blob };
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
  // Pit surveys and breakages carry the event code, not the event id. Newest first.
  pits(eventCode: string): Promise<PitReport[]>;
  breakages(eventCode: string): Promise<BreakageReportRow[]>;
  // The event's teams, by number. Rejects when the lists can't be read.
  eventTeams(eventUuid: string): Promise<TeamOption[]>;
  // Create, or replace every field of the one with the same id. `uploads` are the report's new photos (p.photoIds).
  savePit(p: PitReport, uploads: PitUpload[]): Promise<void>;
  // A saved photo's picture, by the attachment id a pit report lists in `images`; valid after that report has been read.
  pitPhoto(imageId: string): Promise<Blob>;
  // The attachment ids of the photos on these pit reports (ids as the Teams tab's profiles list them).
  pitPhotoIds(pitReportIds: string[]): Promise<string[]>;
  saveBreakage(b: BreakageReportRow): Promise<void>;
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

// Foundry answered and said no, as opposed to no answer at all. The admin package throws its own copy of
// PalantirApiError, so this goes by the status code it carries, not instanceof.
export const isRefused = (e: unknown): boolean => typeof (e as { statusCode?: unknown } | null)?.statusCode === "number";

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
  // Saved photos seen in the pit reports read so far, by attachment id, so a thumbnail can be fetched.
  const attachments = new Map<string, Attachment>();
  const readPit = (o: PitSurvey.OsdkInstance) => {
    const images = imagesOf(o);
    for (const a of images) attachments.set(a.rid, a);
    return toPitReport(o, images.map((a) => a.rid));
  };
  // By the numbers the picker shows (see numbered), so a typed P4 finds the fourth playoff even when all are stored as 1.
  const findMatch = async (eventUuid: string, matchType: string, matchNumber: number) =>
    numbered((await all(client(Match).where({ eventUuid: { $eq: eventUuid }, matchType: { $eq: matchType } }).asyncIter())).map(toMatchRow))
      .find((m) => m.matchNumber === matchNumber);
  return {
    async currentUser() {
      const u = await Users.getCurrent(client);
      return { id: u.id, name: [u.givenName, u.familyName].filter(Boolean).join(" ") || u.username };
    },
    async ourEvents() {
      return (await all(client(Event).where({ ourEvent: { $eq: true } }).asyncIter())).map(toEventRow);
    },
    async matches(eventUuid) {
      return numbered((await all(client(Match).where({ eventUuid: { $eq: eventUuid } }).asyncIter())).map(toMatchRow));
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
    async pits(eventCode) {
      const rows = await all(client(PitSurvey).where({ eventCode: { $eq: eventCode } }).asyncIter({ $orderBy: { createdAt: "desc" } }));
      return rows.map(readPit);
    },
    async breakages(eventCode) {
      const rows = await all(client(BreakageReport).where({ eventCode: { $eq: eventCode } }).asyncIter({ $orderBy: { createdAt: "desc" } }));
      return rows.map(toBreakageReport);
    },
    // Create, or on a second send (or an edit) replace every field of the stored one.
    async eventTeams(eventUuid) {
      const parts = await all(client(Participation).where({ eventUuid: { $eq: eventUuid } }).asyncIter());
      const numbers = [...new Set(parts.map((p) => p.teamNumber ?? 0).filter((n) => n > 0))];
      const names = new Map<number, string>();
      for (let i = 0; i < numbers.length; i += 200) {
        for (const tm of await all(client(Team).where({ teamNumber: { $in: numbers.slice(i, i + 200) } }).asyncIter())) names.set(tm.teamNumber ?? 0, tm.name ?? "");
      }
      const uuids = new Map(parts.map((p) => [p.teamNumber ?? 0, p.teamUuid ?? null]));
      return numbers.sort((a, b) => a - b).map((teamNumber) => ({ teamNumber, teamUuid: uuids.get(teamNumber) ?? null, name: names.get(teamNumber) ?? "" }));
    },
    async savePit(p, uploads) {
      const found = (await client(PitSurvey).where({ pitReportId: { $eq: p.pitReportId } }).fetchPage({ $pageSize: 1 })).data.length > 0;
      // The photos already saved go by id and the new ones as uploads; the client uploads those as it applies the action.
      const images = [...(p.images ?? []), ...uploads.map((u) => createAttachmentUpload(u.blob, u.name))];
      const { pit_report_id, ...fields } = pitParams(p, images);
      if (found) await apply(client(modifyPitSurvey), { "j87bj1om.pit-survey": pit_report_id, ...fields });
      else await apply(client(createPitSurvey), { pit_report_id, ...fields });
    },
    async pitPhoto(imageId) {
      const a = attachments.get(imageId);
      if (!a) throw new Error("Photo not loaded");
      const res = await a.fetchContents();
      if (!res.ok) throw new Error("Couldn't load the photo");
      return res.blob();
    },
    async pitPhotoIds(pitReportIds) {
      if (!pitReportIds.length) return [];
      const rows = await all(client(PitSurvey).where({ pitReportId: { $in: pitReportIds } }).asyncIter());
      return rows.flatMap((o) => readPit(o).images);
    },
    async saveBreakage(b) {
      const found = (await client(BreakageReport).where({ breakageId: { $eq: b.breakageId } }).fetchPage({ $pageSize: 1 })).data.length > 0;
      const { breakage_id, ...fields } = breakageParams(b);
      if (found) await apply(client(modifyBreakageReport), { "j87bj1om.breakage-report": breakage_id, ...fields });
      else await apply(client(createBreakageReport), { breakage_id, ...fields });
    },
  };
}

type Params = Record<string, unknown>;
const snake = (k: string) => k.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`);
const pick = (r: object, keys: readonly string[]): Params =>
  Object.fromEntries(keys.map((k) => [snake(k), (r as Record<string, unknown>)[k] ?? null]));

// The pit and breakage actions take each field as snake_case: teamNumber is team_number. null clears a field.
// The parameters come from these lists, never from whatever keys a stored report has, so a report queued by an older
// build (with fields since removed) still sends.
const PIT_KEPT = ["pitReportId", "eventCode", "teamNumber", "scout", "createdAt", "drivetrain", "archetype",
  "canHive", "canFlower", "canNectar", "canFloorIntake", "canFlowerIntake", "notes"] as const;
const BREAKAGE_KEPT = ["breakageId", "eventCode", "teamNumber", "teamUuid", "reporter", "createdAt", "matchKey",
  "mechanism", "component", "failureType", "severity", "notes"] as const;
export const pitParams = (p: PitReport, images: unknown[]): Params => ({ ...pick(p, PIT_KEPT), images });
export const breakageParams = (b: BreakageReportRow): Params => pick(b, BREAKAGE_KEPT);
// pitParams and breakageParams build the parameters from field names, so TypeScript can't check them against the
// action; their tests and the live check against the dummy event do.
const apply = (action: { applyAction: unknown }, params: Params) =>
  (action.applyAction as (p: Params) => Promise<unknown>).call(action, params);

const orNull = <T>(v: T | null | undefined): T | null => v ?? null;
// A pit report's saved photos; none on one saved before photos existed.
const imagesOf = (o: Partial<PitSurvey.Props>): Attachment[] => o.images ?? [];

// `images` are the attachment ids of the saved photos (see imagesOf).
export const toPitReport = (o: Partial<PitSurvey.Props>, images: string[] = []): PitReport => ({
  pitReportId: o.pitReportId ?? "", eventCode: o.eventCode ?? "", teamNumber: o.teamNumber ?? 0, scout: o.scout ?? "", createdAt: o.createdAt ?? "",
  drivetrain: orNull(o.drivetrain), archetype: orNull(o.archetype),
  canHive: orNull(o.canHive), canFlower: orNull(o.canFlower), canNectar: orNull(o.canNectar),
  canFloorIntake: orNull(o.canFloorIntake), canFlowerIntake: orNull(o.canFlowerIntake),
  notes: orNull(o.notes), images, photoIds: [],
});
export const toBreakageReport = (o: Partial<BreakageReport.Props>): BreakageReportRow => ({
  breakageId: o.breakageId ?? "", eventCode: o.eventCode ?? "", teamNumber: o.teamNumber ?? 0, teamUuid: orNull(o.teamUuid),
  reporter: o.reporter ?? "", createdAt: o.createdAt ?? "", matchKey: orNull(o.matchKey),
  mechanism: orNull(o.mechanism), component: orNull(o.component),
  failureType: orNull(o.failureType), severity: orNull(o.severity), notes: orNull(o.notes),
});
