// Live check of the pit and breakage forms' Foundry side, on the dummy event code SPIKE (never shown for a real event).
// Run from scout-app/ with FOUNDRY_TOKEN in the environment:
//   set -a; . ~/.config/lebob-foundry.env; set +a; node scripts/forms-check.mjs
// Saves (creates, or on a second run replaces) pit report "spike-pit" with two photos and breakage "spike-breakage"
// with notes, reads them back, and lists one event's teams the way the forms' dropdown does. Same parameters as
// pitParams and breakageParams in src/api.ts.
import { createAttachmentUpload, createClient } from "@osdk/client";
import {
  $ontologyRid, BreakageReport, Participation, PitSurvey, createBreakageReport, createPitSurvey, modifyBreakageReport, modifyPitSurvey,
} from "@lebob-scout/sdk";

const url = "https://lebob.euw-3.palantirfoundry.co.uk";
const token = process.env.FOUNDRY_TOKEN;
if (!token) throw new Error("FOUNDRY_TOKEN is not set");
const client = createClient(url, $ontologyRid, async () => token);
const AUPEQ = "a115f534-756c-5359-84d0-f2e15a2f1fd9";

// A 1x1 JPEG: enough to upload and read back.
const JPEG = Buffer.from("/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=", "base64");
const photo = (name) => createAttachmentUpload(new Blob([JPEG], { type: "image/jpeg" }), name);
const one = async (type, where) => (await client(type).where(where).fetchPage({ $pageSize: 1 })).data[0];
const check = (label, ok, detail = "") => console.log(`${ok ? "PASS" : "FAIL"} ${label}${detail ? `: ${detail}` : ""}`);

// Pit: save with one photo, then add a second keeping the first (as an edit in the form does).
const pit = {
  event_code: "SPIKE", team_number: 0, scout: "forms-check", created_at: new Date().toISOString(),
  drivetrain: "mecanum", archetype: "fixed-shooter", can_hive: true, can_flower: false, can_nectar: null,
  can_floor_intake: true, can_flower_intake: null, notes: "Live check of the pit form",
};
const before = await one(PitSurvey, { pitReportId: { $eq: "spike-pit" } });
if (before) await client(modifyPitSurvey).applyAction({ "j87bj1om.pit-survey": "spike-pit", ...pit, images: [photo("spike-1.jpg")] });
else await client(createPitSurvey).applyAction({ pit_report_id: "spike-pit", ...pit, images: [photo("spike-1.jpg")] });
let saved = await one(PitSurvey, { pitReportId: { $eq: "spike-pit" } });
check("pit saved with 1 photo", saved?.images?.length === 1, `${saved?.images?.length} photo(s)`);
const firstRid = saved.images[0].rid;
await client(modifyPitSurvey).applyAction({ "j87bj1om.pit-survey": "spike-pit", ...pit, images: [firstRid, photo("spike-2.jpg")] });
saved = await one(PitSurvey, { pitReportId: { $eq: "spike-pit" } });
check("pit kept its photo and took a second", saved?.images?.length === 2 && saved.images[0].rid === firstRid, `${saved?.images?.length} photo(s)`);
const res = await saved.images[1].fetchContents();
const bytes = (await res.arrayBuffer()).byteLength;
check("a saved photo reads back", res.ok && bytes === JPEG.length, `${bytes} bytes`);
check("pit fields read back", saved.drivetrain === "mecanum" && saved.canHive === true && saved.notes === pit.notes);

// Breakage with notes.
const breakage = {
  event_code: "SPIKE", team_number: 0, team_uuid: null, reporter: "forms-check", created_at: new Date().toISOString(),
  match_key: "SPIKE-q1", mechanism: "intake", component: "belt", failure_type: "slipped", severity: 2,
  notes: "Sev 2: belt slipped while intaking; came back after a minute",
};
if (await one(BreakageReport, { breakageId: { $eq: "spike-breakage" } })) await client(modifyBreakageReport).applyAction({ "j87bj1om.breakage-report": "spike-breakage", ...breakage });
else await client(createBreakageReport).applyAction({ breakage_id: "spike-breakage", ...breakage });
const b = await one(BreakageReport, { breakageId: { $eq: "spike-breakage" } });
check("breakage notes read back", b?.notes === breakage.notes && b?.severity === 2);

// The team dropdown's list for one event.
const parts = [];
for await (const p of client(Participation).where({ eventUuid: { $eq: AUPEQ } }).asyncIter()) parts.push(p);
check("AUPEQ's teams for the dropdown", parts.length > 0, `${new Set(parts.map((p) => p.teamNumber)).size} teams`);
