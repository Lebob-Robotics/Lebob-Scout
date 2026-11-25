# Match scout page: design

Job 1 of 5 in moving lebob.com.au/scout into Foundry.

## Why we are doing this

Scouts record what a robot does during a match. The lead strategist reads that data in Foundry and plans the next match. The strategist wants heatmaps of where each robot shoots and picks up, and the corridors robots drive between those spots, so we can plan to work with a partner's habits or get in an opponent's way.

The current site counts actions with tap buttons and asks the scout to mark positions after the match. It cannot tell us where a robot was at a given time. The new page records a grid square, a type, a count and a match time for each action as it happens.

## The five jobs

We agreed this order. This document covers job 1 only.

1. Match scout page and its data.
2. Pit survey and breakage forms, ported as they are.
3. Team profiles and the coverage grid.
4. Strategist page with heatmaps and corridors.
5. Retire lebob.com.au/scout.

All five live in one app. The old site keeps running until job 5.

## Goals

- A scout records a full match on their phone with their eyes on the field.
- Each tap is saved with its square, type, count and match time.
- A saved report links to the team and match already in Foundry.
- The data is stored so job 4 can draw heatmaps and corridors from it.
- Next season needs a new field picture and grid size, with no change to the data.

## Out of scope for job 1

- The strategist page (job 4).
- Pit survey, breakage, team profiles, coverage grid (jobs 2 and 3).
- Moving old Match Report data into the new shape.
- Working with no network at all. Scouts use their own mobile data.
- Game piece types, missed shots and garden counts. We dropped these.
- Showing scouts which robots other scouts have already picked.

## What would make this a failure

- A scout loses a match because of a dropped signal, a refresh or a locked phone.
- The live screen needs enough attention that the scout misses what the robot does.
- Game-specific words end up in the stored data and the page needs rewriting next season.

## Who uses it

About 8 scouts, each with their own Foundry account, on their own phones with mobile data. They decide between themselves who watches which robot. Two scouts sometimes watch the same robot. That produces two reports, and both are kept.

## What the scout does

### 1. Set up

- Sign in with Foundry. The scout's name comes from the login.
- Pick the match. The page lists matches for the current event and defaults to the next one to be played.
- Pick the robot from that match's four teams, shown in alliance colours.
- If the match is missing from Foundry (the FIRST sync has not caught up), type the match number and team number and choose the alliance and qualification or playoff by hand. *Our call, to stop a late schedule blocking scouting.*
- A hand-typed report is saved without links to Match and Presence. Each time the app loads, it looks for unlinked reports for the event, and links any whose event, match type, match number and team number now match a Presence in Foundry. *Our call. There is no separate backfill job.*
- Tap the robot's start square on the grid.
- Tap Start when the match starts.

### 2. Live screen

The phone is held sideways.

```
[ Shoot  ]   +-----------+   [ 1 ]
[ Intake ]   |  6×6 grid |   [ 2 ]
             |  on field |   [ 3 ]
[ Undo   ]   +-----------+   [ 4 ]
  AUTO 0:21          [ End match ]
```

- A record is three taps: Shoot or Intake, then a square, then a count from 1 to 4. It is stored when the count is tapped, with the match time at that moment.
- On a Shoot, the count is pieces scored, and the page says so next to the buttons. On an Intake, it is pieces picked up.
- There is no 0. A volley where every piece misses is not recorded, so that square does not appear on the map for that volley. Harry chose this.
- The mode stays selected after a record, so repeat actions need two taps.
- Undo removes the last record.
- The clock shows the phase and time left. Phases are 30 s auto, 8 s changeover, 120 s teleop, and the last 60 s of teleop is endgame. These come from the current site.
- A "Skip to teleop" button moves the clock to the start of teleop for a scout who started late.
- The scout can flip the field to match where they sit. Stored squares do not change.
- The screen stays awake during the match.
- End match opens the final page. The clock does not end the match by itself.

