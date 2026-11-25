import type { Tap } from "./taps";
import type { Draft, Observation } from "./observation";

export const tap = (seconds: number): Tap => ({ seconds, square: "C4", kind: "shoot", count: 1 });

export const draft = (overrides: Partial<Draft> = {}): Draft => ({
  eventUuid: "e1", matchUuid: null, presenceUuid: null, teamUuid: null,
  matchNumber: 1, matchType: "qualification", teamNumber: 29550, alliance: "red",
  observationId: "obs-1", fieldKey: "ftc-2026", startSquare: "C4", startedAtMs: 0,
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
  timerStartedAt: "2026-01-01T00:00:00.000Z", fieldKey: "ftc-2026", startSquare: "C4",
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
