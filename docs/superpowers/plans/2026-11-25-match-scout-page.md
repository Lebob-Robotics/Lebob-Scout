# Match Scout Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A phone page, hosted by Foundry, where a scout records timed grid taps for one robot in one match and saves them as a Match Observation.

**Architecture:** A React single-page app built on the Ontology SDK and served by Foundry website hosting. All logic with rules in it (clock, tap recording, auto path, phone storage, save queue) lives in pure TypeScript modules with tests. Screens are thin and call those modules. One new object type holds a report with its taps as four parallel lists, written by one create action and one modify action.

**Tech Stack:** React, TypeScript, Vite, `@osdk/client`, `@osdk/oauth`, `@osdk/foundry.admin`, Vitest, plain CSS. Node 24 and npm 11 are installed locally.

**Spec:** `docs/superpowers/specs/2026-11-25-match-scout-page-design.md`. Read it before starting any task.

**Reference files:** `ftc-scouting-demo.html` (grid, modes, field picture) and `reference/lebob-scout-site.html` (auto path code at lines 1546 to 1567).

## Global Constraints

- Foundry host: `https://lebob.euw-3.palantirfoundry.co.uk`. Ontology RID: `ri.ontology.main.ontology.337241ba-4314-4c10-a9e2-6160a76db115`.
- Existing project (do not modify anything in it): `/Lebob-7db4f1/LebobFTCScouting`. Reuse its Team, Match, Presence and Event object types.
- New project name: `Lebob Scout App`. New object type: display name `Match Observation`, apiName `MatchObservation`, id `match-observation`.
- Repo root is `/home/harry/Documents/Lebob/foundry`. The app lives in `scout-app/`. All paths below are relative to the repo root.
- Field settings for `fieldKey` `"ftc-2026"`: 6 columns, 6 rows, auto 30 s, changeover 8 s, teleop 120 s, endgame is the last 60 s of teleop.
- Squares are named column `A` to `F` from the red alliance wall, row `1` to `6` from the top, as in the demo. They are stored unflipped and unmirrored.
- Tap kinds are `"shoot"` and `"intake"`. Counts are 1 to 4. No 0.
- Stored data carries no game words (no hive, pollen, nectar, flower, garden).
- No component library and no new runtime dependencies beyond the tech stack above.
- `FOUNDRY_TOKEN` comes from Harry's environment. It is never written to a file that git tracks.
- A person must do these in Foundry's screens, because no tool exists for them: create the Developer Console app, request the hosting address, set redirect URLs, set CORS, approve the ontology proposal, share the site. When a step says **Harry:**, stop and ask him, giving the exact clicks.

## Review Focus

Each line names a condition the spec implies. The task in brackets owns its test.

1. A refresh or closed tab in the middle of a match: the page resumes the same match with the clock still correct. (Task 7)
2. A save whose reply is lost after Foundry stored it: the retry does not create a second report. (Task 9)
3. Phone storage is blocked or full: the scout can still finish and save the match, and sees a warning. (Task 7)
4. Taps in the wrong order (a count with no square, a square with no mode, undo with nothing to undo): nothing is recorded and nothing breaks. (Task 5)
5. A hand-typed qualification match 3 must not be linked to playoff match 3, and a team number that Foundry does not know still saves. (Task 9)

## File Structure

```
scout-app/
  src/
    client.ts            OSDK client and sign-in (from the template)
    field.ts             field settings by fieldKey, square naming, flip
    clock.ts             match-clock seconds, phases, skip to teleop
    live.ts              live-screen state: mode, square, taps, undo
    taps.ts              Tap type, checks, conversion to four lists
    autoPath.ts          path simplify and text format, ported
    storage.ts           draft match and save queue in localStorage
    schedule.ts          pick the current event and next match
    api.ts               every Foundry read and write
    sync.ts              flush the save queue, link hand-typed reports
    observation.ts       build an observation from a draft
    App.tsx              which screen is showing
    screens/SetupScreen.tsx
    screens/LiveScreen.tsx
    screens/FinalScreen.tsx
    screens/ReportsScreen.tsx
    components/FieldPicture.tsx
    components/Grid.tsx
    components/AutoPathPad.tsx
    app.css
  src/*.test.ts          one test file beside each logic module
```

Suggested workers: Tasks 4 to 9 are clear-spec logic and suit codex. Tasks 10 to 13 are screens a scout uses and need a model with taste of 7 or more.

---

### Task 1: Developer Console app and hosting (gate)

Nothing else starts until this passes. It answers the spec's first check.

**Files:** none.

- [ ] **Step 1: Harry: create the app.** In Foundry, open Developer Console, choose **+ New application**, choose **Client-facing application** (not Backend service), name it `Lebob Scout`. When asked, choose **Yes, generate an Ontology SDK** and add object types Team, Match, Presence and Event from the Lebob Ontology. Generate the first SDK version.
- [ ] **Step 2: Harry: request hosting.** In the app, open **Website hosting** and request an address (suggest `lebob-scout`). If the Website hosting option is missing or the request is refused, stop the plan here and tell the author. The design depends on it.
- [ ] **Step 3: Harry: send back** the application RID, the client ID, the hosted address, and the prefilled `npm create @osdk/app` command shown on the app's Overview page.
- [ ] **Step 4: Verify.** Call `mcp__palantir-mcp__view_osdk_definition` with the application RID. Expected: it lists Team, Match, Presence and Event. An error saying no SDK package is configured means Step 1 is incomplete.

