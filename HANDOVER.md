# Handover

Written 25 November 2026, end of day. Updated 26 November. Next event: AUCMP, Saturday 5 and Sunday 6 December 2026.

## Where things stand

The plan is five jobs, in this order. Harry: "I assure you you can finish before the next event. We will do all of it."

| Job | State |
|---|---|
| 1. Match scout page and data backend | Done, deployed |
| Second pass (intake as an area, team's look, start dot, portrait live view) | Done, deployed |
| 3. Teams tab (profiles, map, coverage grid, scout from a gap) | Done, deployed |
| 2. Pit survey and breakage forms, ported as they are | Built and tested, functions live, app not yet deployed |
| 4. Strategist page | Not started |
| 5. Retire the old site | Not started |

- **Live version: 0.3.3** at https://lebob-scout-bat5hxlyj3x7fsqq.apps.euw-3.palantirfoundry.co.uk (not public, Foundry sign-in).
- **App repo:** public on GitHub at `Lebob-Robotics/Lebob-Scout`, branch `main`, tag `0.3.3`, 99 tests. Every commit hash changed on 26 Nov: before the first push the commit address was swapped for Harry's GitHub no-reply address, so the hashes in the ledgers are the old ones. New commits use the committer's own GitHub no-reply address.
- **Functions repo** (`scout-functions/`): pushed, head `9d82343`, published as version 0.4.1 (0.4.0's release failed, see the job 2 spec, R9). Functions: `teamsTab`, `teamProfiles`, `reportSummaries`, `scoutTally`. 65 tests. Set-up on Windows (no `rune` there) is in `scout-app/README.md`.
- **SDK:** `@lebob-scout/sdk` 0.4.0, which adds PitSurvey, BreakageReport and their create and modify actions (generated 26 Nov through the palantir-mcp tools, no sign-in scope change).

## Job 2: where it is

Design: `docs/superpowers/specs/2026-11-26-pit-and-breakage-design.md` (decisions, rulings R1 to R9, option lists).

- **Functions 0.4.1 are live:** each team's profile lists its pit reports and breakages (read by the event's code), the scouts tally counts all three kinds, and the Workshop rows gain counts. The live app (0.3.3) ignores the new fields.
- **App, committed but not deployed:** Pit and Breakage tabs with the old forms and a saved list (tap to change); "Pit report" and "Breakage" buttons on each team; pit and breakage sections and chips on the Teams tab; the phone's queue holds all three kinds (older queued match reports still load). 124 tests. Checked in Chrome at 360 and 375 wide with `?dev=1`, after rebasing onto the restyle commit `f0c7c70` (which added a Settings tab; the tab bar is now Reports, Teams, Pit, Breakage, Settings).
- **Saving checked against Foundry** with the dummy event code `SPIKE`, team 0: one pit survey `spike-pit-check` and one breakage `spike-breakage-check`. Both were created and then changed by a second save, leaving one copy each. They cannot be deleted; they show only under the code `SPIKE`.
- **Still to do:** deploy 0.4.0, Brave check signed in, then a phone check.

## Done on 26 Nov

- **Playoffs all stored as match 1.** When a match type's numbers repeat, its matches are numbered 1 to n by scheduled time (`numbering.ts` in the functions, `numbered` in `scout-app/src/schedule.ts`, same rule). Reports move onto their match by `matchUuid`; a report without one keeps its typed number, which is the number the picker showed. AUPEQ now reads P1 to P6. No result shape changed, so no Developer Console step.
- **When a match counts as played.** Once it has a report, an actual time or a past scheduled time, or once any later match is played. This covers matches with no time, and a scouted match counts before its time (which helps while times are 8 hours out).
- **The token is out of the functions clone.** Clone and push go through a one-off credential helper (see `scout-app/README.md`).
- **Answered:** the first save from a phone went through, the team update message was sent, and sharing the site with the scouts is in hand.
- **Email in the functions history: left as it is.** Release tag 0.1.0 points at `2537292` and 0.2.0 is built on it, so rewriting it would mean moving published release tags. The repo is visible only inside the Lebob Foundry org.

## Still open

- **Schedule times 8 hours out: left open on purpose, do nothing yet.** Foundry has AUPEQ's Q1 at 10:30 UTC (6:30 pm Perth) and playoffs past midnight. The import probably stores Perth local time as UTC, so "Next scheduled" shows late and an unscouted match only counts as played 8 hours after its time. The import lives in the off-limits old project. If a workaround is wanted later: AUCMP is in Sydney, Melbourne or Canberra (UTC+11 in December), AUPEQ is Perth (UTC+8).
- **AUCMP has no schedule in Foundry yet** (no matches on 26 Nov). Check it lands before 5 Dec.
- **`tap_counts` description** still says "1 to 4 per tap" (new reports store 0). Agreed to fix: an ontology change, so it goes on a branch as a proposal to approve.
- **"Media sets" read and write** are still on for the app in Developer Console and the app does not use them. Agreed to switch off: a click for a person in Developer Console.

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
