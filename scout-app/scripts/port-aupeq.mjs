// One-off: port the old site's AUPEQ qualification match reports (old project, dataset "matchreport", read-only)
// into the new app as Match Observations. Sean's rulings, 26 Nov:
//   - practice matches (old keys p1 to p4) are skipped; only qualifications are ported
//   - nothing at AUPEQ had a location, so every tap has an empty square
//   - a score is a shot that scored 1; a miss is a shot that scored 0 (same cycle, no points)
//   - intakes from the ground, a flower or the garden are all plain intakes; garden placements are left out
//   - defence times, nectar pieces and flower or garden intakes go into a one-line note
//   - scouts are named by their initials, "SS (old site)", under one shared "old-site" user
// Each report's id is "old-<old report id>", so running the write twice creates nothing new.
//
// Run from scout-app/ with FOUNDRY_TOKEN in the environment:
//   node scripts/port-aupeq.mjs <plan.json>            dry run: writes the plan and prints a check, saves nothing
//   node scripts/port-aupeq.mjs <plan.json> --write    saves every report in the plan
import fs from "node:fs";
import { createClient } from "@osdk/client";
import { $ontologyRid, createMatchObservation, Presence } from "@lebob-scout/sdk";

const URL_ = "https://lebob.euw-3.palantirfoundry.co.uk";
const OLD_REPORTS = "ri.foundry.main.dataset.ab9373bd-cc2c-429d-a290-a897fd5bae05";
const AUPEQ = "a115f534-756c-5359-84d0-f2e15a2f1fd9";
const token = process.env.FOUNDRY_TOKEN;
if (!token) throw new Error("FOUNDRY_TOKEN is not set");
const [planPath, mode] = process.argv.slice(2);
if (!planPath) throw new Error("give a path for the plan, e.g. ../scratch/plan.json");

// A CSV parser for quoted fields with commas, quotes and new lines inside.
function parseCsv(text) {
  const rows = [];
  let row = [], field = "", quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') { field += '"'; i++; }
      else if (c === '"') quoted = false;
      else field += c;
    } else if (c === '"') quoted = true;
    else if (c === ",") { row.push(field); field = ""; }
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(field); rows.push(row); row = []; field = "";
    } else field += c;
  }
  if (field || row.length) { row.push(field); rows.push(row); }
  const [head, ...body] = rows;
  return body.filter((r) => r.length === head.length).map((r) => Object.fromEntries(head.map((h, i) => [h, r[i]])));
}

const res = await fetch(`${URL_}/api/v2/datasets/${OLD_REPORTS}/readTable?format=CSV`, { headers: { Authorization: `Bearer ${token}` } });
if (!res.ok) throw new Error(`reading the old reports failed: ${res.status} ${await res.text()}`);
const old = parseCsv(await res.text()).filter((r) => r.event_code === "AUPEQ" && /^AUPEQ-q\d+$/.test(r.match_key));

const client = createClient(URL_, $ontologyRid, async () => token);
const presences = new Map();
for await (const p of client(Presence).where({ presenceUuid: { $in: [...new Set(old.map((r) => r.presence_uuid).filter(Boolean))] } }).asyncIter()) {
  presences.set(p.presenceUuid, p);
}

const bool = (v) => v === "true";
const int = (v) => (v === "" || v == null ? null : Math.round(Number(v)));
const startXY = (v) => (v <= 50 ? { x: 0.5 - v / 100, y: 0 } : v <= 150 ? { x: 0, y: v / 100 - 0.5 } : { x: v / 100 - 1.5, y: 1 });
// As startSquareFor in src/startWall.ts, for the 6 by 6 field.
function startSquare(v, alliance) {
  if (v == null) return "";
  let { x, y } = startXY(v);
  if (alliance === "blue") { x = 1 - x; y = 1 - y; }
  const col = Math.min(5, Math.floor(x * 6)), row = Math.min(5, Math.floor(y * 6));
  return `${String.fromCharCode(65 + (alliance === "red" ? Math.min(2, col) : Math.max(3, col)))}${row + 1}`;
}
const SHOT = { score: 1, "auto-score": 1, miss: 0, "auto-miss": 0 };
const INTAKE = new Set(["intake-ground", "intake-flower", "auto-intake-garden", "auto-intake-flower"]);

