# Scout App Second Pass Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Intake records an area with no count, the start position is a dot dragged along the wall, the app takes the look of lebob.com.au, and the live screen works in portrait.

**Architecture:** The rules stay in pure modules with tests (`live.ts`, `taps.ts`, a new `startWall.ts`); screens stay thin. One new nullable property in Foundry, `startWallPos`, added to the create action. The look is a set of CSS variables and bundled fonts in `app.css`, applied to the existing markup.

**Tech Stack:** As the first plan: React, TypeScript, Vite, Vitest, `@osdk/client`, plain CSS. New: `@fontsource/ibm-plex-sans` and `@fontsource/ibm-plex-mono` (font files only).

**Spec:** `docs/superpowers/specs/2026-11-25-scout-polish-design.md`, which amends `docs/superpowers/specs/2026-11-25-match-scout-page-design.md`. Read both.

**Reference files:** `reference/lebob-scout-site.html` lines 1071 to 1170 (the start slider). The team site's styles are public at `github.com/Lebob-Robotics/Lebob-Website` (`index.html` `:root`, `polish.css`, `logo/`).

## Global Constraints

- Everything in the first plan's Global Constraints still holds, except: an intake record has count 0; a check accepts 0 to 4 for an intake and 1 to 4 for a shoot; the app writes only 0 for an intake.
- An intake square is recorded the moment it is tapped. Nothing is saved on leaving a mode.
- `startWallPos` is a whole number 0 to 200 on the robot's own wall: 0 to 50 top wall from the centre line to the corner, 50 to 150 outer wall, 150 to 200 bottom wall back to the centre line, measured on the red side. A blue robot's position is the same path turned a half-turn.
- Allowed start ranges for `ftc-2026`: `[[0, 9], [23, 67], [83, 109], [123, 200]]`. They live in the field settings.
- `startSquare` is still saved, worked out from the wall position and alliance, in the unflipped field frame.
- Colours: background `#1a1b1e`, panel `#242529`, border `#36373c`, text `#c8c9c2`, emphasis `#e5e6e0`, muted `#8a8b83`, accent `#FFF200`, red `#ED1C24` (fills only, never small type).
- Type: IBM Plex Sans for reading, IBM Plex Mono for numbers, the clock and small labels, both bundled. Press Start 2P is not used for text.
- 4 px corners. Buttons press in slightly (`transform: scale(0.97)` on `:active`). Movement under 300 ms and off under `prefers-reduced-motion`.
- No button gets smaller, lower in contrast or slower to hit than it is at commit 9b9b206. Tap targets stay at least 48 px.
- A draft or queued report written by the deployed version (0.1.0-5-g9b9b206) must load and save under the new version.
- No request to any site other than Foundry at run time.
- `FOUNDRY_TOKEN` is loaded only inside the command that needs it and never written to a file or printed.

## Review Focus

1. A scout mid-match on the old version picks up the new one: the draft has no `startWallPos` and may hold an intake with count 3. It must load, keep recording and save. (Task 2, Task 3)
2. Intake taps arriving fast and out of order: a square tapped twice in one area, Undo in the middle of an area, switching mode mid-area. No record is lost or doubled. (Task 2)
3. The start dot dragged past the end of the wall, onto a forbidden stretch, or off the field: it rests on the nearest allowed position and Start is never enabled on a forbidden one. (Task 3)
4. A blue robot's dot: the stored position is alliance-relative and the stored square is in the field frame, whichever way the scout has flipped the view. (Task 3)
5. Fonts fail to load or load late: text is readable in the fallback and the layout does not jump enough to move a button under a finger. (Task 4)

---

### Task 1: Foundry property and create action

**Files:** none on disk.