Scouts tap live, so a tap's time is within about 10 seconds of the robot's action. Scouts do not tap squares in the order the robot visited them. Job 4 must not treat tap order as a route.

### 3. Final page

- Auto leave, auto park, teleop park (yes or no).
- Minor fouls, major fouls (counts).
- Broke down (yes or no).
- Driver skill and robot speed, each 1 to 5.
- Auto notes and general notes.
- Auto path, drawn with a finger on the field picture.
- Save.

Auto shooting spots are not asked for. A Shoot record made during auto time is an auto shooting spot.

### 4. After saving

- The scout sees the saved reports for the event, with their own first.
- Any scout can reopen any report to fix the match, team, alliance or any final page answer. Harry chose this, so a report can still be fixed when its scout has gone home.
- Taps cannot be changed after saving.

## Keeping data safe

- The match in progress is written to the phone's storage after each tap. A refresh or a closed tab resumes the same match with the clock still correct.
- A finished report stays on the phone until Foundry confirms the save. The page retries, and shows the scout how many reports are waiting.
- A retry must not create a second copy. The report's ID is made on the phone when the timer starts.

## Approaches we considered

### Where the page lives

| Option | Trade-off |
|---|---|
| **React app hosted by Foundry (chosen)** | Own address, fills the phone screen, can store a match on the phone, scouts sign in with Foundry. Needs website hosting switched on for our Foundry. |
| Custom widget inside Workshop | No phone storage and the widget reloads when re-shown, so a match in progress can be lost. Workshop on phones is a limited feature. |
| Stay on lebob.com.au and upload files | Keeps the QR hand-off and manual upload we want to remove. |

### How taps are stored

| Option | Trade-off |
|---|---|
| **Lists on the report (chosen)** | One save writes the report and its taps together. Fewest parts. Foundry's built-in charts cannot count taps per square, so maps are drawn by our own code. |
| One record per tap | Foundry's own tools can chart taps. A save writes 50 or more records and needs server-side code to keep it all-or-nothing. |
| One block of text | Same as lists with less structure. |

Harry chose lists. He accepted that every tap question needs code and that Foundry's built-in charts will not see taps. If we later want that, we convert the lists to records in a one-off job.

## Data

### New Foundry project

A new project holds the new object type, its actions and the app. *Our call on the name: "Lebob Scout App".* The project shares the existing Lebob Ontology, so the new names must not clash with MatchReport, ScoutMatchReport or PitReport.

We reuse Team, Match, Presence and Event from the existing project. The FIRST sync keeps them current. A Match has four Presence records, each with a team number, alliance and station, and that is where the robot picker gets its list.

### New object type: Match Observation

One scout watching one robot in one match. Backed by an empty dataset, with all rows created through actions.

| Property | Type | Notes |
|---|---|---|
| observationId | string | Primary key. Made on the phone. |
| eventUuid | string | The event picked at set-up. |
| matchUuid | string, optional | Links to Match. Empty for hand-typed matches. |
| presenceUuid | string, optional | Links to Presence. |
| teamUuid | string, optional | Links to Team. Looked up from the team number when hand-typed. |
| matchNumber | integer | Always filled. |
| matchType | string | "qualification" or "playoff", as on Match. Always filled. |
| teamNumber | integer | Always filled. |
| alliance | string | "red" or "blue". |
| scoutUserId | string | Foundry user ID of the scout. |
| scoutName | string | For display. |
| createdAt, updatedAt | timestamp | |
| timerStartedAt | timestamp | Wall-clock time at which the match clock read 0. After "Skip to teleop" it is reset to the time of that tap minus 38 s, so match-clock seconds are always now minus this value. |
| fieldKey | string | Names the field picture, grid size and phase times in use, for example "ftc-2026". |
| startSquare | string | For example "C4". |
| tapSeconds | list of double | Match-clock seconds, 0 at the start of auto. |
| tapSquares | list of string | |
| tapKinds | list of string | "shoot" or "intake". |
| tapCounts | list of integer | 1 to 4. Pieces scored for a shoot, pieces picked up for an intake. |
| autoPathPoints | string | Same format as the current site: strokes of "x,y" points on a 0 to 100 field scale, strokes split by "\|", at most 30 points. |
| autoLeave, autoPark, teleopPark, brokeDown | boolean | |
| minorFouls, majorFouls | integer | |
| driverSkill, robotSpeed | integer, optional | 1 to 5. |
| autoNotes, notes | string, optional | |

