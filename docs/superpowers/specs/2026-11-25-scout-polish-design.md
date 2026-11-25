# Scout app, second pass: design

Four changes from Harry's notes after using the first version. This builds on `2026-11-25-match-scout-page-design.md` and changes it where the two disagree.

## Why

- Scouts watching an intake see a robot sweep an area. Tapping one square and a count does not match that, and nobody trusts a piece count taken at a glance.
- The first version looks like a prototype. The team's site at lebob.com.au has a look, and the scout app should share it.
- The old scout page placed the start position by sliding a dot along the wall. Tapping one of six squares is coarser and feels worse.
- A scout should be able to hold the phone either way up during a match.

## What changes

### 1. Intake records an area, with no count

- With Intake selected, each square tapped is recorded at once, with the match time of that tap.
- Recorded squares stay highlighted while Intake stays selected. Tapping a highlighted square again removes that record. Choosing Shoot, or tapping Intake again, ends the area and clears the highlights.
- The 1 to 4 buttons show only for Shoot.
- Undo removes the last record, as now.
- Stored data: one record per square, kind `"intake"`, count `0`. The four lists stay the same length. No change in Foundry.
- Reports saved before this change keep their intake counts of 1 to 4. The app accepts 0 to 4 for an intake when checking a report, and writes only 0.
- Shoot is unchanged: a square, then pieces scored, 1 to 4.

### 2. Start position is a dot on the wall

- At set-up, the scout drags a dot along the robot's own wall, or taps the field and the dot jumps to the nearest allowed spot. This replaces tapping a start square.
- The position is a whole number from 0 to 200, as on the old site: 0 to 50 runs along the top wall from the centre line to the corner, 50 to 150 down the outer wall, 150 to 200 along the bottom wall back to the centre line. It is measured on the red side of the picture, and a blue robot's wall is the same path turned a half-turn. Old and new start positions mean the same thing.
- The dot cannot rest where a robot may not start. For this season the allowed ranges are 0 to 9, 23 to 67, 83 to 109 and 123 to 200, taken from the old site. They live in the field settings for `ftc-2026`, so next season supplies its own.
- The dot shows in the alliance's colour, and needs the robot picked first.
- Stored data: a new property on Match Observation, `startWallPos` (whole number, may be empty for reports saved before this change). `startSquare` is still saved, worked out from the dot's position, so the heatmap work is unaffected.
- Foundry: one proposal adds the property and adds it to the create action. Harry approves it, and the SDK is regenerated. The modify action does not change. Start position stays uncorrectable after saving, as now.
- The zone names the old site attached to wall positions are game words, and we do not store them.

### 3. The app takes the team's look

Taken from lebob.com.au and its brand notes:

- Background `#1a1b1e`, panels `#242529`, borders `#36373c`, text `#c8c9c2` with `#e5e6e0` for emphasis, muted text `#8a8b83`.
- Yellow `#FFF200` is the accent: the selected state, the primary button, focus rings.
- Red `#ED1C24` fills shapes and never sets small type.
- IBM Plex Sans for reading and IBM Plex Mono for numbers, the clock and labels. Both are bundled with the app, because Foundry's hosting blocks outside font sites.
- Press Start 2P is for the logo only, per the brand notes. The app does not use it for text.
- 4 px corners, a slight press-in on every button, and the dashed yellow pixel rule as a divider.
- The cockatoo mark and "Lebob Scout" sit at the top of every screen except the live one.
- Movement is short and stops for anyone who has asked their phone to reduce motion.

Working colours on the live screen:

- Shoot is brand yellow. Intake is a second colour that reads apart from yellow and from both alliance colours at a glance. *Our call: a cool teal, since red and blue are taken by the alliances.*
- Alliance red and blue stay as they are on the field picture.

Dark only. The old page's light theme is not carried over. *Our call. Say so if scouts need it in bright venues.*

### 4. The live screen works in portrait

- Held upright, the field sits at the top across the full width, with Shoot and Intake, the count buttons, Undo, the clock and End match below it, all within thumb reach.
- Grid squares are at least 48 px on a 390 px wide phone.
- The "turn your phone sideways" cover is removed.
- The sideways layout stays as it is, restyled.

## Not changing

- The save queue, sign-in behaviour, phone storage, schedule rules and the reports list's behaviour. They get the new look and nothing else.
- The final page's questions.
- The Foundry modify action.

## What would make this a failure

- The restyle makes a button smaller, lower in contrast or slower to hit than it is now.
- A scout on the previous version, mid-match or with a report queued, loses it when their phone picks up this version.
- An intake tap is lost because the scout did not "finish" the area.

## Approaches we considered

| Question | Options | Choice |
|---|---|---|
| When is an intake square saved? | On leaving Intake mode, as in the first demo; or the moment it is tapped | The moment it is tapped. Nothing waits on a second action, so nothing can be lost. |
| How is an area stored? | One record per square; or one record holding a list of squares | One record per square. The four lists and everything built on them stay as they are. |
| What does the start slider store? | Only the square it lands in; or the wall position as well | Both. Harry chose this: the slider is only worth having if its precision is kept. |

## Order of work

1. Foundry: the new property and the create action, as a proposal. Harry approves. SDK regenerated.
2. Intake area and the start dot, with tests.
3. The new look across every screen, then the portrait live layout.
4. Deploy, and a short run on a phone.

Steps 2 and 3 do not wait for step 1. Only saving a start position to Foundry does.

## Left to the builder

- The exact teal, and how the count buttons look at rest.
- Whether the portrait field trims the alliance strips to make squares larger.
- How the dot is drawn and how large its touch target is.

---

Lebob · FTC Team 29550 · Scout app, second pass · v0.1, 25 Nov 2026
