# Pit survey and breakage forms: design

The second job in moving the scout page into Foundry: bring the old site's Pit and Breakage forms into the scout app, ported as they are, and show what they hold on the Teams tab. This builds on the match scout page, scout polish and Teams tab designs. The old forms are in `reference/lebob-scout-site.html` (markup at lines 367 to 394, edit and save logic at 812 to 893, Teams tab use at 938 to 1003). Their option lists were lifted from line 460 by a script that printed only the lists (agreed on 26 Nov); nothing else on that line was read.

## Why

- Pit scouting is how we learn what a robot claims it can do before we have seen it play, and breakages are how we learn what goes wrong, ours and theirs.
- The old site kept these reports on one phone until someone exported them. In Foundry every scout and the strategist see them straight away.
- The Teams tab counts match reports only until this lands.

## Goals

- The two forms, with every field and option the old ones had.
- Saving works with no signal: reports wait on the phone and send when it is back, like match reports.
- A report can be opened again and changed. One pit report per scout per team per event, as before.
- Each team's profile on the Teams tab shows its pit reports and breakages.

## Not in this job

- Deleting a report (no delete, as for match reports).
- Spares fields (`sparesNotes`, `sparesCritical`, `fixHeld`, `estimatedRecoveryMinutes`). They exist on the objects but the old forms never filled them in.
- Pit reports in the strategist's pages. That is job 4, which can read the same objects and the flat profile rows.

## Decisions taken on 26 Nov

- **Save to the existing object types.** `PitSurvey` and `BreakageReport` already exist, with `create-pit-survey`, `modify-pit-survey`, `create-breakage-report` and `modify-breakage-report`. No ontology change. The 4 pit surveys and 1 breakage already in Foundry sit alongside the new ones.
- **Two new tabs, and buttons on each team.** The tab bar becomes Reports, Teams, Pit, Breakage. Each team on the Teams tab gets "Pit report" and "Breakage" buttons that open the form with the team filled in.
- **Shown on the Teams tab in this job.** That changes the functions' result shape, so it shares the one Developer Console step with the new object types and actions.

## Rulings (made on Harry's behalf, open to change)

- **R1 Who saved it.** `PitSurvey.scout` and `BreakageReport.reporter` hold the scout's name as Foundry gives it (the same `scoutName` match reports carry). The old site stored initials; old reports keep theirs. "One per scout" compares this name.
- **R2 Which event.** Reports carry `eventCode` (the objects have no event id). The app writes the remembered event's code. The tabs and the Teams tab show only reports whose code matches; old reports with no code are left out.
- **R3 Links.** `BreakageReport.teamUuid` is filled from the team number (as match reports do). `PitSurvey.participationUuid` is left empty: nothing reads it.
- **R4 Breakage match.** The old form's "Match # (blank = practice/pit)" stays, with a Qualification / Playoff choice beside it, since breakages in playoffs matter. `matchKey` is `<eventCode>-q<n>` or `<eventCode>-p<n>`, the old format extended, with playoff numbers as the app shows them (P1 to P6 by time).
- **R5 Saving is "create or replace".** A pit or breakage save is queued whole. Sending checks whether the id exists: if not it creates, if so it modifies with every field. That one path covers new reports, edits, and a retry after a lost answer.
- **R6 Yes / no fields** offer blank, Yes and No, as the old selects did. Blank saves as empty.
- **R7 Labels.** Options show as words with the hyphens turned to spaces and a capital first letter ("tank traction"), and save as the old values ("tank-traction").
- **R8 Team numbers only on the forms** (added while building). The forms, hints and saved lists show the team number without the name: no list of team names is loaded on those tabs, and the Teams tab already pairs each number with its name.
- **R9 Release 0.4.1, not 0.4.0** (added while building). The 0.4.0 functions release failed because PitSurvey and BreakageReport were not imported into the "Lebob Scout App" project. They were added as project imports (alongside Event, Team, Match and Presence, which were already imported from the old project; nothing in the old project changed) and the same commit was released as 0.4.1.

## The forms

Both use the app's existing look (cards, labels above inputs, 44 px targets, the phone sizes in CLAUDE.md).

### Pit (old lines 368 to 380)

Team number (required), drivetrain, robot archetype, HIVE / FLOWER / NECTAR (yes/no), floor intake / FLOWER intake / plays defence (yes/no), AUTO leave / AUTO park (yes/no), AUTO TIPS claimed and claimed TIPS per match (steppers in 0.5s), AUTO routines (text), preferred start, claimed cycle in seconds (stepper in 1s), height in inches (stepper in 1s), weight in kg (stepper in 0.5s), known issues (text), notes (long text). Button: Save pit report.