- [ ] **Step 1: Branch.** `create_global_branch` on ontology `ri.ontology.main.ontology.337241ba-4314-4c10-a9e2-6160a76db115`, display name `match-observation-start-wall`.
- [ ] **Step 2: Add the property** to Match Observation (`ri.ontology.main.object-type.acb6d7a1-0316-4177-89be-503389ba675e`) with `create_or_update_foundry_object_type` in update mode: `propertyTypeId` `start_wall_pos`, apiName `startWallPos`, integer, nullable, edit-only, description "Start position along the robot's own wall, 0 to 200 from the centre line round the outer wall and back. Empty for reports saved before this was recorded." No other property changes.
- [ ] **Step 3: Add it to the create action** (`create-match-observation`, `ri.actions.main.action-type.d6a9158a-7ef3-47e8-a9f2-017da1c514ee`) as an optional parameter mapped to the property. Leave `modify-match-observation` alone.
- [ ] **Step 4: Verify on the branch** with `view_foundry_object_type` and `view_foundry_action_type`: 33 properties; create has 33 property parameters; modify still has 20 and no `start_wall_pos`; `view_global_branch` shows only the object type and the create action as modified, nothing created or deleted.
- [ ] **Step 5: Proposal.** `create_global_proposal`. **Harry:** approve and merge.
- [ ] **Step 6: SDK.** After the merge, `create_or_update_ontology_sdk_version` for application `ri.third-party-applications.main.application.ebbc1c91-5941-420b-bc39-d4dcdd81df44`, marking the object type and the create action `"UPDATED"`. If the tool cannot, **Harry:** generate a new npm SDK version in Developer Console. Verify with `view_osdk_definition`: a version above 0.1.0 and `createMatchObservation` with 33 parameters.

### Task 2: Intake records an area

**Files:**
- Modify: `scout-app/src/live.ts`, `scout-app/src/taps.ts`, `scout-app/src/screens/LiveScreen.tsx`
- Test: `scout-app/src/live.test.ts`, `scout-app/src/taps.test.ts`

**Interfaces:**
- Produces: `LiveState` gains `area: string[]` (squares recorded since Intake was selected). `LiveAction`'s `square` action gains `seconds: number`. `checkTaps` rules as below. Everything else keeps its name.

- [ ] **Step 1: Write the failing tests.** Replace the intake cases in `live.test.ts` and add to `taps.test.ts`:

```ts
const run = (...a: LiveAction[]) => a.reduce(liveReducer, emptyLive);
test("an intake square is recorded as soon as it is tapped", () => {
  const s = run({ type: "mode", mode: "intake" }, { type: "square", square: "A1", seconds: 5 }, { type: "square", square: "B2", seconds: 6.5 });
  expect(s.taps).toEqual([{ seconds: 5, square: "A1", kind: "intake", count: 0 }, { seconds: 6.5, square: "B2", kind: "intake", count: 0 }]);
  expect(s.area).toEqual(["A1", "B2"]);
  expect(s.square).toBeNull();
});
test("tapping a square in the area again removes that record", () => {
  const s = run({ type: "mode", mode: "intake" }, { type: "square", square: "A1", seconds: 5 }, { type: "square", square: "B2", seconds: 6 }, { type: "square", square: "A1", seconds: 7 });
  expect(s.taps.map(t => t.square)).toEqual(["B2"]);
  expect(s.area).toEqual(["B2"]);
});
test("leaving Intake ends the area and keeps its records", () => {
  const s = run({ type: "mode", mode: "intake" }, { type: "square", square: "A1", seconds: 5 }, { type: "mode", mode: "shoot" });
  expect(s.area).toEqual([]);
  expect(s.taps).toHaveLength(1);
  const again = run({ type: "mode", mode: "intake" }, { type: "square", square: "A1", seconds: 5 }, { type: "mode", mode: "intake" }, { type: "square", square: "A1", seconds: 9 });
  expect(again.taps.map(t => t.seconds)).toEqual([5, 9]);   // a new area: the same square is a new record
});
test("a count does nothing in Intake", () => {
  expect(run({ type: "mode", mode: "intake" }, { type: "square", square: "A1", seconds: 5 }, { type: "count", count: 3, seconds: 6 }).taps).toHaveLength(1);
});
test("undo inside an area takes the square back out of it", () => {
  const s = run({ type: "mode", mode: "intake" }, { type: "square", square: "A1", seconds: 5 }, { type: "square", square: "B2", seconds: 6 }, { type: "undo" });
  expect(s.taps.map(t => t.square)).toEqual(["A1"]);
  expect(s.area).toEqual(["A1"]);
});
test("shoot is unchanged", () => {
  const s = run({ type: "mode", mode: "shoot" }, { type: "square", square: "C4", seconds: 1 }, { type: "count", count: 3, seconds: 12.3 });
  expect(s.taps).toEqual([{ seconds: 12.3, square: "C4", kind: "shoot", count: 3 }]);
});
// taps.test.ts
test("intake counts", () => {
  const t = (kind: Kind, count: number): Tap => ({ seconds: 1, square: "A1", kind, count });
  expect(checkTaps([t("intake", 0)], f)).toEqual([]);
  expect(checkTaps([t("intake", 3)], f)).toEqual([]);      // saved before this change
  expect(checkTaps([t("intake", 5)], f)).toHaveLength(1);
  expect(checkTaps([t("shoot", 0)], f)).toHaveLength(1);
  expect(checkTaps([t("shoot", 4)], f)).toEqual([]);
});
```