Rules for the lists:

- The four lists have the same length. Entry *n* in each describes the same tap.
- The app checks this before saving. Only the app writes these lists.
- A match is 30 to 80 taps. Foundry allows 10,000 entries in a list parameter.

Squares:

- Columns are A to F from the red alliance wall. Rows are 1 to 6 from the top of the field picture in `ftc-scouting-demo.html`.
- Squares are stored in that frame for both alliances and for a flipped view. They are not mirrored for blue.
- The auto path uses the same frame. Its 0 to 100 scale covers the grid area only: x is 0 at the red alliance wall and 100 at the blue wall, y is 0 at the top row and 100 at the bottom. The alliance areas outside the walls are not part of it. This matches the current site, so old and new paths can be compared. A square is 100/6 units wide.

Match-clock seconds:

- 0 to 30 is auto, 30 to 38 is changeover, 38 to 158 is teleop, 98 to 158 is endgame.
- "Skip to teleop" sets the clock to 38.
- Taps after 158 are kept with their real clock time.

Hive scores are not on this type. They come from the FIRST API as alliance totals and are already on Presence and Match.

### Links

- Team to Match Observation, one to many.
- Match to Match Observation, one to many.
- Presence to Match Observation, one to many.

### Actions

- **Create Match Observation.** Takes every property. Adds one object.
- **Modify Match Observation.** Changes the match, team and alliance fields (matchUuid, presenceUuid, teamUuid, matchNumber, matchType, teamNumber, alliance) and the final page fields. Leaves the tap lists alone. Anyone who can use the app can run it on any report. It sets updatedAt. *Our call: we do not record who made the change. Foundry's own edit history covers that.*

Scouts need permission to view Team, Match, Presence and Event, to run both actions, and to open the hosted site.

## The app

- React, TypeScript and Vite, from the template Developer Console creates, with the generated Ontology SDK.
- Hosted by Foundry website hosting. Scouts open one address and sign in.
- Palantir's advanced to-do application is the reference for structure (client set-up, data hooks, current user): https://www.palantir.com/docs/foundry/ontology-sdk-react-applications/advanced-todo-application-overview/
- Plain CSS, as in the demo. No component library.
- The field picture, grid size and phase times sit in one settings object keyed by `fieldKey`.
- The grid, the Shoot and Intake modes and the count buttons start from `ftc-scouting-demo.html` in this folder.
- The finger-drawn auto path is ported from the current site, including its point limit and text format. A copy of the site's source is saved at `reference/lebob-scout-site.html` (one file, scripts inline; search for `autoPathPoints`).
- The heat, legs, runs and spline code in the demo belongs to job 4 and is left out of job 1.
- Tests cover the parts with logic: the match clock and phases, building and checking the tap lists, and the waiting-to-save queue. The page is also run on a real phone before we call it done.

## First things to check

1. **Website hosting is switched on for our Foundry.** We could not confirm this from outside. If it is off, stop and talk to Harry before building anything else.
2. **Which set-up steps need a person in the Foundry screens.** Creating the Developer Console app, choosing the site address, allowing local development and sharing the site with scouts may need Harry to click through them. The builder lists these steps for him in order.
3. **The save works from a phone on mobile data** with a list of 80 taps, before the rest of the page is built.

## Left to the builder

- Component and file layout.
- Which property is the report's display title.
- How "current event" and "next match" are picked from Event and Match.
- How a retry detects that a report already saved.
- Look and feel of the set-up and final pages, within the colours and plain style of the demo.

---

Lebob · FTC Team 29550 · Scout app, job 1 · v0.1, 25 Nov 2026
