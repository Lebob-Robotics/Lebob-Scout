# Handover

Written 25 November 2026, end of day. Updated 26 November. Next event: AUCMP, Saturday 5 and Sunday 6 December 2026.

## Where things stand

The plan is five jobs, in this order. Harry: "I assure you you can finish before the next event. We will do all of it."

| Job | State |
|---|---|
| 1. Match scout page and data backend | Done, deployed |
| Second pass (intake as an area, team's look, start dot, portrait live view) | Done, deployed |
| 3. Teams tab (profiles, map, coverage grid, scout from a gap) | Done, deployed |
| 2. Pit survey and breakage forms, ported as they are | Done, deployed as 0.4.1, signed-in check passed 26 Nov; phone check to do |
| 4. Strategist page | Deployed at `/strategy` (0.5.0, feedback rounds 0.5.1 to 0.5.8, 26 Nov). After-AUCMP heatmap insights to do |
| 5. Retire the old site | Foundry side done 26 Nov (see "Old site retired"). Taking down lebob.com.au/scout and /old-scout is for whoever runs the website |

- **Live version: 0.5.8** (deployed 26 Nov) at https://lebob-scout-bat5hxlyj3x7fsqq.apps.euw-3.palantirfoundry.co.uk (not public, Foundry sign-in). Both apps have light and dark mode and the old site's dropdowns; the strategy app is described under "Job 4".
- **App repo:** public on GitHub at `Lebob-Robotics/Lebob-Scout`, branch `main`, tag `0.5.8`, 217 tests. **History rewritten on 26 Nov (twice):** first the commit address was swapped for Harry's GitHub no-reply address, then (Sean's request) the Claude co-author lines were taken out of Sean's 22 commits and the tags 0.3.3 to 0.5.5 moved onto the rewritten commits. Commit hashes in the ledgers and older notes are the old ones. Commits carry no Claude co-author lines from now on.
- **Functions repo** (`scout-functions/`): pushed, head `786e53a`, published as version 0.12.0 (0.4.0's release failed, see the job 2 spec, R9). Functions: `teamsTab`, `teamProfiles`, `reportSummaries`, `scoutTally`, `fieldMaps`, `matchMaps`, `pointSplits`, `teamCycles`. 103 tests. Its history was not rewritten: release tags point at published versions. Set-up on Windows (no `rune` there) is in `scout-app/README.md`.
- **SDK:** `@lebob-scout/sdk` 0.13.0 (0.13.0: the old site's types removed; 0.12.0: each team's aligned map, functions 0.11.0; 0.11.0: mirrored cycles and half-field heatmaps, functions 0.9.0; 0.10.0: `teamCycles`; 0.9.0: auto shooting squares and scouted points per match; 0.8.0: team scouting detail; 0.7.0: `fieldMaps`, `matchMaps`, `pointSplits`; 0.6.0: the match model objects; 0.5.0: the Teams tab's `timeZone`; 0.4.0: PitSurvey, BreakageReport and their actions). Shape changes are regenerated through the palantir-mcp tools; a new function needs a person to add it to the app in Developer Console first.

## Job 2: where it is

Design: `docs/superpowers/specs/2026-11-26-pit-and-breakage-design.md` (decisions, rulings R1 to R9, option lists).

- **Functions 0.4.1 are live:** each team's profile lists its pit reports and breakages (read by the event's code), the scouts tally counts all three kinds, and the Workshop rows gain counts. The live app (0.3.3) ignores the new fields.
- **App, committed but not deployed:** Pit and Breakage tabs with the old forms and a saved list (tap to change); "Pit report" and "Breakage" buttons on each team; pit and breakage sections and chips on the Teams tab; the phone's queue holds all three kinds (older queued match reports still load). 124 tests. Checked in Chrome at 360 and 375 wide with `?dev=1`, after rebasing onto the restyle commit `f0c7c70` (which added a Settings tab; the tab bar is now Reports, Teams, Pit, Breakage, Settings).
- **Saving checked against Foundry** with the dummy event code `SPIKE`, team 0: one pit survey `spike-pit-check` and one breakage `spike-breakage-check`. Both were created and then changed by a second save, leaving one copy each. They cannot be deleted; they show only under the code `SPIKE`.
- **Signed-in check passed** (26 Nov, by hand in Brave: tabs, both forms, saved lists, Teams tab pit section and buttons, match page). **Still to do:** a phone check, which also covers the restyle (commit f0c7c70, tag 0.4.0) that went live in the same deploy.

## Done on 26 Nov

- **Playoffs all stored as match 1.** When a match type's numbers repeat, its matches are numbered 1 to n by scheduled time (`numbering.ts` in the functions, `numbered` in `scout-app/src/schedule.ts`, same rule). Reports move onto their match by `matchUuid`; a report without one keeps its typed number, which is the number the picker showed. AUPEQ now reads P1 to P6. No result shape changed, so no Developer Console step.
- **When a match counts as played.** Once it has a report, an actual time or a past scheduled time, or once any later match is played. This covers matches with no time, and a scouted match counts before its time (which helps while times are 8 hours out).
- **The token is out of the functions clone.** Clone and push go through a one-off credential helper (see `scout-app/README.md`).
- **Answered:** the first save from a phone went through, the team update message was sent, and sharing the site with the scouts is in hand.
- **Email in the functions history: left as it is.** Release tag 0.1.0 points at `2537292` and 0.2.0 is built on it, so rewriting it would mean moving published release tags. The repo is visible only inside the Lebob Foundry org.

## Job 4: where it is

Design: `docs/superpowers/specs/2026-11-26-strategy-app-design.md`.

- **Live at `/strategy`** on the scout app's site (0.5.6, deployed 26 Nov) (link in the scout app's Settings). Six tabs: Event (status tiles, OPR table), Team (OPR and its chart, scouting, heatmap with a half-field view, auto paths with where they shoot and similar autos averaged, cycles, pit, breakages, matches), Match planner (forecast, robots, alliance heatmaps and where they will meet), Schedule, Alliance (a play-out of the rest of qualifications, predicted selection and playoffs), Settings (event, our team, refresh, display, playoff alliances, theme).
- **Data:** our own scouting and the official scores. Sean's rules (26 Nov): forecasts, expected scores and win chances come from scouted points per match; a robot nobody scouted uses its official share (alliance score less the scouted partner, or half); the OPR is our own, fitted to this event's official scores with no starting estimate; cycles never use OPR (pit claim as the fallback). Still from the old project's model: the current RP, rank and RS (RankProjection, right only during qualifications, since it also counts playoff matches) and tips per match (EventRating's HIVE part). Functions: `fieldMaps`, `matchMaps`, `teamCycles` (functions 0.12.0, SDK 0.13.0).
- **One side for a team's maps (26 Nov):** a team's heatmap, auto paths and cycles show every match turned to the left-hand side, drawn as the yellow alliance against a grey one (`TeamMap.aligned` and `half` in the functions). Cycles are folded onto the upper half so they average into one. The match planner keeps real red and blue, with each robot's map placed on the side it plays in that match.
- **Model checked against official results (26 Nov):** scores match FIRST's in all 8,642 played matches across 398 events. Alliance ratings add up to within about 9 points of the official pre-foul score on average (scores average about 51), on matches the model has seen; true before-match predictions at AUPEQ were out by about 15.6 and picked 15 of 16 decided qualification winners and 6 of 6 playoffs. Win, tie and loss chances add to 1, and rank chances add to 1, 4 and 8. SWARM and POLLINATOR 1 chances are well judged. **POLLINATOR 2 is broken from 15 Nov** (about 81% predicted against 1.8% earned; before 15 Nov it was right). The model lives in the old project, so it is left as it is (Sean, 26 Nov).
- **Cycles** (functions `teamCycles`, rule at the top of `scout-functions/typescript-functions/src/teams/cycles.ts`): a teleop trip from a shot, through collecting, to the next shot, timed shot to shot in three parts (collect, travel, shoot). Red's view, and a cycle shot from the lower half is mirrored onto the upper half so a team's cycles average into one. The Teams tab's cycle count and time use the same rule.
- **#scouting overview** of the strategy app was written 26 Nov for Sean to post (the Discord tool here cannot post to a channel).
- **Still to do:** a signed-in check of `/strategy` (including that sign-in returns to `/strategy`), the strategy team trying it before AUCMP, then after AUCMP: cold spots, free alleys, predicted pathing, automated insights. Match video (ruling S3) is left open on purpose.