- [ ] **Step 2: Run** `npm run test -- live taps`. Expected: FAIL.
- [ ] **Step 3: Implement.** In Shoot the `square` action's `seconds` is ignored. Undo removes the last tap whatever its kind, and removes its square from `area` if it is there. The reducer still returns the same `taps` array object when taps do not change.
- [ ] **Step 4: Update `LiveScreen`.** Squares in `area` show selected in the intake colour. The count buttons render only in Shoot mode; in Intake that space shows the number of squares in the current area. Hints: Intake, "Tap every square it collects from."; Shoot as now. `seconds` for a square tap is `matchSeconds(draft.startedAtMs, Date.now())`. The draft is handed to `onChange` after every intake tap, as for every other record.
- [ ] **Step 5: Run** `npm run test`, `npm run lint`, `npm run build`. Check in a browser with `?dev=1`: an area of three squares, one removed, Undo, switch to Shoot and score, reload mid-area and confirm the records are there. Expected: all pass.
- [ ] **Step 6: Commit.** `git commit -am "Record an intake as an area with no count"`

### Task 3: Start position as a dot on the wall

**Files:**
- Create: `scout-app/src/startWall.ts`, `scout-app/src/components/StartPad.tsx`
- Modify: `scout-app/src/field.ts`, `scout-app/src/observation.ts`, `scout-app/src/storage.ts`, `scout-app/src/api.ts`, `scout-app/src/devApi.ts`, `scout-app/src/screens/SetupScreen.tsx`, `scout-app/src/App.tsx`
- Test: `scout-app/src/startWall.test.ts`, additions to `observation.test.ts`, `storage.test.ts`, `api.test.ts`

**Interfaces:**
- Produces:
  - `Field` gains `startOk: [number, number][]`.
  - `startXY(v: number): { x: number; y: number }` (0 to 1 across the grid area, red frame)
  - `startSnap(v: number, field: Field): number`
  - `startNearest(x: number, y: number, field: Field): number` (nearest allowed position to a point in the red frame)
  - `wallPoint(v: number, alliance: "red" | "blue"): { x: number; y: number }` (field frame; blue is `1 - x`, `1 - y`)
  - `startSquareFor(v: number, alliance: "red" | "blue", field: Field): string`
  - `Draft` and `Observation` gain `startWallPos: number | null`.
  - `SetupScreen`'s `onStart(target, startSquare, flipped, startWallPos)`.
  - `StartPad({ fieldKey, flipped, alliance, value, onChange }: { fieldKey: string; flipped: boolean; alliance: "red" | "blue" | null; value: number | null; onChange(v: number): void })`

- [ ] **Step 1: Write the failing tests.**