- Typing a team you have already pit-scouted at this event shows: "You already pit-scouted 12345 Name. Saving replaces that report." with an "Edit that report" button, as the old hint did. Saving with a twin asks "Replace it with this one?" and, on yes, replaces it (same id).

### Breakage (old lines 383 to 394)

Team number (required), match number (blank = practice or pit) with Qualification / Playoff, phase, field location, mechanism and component (text), failure type, severity (0 no effect, 1 brief, self-recovered, 2 reduced / lost cycles, 3 unavailable for a while, 4 immobilised / match over), symptoms and "robot was doing" (text), suspected cause, confidence, seconds lost and repair minutes (steppers in 5s), recovered / seen before (yes/no), recurrence (unknown, low, medium, high), fix applied, spare used, evidence (photo name or video time) (text). Button: Save breakage. As many breakages per team as needed.

### Option lists (from the old site)

- Drivetrain: mecanum, tank-traction, swerve, x-drive-omni, other, unknown
- Archetype: fixed-shooter, dual-adjustable-shooter, shooter-flower-hybrid, flower-specialist, turret-shooter, catapult-drum, pusher-defender, unknown
- Preferred start: near-wall, far-wall, audience-side, rear-side, unknown
- Phase: auto, teleop, endgame, pit, practice
- Field location: own-loading-zone, own-half, centre-hive, opp-half, opp-loading-zone, garden, red-flower, blue-flower, audience-flower, scoring-flower, unknown
- Failure type: cracked-bent, loose-disconnected, jammed, slipped, overheated, sensor-software, brownout-disconnect, immobilised, tipped-over, other
- Cause: impact, overload, snag, wear, assembly, electrical, code, unknown
- Confidence: confirmed, likely, speculative

### Under each form

A "Saved" list of this event's reports of that kind, newest first, from Foundry: team number and name with archetype (pit) or component, mechanism and severity (breakage), plus who and when. Reports still waiting on this phone show first, marked "waiting". Tapping one opens it in the form to change ("Editing the report for 12345 Name, saved Sat 2:14 pm." with Save changes and Cancel editing). Anyone can change anyone's report, as with match reports.

## Saving

- The phone's queue holds three kinds: match, pit, breakage. Queued items saved by an older build have no kind and are match reports.
- The same banner counts every kind waiting, and the 30 second retry and "back online" send cover them all.
- After a save the form clears and the button reads "Saved" for a moment, as the old one did.

## Teams tab

- Each profile gains a "Pit" section (each pit report: who, archetype, drivetrain, what it claims it can do, claimed cycle and TIPS, known issues, notes) and a "Breakages" section (each: match or "pit/practice", component, mechanism, severity, cause, recovered, fix). Both are hidden when empty.
- Chips gain "pit ✓" when the team has a pit report, and "N breakages" when it has any.
- Each team row gets "Pit report" (opens that scout's own pit report for the team when there is one) and "Breakage" buttons.
- Teams with only pit or breakage reports still get a row.
- The scouts list counts all three kinds per scout.
- "Needs scouting" is unchanged: it is about match coverage.
- The flat Workshop rows (`teamProfiles`) gain `pitReports` and `breakages` counts.

## In Foundry

1. **Functions:** import `PitSurvey` and `BreakageReport` into the functions repository, load them by the event's code alongside the rest, add the sections and counts above, publish 0.4.0. This changes the result shape.
2. **Developer Console (Harry or Sean, once):** add `PitSurvey` and `BreakageReport` and the four actions to the scout app, then generate SDK 0.4.0. Doing it after step 1 picks up the new function shapes in the same SDK.
3. **App:** install SDK 0.4.0, build the tabs, deploy 0.4.0.

## Checks

- Tests for: the option labels, building each kind of report from a form, the create-or-replace send, the queue with old items with no kind, the one-pit-per-scout rule, the match key, and each new figure in the functions.
- No test ever saves to a real event (no delete). Live saving is checked against the dummy event `spike` only, with a pit report and a breakage for team 0, and those two test reports are listed in the handover.
- Brave check at 360, 375 and 390 wide, then Harry's phone.

## What would make it a failure

- A pit or breakage report lost because the signal dropped.
- Editing a report creating a second copy.
- A Teams tab profile showing another event's pit reports.
- A form that is slower to fill in than the old one.
