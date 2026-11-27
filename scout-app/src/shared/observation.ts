import { FIELDS } from "./field";
import { checkTaps, toLists } from "./taps";
import type { Tap, TapLists } from "./taps";

export type Target = {
  eventUuid: string; matchUuid: string | null; presenceUuid: string | null; teamUuid: string | null;
  matchNumber: number; matchType: "qualification" | "playoff"; teamNumber: number; alliance: "red" | "blue";
};
export type FinalPage = {
  autoLeave: boolean; autoPark: boolean; teleopPark: boolean; brokeDown: boolean;
  minorFouls: number; majorFouls: number; driverSkill: number | null; robotSpeed: number | null;
  autoNotes: string | null; notes: string | null; autoPathPoints: string | null;
};
export type Draft = Target & {
  observationId: string; fieldKey: string; startSquare: string; startWallPos: number | null; startedAtMs: number;
  taps: Tap[]; flipped: boolean; stage: "live" | "final"; final: FinalPage;
};
export type Observation = Target & FinalPage & TapLists & {
  observationId: string; label: string; scoutUserId: string; scoutName: string;
  createdAt: string; updatedAt: string; timerStartedAt: string; fieldKey: string; startSquare: string; startWallPos: number | null;
};

export const labelFor = (t: Pick<Target, "matchType" | "matchNumber" | "teamNumber">): string =>
  `${t.matchType === "qualification" ? "Q" : "P"}${t.matchNumber} · ${t.teamNumber}`;

export function buildObservation(draft: Draft, user: { id: string; name: string }, nowMs: number): Observation {
  const field = FIELDS[draft.fieldKey];
  if (!field) throw new Error(`Unknown field ${draft.fieldKey}`);
  const problems = checkTaps(draft.taps, field);
  if (problems.length) throw new Error(problems.join("; "));
  const now = new Date(nowMs).toISOString();
  return {
    eventUuid: draft.eventUuid, matchUuid: draft.matchUuid, presenceUuid: draft.presenceUuid, teamUuid: draft.teamUuid,
    matchNumber: draft.matchNumber, matchType: draft.matchType, teamNumber: draft.teamNumber, alliance: draft.alliance,
    ...draft.final,
    ...toLists(draft.taps),
    observationId: draft.observationId,
    label: labelFor(draft),
    scoutUserId: user.id,
    scoutName: user.name,
    createdAt: now,
    updatedAt: now,
    timerStartedAt: new Date(draft.startedAtMs).toISOString(),
    fieldKey: draft.fieldKey,
    startSquare: draft.startSquare,
    startWallPos: draft.startWallPos ?? null, // a draft from before the wall position has none
  };
}
