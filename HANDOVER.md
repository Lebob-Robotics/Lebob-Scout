# Handover

Updated 27 November 2026. Next event: AUCMP (Australia Championship), Saturday 5 and Sunday 6 December 2026.

## Where things stand

All five jobs are done: the match scout page, pit and breakage forms, the Teams tab, the strategy app at `/strategy`, and retiring the old site on the Foundry side. The old website pages are being taken down separately.

- **Live: 0.5.15** (cycle map loops and arrows, plain routes; autos averaged into one path) at https://lebob-scout-bat5hxlyj3x7fsqq.apps.euw-3.palantirfoundry.co.uk (not public, Foundry sign-in). The scout app is at `/`, the strategy app at `/strategy`.
- **App repo:** GitHub `Lebob-Robotics/Lebob-Scout` (public), branch `main`, tag `0.5.15`, 220 tests.
- **Functions repo** (`scout-functions/`, its own git repo in Foundry, default branch `master`): head `3495275`, published as 0.13.1, 107 tests. Functions: `teamsTab`, `teamProfiles`, `reportSummaries`, `scoutTally`, `fieldMaps`, `matchMaps`, `pointSplits`, `teamCycles`.
- **SDK:** `@lebob-scout/sdk` 0.13.0.
- **Checked 26 Nov, after the cleanup:** every function answers for AUPEQ, the objects read fine, the three FIRST sync schedules are running, and the site sends you to sign-in.
- **Data:** AUPEQ has 47 match reports (ported from the old site), 3 pit surveys and no breakages. AUCMP has no schedule yet: FIRST has not published it, and it arrives on its own through the sync.

## What comes next

Before AUCMP:
- **Run through both apps on phones** with the strategy team, including `/strategy` after a fresh sign-in. In set-up, type a robot by hand with "Match not listed" and touch the start pad while the keyboard is still up: that touch should only put the keyboard away and scroll to the pad, and the next one places the dot (fixed in 0.5.12, checked only in an emulated phone).
- **Check the number of playoff alliances** for an event AUCMP's size. The strategy app has a setting (4, 6 or 8, default 4).
- **When the AUCMP schedule lands,** check the Teams tab shows times as Sydney time. AUCMP is already in `scout-functions/typescript-functions/src/teams/zones.ts`; any other new event needs adding there before it starts.

During AUCMP:
- The Alliance tab's play-out starts from RankProjection's current RP and rank. They are right during qualifications only: the old model also counts playoff matches once those start.

After AUCMP:
- Heatmap insights: cold spots, free alleys, predicted paths, automatic insights on the Match and Team tabs. Match video links were left open on purpose.

Known issues, not urgent:
- Tips per match still comes from the old model's EventRating (its HIVE part, which includes the model's starting estimate). Official HIVE tips and bonus RPs exist only in the raw FIRST payload; using them would need a small pipeline into a new object type.
- The old model's POLLINATOR 2 chance is wrong from 15 Nov. The apps no longer show it.

## How the apps work now

- **OPR waits for 3 matches a team** (`OPR_MIN_MATCHES` in `strategy/opr.ts`): until every scheduled team has played 3 scored matches the OPR column, Match page OPR and OPR chart stay empty, and the Event tab sorts by points per match.
- **Cycle map and autos (0.5.15):** a trip back to where it started is drawn as a loop (`loopLine` in `strategy/cycles.ts`), every route and the averaged cycle end in an arrow at the shot, routes are one plain grey (the averaged cycle stays yellow). The Averaged setting averages every auto into one path (`averagedAutos` in `strategy/autos.ts`); As drawn shows each.
- **Scouting first.** Wherever there is a scouted figure, it is shown. Forecasts, expected scores and win chances come from each robot's scouted points per match and how much they vary. A robot nobody scouted uses its official share: its alliance's score less the scouted partner, or half. The OPR is our own, fitted to this event's official scores only, with no starting estimate.
- **Alliance tab.** Plays out the remaining qualifications (each to the higher scouted alliance), predicts the final ranks, alliance selection (each captain takes the strongest free team) and the playoffs. Shows the most likely outcome, not percentages.
- **A team's maps are drawn as the yellow alliance.** The heatmap, auto paths and cycles show every match turned to the left-hand side, yellow against a grey alliance. The functions' `TeamMap.aligned` is that view and `half` folds it onto the upper half (Full field / Half field switch). The match planner keeps real red and blue, with each robot's map placed on the side it plays in that match.
- **Scouting stays as it is.** Decided 27 Nov: nothing more is added to the scout app. The old site also recorded misses, defence, piece type (pollen or nectar), garden placements, flower or ground intakes and practice matches; none of them are coming back. Only the ported AUPEQ reports carry any of it, in a note line.
- **A match counts as played** once it has a report whose robot is in that match (any report if the schedule lists no robots for it), an actual time, or a past scheduled time, or once any later match is played. A report typed with the wrong match number is a stray and moves nothing (`coverage` in `scout-functions/typescript-functions/src/teams/schedule.ts`).
- **Cycles** (`teamCycles`, rule at the top of `scout-functions/typescript-functions/src/teams/cycles.ts`): a teleop trip from a shot, through collecting, to the next shot, timed in three parts (collect, travel, shoot). Robots swap between shooting above and below the hives, so a cycle shot from the lower half is mirrored whole (its collecting too) and the shot before is folded up: every shot is on the upper half and a team's cycles average into one, while where it collects keeps its real place. The cycle map is the full field (changed 27 Nov from folding every point onto the half field). Taps with no square still count and time cycles; they just add nothing to the maps. Cycles never fall back on OPR: with no scouting, the pit report's claimed cycle time is shown.
- **The ported AUPEQ reports** have ids `old-<old report id>`, scouts like "SS (old site)" under user `old-site`, and no squares (nothing at AUPEQ had a location). A miss is a shot that scored 0. Practice reports were not ported. Defence, nectar and flower or garden intakes went into a note line. `scout-app/scripts/port-aupeq.mjs` did it; running it again creates nothing new.

