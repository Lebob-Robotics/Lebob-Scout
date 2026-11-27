// Copies what the strategy app reads from Foundry into static files, for the public strategy page at
// lebob.com.au/strategy (src/strategy/publicMain.tsx, src/strategy/publicApi.ts). Run with the token loaded:
//   FOUNDRY_TOKEN=... node scripts/export-public.mjs <out dir>
// Writes <out>/data/index.json (our events and when this ran), <out>/data/<eventUuid>.json (the raw Match, Presence,
// EventRating and RankProjection objects, and the teamsTab, fieldMaps, pointSplits, teamCycles and matchMaps
// results) and <out>/data/photos/<attachment rid> (pit photos). Every scout's name and user id is blanked and every scout note left out: the
// page is public. Read-only: nothing is written to Foundry. Node 18+, no dependencies.
import fs from "node:fs";
import path from "node:path";

const HOST = "https://lebob.euw-3.palantirfoundry.co.uk";
const ONTOLOGY = "ri.ontology.main.ontology.337241ba-4314-4c10-a9e2-6160a76db115";
const TOKEN = (process.env.FOUNDRY_TOKEN ?? "").trim();
const OUT = path.join(process.argv[2] ?? "public-data", "data");
if (!TOKEN) { console.error("FOUNDRY_TOKEN is not set"); process.exit(1); }

const headers = { Authorization: `Bearer ${TOKEN}`, "Content-Type": "application/json" };
async function call(url, init = {}, tries = 4) {
  for (let i = 1; ; i++) {
    const r = await fetch(url, { headers, ...init });
    if (r.ok) return r;
    if ((r.status === 429 || r.status >= 500) && i < tries) { await new Promise((ok) => setTimeout(ok, 1000 * i)); continue; }
    throw new Error(`${init.method ?? "GET"} ${url.replace(HOST, "")}: ${r.status} ${(await r.text()).slice(0, 200)}`);
  }
}
const api = `${HOST}/api/v2/ontologies/${ONTOLOGY}`;
const strip = (o) => Object.fromEntries(Object.entries(o).filter(([k]) => !k.startsWith("__")));
async function search(type, where) {
  const out = [];
  let pageToken;
  do {
    const r = await (await call(`${api}/objects/${type}/search`, { method: "POST", body: JSON.stringify({ where, pageSize: 1000, pageToken }) })).json();
    out.push(...r.data.map(strip));
    pageToken = r.nextPageToken;
  } while (pageToken);
  return out;
}
const eq = (field, value) => ({ type: "eq", field, value });
const inList = async (type, field, values) => {
  const out = [];
  for (let i = 0; i < values.length; i += 200) out.push(...await search(type, { type: "in", field, value: values.slice(i, i + 200) }));
  return out;
};
// A function's result, or null when it fails (the page then says that part could not load, as the real app does).
async function query(name, parameters) {
  try {
    return (await (await call(`${api}/queries/${name}/execute`, { method: "POST", body: JSON.stringify({ parameters }) })).json()).value;
  } catch (e) {
    console.warn(`  ${name}: ${e.message}`);
    return null;
  }
}
async function pool(items, n, f) {
  const out = new Array(items.length);
  let next = 0;
  await Promise.all(Array.from({ length: Math.min(n, items.length) }, async () => {
    while (next < items.length) { const i = next++; out[i] = await f(items[i]); }
  }));
  return out;
}

// Scout names and ids, anywhere in a result, become empty, and everything scouts wrote in their own words is left
// out (match notes, pit report notes and issues, breakage descriptions): the public page shows no scouts and no notes.
const NAME_KEYS = new Set(["scoutName", "scoutUserId", "scout", "reporter"]);
const NOTE_KEYS = new Set(["notes", "autoNotes", "knownIssues", "symptoms", "evidence", "fix", "actionBefore", "cause"]);
// Qualitative scouting is left out too: driver and speed ratings, fouls and breakdowns. Pit reports (and their
// photos) are dropped whole, and each breakage keeps only that it happened, so the page can still count them.
const QUALITATIVE_KEYS = new Set(["driverSkill", "robotSpeed", "minorFouls", "majorFouls", "brokeDownMatches", "brokeDown"]);
function scrub(v) {
  if (Array.isArray(v)) return v.map(scrub);
  if (v && typeof v === "object") {
    return Object.fromEntries(Object.entries(v)
      .filter(([k, x]) => !(NOTE_KEYS.has(k) && typeof x === "string") && !QUALITATIVE_KEYS.has(k))
      .map(([k, x]) => [k, NAME_KEYS.has(k) && typeof x === "string" ? "" : scrub(x)]));
  }
  return v;
}

