// One-off, read-only check that the teamsTab function answers through the SDK.
// Run from scout-app/ with FOUNDRY_TOKEN in the environment:
//   set -a; . ~/.config/lebob-foundry.env; set +a; node scripts/teams-tab-check.mjs
import { createClient } from "@osdk/client";
import { $ontologyRid, teamsTab } from "@lebob-scout/sdk";

const url = "https://lebob.euw-3.palantirfoundry.co.uk";
const token = process.env.FOUNDRY_TOKEN;
if (!token) throw new Error("FOUNDRY_TOKEN is not set");
const client = createClient(url, $ontologyRid, async () => token);

const eventUuid = "a115f534-756c-5359-84d0-f2e15a2f1fd9"; // AUPEQ
for (let i = 1; i <= 3; i++) {
  const t0 = performance.now();
  const r = await client(teamsTab).executeFunction({ eventUuid });
  const ms = Math.round(performance.now() - t0);
  const t = r.teams[0];
  console.log(JSON.stringify({
    call: i, ms, teams: r.teams.length, rows: r.coverage.rows.length, slots: r.coverage.slots,
    have: r.coverage.have, needScouting: r.needScouting, scouts: r.scouts.length,
    firstTeam: t && { teamNumber: t.teamNumber, scheduled: t.scheduled, played: t.played, toCome: t.toCome, matches: t.matches },
  }));
}
