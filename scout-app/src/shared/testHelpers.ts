import type { Tap } from "./taps";
import type { Draft, Observation } from "./observation";
import type { Patch, PitUpload, PresenceRow } from "./api";
import { buildBreakage, buildPit, emptyBreakageForm, emptyPitForm } from "./pitBreakage";
import type { BreakageReport, PitReport } from "./pitBreakage";
import { createStore } from "./storage";
import type { Store } from "./storage";

export const tap = (seconds: number): Tap => ({ seconds, square: "C4", kind: "shoot", count: 1 });

export const draft = (overrides: Partial<Draft> = {}): Draft => ({
  eventUuid: "e1", matchUuid: null, presenceUuid: null, teamUuid: null,
  matchNumber: 1, matchType: "qualification", teamNumber: 29550, alliance: "red",
  observationId: "obs-1", fieldKey: "ftc-2026", startSquare: "C4", startWallPos: null, startedAtMs: 0,
  taps: [], flipped: false, stage: "live",
  final: {
    autoLeave: false, autoPark: false, teleopPark: false, brokeDown: false,
    minorFouls: 0, majorFouls: 0, driverSkill: null, robotSpeed: null,
    autoNotes: null, notes: null, autoPathPoints: null,
  },
  ...overrides,
});

export const obs = (id: string, overrides: Partial<Observation> = {}): Observation => ({
  eventUuid: "e1", matchUuid: null, presenceUuid: null, teamUuid: null,
  matchNumber: 1, matchType: "qualification", teamNumber: 29550, alliance: "red",
  autoLeave: false, autoPark: false, teleopPark: false, brokeDown: false,
  minorFouls: 0, majorFouls: 0, driverSkill: null, robotSpeed: null,
  autoNotes: null, notes: null, autoPathPoints: null,
  tapSeconds: [], tapSquares: [], tapKinds: [], tapCounts: [],
  observationId: id, label: "Q1 · 29550", scoutUserId: "u1", scoutName: "Sam Scout",
  createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z",
  timerStartedAt: "2026-01-01T00:00:00.000Z", fieldKey: "ftc-2026", startSquare: "C4", startWallPos: null,
  ...overrides,
});

export const fakeStorage = (initial: Record<string, string> = {}): Storage => {
  const m = new Map(Object.entries(initial));
  return {
    getItem: k => m.get(k) ?? null,
    setItem: (k, v) => void m.set(k, v),
    removeItem: k => void m.delete(k),
    clear: () => m.clear(),
    key: i => [...m.keys()][i] ?? null,
    get length() { return m.size; },
  };
};

export const throwingStorage = (): Storage => ({
  ...fakeStorage(),
  getItem: () => { throw new Error("blocked"); },
  setItem: () => { throw new Error("blocked"); },
});

export const storeWith = (...observations: Observation[]): Store => {
  const s = createStore(fakeStorage());
  observations.forEach(o => s.enqueue(o));
  return s;
};

export const anyPresence: PresenceRow = { presenceUuid: "p", matchUuid: "m", teamUuid: "t", teamNumber: 29550, alliance: "red", station: 1 };

export function fake(options: {
  createThrows?: boolean; createThrowsFor?: string; createHangs?: boolean; observations?: Observation[];
  presence?: { key: string; row: PresenceRow };
}) {
  const api = {
    calls: [] as string[],
    existing: new Set<string>(),
    createThrows: options.createThrows ?? false,
    existsThrows: false,
    modified: [] as [string, Patch][],
    async exists(id: string) {
      api.calls.push(`exists ${id}`);
      if (api.existsThrows) throw new Error("exists failed");
      return api.existing.has(id);
    },
    async create(o: Observation) {
      api.calls.push(`create ${o.observationId}`);
      if (options.createHangs) return new Promise<void>(() => {}); // a request that never answers
      if (api.createThrows || options.createThrowsFor === o.observationId) throw new Error("network");
    },
    async observations(_eventUuid: string) { return options.observations ?? []; },
    async findPresence(_e: string, matchType: string, matchNumber: number, teamNumber: number) {
      return options.presence?.key === `${matchType} ${matchNumber} ${teamNumber}` ? options.presence.row : null;
    },
    async modify(id: string, patch: Patch, _nowMs: number) { api.modified.push([id, patch]); },
    saveThrows: false,
    async savePit(p: PitReport, uploads: PitUpload[] = []) {
      api.calls.push(`savePit ${p.pitReportId}${uploads.length ? ` +${uploads.length}` : ""}`);
      if (api.saveThrows) throw new Error("network");
    },
    async saveBreakage(b: BreakageReport) {
      api.calls.push(`saveBreakage ${b.breakageId}`);
      if (api.saveThrows) throw new Error("network");
    },
  };
  return api;
}

export const pitReport = (id: string, teamNumber = 7): PitReport =>
  buildPit(emptyPitForm(String(teamNumber)), { pitReportId: id, eventCode: "AUCMP", scout: "Ann", createdAt: "2026-12-05T01:00:00.000Z" });
export const breakageReport = (id: string, teamNumber = 7): BreakageReport =>
  buildBreakage(emptyBreakageForm(String(teamNumber)), { breakageId: id, eventCode: "AUCMP", reporter: "Bo", createdAt: "2026-12-05T02:00:00.000Z" }, null);
