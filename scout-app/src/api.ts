import type { FinalPage, Observation, Target } from "./observation";

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
};