### Task 2: Ontology for Match Observation

**Files:** none on disk. All work is in Foundry on a branch.

**Interfaces:**
- Produces: object type `MatchObservation`, actions `create-match-observation` and `modify-match-observation`, links `team`, `match`, `presence` on MatchObservation and `matchObservations` on the other side. Later tasks use these names through the generated SDK.

- [ ] **Step 1: Create the project.** Use `list_foundry_project_templates` and `search_foundry_projects` to find the namespace of `/Lebob-7db4f1`, then `create_foundry_project` named `Lebob Scout App`. Record the project RID.
- [ ] **Step 2: Create a branch.** `create_global_branch` on the ontology, display name `match-observation`. Record `globalBranchRid` and pass it to every call below.
- [ ] **Step 3: Create the object type** with `create_or_update_foundry_object_type`, location the new project, primary key `observation_id`, title property `label`.
  - Properties: every row of the spec's Match Observation table, plus `label` (string). `propertyTypeId` is the snake_case form of the spec name (`tapSeconds` becomes `tap_seconds`), `apiName` is the spec name.
  - Types: lists are `{type:"array", array:{type:"double"|"string"|"integer"}}`. `autoNotes` and `notes` are strings with `isLongText: true`.
  - Nullable: only what the spec marks optional. All others are not nullable.
  - First try with `backingDataset` omitted. If Foundry rejects that, create a dataset in the new project with `create_and_write_to_foundry_dataset` from a header-only CSV holding only `observation_id`, map the primary key to that column, and map every other property as `{type:"editOnly"}`.
- [ ] **Step 4: Create three link types** with `create_or_update_foundry_link_type`, each one-to-many into MatchObservation: Team by `teamUuid`, Match by `matchUuid`, Presence by `presenceUuid`. Use `view_foundry_object_type` to get the existing types' ids and key properties. API names: `team`, `match`, `presence` on the MatchObservation side, `matchObservations` on the other.
- [ ] **Step 5: Create the actions** with `create_or_update_foundry_action_type`, both in the new project.
  - `create-match-observation`: rule `modifyObject` with `modification: "add"` and all properties as parameters.
  - `modify-match-observation`: rule `modifyObject` with `modification: "modify"` and only these properties as parameters: `match_uuid`, `presence_uuid`, `team_uuid`, `match_number`, `match_type`, `team_number`, `alliance`, `label`, `auto_leave`, `auto_park`, `teleop_park`, `broke_down`, `minor_fouls`, `major_fouls`, `driver_skill`, `robot_speed`, `auto_notes`, `notes`, `auto_path_points`, `updated_at`.
