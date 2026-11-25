# Teams tab: design

The third job in moving the scout page into Foundry. It brings the Teams tab of lebob.com.au/scout into the scout app. This builds on `2026-11-25-match-scout-page-design.md` and `2026-11-25-scout-polish-design.md`. The old tab is in `reference/lebob-scout-site.html` (markup at lines 350 to 366, `prof()` and `renderTeams()` at 913 to 991, `renderCoverage()` at 1041 to 1064).

## Why

- Scouts use the Teams tab during an event to see which robots still need a report, to pick up a robot nobody has covered, and to look up a team before a match. Harry: "Teams tab is opened by scouts, only strat lead opens that dashboard."
- Harry wants everything the old tab had: "for teams tab include everything from the lebob.com.au/scout teams tab."
- The old tab counted only the reports on that phone. In Foundry every scout sees every scout's reports, so the coverage figures are true for the whole team.

## Goals

- Every part of the old tab is in the new one: the status tiles, the team list with search and filters, the profile for each team, the coverage grid, and the scouts list.
- Profile figures are worked out from the taps, since the new reports no longer store totals.
- The sums are done in Foundry, so the strategist's Workshop pages in job 4 read the same figures the scouts see.
- A scout can go from a gap in the coverage grid to scouting that robot in one tap.

## Not in this job

- The strategist's heatmaps, corridors and match planning. That is job 4.
- Pit survey and breakage reports. That is job 2. The Teams tab counts match reports only until then.
- Deleting a report. Harry decided against a delete action. A report can be corrected, including moved to another match or robot, and cannot be removed.
- Accuracy figures. The old tab showed auto accuracy and cycle accuracy, and both need missed shots, which the new recording leaves out. Those two tiles are dropped. Pieces into the garden drop out of the points estimate for the same reason.

## What would make it a failure

- A coverage figure that disagrees with the reports list.
- A profile that double counts a match because two scouts covered it.
- A tab that takes more than a few seconds to open on mobile data at a venue.
- Sums written twice, once for scouts and once for the strategist, that drift apart.

## Approaches

1. **Work it out in Foundry with functions.** Foundry functions read the event's reports, schedule and teams and return the finished figures. The app calls them when the tab opens and draws what comes back. Workshop can call the same functions, so job 4 starts with the sums already written. Figures are worked out on each call, so they are never behind the reports. **Chosen.** Harry: "most math can be done in foundry."
2. **Work it out in Foundry with a pipeline.** A scheduled job writes a profile object per team. Match Observation has no dataset behind it, so the job would first need the reports copied out to one, and profiles would lag behind new reports by the length of the schedule. Not chosen.
3. **Work it out in the app.** No Foundry work, but the strategist's pages would need the same sums written a second time. Not chosen.

What stays in the app: searching and filtering the team list, remembering which rows are open, the count of reports waiting on this phone, and drawing.

## In Foundry

- A functions repository in the "Lebob Scout App" project, in TypeScript.
- Functions that take an event and return, between them: the status figures, one profile per team (tiles, chips, map figures, report lines), the coverage grid with its summary, and the scouts list. How they are split is the builder's, as long as the per-report sums and the per-team profile can each be called alone from Workshop.
- The functions are added to the scout app in Developer Console and the SDK is regenerated.
- No change to object types or actions, so no proposal. Publishing the functions and adding them to the app are steps in Foundry that Harry may need to do or approve.
- **To measure first:** how long a call takes from a phone, the first call after a quiet spell included. The builder builds one function end to end and times it before building the rest. If the tab cannot open in a few seconds, stop and tell Harry before going on.

## Getting to it

- A two-button bar under the header, **Reports** and **Teams**, on every screen except set-up, live and final. The app opens on Reports as now.
- The Teams tab shows the remembered event, the same one Reports uses.
- It loads when opened and after a report saves, by calling the functions. A **Refresh** button reloads it. It does not update by itself while open.
- While loading it says so. If loading fails it says so with a Retry button, in the same words as Reports.

## The tab, top to bottom

### 1. Scouting status

Four tiles:

| Tile | Figure |
|---|---|
| teams | teams at the event |
| need scouting | teams with a played match that has no report, or with no schedule and no report |
| matches covered | robot-matches played that have a report, over robot-matches played, as `have/slots` |
| waiting to save | reports queued on this phone (the old "unsent") |

Under the tiles, one line names the event and says how the app decides a match has been played.

**Played** means: the match has an actual time, or its scheduled time has passed. If no match at the event has either time, a match counts as played when its number is at or below the highest match number anyone has scouted, as on the old tab.

**Teams at the event** are the teams in the event's schedule plus any team that has a report for the event. Names come from the Team object.

### 2. Teams

- A search box that matches team number or name.
- Three filters: All, Needs scouting, Scouted by me. "By me" means the signed-in scout's Foundry user.
- One row per team, in number order: number, name and chips. Tapping a row opens it, and open rows stay open across a refresh.

Chips, as on the old tab:

