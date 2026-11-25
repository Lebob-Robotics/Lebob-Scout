// Throwaway experiment: how do Foundry's actions and reads behave for this app?
// Run from scout-app/ with FOUNDRY_TOKEN in the environment:
//   set -a; . ~/.config/lebob-foundry.env; set +a; node scripts/spike.mjs
// Creates at most one Match Observation (label "SPIKE 1", eventUuid "spike").
import { createClient } from "@osdk/client";
import { Users } from "@osdk/foundry.admin";
import { $ontologyRid, Event, Match, MatchObservation, createMatchObservation, modifyMatchObservation } from "@lebob-scout/sdk";

const url = "https://lebob.euw-3.palantirfoundry.co.uk";
const token = process.env.FOUNDRY_TOKEN;
if (!token) throw new Error("FOUNDRY_TOKEN is not set");
const client = createClient(url, $ontologyRid, async () => token);

const show = (v) => JSON.stringify(v, (_k, x) => (x === undefined ? "<undefined>" : x));
const errInfo = (e) => show({ name: e?.name, message: e?.message, errorName: e?.errorName, errorCode: e?.errorCode, statusCode: e?.statusCode, parameters: e?.parameters, errorInstanceId: e?.errorInstanceId });
async function step(label, fn) {
  try { console.log(`${label}: OK ${show(await fn())}`); }
  catch (e) { console.log(`${label}: ERROR ${errInfo(e)}`); }
}
const plain = (o) => Object.fromEntries(Object.entries(o).filter(([k]) => !k.startsWith("$")).map(([k, v]) => [k, v === undefined ? "<undefined>" : v]));
const types = (o) => Object.fromEntries(Object.entries(plain(o)).map(([k, v]) => [k, Array.isArray(v) ? `array(${v.length})` : `${v === null ? "null" : typeof v}`]));

const id = crypto.randomUUID();
console.log("observationId", id);
const n = 80;
const tapSeconds = Array.from({ length: n }, (_, i) => i * 1.5 + 0.25);
const tapKinds = Array.from({ length: n }, (_, i) => (i % 2 ? "intake" : "shoot"));
const tapSquares = Array.from({ length: n }, (_, i) => `${"ABCDEF"[i % 6]}${(i % 6) + 1}`);
const tapCounts = Array.from({ length: n }, (_, i) => (i % 4) + 1);
const t0 = "2026-11-25T10:00:00.000Z";
const createParams = {
  observation_id: id, label: "SPIKE 1", event_uuid: "spike",
  match_uuid: null, presence_uuid: null, team_uuid: null,
  match_number: 0, match_type: "qualification", team_number: 0, alliance: "red",
  auto_leave: false, auto_park: false, teleop_park: false, broke_down: false,
  minor_fouls: 0, major_fouls: 0, driver_skill: null, robot_speed: null,
  auto_notes: null, notes: null, auto_path_points: "",
  tap_seconds: tapSeconds, tap_kinds: tapKinds, tap_squares: tapSquares, tap_counts: tapCounts,
  scout_user_id: "spike", scout_name: "Spike", created_at: t0, updated_at: t0, timer_started_at: t0,
  field_key: "ftc-2026", start_square: "A1",
};

// a. create and read back
await step("a.create", () => client(createMatchObservation).applyAction(createParams, { $returnEdits: true }));
await step("a.readback", async () => {
  const o = await client(MatchObservation).fetchOne(id);
  const same = (a, b) => Array.isArray(a) && a.length === b.length && a.every((x, i) => x === b[i]);
  return {
    lengths: [o.tapSeconds?.length, o.tapKinds?.length, o.tapSquares?.length, o.tapCounts?.length],
    sameOrder: [same(o.tapSeconds, tapSeconds), same(o.tapKinds, tapKinds), same(o.tapSquares, tapSquares), same(o.tapCounts, tapCounts)],
    nullables: { matchUuid: o.matchUuid, presenceUuid: o.presenceUuid, teamUuid: o.teamUuid, driverSkill: o.driverSkill, robotSpeed: o.robotSpeed, autoNotes: o.autoNotes, notes: o.notes, autoPathPoints: o.autoPathPoints },
    timestamps: { createdAt: o.createdAt, updatedAt: o.updatedAt, timerStartedAt: o.timerStartedAt },
    types: types(o),
  };
});

// b. create the same id again
await step("b.createSameId", () => client(createMatchObservation).applyAction({ ...createParams, label: "SPIKE 1 again" }, { $returnEdits: true }));
await step("b.afterRetry", async () => { const o = await client(MatchObservation).fetchOne(id); return { label: o.label, tapCount: o.tapSeconds?.length }; });

