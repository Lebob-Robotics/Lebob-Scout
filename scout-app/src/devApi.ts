// Development stand-in for the real server: fixed made-up data held in memory.
import type { Api, EventRow, MatchRow, PresenceRow, TeamsTab } from "./api";
import { DEV_TEAMS_TAB } from "./devTeamsTab";
import type { Observation } from "./observation";

const wait = <T>(value: T) => new Promise<T>((resolve) => setTimeout(() => resolve(value), 150));
const day = (offset: number) => {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
};
const TEAMS = [11115, 12345, 14469, 16021, 18172, 19044, 21230, 23511];

const fail = (why = "Schedule unavailable") => new Promise<never>((_, reject) => setTimeout(() => reject(new Error(why)), 150));
const SAVED_KEY = "lsa:dev-observations";
const loadSaved = (): Observation[] => {
  // Reports saved before the wall position have none.
  try { return JSON.parse(localStorage.getItem(SAVED_KEY) ?? "[]").map((o: Observation) => ({ ...o, startWallPos: o.startWallPos ?? null })); } catch { return []; }
};

// failSchedule makes the event, match and robot lists fail, to check the offline paths. failSave makes modify fail.
// failCreate makes create fail. failTeams makes the Teams tab fail. create also refuses an observationId it already holds, so a duplicate save shows up.
// Saved observations are kept in localStorage so they survive a reload.
// Any other event: no schedule and no reports yet.
const NO_SCHEDULE: TeamsTab = { teams: [], scouts: [], needScouting: 0, coverage: { rows: [], slots: 0, have: 0, duplicates: 0, strays: 0, unscheduled: 0, playedBy: "none" } };

export function createDevApi({ failSchedule = false, failSave = false, failCreate = false, failTeams = false }: { failSchedule?: boolean; failSave?: boolean; failCreate?: boolean; failTeams?: boolean } = {}): Api {
  const events: EventRow[] = [
    { eventUuid: "dev-event-now", eventCode: "DEVNOW", eventName: "Dev Qualifier (running)", dateStart: day(-1), dateEnd: day(1) },
    { eventUuid: "dev-event-next", eventCode: "DEVNEXT", eventName: "Dev Championship (next month)", dateStart: day(30), dateEnd: day(31) },
  ];
  const played = new Date(Date.now() - 3600000).toISOString();
  const matches: MatchRow[] = [
    ...[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11].map((n): MatchRow => ({ matchUuid: `dev-q${n}`, matchNumber: n, matchType: "qualification", scheduledTime: null, actualTime: n <= 10 ? played : null })),
    ...[1, 2].map((n): MatchRow => ({ matchUuid: `dev-p${n}`, matchNumber: n, matchType: "playoff", scheduledTime: null, actualTime: null })),
  ];
  const presences: PresenceRow[] = matches.flatMap((m, i) =>
    ([["red", 1], ["red", 2], ["blue", 1], ["blue", 2]] as const).map(([alliance, station], j): PresenceRow => {
      // Qualification line-ups follow the Teams tab's coverage rows, so a tapped cell is on the schedule.
      const teamNumber = DEV_TEAMS_TAB.coverage.rows.find((r) => r.matchUuid === m.matchUuid)?.cells[j].teamNumber ?? TEAMS[(i * 3 + j) % TEAMS.length];
      return { presenceUuid: `${m.matchUuid}-${alliance}${station}`, matchUuid: m.matchUuid, teamUuid: `dev-team-${teamNumber}`, teamNumber, alliance, station };
    }),
  );
  let saved = loadSaved();
  const keep = (next: Observation[]) => {
    saved = next;
    try { localStorage.setItem(SAVED_KEY, JSON.stringify(next)); } catch { /* kept in memory only */ }
  };

  return {
    currentUser: () => wait({ id: "dev", name: "Dev Scout" }),
    ourEvents: () => (failSchedule ? fail() : wait(events)),
    matches: (eventUuid) => (failSchedule ? fail() : wait(eventUuid === events[0].eventUuid ? matches : [])),
    presences: (matchUuid) => (failSchedule ? fail() : wait(presences.filter((p) => p.matchUuid === matchUuid))),
    findPresence: (eventUuid, matchType, matchNumber, teamNumber) => {
      const m = eventUuid === events[0].eventUuid ? matches.find((x) => x.matchType === matchType && x.matchNumber === matchNumber) : undefined;
      return wait(presences.find((p) => p.matchUuid === m?.matchUuid && p.teamNumber === teamNumber) ?? null);
    },
    findTeamUuid: (teamNumber) => wait(TEAMS.includes(teamNumber) ? `dev-team-${teamNumber}` : null),
    exists: (id) => wait(saved.some((o) => o.observationId === id)),
    create: (o) => {
      if (failCreate) return fail("Create failed");
      if (saved.some((x) => x.observationId === o.observationId)) return fail(`Duplicate create of ${o.observationId}`);
      keep([...saved, o]);
      return wait(undefined);
    },
    modify: (id, patch, nowMs) => {
      if (failSave) return fail("Save failed");
      keep(saved.map((o) => (o.observationId === id ? { ...o, ...patch, updatedAt: new Date(nowMs).toISOString() } : o)));
      return wait(undefined);
    },
    observations: (eventUuid) => wait(saved.filter((o) => o.eventUuid === eventUuid)),
    observation: (id) => {
      const o = saved.find((x) => x.observationId === id);
      return o ? wait(o) : fail(`No report ${id}`);
    },
    teamsTab: (eventUuid) => new Promise((resolve, reject) => setTimeout(() => (failTeams ? reject(new Error("Teams unavailable")) : resolve(eventUuid === events[0].eventUuid ? DEV_TEAMS_TAB : NO_SCHEDULE)), 300)),
  };
}