- [ ] **Step 6: Verify on the branch.** `view_foundry_object_type` and `view_foundry_action_type` for each new resource. Expected: 32 properties on the object type (the spec's 31 plus `label`), four of them arrays; the modify action has no `tap_*` parameter.
- [ ] **Step 7: Open a proposal** with `create_global_proposal`. **Harry:** approve and merge it in Foundry.
- [ ] **Step 8: Add to the SDK.** `create_or_update_ontology_sdk_version` for the Task 1 application, marking the object type, three link types and two action types as `"CREATED"`. If the tool cannot add resources to the app, **Harry:** add them under the app's resources and generate a new SDK version.
- [ ] **Step 9: Verify.** `view_osdk_definition` lists MatchObservation, both actions and the three links.

### Task 3: Scaffold, sign in, and prove the save from a phone (gate)

This answers the spec's second and third checks before any real page is built.

**Files:**
- Create: `scout-app/` (from the template), `.gitignore`
- Create: `scout-app/src/spike.ts` (deleted in Task 14)

**Interfaces:**
- Produces: `scout-app/src/client.ts` exporting the OSDK `client`; working `npm run dev`, `npm run build`, `npm run test` in `scout-app/`.

- [ ] **Step 1: Init the repo.** `git init` in the repo root. `.gitignore` holds `node_modules`, `dist`, `.env*.local`, `.npmrc`.
- [ ] **Step 2: Scaffold.** With `FOUNDRY_TOKEN` exported, run the prefilled `npm create @osdk/app@latest` command from Task 1, choosing the React template and the directory name `scout-app`. Then `mcp__palantir-mcp__install_sdk_package` for the latest SDK version.
- [ ] **Step 3: Tests.** If `scout-app/package.json` has no working `test` script, add Vitest (`npm i -D vitest`) and set `"test": "vitest run"`. Run `npm run test`. Expected: exits 0.
- [ ] **Step 4: Harry: allow local development.** Run `npm run dev` and note the port it prints. Harry adds `http://localhost:<port>/auth/callback` to the app's redirect URLs, adds `http://localhost:<port>` to CORS in Control Panel, and confirms the hosted redirect URL is `https://<hosted address>/auth/callback`.
- [ ] **Step 5: Write the spike.** `spike.ts` exports `saveSpike(): Promise<string>`. It applies `create-match-observation` with a random `observationId`, `label: "SPIKE"`, `eventUuid: "spike"`, `matchNumber: 0`, `teamNumber: 0`, placeholder values for every other required property, and four lists of 80 entries each, then reads the object back by primary key and returns `"ok 80"` if `tapSeconds.length === 80`. It then calls `saveSpike` a second time with the same id and returns what Foundry does with a repeated primary key (error name and message). Show the results in a button on the template's home page.
- [ ] **Step 6: Deploy.** `npm run build`, then run `npx @osdk/cli site deploy --help` and deploy with it. If the CLI route fails, zip the contents of `dist/` and **Harry:** upload it under Website hosting and deploy to production.
- [ ] **Step 7: Verify on a phone.** Harry opens the hosted address on a phone using mobile data, signs in and taps the button. Expected: `ok 80`. Record the repeated-key error name in this plan under Task 9 for reference. If sign-in or the save fails, stop and report.
- [ ] **Step 8: Clean up the spike rows.** Report the spike `observationId`s to Harry so he can delete them in Foundry. There is no delete action by design.
- [ ] **Step 9: Commit.** `git add -A && git commit -m "Scaffold scout app and prove save from phone"`

### Task 4: Field settings and match clock

**Files:**
- Create: `scout-app/src/field.ts`, `scout-app/src/clock.ts`
- Test: `scout-app/src/field.test.ts`, `scout-app/src/clock.test.ts`

**Interfaces:**
- Produces:
  - `type Field = { key: string; cols: number; rows: number; auto: number; changeover: number; teleop: number; endgame: number }`
  - `FIELDS: Record<string, Field>`, `CURRENT_FIELD_KEY = "ftc-2026"`
  - `squareName(col: number, row: number): string` (0-based in, `"A1"` out)
  - `flipSquare(square: string, field: Field): string` (half-turn of the grid)
  - `isSquare(square: string, field: Field): boolean`
  - `type Phase = "auto" | "changeover" | "teleop" | "endgame" | "over"`
  - `matchSeconds(startedAtMs: number, nowMs: number): number` (one decimal place)
  - `phaseAt(seconds: number, field: Field): { phase: Phase; remaining: number }`
  - `skipToTeleop(nowMs: number, field: Field): number` (the new `startedAtMs`)

- [ ] **Step 1: Write the failing tests.**

```ts
const f = FIELDS["ftc-2026"];
test("squares", () => {
  expect(squareName(0, 0)).toBe("A1");
  expect(squareName(5, 5)).toBe("F6");
  expect(flipSquare("A1", f)).toBe("F6");
  expect(flipSquare("C4", f)).toBe("D3");
  expect(isSquare("F6", f)).toBe(true);
  expect(isSquare("G1", f)).toBe(false);
  expect(isSquare("A7", f)).toBe(false);
});
test("phases", () => {
  expect(phaseAt(0, f)).toEqual({ phase: "auto", remaining: 30 });
  expect(phaseAt(30, f)).toEqual({ phase: "changeover", remaining: 8 });
  expect(phaseAt(38, f)).toEqual({ phase: "teleop", remaining: 120 });
  expect(phaseAt(98, f)).toEqual({ phase: "endgame", remaining: 60 });
  expect(phaseAt(158, f)).toEqual({ phase: "over", remaining: 0 });
  expect(phaseAt(200, f).phase).toBe("over");
});
test("clock", () => {
  expect(matchSeconds(1000, 13_340)).toBe(12.3);
  expect(skipToTeleop(100_000, f)).toBe(62_000);
});
```

- [ ] **Step 2: Run** `npm run test -- field clock`. Expected: FAIL, modules not found.
- [ ] **Step 3: Implement** both modules to the signatures above. `remaining` is seconds left in the current phase, and for endgame it is seconds left in the match.
- [ ] **Step 4: Run** the tests. Expected: PASS.
- [ ] **Step 5: Commit.** `git commit -am "Add field settings and match clock"`

### Task 5: Taps and live-screen state

**Files:**
- Create: `scout-app/src/taps.ts`, `scout-app/src/live.ts`
- Test: `scout-app/src/taps.test.ts`, `scout-app/src/live.test.ts`

**Interfaces:**
- Consumes: `Field`, `isSquare` from Task 4.
- Produces:
  - `type Kind = "shoot" | "intake"`
  - `type Tap = { seconds: number; square: string; kind: Kind; count: number }`
  - `type TapLists = { tapSeconds: number[]; tapSquares: string[]; tapKinds: string[]; tapCounts: number[] }`
  - `toLists(taps: Tap[]): TapLists`
  - `checkTaps(taps: Tap[], field: Field): string[]` (empty when valid, else one message per problem)
  - `type LiveState = { mode: Kind | null; square: string | null; taps: Tap[] }`
  - `type LiveAction = { type: "mode"; mode: Kind } | { type: "square"; square: string } | { type: "count"; count: number; seconds: number } | { type: "undo" }`
  - `liveReducer(state: LiveState, action: LiveAction): LiveState`
  - `emptyLive: LiveState`

- [ ] **Step 1: Write the failing tests.**

```ts
const f = FIELDS["ftc-2026"];
const run = (...a: LiveAction[]) => a.reduce(liveReducer, emptyLive);
test("a record is mode, square, count", () => {
  const s = run({ type: "mode", mode: "shoot" }, { type: "square", square: "C4" }, { type: "count", count: 3, seconds: 12.3 });
  expect(s.taps).toEqual([{ seconds: 12.3, square: "C4", kind: "shoot", count: 3 }]);
  expect(s.mode).toBe("shoot");   // mode stays
  expect(s.square).toBeNull();    // square clears
});
test("out-of-order taps record nothing", () => {
  expect(run({ type: "count", count: 2, seconds: 1 }).taps).toEqual([]);
  expect(run({ type: "square", square: "A1" }).square).toBeNull();
  expect(run({ type: "mode", mode: "intake" }, { type: "count", count: 2, seconds: 1 }).taps).toEqual([]);
  expect(run({ type: "undo" })).toEqual(emptyLive);
});
test("changing mode clears the square", () => {
  expect(run({ type: "mode", mode: "shoot" }, { type: "square", square: "A1" }, { type: "mode", mode: "intake" }).square).toBeNull();
});
test("undo removes the last record", () => {
  const s = run({ type: "mode", mode: "intake" }, { type: "square", square: "A1" }, { type: "count", count: 1, seconds: 5 },
    { type: "square", square: "B2" }, { type: "count", count: 4, seconds: 9 }, { type: "undo" });
  expect(s.taps.map(t => t.square)).toEqual(["A1"]);
});
test("lists stay in step", () => {
  const taps: Tap[] = [{ seconds: 5, square: "A1", kind: "intake", count: 1 }, { seconds: 9, square: "B2", kind: "shoot", count: 4 }];
  expect(toLists(taps)).toEqual({ tapSeconds: [5, 9], tapSquares: ["A1", "B2"], tapKinds: ["intake", "shoot"], tapCounts: [1, 4] });
  expect(checkTaps(taps, f)).toEqual([]);
});
test("bad taps are reported", () => {
  expect(checkTaps([{ seconds: 5, square: "Z9", kind: "shoot", count: 1 }], f)).toHaveLength(1);
  expect(checkTaps([{ seconds: 5, square: "A1", kind: "shoot", count: 0 }], f)).toHaveLength(1);
  expect(checkTaps([{ seconds: 5, square: "A1", kind: "shoot", count: 5 }], f)).toHaveLength(1);
  expect(checkTaps([{ seconds: -1, square: "A1", kind: "shoot", count: 1 }], f)).toHaveLength(1);
});
```

- [ ] **Step 2: Run** `npm run test -- taps live`. Expected: FAIL.
- [ ] **Step 3: Implement** both modules. A `count` action outside 1 to 4 is ignored.
- [ ] **Step 4: Run** the tests. Expected: PASS.
- [ ] **Step 5: Commit.** `git commit -am "Add tap recording and live state"`

### Task 6: Auto path format

**Files:**
- Create: `scout-app/src/autoPath.ts`
- Test: `scout-app/src/autoPath.test.ts`

**Interfaces:**
- Produces:
  - `type Stroke = [number, number][]` (points on the 0 to 100 grid frame)
  - `PATH_MAX = 30`
  - `simplifyPath(strokes: Stroke[]): Stroke[]`
  - `encPath(strokes: Stroke[]): string | null`
  - `decPath(text: string | null): Stroke[]`
  - `clamp100(fraction: number): number` (0 to 1 in, integer 0 to 100 out)

- [ ] **Step 1: Write the failing tests.**

```ts
test("text format matches the current site", () => {
  expect(encPath([[[0, 50], [20, 50]], [[20, 50], [20, 80]]])).toBe("0,50 20,50|20,50 20,80");
  expect(encPath([])).toBeNull();
  expect(decPath("0,50 20,50|20,50 20,80")).toEqual([[[0, 50], [20, 50]], [[20, 50], [20, 80]]]);
  expect(decPath(null)).toEqual([]);
  expect(decPath("junk")).toEqual([]);
});
test("a long stroke is cut to 30 points and keeps its ends", () => {
  const long: Stroke = Array.from({ length: 200 }, (_, i) => [i / 2, 50 + 10 * Math.sin(i / 5)]);
  const out = simplifyPath([long]);
  expect(out.flat().length).toBeLessThanOrEqual(30);
  expect(out[0][0]).toEqual(long[0]);
  expect(out[0].at(-1)).toEqual(long.at(-1));
});
test("clamp", () => {
  expect(clamp100(-0.2)).toBe(0);
  expect(clamp100(0.5)).toBe(50);
  expect(clamp100(1.3)).toBe(100);
});
```

- [ ] **Step 2: Run** `npm run test -- autoPath`. Expected: FAIL.
- [ ] **Step 3: Port** `rdp`, `simplifyPath`, `encPath`, `decPath` and `clamp100` from `reference/lebob-scout-site.html` lines 1543 and 1546 to 1567, adding types. Keep the behaviour identical.
- [ ] **Step 4: Run** the tests. Expected: PASS.
- [ ] **Step 5: Commit.** `git commit -am "Port auto path format from the current site"`

### Task 7: Phone storage for the draft match and the save queue

**Files:**
- Create: `scout-app/src/storage.ts`, `scout-app/src/observation.ts`
- Test: `scout-app/src/storage.test.ts`, `scout-app/src/observation.test.ts`

**Interfaces:**
- Consumes: `Tap`, `toLists`, `checkTaps`, `Field`.
- Produces:
  - `type Target = { eventUuid: string; matchUuid: string | null; presenceUuid: string | null; teamUuid: string | null; matchNumber: number; matchType: "qualification" | "playoff"; teamNumber: number; alliance: "red" | "blue" }`
  - `type FinalPage = { autoLeave: boolean; autoPark: boolean; teleopPark: boolean; brokeDown: boolean; minorFouls: number; majorFouls: number; driverSkill: number | null; robotSpeed: number | null; autoNotes: string | null; notes: string | null; autoPathPoints: string | null }`
  - `type Draft = Target & { observationId: string; fieldKey: string; startSquare: string; startedAtMs: number; taps: Tap[]; flipped: boolean; stage: "live" | "final"; final: FinalPage }`
  - `type Observation = Target & FinalPage & TapLists & { observationId: string; label: string; scoutUserId: string; scoutName: string; createdAt: string; updatedAt: string; timerStartedAt: string; fieldKey: string; startSquare: string }` (timestamps as ISO strings)
  - `labelFor(t: Pick<Target, "matchType" | "matchNumber" | "teamNumber">): string` (`"Q12 · 29550"`, `"P3 · 29550"`)
  - `buildObservation(draft: Draft, user: { id: string; name: string }, nowMs: number): Observation` (throws if `checkTaps` reports problems)
  - `type Pending = { observation: Observation; attempts: number }`
  - `createStore(backing?: Storage)` returning `{ ok: boolean; loadDraft(): Draft | null; saveDraft(d: Draft): void; clearDraft(): void; pending(): Pending[]; enqueue(o: Observation): void; bump(id: string): void; remove(id: string): void }`
  - `type Store = ReturnType<typeof createStore>`
  - Storage keys: `lsa:draft`, `lsa:outbox`.

- [ ] **Step 1: Write the failing tests.** Use a `Map`-backed fake `Storage` and a second fake whose `setItem` throws. The helpers `draft(overrides)`, `tap(seconds)` and `obs(id, overrides?)` build valid values and live in `scout-app/src/testHelpers.ts`, shared with Task 9.

```ts
test("a draft survives a reload with its start time", () => {
  const backing = fakeStorage();
  createStore(backing).saveDraft(draft({ startedAtMs: 1_000_000, taps: [tap(12.3)] }));
  const d = createStore(backing).loadDraft()!;       // a new store is a page reload
  expect(d.startedAtMs).toBe(1_000_000);
  expect(matchSeconds(d.startedAtMs, 1_045_000)).toBe(45);
  expect(d.taps).toHaveLength(1);
});
test("blocked storage does not throw and still holds the match in memory", () => {
  const s = createStore(throwingStorage());
  expect(s.ok).toBe(false);
  s.saveDraft(draft({}));
  expect(s.loadDraft()).not.toBeNull();
  s.enqueue(obs("a"));
  expect(s.pending()).toHaveLength(1);
});
test("corrupt stored text is treated as empty", () => {
  const backing = fakeStorage({ "lsa:draft": "{not json", "lsa:outbox": "42" });
  const s = createStore(backing);
  expect(s.loadDraft()).toBeNull();
  expect(s.pending()).toEqual([]);
});
test("queue", () => {
  const s = createStore(fakeStorage());
  s.enqueue(obs("a")); s.enqueue(obs("b")); s.bump("a"); s.remove("b");
  expect(s.pending()).toEqual([{ observation: obs("a"), attempts: 1 }]);
});
test("observation", () => {
  const o = buildObservation(draft({ startedAtMs: 1_000_000, taps: [tap(12.3)], matchType: "qualification", matchNumber: 12, teamNumber: 29550 }), { id: "u1", name: "Sam Scout" }, 1_200_000);
  expect(o.label).toBe("Q12 · 29550");
  expect(o.tapSeconds).toEqual([12.3]);
  expect(o.timerStartedAt).toBe(new Date(1_000_000).toISOString());
  expect(o.createdAt).toBe(new Date(1_200_000).toISOString());
  expect(o.scoutUserId).toBe("u1");
  expect(() => buildObservation(draft({ taps: [{ seconds: 1, square: "Z9", kind: "shoot", count: 1 }] }), { id: "u1", name: "x" }, 0)).toThrow();
});
```

- [ ] **Step 2: Run** `npm run test -- storage observation`. Expected: FAIL.
- [ ] **Step 3: Implement.** `createStore` defaults to `window.localStorage`, keeps an in-memory copy of both values, and sets `ok` to false after the first read or write that throws.
- [ ] **Step 4: Run** the tests. Expected: PASS.
- [ ] **Step 5: Commit.** `git commit -am "Keep the draft match and save queue on the phone"`

### Task 8: Foundry reads and writes, and schedule defaults

**Files:**
- Create: `scout-app/src/api.ts`, `scout-app/src/schedule.ts`
- Test: `scout-app/src/schedule.test.ts`

**Interfaces:**
- Consumes: `client` from Task 3, `Observation`, `Target`, `FinalPage`.
- Produces:
  - `type EventRow = { eventUuid: string; eventCode: string; eventName: string; dateStart: string; dateEnd: string }`
  - `type MatchRow = { matchUuid: string; matchNumber: number; matchType: "qualification" | "playoff"; scheduledTime: string | null; actualTime: string | null }`
  - `type PresenceRow = { presenceUuid: string; matchUuid: string; teamUuid: string; teamNumber: number; alliance: "red" | "blue"; station: number }`
  - `type Patch = Partial<Omit<Target, "eventUuid"> & FinalPage> & { label?: string }`
  - `type Api = { currentUser(): Promise<{ id: string; name: string }>; ourEvents(): Promise<EventRow[]>; matches(eventUuid: string): Promise<MatchRow[]>; presences(matchUuid: string): Promise<PresenceRow[]>; findPresence(eventUuid: string, matchType: string, matchNumber: number, teamNumber: number): Promise<PresenceRow | null>; findTeamUuid(teamNumber: number): Promise<string | null>; exists(observationId: string): Promise<boolean>; create(o: Observation): Promise<void>; modify(observationId: string, patch: Patch, nowMs: number): Promise<void>; observations(eventUuid: string): Promise<Observation[]> }`
  - `api: Api` (the real one)
  - `pickEvent(events: EventRow[], todayIso: string): EventRow | null`
  - `pickMatch(matches: MatchRow[]): MatchRow | null`

- [ ] **Step 1: Write the failing tests** for the two pure functions.

```ts
const ev = (code: string, a: string, b: string): EventRow => ({ eventUuid: code, eventCode: code, eventName: code, dateStart: a, dateEnd: b });
test("pickEvent", () => {
  const es = [ev("past", "2026-10-01", "2026-10-02"), ev("now", "2026-11-24", "2026-11-26"), ev("next", "2026-12-10", "2026-12-11")];
  expect(pickEvent(es, "2026-11-25")!.eventCode).toBe("now");        // running today
  expect(pickEvent(es, "2026-12-01")!.eventCode).toBe("next");       // else the next to start
  expect(pickEvent(es, "2027-01-01")!.eventCode).toBe("next");       // else the most recent
  expect(pickEvent([], "2026-11-25")).toBeNull();
});
const m = (n: number, type: "qualification" | "playoff", played: boolean): MatchRow => ({ matchUuid: type + n, matchNumber: n, matchType: type, scheduledTime: null, actualTime: played ? "x" : null });
test("pickMatch", () => {
  expect(pickMatch([m(2, "qualification", false), m(1, "qualification", true), m(1, "playoff", false)])!.matchUuid).toBe("qualification2");
  expect(pickMatch([m(1, "qualification", true), m(1, "playoff", false)])!.matchUuid).toBe("playoff1");
  expect(pickMatch([m(1, "qualification", true), m(2, "qualification", true)])!.matchUuid).toBe("qualification2");
  expect(pickMatch([])).toBeNull();
});
```

- [ ] **Step 2: Run** `npm run test -- schedule`. Expected: FAIL.
- [ ] **Step 3: Implement `schedule.ts`.** Matches are ordered qualification before playoff, then by match number. `pickMatch` returns the first with no `actualTime`, else the last.
- [ ] **Step 4: Implement `api.ts`** against the generated SDK. Use `mcp__palantir-mcp__get_ontology_sdk_examples` for the exact call shapes.
  - `ourEvents`: Event where `ourEvent` is true.
  - `findPresence`: Match where `eventUuid`, `matchType` and `matchNumber` all match, then its `presences` where `teamNumber` matches. Null when either step finds nothing.
  - `exists`: `where({ observationId: { $eq: id } }).fetchPage({ $pageSize: 1 })`, true when a row comes back. Do not rely on a not-found error.
  - `create` and `modify`: `client(action).applyAction(...)`. `modify` sets `updatedAt` from `nowMs`. Both let errors throw.
  - `observations`: where `eventUuid` matches, newest first, following `$nextPageToken` until done.
  - `currentUser`: `getCurrent` from `@osdk/foundry.admin`, name is `givenName` and `familyName` joined, falling back to `username`. If the sign-in scope lacks `api:admin-read`, add it in `client.ts` and **Harry:** enable it on the app.
- [ ] **Step 5: Run** `npm run test` and `npm run build`. Expected: both pass with no type errors.
- [ ] **Step 6: Commit.** `git commit -am "Add Foundry reads and writes and schedule defaults"`

### Task 9: Save queue flush and linking hand-typed reports

**Files:**
- Create: `scout-app/src/sync.ts`
- Test: `scout-app/src/sync.test.ts`

**Interfaces:**
- Consumes: `Api`, `Pending`, the store from Task 7, `labelFor`.
- Produces:
  - `flush(api: Pick<Api, "exists" | "create">, store: Store): Promise<{ saved: number; waiting: number }>`
  - `linkUnlinked(api: Pick<Api, "observations" | "findPresence" | "modify">, eventUuid: string, nowMs: number): Promise<number>` (number linked)

- [ ] **Step 1: Write the failing tests** with a hand-written fake `Api` that records calls.

```ts
test("a good save leaves the queue empty", async () => {
  const s = storeWith(obs("a")); const api = fake({});
  expect(await flush(api, s)).toEqual({ saved: 1, waiting: 0 });
  expect(api.calls).toEqual(["create a"]);          // no exists check on a first attempt
});
test("a failed save stays queued", async () => {
  const s = storeWith(obs("a")); const api = fake({ createThrows: true });
  expect(await flush(api, s)).toEqual({ saved: 0, waiting: 1 });
  expect(s.pending()[0].attempts).toBe(1);
});
test("a lost reply does not create a second report", async () => {
  const s = storeWith(obs("a")); const api = fake({ createThrows: true });
  await flush(api, s);                               // Foundry stored it, the reply was lost
  api.createThrows = false; api.existing.add("a");
  expect(await flush(api, s)).toEqual({ saved: 1, waiting: 0 });
  expect(api.calls).toEqual(["create a", "exists a"]);   // no second create
});
test("one failure does not block the rest", async () => {
  const s = storeWith(obs("a"), obs("b")); const api = fake({ createThrowsFor: "a" });
  expect(await flush(api, s)).toEqual({ saved: 1, waiting: 1 });
});
test("hand-typed reports are linked once the match exists", async () => {
  const api = fake({ observations: [obs("a", { matchUuid: null, presenceUuid: null, teamUuid: null, matchType: "qualification", matchNumber: 3, teamNumber: 29550 })],
    presence: { key: "qualification 3 29550", row: { presenceUuid: "p", matchUuid: "m", teamUuid: "t", teamNumber: 29550, alliance: "red", station: 1 } } });
  expect(await linkUnlinked(api, "e", 5)).toBe(1);
  expect(api.modified).toEqual([["a", { matchUuid: "m", presenceUuid: "p", teamUuid: "t", alliance: "red" }]]);
});
test("qualification 3 is not linked to playoff 3, and linked reports are left alone", async () => {
  const api = fake({ observations: [obs("a", { matchUuid: null, matchType: "playoff", matchNumber: 3, teamNumber: 29550 }), obs("b", { matchUuid: "m" })],
    presence: { key: "qualification 3 29550", row: anyPresence } });
  expect(await linkUnlinked(api, "e", 5)).toBe(0);
  expect(api.modified).toEqual([]);
});
```

- [ ] **Step 2: Run** `npm run test -- sync`. Expected: FAIL.
- [ ] **Step 3: Implement.** `flush` handles each pending item in turn: when `attempts > 0` it calls `exists` first and removes the item if true; otherwise it calls `create`, removes on success and bumps `attempts` on failure. `linkUnlinked` ignores reports whose `matchUuid` is set and swallows a failure on one report so the others still link.
- [ ] **Step 4: Run** the tests. Expected: PASS.
- [ ] **Step 5: Commit.** `git commit -am "Flush the save queue safely and link hand-typed reports"`

### Task 10: Set-up screen

**Files:**
- Create: `scout-app/src/screens/SetupScreen.tsx`, `scout-app/src/components/FieldPicture.tsx`, `scout-app/src/components/Grid.tsx`, `scout-app/src/app.css`

**Interfaces:**
- Consumes: `api`, `pickEvent`, `pickMatch`, `Target`, `Field`, `squareName`, `flipSquare`.
- Produces:
  - `FieldPicture({ fieldKey, flipped }: { fieldKey: string; flipped: boolean })`: the demo's SVG, rotated a half-turn when flipped.
  - `Grid({ field, flipped, selected, onPick, disabled }: { field: Field; flipped: boolean; selected: string | null; onPick(square: string): void; disabled?: boolean })`: reports stored (unflipped) square names.
  - `SetupScreen({ onStart }: { onStart(target: Target, startSquare: string, flipped: boolean): void })`

- [ ] **Step 1: Build `FieldPicture` and `Grid`** from `ftc-scouting-demo.html` (the `<svg viewBox="0 0 320 240">` block and the `#grid` rules). The grid covers the middle 75% of the picture's width, as in the demo.
- [ ] **Step 2: Build `SetupScreen`.** In order: event (defaulted by `pickEvent`, changeable, remembered in localStorage key `lsa:event`), match (defaulted by `pickMatch`), the four robots as buttons in alliance colours showing team number, a Flip field button, the grid for the start square, and Start. Start is disabled until a robot and a start square are chosen.
- [ ] **Step 3: Add the hand-typed path.** A "Match not listed" link shows match number, team number, alliance and qualification or playoff inputs. On Start it calls `api.findTeamUuid` and builds a `Target` with `matchUuid` and `presenceUuid` null. A team number Foundry does not know still starts, with `teamUuid` null.
- [ ] **Step 4: Verify.** `npm run build` passes. On the dev server, signed in: the current event and next match are preselected, picking a robot and a square enables Start, and the hand-typed path enables Start with match 99 and team 29550.
- [ ] **Step 5: Commit.** `git commit -am "Add set-up screen"`

### Task 11: Live screen

**Files:**
- Create: `scout-app/src/screens/LiveScreen.tsx`
- Modify: `scout-app/src/app.css`

**Interfaces:**
- Consumes: `liveReducer`, `emptyLive`, `matchSeconds`, `phaseAt`, `skipToTeleop`, `Grid`, `FieldPicture`, `Draft`, the store.
- Produces: `LiveScreen({ draft, onChange, onEnd }: { draft: Draft; onChange(d: Draft): void; onEnd(): void })`. It calls `onChange` after every record, undo, flip and skip, so the caller can write the draft to the phone.

- [ ] **Step 1: Build the layout** from the spec's sketch: Shoot, Intake and Undo on the left, the field with the grid in the middle, 1 to 4 on the right, the clock and End match along the bottom. The count buttons are labelled "scored" in Shoot mode and "picked up" in Intake mode. Buttons are at least 48 px tall.
- [ ] **Step 2: Wire the state.** Taps come from `draft.taps`, mode and square are local. A count calls the reducer with `matchSeconds(draft.startedAtMs, Date.now())`. Count buttons are disabled until a mode and a square are chosen.
- [ ] **Step 3: Clock.** Re-render four times a second from `Date.now()`, never by counting ticks. Show the phase name and `m:ss` remaining. Show Skip to teleop only during auto and changeover. It replaces `draft.startedAtMs` with `skipToTeleop(Date.now(), field)`.
- [ ] **Step 4: Phone behaviour.** Request `navigator.wakeLock.request("screen")` while the screen is shown and again on `visibilitychange`, ignoring failures. In portrait, show a "Turn your phone sideways" message over the screen. Set `touch-action: manipulation` on buttons. End match asks for confirmation if the phase is not `over`.
- [ ] **Step 5: Verify.** `npm run build` passes. On the dev server in a phone-sized landscape window: record shoot C4 ×3 and intake A1 ×2, undo once, reload the page, and confirm one record remains and the clock has kept running. Skip to teleop shows TELEOP 2:00.
- [ ] **Step 6: Commit.** `git commit -am "Add live screen"`

### Task 12: Final page and auto path drawing

**Files:**
- Create: `scout-app/src/screens/FinalScreen.tsx`, `scout-app/src/components/AutoPathPad.tsx`

**Interfaces:**
- Consumes: `simplifyPath`, `encPath`, `decPath`, `clamp100`, `Stroke`, `FieldPicture`, `FinalPage`.
- Produces:
  - `AutoPathPad({ fieldKey, flipped, value, onChange }: { fieldKey: string; flipped: boolean; value: string | null; onChange(text: string | null): void })`
  - `FinalScreen({ value, onChange, onSave, saveLabel, fieldKey, flipped }: { value: FinalPage; onChange(f: FinalPage): void; onSave(): void; saveLabel: string; fieldKey: string; flipped: boolean })`

- [ ] **Step 1: Build `AutoPathPad`.** Pointer events on the grid area draw strokes. Points are `clamp100` of the pointer's position as a fraction of the grid area, un-flipped before storing so the stored frame is always red wall at x 0. On each stroke end it calls `onChange(encPath(simplifyPath(strokes)))`. It has Undo (last stroke) and Clear. It draws `decPath(value)` when given an existing path.
- [ ] **Step 2: Build `FinalScreen`.** Yes or no toggles for auto leave, auto park, teleop park and broke down. Steppers for minor and major fouls, never below 0. Driver skill and robot speed as five buttons each, labelled as on the current site ("1 = struggled, 5 = excellent", "1 = slow, 5 = very fast"), tappable again to clear. Auto notes and notes as text areas. The path pad. A Save button showing `saveLabel`.
- [ ] **Step 3: Verify.** `npm run build` passes. On the dev server: draw two strokes, see the text update, flip the field and confirm the same strokes appear rotated with the stored text unchanged.
- [ ] **Step 4: Commit.** `git commit -am "Add final page and auto path drawing"`

### Task 13: Reports list and corrections

**Files:**
- Create: `scout-app/src/screens/ReportsScreen.tsx`

**Interfaces:**
- Consumes: `api.observations`, `api.modify`, `api.matches`, `api.presences`, `labelFor`, `FinalScreen`, `Patch`.
- Produces: `ReportsScreen({ eventUuid, userId, waiting, onNew }: { eventUuid: string; userId: string; waiting: number; onNew(): void })`

- [ ] **Step 1: Build the list.** Reports for the event, the signed-in scout's first, then newest first. Each row shows the label, alliance, scout name and tap count, and an "unlinked" tag when `matchUuid` is null. A banner shows "`waiting` reports waiting to save" when `waiting > 0`. A New match button calls `onNew`.
- [ ] **Step 2: Build the correction view.** Opening any report shows the match and robot pickers from set-up (preset to its values) and `FinalScreen` filled from the report. Save calls `api.modify` with the changed fields, a new `label` from `labelFor`, and nothing from the tap lists. A failed save shows the error and keeps the form.
- [ ] **Step 3: Verify.** `npm run build` passes. On the dev server: open a saved report, change the team and a note, save, reload, and confirm both changed and the tap count did not.
- [ ] **Step 4: Commit.** `git commit -am "Add reports list and corrections"`

### Task 14: Wire the screens, deploy and run a match on a phone

**Files:**
- Modify: `scout-app/src/App.tsx` (replace the template home page)
- Delete: `scout-app/src/spike.ts`
- Modify: `scout-app/index.html` (title `Lebob Scout`, `<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">`)

**Interfaces:**
- Consumes: every screen, the store, `flush`, `linkUnlinked`, `buildObservation`, `api.currentUser`.

- [ ] **Step 1: Wire `App`.** On load: read the user, load the draft, and show the live or final screen if a draft exists, else the reports list. Start creates a draft with `crypto.randomUUID()`, `CURRENT_FIELD_KEY` and `startedAtMs: Date.now()`. Every `onChange` writes the draft. End match sets the draft's `stage` to `"final"`. Save on the final page builds the observation, enqueues it, clears the draft, calls `flush`, and shows the reports list.
- [ ] **Step 2: Retry and link.** Call `flush` on load, when the browser fires `online`, and every 30 seconds while anything is waiting. Call `linkUnlinked` once on load after the event is known. Show a warning line when `store.ok` is false: "This phone can't store data. Keep this page open until your report has saved."
- [ ] **Step 3: Run everything.** `npm run test && npm run lint && npm run build`. Expected: all pass.
- [ ] **Step 4: Deploy** the same way as Task 3 Step 6.
- [ ] **Step 5: Harry: share the site.** In the app's Sharing settings, use Share hosted website to add the scouts. Confirm the scouts can view Team, Match, Presence, Event and Match Observation and can run both actions. If a scout sees empty lists or a permission error on save, fix the role on the project that holds the missing resource.
- [ ] **Step 6: Acceptance run on a phone, on mobile data,** against a real or practice match, by Harry or a scout. Every line must hold:
  - The next match and its four robots are offered without typing.
  - A full match can be recorded sideways without looking down for more than a glance.
  - Refreshing the page in the middle of teleop returns to the same match with the right time.
  - Switching to aeroplane mode before Save shows the report as waiting, and it saves by itself within a minute of the signal returning, once only.
  - The saved Match Observation in Foundry has four lists of equal length, squares that match what was tapped, and seconds within the match.
  - A second scout can open that report and correct the team number.
- [ ] **Step 7: Commit.** `git commit -am "Wire screens and ship match scout page"`

---

## Not in this plan

Jobs 2 to 5 from the spec: pit survey and breakage forms, team profiles and coverage grid, the strategist page, and retiring lebob.com.au/scout. Each gets its own design and plan.