// c. reads for an id that does not exist
const missing = crypto.randomUUID();
await step("c.whereMissing", async () => { const p = await client(MatchObservation).where({ observationId: { $eq: missing } }).fetchPage({ $pageSize: 1 }); return { rows: p.data.length, nextPageToken: p.nextPageToken }; });
await step("c.whereExisting", async () => { const p = await client(MatchObservation).where({ observationId: { $eq: id } }).fetchPage({ $pageSize: 1 }); return { rows: p.data.length }; });
await step("c.fetchOneMissing", () => client(MatchObservation).fetchOne(missing));

// d. partial modify, then full modify
const objRef = "j87bj1om.match-observation";
const t1 = "2026-11-25T11:00:00.000Z";
await step("d.partialWithObject", async () => {
  const o = await client(MatchObservation).fetchOne(id);
  return client(modifyMatchObservation).applyAction({ [objRef]: o, notes: "partial", updated_at: t1 }, { $returnEdits: true });
});
const full = (ref, extra) => ({
  [objRef]: ref, label: "SPIKE 1", match_uuid: null, presence_uuid: null, team_uuid: null,
  match_number: 0, match_type: "qualification", team_number: 0, alliance: "red",
  auto_leave: true, auto_park: false, teleop_park: false, broke_down: false, minor_fouls: 1, major_fouls: 0,
  driver_skill: 3, robot_speed: null, auto_notes: null, notes: "full", auto_path_points: "", updated_at: t1, ...extra,
});
await step("d.fullWithPrimaryKey", () => client(modifyMatchObservation).applyAction(full(id), { $returnEdits: true }));
await step("d.fullWithObject", async () => {
  const o = await client(MatchObservation).fetchOne(id);
  return client(modifyMatchObservation).applyAction(full(o, { notes: "full via object" }), { $returnEdits: true });
});
await step("d.afterFull", async () => { const o = await client(MatchObservation).fetchOne(id); return { notes: o.notes, autoLeave: o.autoLeave, minorFouls: o.minorFouls, driverSkill: o.driverSkill, tapCount: o.tapSeconds?.length }; });

// e. does null clear a nullable value?
const t2 = "2026-11-25T12:00:00.000Z";
await step("e.setNotesNull", () => client(modifyMatchObservation).applyAction(full(id, { notes: null, updated_at: t2 }), { $returnEdits: true }));
await step("e.afterNull", async () => { const o = await client(MatchObservation).fetchOne(id); return { notes: o.notes, typeofNotes: o.notes === null ? "null" : typeof o.notes }; });

// f. timestamps after modify
await step("f.timestamps", async () => { const o = await client(MatchObservation).fetchOne(id); return { createdAt: o.createdAt, updatedAt: o.updatedAt, timerStartedAt: o.timerStartedAt, sentUpdatedAt: t2 }; });

// g. schedule reads
await step("g.events", async () => {
  const es = await Array.fromAsync(client(Event).where({ ourEvent: { $eq: true } }).asyncIter());
  return { count: es.length, sample: es.slice(0, 3).map(plain) };
});
await step("g.matchesAndPresences", async () => {
  const es = await Array.fromAsync(client(Event).where({ ourEvent: { $eq: true } }).asyncIter());
  for (const e of es) {
    const ms = await Array.fromAsync(client(Match).where({ eventUuid: { $eq: e.eventUuid } }).asyncIter());
    if (!ms.length) continue;
    const viaLink = await Array.fromAsync(e.$link.matches.asyncIter());
    const m = ms[0];
    const ps = await Array.fromAsync(m.$link.presences.asyncIter());
    return {
      event: e.eventCode, matchCount: ms.length, viaLinkCount: viaLink.length,
      matchTypes: [...new Set(ms.map((x) => x.matchType))],
      timeSamples: ms.slice(0, 3).map((x) => ({ scheduledTime: x.scheduledTime, actualTime: x.actualTime, types: [typeof x.scheduledTime, typeof x.actualTime] })),
      matchSample: plain(m),
      presenceCount: ps.length,
      presences: ps.map((p) => ({ alliance: p.alliance, station: p.station, teamNumber: p.teamNumber, teamUuid: p.teamUuid })),
    };
  }
  return "no ourEvent event has matches";
});

// h. current user
await step("h.getCurrent", async () => {
  const u = await Users.getCurrent(client);
  // Field names only: values can be personal (username may be an email address).
  return { fields: Object.keys(u), filled: Object.keys(u).filter((k) => u[k] != null && u[k] !== "") };
});
