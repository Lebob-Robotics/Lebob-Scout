// Development stand-in for the real server: fixed made-up data held in memory.
import type { Api, EventRow, MatchRow, PresenceRow, TeamOption, TeamsTab } from "./api";
import { DEV_TEAMS_TAB } from "./devTeamsTab";
import type { Observation } from "./observation";
import { buildBreakage, buildPit, emptyBreakageForm, emptyPitForm } from "./pitBreakage";
import type { BreakageReport, PitReport } from "./pitBreakage";

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
// Pit and breakage reports, kept like the observations. The first load holds one of each from another scout.
const PITS_KEY = "lsa:dev-pits";
const BREAKAGES_KEY = "lsa:dev-breakages";
const hourAgo = () => new Date(Date.now() - 3600000).toISOString();
// Pit photos by attachment id, in memory (they don't survive a reload; the seeded two are made again each load). Shared
// by every dev api, so the strategy app's dev data sees the scout app's photos.
const picture = (colour: string, text: string) => new Blob([`<svg xmlns="http://www.w3.org/2000/svg" width="320" height="240"><rect width="320" height="240" fill="${colour}"/><text x="160" y="130" font-size="28" font-family="sans-serif" text-anchor="middle" fill="#fff">${text}</text></svg>`], { type: "image/svg+xml" });
const devPhotos = new Map<string, Blob>([["dev-photo-seed-1", picture("#4a7fb5", "Robot front")], ["dev-photo-seed-2", picture("#b5774a", "Robot side")]]);
let photoCount = 0;
const SEED_PITS = (): PitReport[] => [buildPit({ ...emptyPitForm("12345"), drivetrain: "mecanum", archetype: "turret-shooter", canHive: "yes", canFloorIntake: "yes", notes: "Intake belt slips when hot" },
  { pitReportId: "dev-pit-1", eventCode: "DEVNOW", scout: "Alice Nguyen", createdAt: hourAgo() }, { images: ["dev-photo-seed-1", "dev-photo-seed-2"], photoIds: [] })];
const SEED_BREAKAGES = (): BreakageReport[] => [buildBreakage({ ...emptyBreakageForm("16021"), matchNumber: "2", mechanism: "drive", component: "wheel hub", failureType: "loose-disconnected", severity: "3", notes: "Hub came loose after a hit." }, { breakageId: "dev-breakage-1", eventCode: "DEVNOW", reporter: "Sam", createdAt: hourAgo() }, "dev-team-16021")];
function loadKept<T>(key: string, seed: () => T[]): T[] {
  try { const t = localStorage.getItem(key); return t ? JSON.parse(t) : seed(); } catch { return seed(); }
}
const NAMES = Object.fromEntries(DEV_TEAMS_TAB.teams.map((t) => [t.teamNumber, t.name])) as Record<number, string>;
const newestFirst = <T extends { createdAt: string }>(xs: T[]) => [...xs].sort((a, b) => b.createdAt.localeCompare(a.createdAt));

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
  // A pit report kept by an earlier build has no photo fields.
  let pits = loadKept(PITS_KEY, SEED_PITS).map((p) => ({ ...p, images: p.images ?? [], photoIds: p.photoIds ?? [] }));
  let breakages = loadKept(BREAKAGES_KEY, SEED_BREAKAGES);
  const store = (key: string, value: unknown) => { try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* kept in memory only */ } };
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
    pits: (eventCode) => (failSchedule ? fail() : wait(newestFirst(pits.filter((p) => p.eventCode === eventCode)))),
    breakages: (eventCode) => (failSchedule ? fail() : wait(newestFirst(breakages.filter((b) => b.eventCode === eventCode)))),
    eventTeams: (eventUuid) => {
      if (failSchedule) return fail();
      const teams: TeamOption[] = eventUuid === events[0].eventUuid ? TEAMS.map((n) => ({ teamNumber: n, teamUuid: `dev-team-${n}`, name: NAMES[n] ?? "" })) : [];
      return wait(teams);
    },
    pitPhoto: (id) => {
      const b = devPhotos.get(id);
      return b ? wait(b) : fail("Photo unavailable");
    },
    pitPhotoIds: (ids) => wait(pits.filter((p) => ids.includes(p.pitReportId)).flatMap((p) => p.images)),
    savePit: (p, uploads) => {
      if (failSave) return fail("Save failed");
      const added = uploads.map((u) => { const id = `dev-photo-${++photoCount}-${Date.now()}`; devPhotos.set(id, u.blob); return id; });
      pits = [...pits.filter((x) => x.pitReportId !== p.pitReportId), { ...p, images: [...(p.images ?? []), ...added], photoIds: [] }];
      store(PITS_KEY, pits);
      return wait(undefined);
    },
    saveBreakage: (b) => {
      if (failSave) return fail("Save failed");
      breakages = [...breakages.filter((x) => x.breakageId !== b.breakageId), b];
      store(BREAKAGES_KEY, breakages);
      return wait(undefined);
    },
    teamsTab: (eventUuid) => new Promise((resolve, reject) => setTimeout(() => (failTeams ? reject(new Error("Teams unavailable")) : resolve(eventUuid === events[0].eventUuid ? DEV_TEAMS_TAB : NO_SCHEDULE)), 300)),
  };
}