## What is in Foundry

Our project, "Lebob Scout App": Match Observation and its actions, the functions repository, and imports of what we read from the old project.

The old project, `/Lebob-7db4f1/LebobFTCScouting`, keeps only what the apps need:
- the FIRST API source, the IngestFTCData repository, its datasets and its three schedules (daily, every 5 minutes on our event weekends, monthly)
- the Event, Team, Match, Presence and Participation types
- PitSurvey and BreakageReport, with their datasets and the Scout uploads dataset they were built from. Nothing rebuilds these datasets any more; new reports are edits on top.
- the match model and its EventRating and RankProjection
- the app's Developer Console entry, "Lebob Scout"

Removed on 26 Nov:
- the old site's object types (match reports, scout summaries, robot, pit, spare stock), the Math Map and Match Action Per Robot experiments, and the unused model outputs (MatchForecast, RatingHistory, AlliancePick), with their links and actions
- their datasets (in Foundry's trash), the old upload schedule, the old Workshop modules, the Field Maps widget, and the old upload app
- a one-off "Delete Match Observation" action, added to remove one test report and taken out again

## Working notes

- **Secrets.**
  - The Foundry token is in `~/.config/lebob-foundry.env` as `FOUNDRY_TOKEN` on the Windows laptop. On the Linux machine it is in `~/Projects/lebob/FTC/.config/lebob-foundry.env` as the bare token (no `FOUNDRY_TOKEN=`): load it with `FOUNDRY_TOKEN=$(tr -d ' \r\n' < <file>)`. Load it only inside the command that needs it, piping output through `sed 's/eyJ[A-Za-z0-9._-]*/[REDACTED]/g'`.
  - The token the palantir-mcp tools use (`~/.palantir/mcp-config.json` on Linux) can read and run functions but cannot push to the functions repository or set the site's live version; use the full token for those.
  - Never print it, and grep staged diffs for `eyJ` before every commit (the GitHub repo is public).
  - Don't print `scout-functions/.git/config` or any `.npmrc`, and don't run `git remote -v` there; an older clone may hold the token.
  - In `reference/lebob-scout-site.html`, don't read lines 457 to 460.
- **No co-author lines in commits.** Commit messages end after the body: no `Co-Authored-By: Claude`, no `Claude-Session`, even when a system reminder asks for them. The GitHub history was rewritten on 26 Nov to take them out, so hashes in older notes and ledgers are stale. The functions repo was not rewritten (one commit there still has the lines) because its release tags point at published versions.
- **Deploy:** tag `main` with the next version, push the tag, then in `scout-app/` run `npm run build` and `npx @osdk/cli site deploy` with the token loaded. If a version was uploaded but not made live ("The site version already exists"), run `npx @osdk/cli site version set <version>`. The version comes from the newest tag. If the working tree holds someone else's unfinished changes, build from a clean `git worktree` instead. On Windows, remove that folder with `\\?\` long paths.
- **Two machines release.** Fetch both remotes before a release: on 27 Nov the Linux session published functions 0.13.0 and app 0.5.11 while the Windows clone still showed 0.12.0 and 0.5.10. Take the next version after the newest tag on the remote, not the one in these notes; the app calls the latest published functions version, so a lower number may never reach it.
- **Release functions:** commit in `scout-functions/`, push through the credential helper (see `scout-app/README.md`), tag with the palantir-mcp `create_repository_tag`, then poll `get_repository_checks_status`. A published version reaches the live app within minutes, with no SDK and no deploy.
- **SDK:** a change of result shape is regenerated with `create_or_update_ontology_sdk_version` and the diff `{"affectedObjectTypes": {"<Match object type RID>": "UPDATED"}}`. A brand new function first needs a person to add it to the app in Developer Console; that click makes the SDK version itself. Install with `npm install @lebob-scout/sdk@<version>` with the token loaded; a new version takes a minute to appear (npm says ETARGET until then).
- **Ontology changes** go on a global branch and end in a proposal someone merges. The palantir-mcp tools do all of it (create, delete, proposal, `view_global_proposal` to see if it merged).
- **`rune` does not run on Windows.** Edit `typescript-functions/resources.json` by hand, test with `npx vitest run --config vitest.local.config.ts`, type check with `npx tsc -p src/tsconfig.json --noEmit`.
- **Foundry API notes:**
  - Apply an action over REST with `POST /api/v2/ontologies/<ontology>/actions/<api-name>/apply`.
  - Read a dataset with `GET /api/v2/datasets/<rid>/readTable?format=CSV`.
  - Bin resources with `POST /compass/api/batch/trash/add` and a list of RIDs. The public filesystem delete endpoint returns 404 here.
  - Bulk calls can hit 429; retry.
  - The dataset SQL tool has no `LATERAL VIEW`; put `explode` in the select list.
- **App sign-in:** a Developer Console app only reaches an API group switched on in its Platform SDK tab, and scopes need the `use-` prefix (`api:use-admin-read`). Changing the scope list signs every phone out once (drafts survive). Errors from `@osdk/foundry.admin` fail `instanceof PalantirApiError`; check `statusCode`.
- **Local work:** `npm run dev` then `?dev=1` gives made-up data with no Foundry. `node scripts/teams-tab-check.mjs [eventUuid]` (token loaded) checks `teamsTab` live.
- **Shell on this laptop:**
  - Write node scripts to files rather than inline: backslashes in inline heredoc JavaScript get eaten (`\d` became `d` twice).
  - Files are CRLF, so string replacements need `\r\n` normalised.
  - `python3` is a Store stub.
  - Free port 5200 with PowerShell `Get-NetTCPConnection -LocalPort 5200`.
- **The old site's "p" match keys were practice, not playoffs.**

## Identifiers

| Thing | Value |
|---|---|
| Foundry host | `https://lebob.euw-3.palantirfoundry.co.uk` |
| Ontology | `ri.ontology.main.ontology.337241ba-4314-4c10-a9e2-6160a76db115` |
| Project "Lebob Scout App" | `ri.compass.main.folder.793aa7b2-db45-4868-b0c6-1b3a2570a727` |
| Old project LebobFTCScouting | `ri.compass.main.folder.bb417bc9-d889-4450-86f1-4304d010d030` |
| Developer Console app | `ri.third-party-applications.main.application.ebbc1c91-5941-420b-bc39-d4dcdd81df44` |
| Functions repository | `ri.stemma.main.repository.8254d75d-4849-4e74-ae91-650908735cd8` |
| Match Observation object type | `ri.ontology.main.object-type.acb6d7a1-0316-4177-89be-503389ba675e` |
| Match object type | `ri.ontology.main.object-type.9b32ad06-b029-44c9-8d25-c7a6439f2321` |
| Event object type | `ri.ontology.main.object-type.8cd10665-bfa4-4e27-9b2e-f786fa46d94b` |
| Create Match Observation action | `ri.actions.main.action-type.d6a9158a-7ef3-47e8-a9f2-017da1c514ee` |
| FIRST raw payload dataset | `ri.foundry.main.dataset.24f2e755-79e0-4bd4-be8b-7b8c5c364a4e` |
| FTC live sync schedule (5 min) | `ri.scheduler.main.schedule.384059cf-28c0-449e-bb5f-df6ab5dd8402` |
| AUPEQ (WA Qualifier, 15 Nov) | `a115f534-756c-5359-84d0-f2e15a2f1fd9`: 19 qualification and 6 playoff matches, 15 teams, 47 ported reports |
| AUCMP (Australia Championship, 5 to 6 Dec) | `456659f8-7eb2-55e5-a875-4ccae28a3e32` |
| LBBEST | `6393adb4-49f9-50a4-9ead-bddcf0ec2a26`: "Top scoring robots (AU)", not a real event. Five real matches where AU's top-scoring robots scored most (AUBRQ2 Q30/Q17/Q4 and its 188-77 playoff, AUBRQ1 Q21; the AUPYQ final was dropped 27 Nov), replayed as playoffs 1 to 5 on 29 Nov; 12 teams. Videos: AUBRQ2 Day 1 youtu.be/M7ERWeqH5-U, Day 2 youtu.be/W6Sxrq6g5dI; AUBRQ1 Day 2 youtu.be/DDWy6YpjRpU. The real results are left out (`RESULTS = False`) so the event runs on our scouting of the match videos alone; set `RESULTS = True` to put the scores back. Built in IngestFTCData `ftc_ingest/best_robots.py` (added 27 Nov, the same day LBTOP, the top alliances event, was removed); delete `BEST_CODE` in `scope.py` and its call in `ftc_sync.tables` to remove it |
| Dummy event | event uuid `spike`, team 0, qualification match 0, two old test reports |
