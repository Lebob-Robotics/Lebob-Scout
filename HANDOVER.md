# Handover

Written 25 November 2026, end of day. Next event: AUCMP, Saturday 5 and Sunday 6 December 2026.

## Where things stand

The plan is five jobs, in this order. Harry: "I assure you you can finish before the next event. We will do all of it."

| Job | State |
|---|---|
| 1. Match scout page and data backend | Done, deployed |
| Second pass (intake as an area, team's look, start dot, portrait live view) | Done, deployed |
| 3. Teams tab (profiles, map, coverage grid, scout from a gap) | Done, deployed |
| 2. Pit survey and breakage forms, ported as they are | Not started |
| 4. Strategist page | Not started |
| 5. Retire the old site | Not started |

- **Live version: 0.3.2** at https://lebob-scout-bat5hxlyj3x7fsqq.apps.euw-3.palantirfoundry.co.uk (not public, Foundry sign-in). Checked in Brave on 25 Nov.
- **App repo:** private on GitHub at `Lebob-Robotics/Lebob-Scout` (pushed 26 Nov), branch `main`, tag `0.3.2` at `4e443fe`, 97 tests. All work branches are merged and deleted. Every commit hash changed on 26 Nov: before the first push the commit address was swapped for Harry's GitHub no-reply address, so the hashes in the ledgers are the old ones. The old commits are still in this laptop's copy under `refs/original`.
- **Functions repo** (`scout-functions/`): pushed, head `c4a853a`, published as version 0.2.0. Functions: `teamsTab`, `teamProfiles`, `reportSummaries`, `scoutTally`. 43 tests.
- **SDK:** `@lebob-scout/sdk` 0.3.0.

## Waiting on Harry

Ask about these first. None has been answered.

1. **Did the save on his phone go through?** He hit "Couldn't confirm who you are" on 0.3.0. The cause is fixed in 0.3.1 (see "What went wrong today"). His steps: reload, tap Sign in, tap Allow, tap Save report. The path "signed-out banner appears on reload with a match open" was not tested on a phone. If the banner does not show, tapping Save once should bring it up.
2. **Schedule times look 8 hours out.** Foundry has AUPEQ's Q1 at 10:30 UTC (6:30 pm Perth) and playoffs past midnight. The import probably stores Perth local time as UTC. Effect on the Teams tab: "Next scheduled" times show late, and a match only counts as played 8 hours after its scheduled time unless its actual time has synced. Question for Harry: was Q1 at about 10:30 am, and does he fix the import or do we work around it? A workaround needs each event's time zone, and AUCMP may not be in Perth.
3. **Every AUPEQ playoff match is stored as match number 1** (six of them). The grid shows six "P1" rows, chips read "missing P1, P1, P1", a playoff report would count in every P1 row its team is in, and a team's playoff matches would merge into one in its profile. The set-up picker has the same six "P1" entries. Recommended: fix it on our side in the functions (match playoff reports by match id when the report has one, label playoffs P1 to P6 by scheduled time). That needs a new published functions version and no Developer Console step, as long as the result shape does not change. Waiting for his yes.
4. **Matches with no time at a timed event** never count as played, even when scouted (`schedule.ts` `isPlayed`). A per-match fallback is a small functions change. His call.
5. **Scouts' access.** About eight scouts, each with their own Foundry account. Sharing the hosted site with them and checking their permissions is still on his list. Every scout taps Allow once on first opening 0.3.1 or later.
6. **Team update message.** Drafted in his voice ("we" voice, with a backend paragraph). He has the text. Not known whether he sent it.
7. **Smaller, older items:** his real email is on pushed commit `2537292` in the functions repo (removing it rewrites history); the Foundry token sits in the clone's `.git/config` and `.npmrc` (offered to strip it between pushes); "Media sets" read and write permissions are on for the app in Developer Console and the app does not use them; the `tap_counts` description in Foundry still says "1 to 4 per tap" (new reports store 0).

## What comes next

When Harry answers 2, 3 and 4, do those first: they change what the Teams tab shows at AUCMP.

Then job 2 (pit survey and breakage forms). Start with the brainstorming skill and read the old forms in `reference/lebob-scout-site.html`. The Teams tab counts match reports only until job 2 lands.

Job 4 (strategist page) can call `teamProfiles` and `reportSummaries` from Workshop. They return flat rows for that purpose. Harry's earlier notes mention heatmaps and "pathways".

The way each job has been run: brainstorm, design doc in `docs/superpowers/specs/`, plan in `docs/superpowers/plans/`, then subagent-driven development with a ledger in `.superpowers/sdd/<plan>/progress.md`, a final whole-branch review, one fix wave, deploy, Brave check, Harry's phone check.

## What went wrong today, so it does not happen again

- **Saving had never worked on the hosted site.** The app's "who am I" call (`GET /api/v2/admin/users/getCurrent`) returned 403. Developer Console apps are restricted: an endpoint works only if its API group is switched on in the app's **Platform SDK** tab, and the scope the app asks for needs the `use-` prefix (`api:use-admin-read`, not `api:admin-read`). Harry switched on "Admin read permission" and `scout-app/src/client.ts` now asks for the right scope.
- **Nobody noticed because no check ever pressed Save** on the hosted site (a saved report cannot be deleted). The whole save path to Foundry is still unproven end to end from a browser. The first real save is Harry's phone (item 1). Worth raising with Harry: a practice event in Foundry would let us test saving for real.
- **Changing the scope list signs every phone out once.** The sign-in library ignores a stored sign-in whose scopes differ. A match in progress survives it (the draft is in localStorage).
- **`instanceof PalantirApiError` is false for errors from `@osdk/foundry.admin`**, which bundles its own copy of the class. `isRefused` in `api.ts` checks `statusCode` instead.
- **Adding a function to the app, or changing a function's parameters or result shape, needs Harry**: add it to the app in Developer Console and generate a new SDK version. No tool can do that step. Plan releases so he does it once.

## Open technical notes

- **Speed.** In Brave the Teams tab opened in 1.4 s on a fresh load and 0.7 s after; Refresh took 0.5 to 0.9 s. From Node on this laptop, three calls in a row took about 8 s, 4 s and 1 to 4 s. The app warms the function when it opens. If phones at a venue are slow, the fallback is running the functions always-on in Foundry, which costs compute: ask Harry first.
- **An 8 second blank page** was seen once, on the first load of 0.3.1 just before the consent screen. It did not happen again. Unexplained.
- **Whether a newly published function version reaches the app without a new SDK** is unconfirmed. The SDK marks the functions `isFixedVersion: false`, which suggests it does. Check in the app after the next publish.
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

## Team update message, as last drafted

In Harry's voice, "we" throughout, with the backend paragraph he asked for. Use the harry-voice skill for any edit.

> Hi all,
>
> Quick update on scouting. We've been moving the scout page off lebob.com.au/scout and into Foundry, so every report now goes into the one place and everyone sees everyone else's reports, not just what's on their own phone.
>
> What's in there so far is the match scouting page (tap the field where the robot shoots and picks up, it works with your phone upright or sideways) and a Teams tab, which builds a profile for each team from all of our reports and shows which robots still need scouting in which matches. You can tap a gap and go straight into scouting that robot.
>
> On the backend, each report is saved in Foundry as its own record linked to the event, match and team from the schedule data we already had in there. The numbers on the Teams tab (points per match, cycles, coverage) are worked out by functions running in Foundry, not on your phone, so the strategy page will be reading the same figures when we build it. The app itself is a web page hosted by Foundry, and if you lose signal mid-event your report waits on your phone and sends when it's back.
>
> You can have a look here: https://lebob-scout-bat5hxlyj3x7fsqq.apps.euw-3.palantirfoundry.co.uk
> Sign in with your Foundry account and tap Allow the first time (if you don't have an account yet, let us know). Please don't save a report for a match you didn't actually scout, reports can be corrected but not deleted.
>
> Still to come before AUCMP (5 and 6 December) are the pit survey and breakage forms, and the strategy page. If something looks wrong or is annoying to use, tell us, we'd rather hear it now than at the event.
>
> Cheers,
> Harry