fs.mkdirSync(path.join(OUT, "photos"), { recursive: true });
// Only these events go on the public page (event codes, comma-separated in PUBLIC_EVENTS): by default the WA
// Qualifier and the Australia Championship. An event with no schedule yet (no matches) is left out until it has one.
const PUBLIC_EVENTS = new Set((process.env.PUBLIC_EVENTS ?? "AUPEQ,AUCMP").split(",").map((c) => c.trim().toUpperCase()).filter(Boolean));
const events = (await search("Event", eq("ourEvent", true)))
  .filter((e) => PUBLIC_EVENTS.has(String(e.eventCode).toUpperCase()))
  .map((e) => ({ eventUuid: e.eventUuid, eventCode: e.eventCode, eventName: e.eventName, dateStart: e.dateStart, dateEnd: e.dateEnd }))
  .sort((a, b) => String(a.dateStart).localeCompare(String(b.dateStart)));
let photos = 0;
const published = [];
for (const ev of events) {
  const e = ev.eventUuid;
  console.log(`${ev.eventCode} (${e})`);
  const matches = await search("Match", eq("eventUuid", e));
  if (!matches.length) { console.log("  no schedule yet: left out"); continue; }
  published.push(ev);
  const presences = await inList("Presence", "matchUuid", matches.map((m) => m.matchUuid));
  const [ratings, projections] = await Promise.all([search("EventRating", eq("eventUuid", e)), search("RankProjection", eq("eventUuid", e))]);
  const [teamsTab, fieldMaps, pointSplits, teamCycles] = await Promise.all(
    ["teamsTab", "fieldMaps", "pointSplits", "teamCycles"].map((q) => query(q, { eventUuid: e })));
  const mm = await pool(matches, 4, (m) => query("matchMaps", { eventUuid: e, matchUuid: m.matchUuid }));
  const matchMaps = Object.fromEntries(matches.map((m, i) => [m.matchUuid, mm[i]]).filter(([, v]) => v));
  // Pit photos: each pit report's attachments, downloaded once.
  const pitIds = []; // pit reports and their photos are not published (see QUALITATIVE_KEYS)
  const pits = pitIds.length ? await inList("PitSurvey", "pitReportId", pitIds) : [];
  const pitImages = {};
  for (const p of pits) {
    const rids = (p.images ?? []).map((a) => a.rid).filter(Boolean);
    pitImages[p.pitReportId] = rids;
    for (const rid of rids) {
      const file = path.join(OUT, "photos", rid);
      if (fs.existsSync(file)) continue;
      try {
        const r = await call(`${HOST}/api/v2/ontologies/attachments/${rid}/content`);
        fs.writeFileSync(file, Buffer.from(await r.arrayBuffer()));
        photos++;
      } catch (err) { console.warn(`  photo ${rid}: ${err.message}`); }
    }
  }
  const data = scrub({ matches, presences, ratings, projections, teamsTab, fieldMaps, pointSplits, teamCycles, matchMaps, pitImages });
  if (data.teamsTab) {
    data.teamsTab.scouts = [];
    data.teamsTab.teams = data.teamsTab.teams.map((t) => ({
      ...t, notes: [], pits: [],
      breakages: (t.breakages ?? []).map((b) => ({ breakageId: b.breakageId, teamNumber: b.teamNumber, createdAt: b.createdAt })),
    }));
  }
  fs.writeFileSync(path.join(OUT, `${e}.json`), JSON.stringify(data));
  console.log(`  ${matches.length} matches, ${presences.length} slots, ${data.teamsTab?.teams?.length ?? 0} teams, ${Object.keys(matchMaps).length} match maps`);
}
fs.writeFileSync(path.join(OUT, "index.json"), JSON.stringify({ exportedAt: new Date().toISOString(), events: published }));
console.log(`${published.length} events, ${photos} new photos -> ${OUT}`);