```ts
const f = FIELDS["ftc-2026"];
test("wall positions map to the wall", () => {
  expect(startXY(0)).toEqual({ x: 0.5, y: 0 });
  expect(startXY(50)).toEqual({ x: 0, y: 0 });
  expect(startXY(100)).toEqual({ x: 0, y: 0.5 });
  expect(startXY(150)).toEqual({ x: 0, y: 1 });
  expect(startXY(200)).toEqual({ x: 0.5, y: 1 });
});
test("the dot rests only where a robot may start", () => {
  expect(f.startOk).toEqual([[0, 9], [23, 67], [83, 109], [123, 200]]);
  expect(startSnap(5, f)).toBe(5);
  expect(startSnap(12, f)).toBe(9);
  expect(startSnap(20, f)).toBe(23);
  expect(startSnap(75, f)).toBe(67);     // 67 and 83 are equally far; the lower wins, as on the old site
  expect(startSnap(-40, f)).toBe(0);
  expect(startSnap(999, f)).toBe(200);
  expect(startSnap(100.4, f)).toBe(100);
});
test("a tap finds the nearest allowed spot", () => {
  expect(startNearest(0, 0.5, f)).toBe(100);
  expect(startNearest(0.9, 0.5, f)).toBe(startSnap(startNearest(0.9, 0.5, f), f));   // always allowed
});
test("blue is the same path turned a half-turn", () => {
  expect(wallPoint(100, "red")).toEqual({ x: 0, y: 0.5 });
  expect(wallPoint(100, "blue")).toEqual({ x: 1, y: 0.5 });
  expect(wallPoint(0, "blue")).toEqual({ x: 0.5, y: 1 });
});
test("the square is in the field frame", () => {
  expect(startSquareFor(105, "red", f)).toBe("A4");    // y 0.55, fourth row
  expect(startSquareFor(105, "blue", f)).toBe("F3");   // turned: x 1, y 0.45
  expect(startSquareFor(50, "red", f)).toBe("A1");
  expect(startSquareFor(150, "red", f)).toBe("A6");
  expect(startSquareFor(0, "red", f)).toBe("D1");
  expect(startSquareFor(200, "blue", f)).toBe("D1");   // turned: x 0.5, y 0
});
// observation.test.ts
test("the wall position is carried, and old drafts have none", () => {
  expect(buildObservation(draft({ startWallPos: 100 }), { id: "u", name: "x" }, 0).startWallPos).toBe(100);
  const old = draft({}); delete (old as Partial<Draft>).startWallPos;
  expect(buildObservation(old, { id: "u", name: "x" }, 0).startWallPos).toBeNull();
});
// storage.test.ts
test("a draft from the previous version still loads", () => {
  const old = draft({ taps: [{ seconds: 1, square: "A1", kind: "intake", count: 3 }] }); delete (old as Partial<Draft>).startWallPos;
  const backing = fakeStorage({ "lsa:draft": JSON.stringify(old) });
  expect(createStore(backing).loadDraft()).not.toBeNull();
});
// api.test.ts
test("create sends the wall position, modify does not", () => {
  expect(toCreateParams(obs("a", { startWallPos: 100 })).start_wall_pos).toBe(100);
  expect("start_wall_pos" in toModifyParams(obs("a"), {}, 0)).toBe(false);
});
```

A point with x exactly 0.5 falls in column D; `startSquareFor` clamps the column and row to the grid. If a figure in these tests disagrees with the old site's `startXY`, `startSnap` or `startNearest` at `reference/lebob-scout-site.html` lines 1079 to 1093, the old site's behaviour wins: fix the test and say so in the report.

- [ ] **Step 2: Run** `npm run test -- startWall observation storage api`. Expected: FAIL.
- [ ] **Step 3: Implement the pure parts**, porting `startXY`, `startSnap` and `startNearest` from the reference lines. No zone names.
- [ ] **Step 4: Build `StartPad`.** The field picture with a track drawn along the alliance's wall, allowed stretches bright and forbidden stretches dim, and a dot in the alliance colour. Dragging the dot or tapping anywhere on the picture calls `onChange(startNearest(...))`, un-flipping and un-turning the pointer first. Left and right arrow keys step to the next allowed position. With no alliance it shows "Pick the robot first." and takes no input. The dot's touch target is at least 48 px. `touch-action: none` on the picture.
- [ ] **Step 5: Use it in `SetupScreen`** in place of the start-square grid. Start needs a robot and a wall position. The line under it reads "Start: <square>" using `startSquareFor`. Changing the robot to the other alliance keeps the same wall number. `onStart` passes both the square and the wall position; `App.tsx` puts both in the draft.
- [ ] **Step 6: `api.ts` and `devApi.ts`.** `toCreateParams` sends `start_wall_pos` (null allowed). Reading maps a missing value to null. This step needs the SDK version from Task 1; if Task 1's SDK is not available yet, do Steps 1 to 5, commit, and report NEEDS_CONTEXT for this step.
- [ ] **Step 7: Run** `npm run test`, `npm run lint`, `npm run build`. Check in a browser with `?dev=1` at 390 by 844: drag along the wall, tap the middle of the field, try a forbidden stretch, pick a blue robot, flip the field, start, and confirm the saved report carries both values.
- [ ] **Step 8: Commit.** `git commit -am "Place the start position with a dot on the wall"`

### Task 4: The team's look