## Old site retired (26 Nov)

- **AUPEQ ported.** The old site's 47 qualification reports are Match Observations now (ids `old-<old report id>`, scout names like "SS (old site)", user `old-site`), by `scout-app/scripts/port-aupeq.mjs`. Sean's rulings: practice reports (21) were not ported; nothing at AUPEQ had a location, so taps have no square (points, cycle counts and cycle times work; maps stay empty); a miss is a shot that scored 0; garden placements left out; defence, nectar and flower or garden intakes went into a note line. Totals match the old site (231 pieces scored). A test report Harry saved to AUPEQ Q3 the same day was deleted.
- **A delete action now exists:** "Delete Match Observation" (Sean asked, Harry approved 26 Nov). The scout app has no button for it. Harry may want it removed again.
- **Removed from the old project** (Harry merged the proposal): the MatchReport, Scout Summary, Robot, Pit, SpareStock, Math Map, Match Action Per Robot, MatchForecast, RatingHistory and AlliancePick object types with their 17 links and 13 actions; the matchreport, scout_summary, sparestock, scout_upload_log, robot and pit datasets (in Foundry's trash); the "Scout uploads -> scout reports" schedule (deleted); the old Workshop modules (Lebob Scout, teamViewer, Scouting Form Submission, the 26 Nov module) and the Lebob Field Maps widget and repository (in the trash). Sean removed the Lebob Scout Upload app.
- **Kept in the old project, because the apps need it:** the FIRST API source, the IngestFTCData repository, its datasets and sync schedules (they bring in AUCMP's schedule and scores); the Event, Team, Match, Presence and Participation types; PitSurvey and BreakageReport with the pitsurvey and breakagereport datasets and the Scout uploads dataset they were built from (now frozen: nothing rebuilds them, and new reports are edits on top); the match model and its EventRating and RankProjection (current RP and rank for the Alliance play-out, tips per match); and the new app's Developer Console entry, "Lebob Scout (1)". The model still builds its unused match_prediction, rating_history and alliance_picks datasets; harmless.
- **The new scout app records less than the old site did:** no misses, defence, piece type, garden placements, flower or ground intakes, or practice matches. Add any that matter before AUCMP.

## What comes next

Finish job 2 (see "Job 2: where it is"). Then job 4.

Job 4 (strategist page) can call `teamProfiles` and `reportSummaries` from Workshop. They return flat rows for that purpose. Harry's earlier notes mention heatmaps and "pathways".

The way each job has been run: brainstorm, design doc in `docs/superpowers/specs/`, plan in `docs/superpowers/plans/`, then subagent-driven development with a ledger in `.superpowers/sdd/<plan>/progress.md`, a final whole-branch review, one fix wave, deploy, Brave check, Harry's phone check.

## What went wrong today, so it does not happen again

- **Saving had never worked on the hosted site.** The app's "who am I" call (`GET /api/v2/admin/users/getCurrent`) returned 403. Developer Console apps are restricted: an endpoint works only if its API group is switched on in the app's **Platform SDK** tab, and the scope the app asks for needs the `use-` prefix (`api:use-admin-read`, not `api:admin-read`). Harry switched on "Admin read permission" and `scout-app/src/client.ts` now asks for the right scope.
- **Nobody noticed because no check ever pressed Save** on the hosted site (a saved report cannot be deleted). The first real save, from Harry's phone on 0.3.1, went through. Worth raising with Harry: a practice event in Foundry would let us test saving for real.
- **Changing the scope list signs every phone out once.** The sign-in library ignores a stored sign-in whose scopes differ. A match in progress survives it (the draft is in localStorage).
- **`instanceof PalantirApiError` is false for errors from `@osdk/foundry.admin`**, which bundles its own copy of the class. `isRefused` in `api.ts` checks `statusCode` instead.
- **Adding a function to the app, or changing a function's parameters or result shape, needs Harry**: add it to the app in Developer Console and generate a new SDK version. No tool can do that step. Plan releases so he does it once.

## Open technical notes

- **Speed.** In Brave the Teams tab opened in 1.4 s on a fresh load and 0.7 s after; Refresh took 0.5 to 0.9 s. From Node on this laptop, three calls in a row took about 8 s, 4 s and 1 to 4 s. The app warms the function when it opens. If phones at a venue are slow, the fallback is running the functions always-on in Foundry, which costs compute: ask Harry first.
- **An 8 second blank page** was seen once, on the first load of 0.3.1 just before the consent screen. It did not happen again. Unexplained.
- **A newly published function version reaches the app without a new SDK** (confirmed with 0.3.0 on 26 Nov: the live `teamsTab` answered with the new numbers about two minutes after the tag was pushed).
- **The sums are verified on live data.** `teamsTab` for the event `spike` matched a hand calculation exactly. Run `node scripts/teams-tab-check.mjs spike` in `scout-app/` with the token loaded to repeat it. With no argument it checks AUPEQ.
- **Parked small items** (in the teams-tab ledger): an empty time prints "undefined NaN:NaN pm" (the app always writes the time, so it needs a row written outside the app); the map's Scored / Picked up switch resets after returning from set-up; the hand-typed path in set-up can drag the start pad during the scroll; a mistyped match number inside the schedule still marks earlier matches played when no match has a time.
- **Rulings.** Every decision made on Harry's behalf is a `Ruling` line in the ledgers: match-scout-page, scout-polish (R1 to R16) and teams-tab (P1 to P3, T1 to T11). The teams-tab ones were listed to him on 25 Nov.

## Identifiers

| Thing | Value |
|---|---|
| Foundry host | `https://lebob.euw-3.palantirfoundry.co.uk` |
| Ontology | `ri.ontology.main.ontology.337241ba-4314-4c10-a9e2-6160a76db115` |
| Project "Lebob Scout App" | `ri.compass.main.folder.793aa7b2-db45-4868-b0c6-1b3a2570a727` |
| Developer Console app | `ri.third-party-applications.main.application.ebbc1c91-5941-420b-bc39-d4dcdd81df44` |
| Functions repository | `ri.stemma.main.repository.8254d75d-4849-4e74-ae91-650908735cd8` |
| Match Observation object type | `ri.ontology.main.object-type.acb6d7a1-0316-4177-89be-503389ba675e` |
| Match object type | `ri.ontology.main.object-type.9b32ad06-b029-44c9-8d25-c7a6439f2321` |
| Event object type | `ri.ontology.main.object-type.8cd10665-bfa4-4e27-9b2e-f786fa46d94b` |
| Create action | `ri.actions.main.action-type.d6a9158a-7ef3-47e8-a9f2-017da1c514ee` |
| `teamsTab` function | `ri.function-registry.main.function.0b012167-969e-4949-acbb-5d8a04b94fa3` |
| AUPEQ (WA Qualifier, 15 Nov) | `a115f534-756c-5359-84d0-f2e15a2f1fd9`: 19 qualification and 6 playoff matches, 15 teams, no reports |
| AUCMP (Australia Championship, 5 to 6 Dec) | `456659f8-7eb2-55e5-a875-4ccae28a3e32` |
| LBTOP (top alliances, not a real event) | `082fa55c-f932-5a4f-bdb8-b8284adc73ec`: Harry said "just leave the LBTOP for now" |
| Dummy event with two test reports | event uuid `spike`, team 0, qualification match 0 |

The palantir-mcp tools read the ontology (`query_ontology_using_sql` with the object type RIDs above) and the SDK definition (`view_osdk_definition` with the app RID).