- `≈N pts · n matches`, or `not scouted`.
- `matches x/y` (scouted over played) with `· k to come` when matches remain. `k matches to come` alone when none are played. `n matches` when there is no schedule.
- `missing Q3, Q7` for played matches with no report.
- `twice in Q4` for matches with more than one report.

An open row shows, in order: the next scheduled match and its time; the profile tiles; the map; one line per report.

### 3. Profile

Ten tiles:

| Tile | Worked out from |
|---|---|
| points / match | auto pts + teleop pts + park pts, rounded |
| auto pts | leave, auto park, and pieces scored in auto |
| teleop pts | pieces scored after auto |
| park pts | teleop park |
| auto scored | pieces scored in auto |
| cycles | teleop cycles (below) |
| cycle time | typical seconds per cycle (below) |
| driver 1-5 | average rating, ignoring blanks |
| speed 1-5 | average rating, ignoring blanks |
| matches | matches with a report |

Rules:

- **Auto** is a tap before 30 seconds on the match clock. Everything from 30 seconds on counts as teleop, the changeover included.
- **Pieces scored** is the sum of the counts on Shoot taps.
- **Cycles** follow the old rule: teleop Shoot taps in time order, where a new cycle starts at a shot that has an intake between it and the start of the cycle before. Cycles is the number of those starts. **Cycle time** is the median gap between one start and the next, to one decimal place, and a dash when there are fewer than two.
- **Points values** are the old site's: leave 3, auto park 5, teleop park 5, and 20 ÷ 7.5 points per piece scored. They sit in one place in the functions, keyed by the report's season (`fieldKey`), so next season supplies its own.
- **Two reports for one match**: each figure is averaged across that match's reports first, then across matches. Every match counts once. *Our call. The old tab kept only the newest report.* Cycle time is the median over the per-match medians.
- A team with no reports shows `not scouted` and no tiles.

### 4. Map

- The field picture with the 6 by 6 grid, squares shaded by how much the team did there in teleop. A switch chooses **Scored** (pieces scored from each square) or **Picked up** (intake records in each square). The old tab had scoring spots only.
- Nothing is turned and nothing is dimmed. Every match, red or blue, is drawn on the one map, with squares where they were recorded on the field. Harry: "Red/Blue matches should not be rotated", and dimming is "only … in auto select prematch. Nothing for match."
- With two reports for one match, each counts for half.
- **Auto start**: one dot for each match on the wall the robot started from, red matches on the red wall and blue on the blue wall, in the alliance's colour. This replaces the old "Auto start: zone (3/5)" line, because the zone names were game words and are not stored. *Our call.* Reports with no wall position get no dot. The dot is placed from the wall position and the report's alliance, never from `startSquare`, because a correction can change the alliance and leaves the start fields as they were.
- A caption says what the shading means.

### 5. Report lines

- One line per report, in match order: `Q3 · 4 auto · 9 cycles · 21 scored · Sam Scout`. "Scored" is teleop pieces.
- Tapping the line opens the report for correction, the same screen Reports uses. Saving or going back returns to the Teams tab.
- No sent or unsent mark: every report listed is in Foundry. No Delete.

### 6. Match coverage

- A grid with one row per match in schedule order and one cell per robot, red cells first. Each cell shows the team number, a tick for one report, `×2` for more, a dash for none, and the team name small.
- Matches still to come are shown muted and are left out of the counts. *Our call. The old grid counted them as missing, which would disagree with the "matches covered" tile.* The summary line and that tile use the same count.
- "Only matches with gaps" shows played matches where a robot has no report or more than one, and hides everything else, matches to come included.
- A summary line above, over played matches: `X of Y robot-matches have a report · N missing · N with more than one`, plus `N for a team not in that match (check team numbers)` and `N for matches not in the schedule` when those are not zero.
- Tapping any cell, played or to come, opens set-up with that match and robot already picked. A scout who starts a match from here comes back to the Teams tab after saving, and set-up's back button returns here too.
- Reports are matched to cells by match type, match number and team number, so a report typed in by hand counts too.
- Qualification rows are labelled `Q1`. Playoff matches, when the schedule has them, follow as `P1`.
- With no schedule loaded for the event, the card says so instead of showing a grid.

### 7. Scouts

- One line per scout: name, "(you)" beside the signed-in scout, the number of match reports, and the time of their latest. Most reports first.

## Look

The team's look from the second pass: panels, tiles in Plex Mono, chips with the yellow accent for good and the muted outline for a gap. Red stays for fills. Works at 360 px wide and has no sideways scroll, except the coverage grid, which may scroll inside its card if four robots do not fit.

## Left to the builder

- File layout, component names, and how the correction screen is shared between the two tabs.
- Which kind of TypeScript function to use, how the functions are split, and the shape of what they return.
- How a function reads every robot for an event. Presence has no event field, so it goes by the event's match ids.
- The shading scale on the map.
- Exact chip and tile styling within the look above.
- Tests for the sums, run in the functions repository: two reports for one match, a team on both alliances, no schedule, no times, a report typed in by hand.