const plan = [], problems = [];
for (const r of old) {
  const p = presences.get(r.presence_uuid);
  if (!p) { problems.push(`${r.report_id}: presence ${r.presence_uuid} not found`); continue; }
  const alliance = r.alliance.toLowerCase();
  if (p.alliance !== alliance || p.teamNumber !== Number(r.team_number)) problems.push(`${r.report_id}: presence says ${p.teamNumber} ${p.alliance}`);
  const matchNumber = Number(r.match_key.replace("AUPEQ-q", ""));
  let log = [];
  try { log = r.cycle_log ? JSON.parse(r.cycle_log) : []; } catch { problems.push(`${r.report_id}: cycle log unreadable`); }
  const taps = [];
  let nectar = 0, flower = 0, garden = 0;
  for (const [s, kind, piece] of log) {
    if (piece === "nectar") nectar++;
    if (kind.endsWith("intake-flower")) flower++;
    if (kind === "auto-intake-garden") garden++;
    if (kind in SHOT) taps.push({ seconds: Number(s), kind: "shoot", count: SHOT[kind] });
    else if (INTAKE.has(kind)) taps.push({ seconds: Number(s), kind: "intake", count: 0 });
  }
  const parts = [
    int(r.defence_seconds) ? `defended ${int(r.defence_seconds)} s` : "",
    int(r.defended_seconds) ? `was defended ${int(r.defended_seconds)} s` : "",
    nectar ? `${nectar} nectar` : "",
    flower ? `${flower} flower intake${flower === 1 ? "" : "s"}` : "",
    garden ? `${garden} garden intake${garden === 1 ? "" : "s"}` : "",
  ].filter(Boolean);
  const notes = [r.notes?.trim(), parts.length ? `Old site: ${parts.join(", ")}.` : ""].filter(Boolean).join("\n");
  const at = new Date(/^\d+$/.test(r.created_at) ? Number(r.created_at) : Date.parse(r.created_at)).toISOString();
  const wall = int(r.start_wall_pos);
  plan.push({
    observation_id: `old-${r.report_id}`, event_uuid: AUPEQ, field_key: "ftc-2026",
    label: `Q${matchNumber} · ${r.team_number}`, match_uuid: p.matchUuid, presence_uuid: p.presenceUuid, team_uuid: p.teamUuid ?? r.team_uuid,
    match_number: matchNumber, match_type: "qualification", team_number: Number(r.team_number), alliance,
    auto_leave: bool(r.auto_leave), auto_park: bool(r.auto_park), teleop_park: bool(r.teleop_park), broke_down: bool(r.broke_down),
    minor_fouls: int(r.minor_fouls) ?? 0, major_fouls: int(r.major_fouls) ?? 0, driver_skill: int(r.driver_skill), robot_speed: int(r.robot_speed),
    auto_notes: r.auto_path?.trim() || null, notes: notes || null, auto_path_points: "",
    tap_seconds: taps.map((t) => t.seconds), tap_kinds: taps.map((t) => t.kind), tap_squares: taps.map(() => ""), tap_counts: taps.map((t) => t.count),
    scout_user_id: "old-site", scout_name: `${r.scout} (old site)`,
    created_at: at, updated_at: at, timer_started_at: at,
    start_square: startSquare(wall, alliance), start_wall_pos: wall,
    _check: { hive_scored: int(r.hive_scored), hive_missed: int(r.hive_missed), auto_scored: int(r.auto_scored) },
  });
}

fs.writeFileSync(planPath, JSON.stringify(plan, null, 1));
const shots = plan.reduce((n, p) => n + p.tap_kinds.filter((k) => k === "shoot").length, 0);
const scored = plan.reduce((n, p) => n + p.tap_counts.reduce((a, b) => a + b, 0), 0);
const oldScored = plan.reduce((n, p) => n + (p._check.hive_scored ?? 0) + (p._check.auto_scored ?? 0), 0);
console.log(JSON.stringify({
  reports: plan.length, teams: new Set(plan.map((p) => p.team_number)).size, matches: new Set(plan.map((p) => p.match_number)).size,
  shots, scored, oldSiteScored: oldScored, withNotes: plan.filter((p) => p.notes).length, withStart: plan.filter((p) => p.start_square).length,
  problems,
}, null, 1));

if (mode === "--write") {
  let made = 0, already = 0;
  for (const p of plan) {
    const { _check, ...params } = p;
    try { await client(createMatchObservation).applyAction(params); made++; }
    catch (e) { if (e?.errorName === "ObjectAlreadyExists") already++; else throw e; }
  }
  console.log(JSON.stringify({ saved: made, alreadyThere: already }));
}