**Files:**
- Modify: `scout-app/src/app.css`, `scout-app/src/main.tsx`, `scout-app/index.html`, `scout-app/package.json`, and class names in the screens and components where the styles need a hook
- Create: `scout-app/src/assets/lebob-mark.svg` (from the website repository's `logo/lebob-mark-primary.svg`), `scout-app/src/components/Header.tsx`

- [ ] **Step 1: Fonts.** `npm i @fontsource/ibm-plex-sans @fontsource/ibm-plex-mono`. Import weights 400, 500 and 600 of Sans and 500 of Mono in `main.tsx`. `font-display: swap` (the packages' default). Confirm the built bundle requests no outside host: `grep -rE "fonts\.(googleapis|gstatic)" dist` finds nothing.
- [ ] **Step 2: Tokens.** Put the Global Constraints colours, the two font stacks, the 4 px radius and one easing curve (`cubic-bezier(0.23, 1, 0.32, 1)`) in `:root` in `app.css`, and replace every literal colour in the file with a variable. Shoot is `--accent` yellow. Intake is a teal chosen to pass 3:1 against the panel colour and to read apart from the yellow, the alliance red and the alliance blue for the common kinds of colour blindness; state the value and the contrast figures in the report.
- [ ] **Step 3: Components.** Buttons: panel background, 1 px border, emphasis text; primary buttons (Start, Save) yellow with dark text; danger buttons outlined in red; selected states filled; `:active` scale 0.97; a 2 px yellow focus ring on `:focus-visible`. Inputs, selects and text areas match. The dashed yellow pixel rule (`repeating-linear-gradient(90deg, var(--accent) 0 8px, transparent 8px 16px)`, 8 px tall) divides the header from the page. Numbers, the clock and small labels in Mono.
- [ ] **Step 4: Header.** `Header.tsx` shows the cockatoo mark at 36 px and "Lebob Scout", on every screen except the live one. The mark has `alt=""`.
- [ ] **Step 5: Apply to every screen**: set-up, final page, reports list, correction view, sign-in and error screens, the waiting and signed-out banners. The live screen keeps its layout and takes the new colours and type.
- [ ] **Step 6: Motion.** Transitions on colour, opacity and transform only, under 300 ms. Under `@media (prefers-reduced-motion: reduce)`, no transforms.
- [ ] **Step 7: Verify.** `npm run test`, `npm run lint`, `npm run build`. In a browser with `?dev=1`, screenshot every screen at 390 by 844 and the live screen at 844 by 390 into the plan workspace. Measure and report: the smallest tap target on each screen (must be 48 px or more), the grid square size on the live screen at 667 by 375 and 844 by 390 (must not be smaller than 50.8 and 53.1), and the contrast of body text, muted text and button text against their backgrounds.
- [ ] **Step 8: Commit.** `git commit -am "Give the app the team's look"`

### Task 5: Portrait live screen

**Files:**
- Modify: `scout-app/src/screens/LiveScreen.tsx`, `scout-app/src/app.css`

- [ ] **Step 1: Layout.** Under `(orientation: portrait)`: the field across the full width at the top; below it Shoot and Intake side by side; below that the 1 to 4 buttons in one row (Shoot) or the area count (Intake); then one bar with the clock, Undo, Flip field, Skip to teleop when it applies, and End match. Remove the "turn your phone" cover and its text. The landscape layout does not change.
- [ ] **Step 2: Squares.** At 390 wide the grid squares are at least 48 px. If the full picture cannot give that, trim the alliance strips in portrait so the grid takes more of the width, keeping the grid aligned with the picture's tile area.
- [ ] **Step 3: Reach.** Nothing the scout taps during play sits in the top 25% of the screen except the field. End match is at the bottom, on the opposite side from the count buttons' last column, and its confirm keeps "Keep going" under the finger.
- [ ] **Step 4: Verify.** `npm run test`, `npm run lint`, `npm run build`. In a browser with `?dev=1` at 390 by 844, 360 by 740 and 430 by 932: no scrolling on the live screen, square sizes reported for each, a full Shoot record and an Intake area, the End match double tap still lands on Keep going. Rotate between portrait and landscape mid-area and confirm the mode, the area highlights and the records survive. Screenshots into the plan workspace.
- [ ] **Step 5: Commit.** `git commit -am "Lay the live screen out for portrait"`

### Task 6: Deploy and check on a phone

- [ ] **Step 1:** `npm run test && npm run lint && npm run build`, token grep, `npx @osdk/cli site deploy` with the token loaded inside the command, `curl -sI` the hosted address.
- [ ] **Step 2: Upgrade check in Brave** (Harry is signed in there): with the current version open, start a match and record an intake; deploy; reload; confirm the match is still there and saves.
- [ ] **Step 3: Harry, on a phone on mobile data:** set up with the dot, record a match upright and sideways with an intake area, save, and confirm the report in Foundry has `startWallPos`, `startSquare` and intake records with count 0.
