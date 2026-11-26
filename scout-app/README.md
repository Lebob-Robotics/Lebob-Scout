# Lebob Scout

A phone web app for scouting robotics matches. A scout picks the match and robot, taps what the robot does on a field grid during the match, fills in a short final page, and the report is saved to Palantir Foundry. The match in progress and any unsent reports are kept on the phone, so a refresh or a drop in signal loses nothing.

## Running it

```sh
npm install
npm run dev
```

Open http://localhost:5173/?dev=1 to use made-up data held in memory instead of Foundry (development builds only). Add `&fail=1` to make the schedule fail, `&failsave=1` to make corrections fail, `&failcreate=1` to make saving a new report fail, or `&failteams=1` to make the Teams tab fail. In this mode the Teams tab draws from the fixture in `src/devTeamsTab.ts` and makes no Foundry calls.

Without `?dev=1` the app signs in to Foundry with the settings in `.env.development`.

## Checks

```sh
npm run test
npm run lint
npm run build
```

All three must pass with clean output before a commit.

## Deploying

The deploy uses a Foundry token from the `FOUNDRY_TOKEN` environment variable. Keep the token in a file outside the repo (we use `~/.config/lebob-foundry.env`, one line `FOUNDRY_TOKEN=...`) and load it only for the command that needs it. Never commit it, never paste it into a file in this folder, and never put it in the app's code.

```sh
npm run build
set -a; . ~/.config/lebob-foundry.env; set +a; npx @osdk/cli site deploy
```

The version comes from `git describe`, so tag a release (for example `git tag 0.3.1`) before deploying it. The site is served at https://lebob-scout-bat5hxlyj3x7fsqq.apps.euw-3.palantirfoundry.co.uk.

`npm install` also needs the token loaded, since `.npmrc` reads `FOUNDRY_TOKEN` to fetch the SDK from Foundry.

## When the ontology changes

The app talks to Foundry through the generated SDK `@lebob-scout/sdk`. After changing an object type, link type or action the app uses, add it to the app's resources in Developer Console, generate a new SDK version there, then install it with the token loaded for that one command:

```sh
set -a; . ~/.config/lebob-foundry.env; set +a; npm install @lebob-scout/sdk@^<new version>
```

Then update `src/api.ts` to match, and run the checks. `scripts/spike.mjs` is a good place to try a changed action against Foundry first (it writes test rows with `eventUuid` "spike").

## The Teams tab

The Teams tab shows, for the remembered event, which robots still need a report, a profile and map for each team, the match coverage grid and the scouts list. The sums run in Foundry as TypeScript functions, so the strategist's Workshop pages can call the same functions and show the same figures. The app calls `teamsTab` through the SDK (`api.teamsTab` in `src/api.ts`) and draws what comes back.

The first call after a quiet spell can take several seconds, so the app makes one background `teamsTab` call when it opens and ignores the result.

## The functions repository

The functions live in the Foundry repository `lebob-scout-functions`, in the "Lebob Scout App" project (`/Lebob-7db4f1/Lebob Scout App/lebob-scout-functions`). Our local clone sits at `scout-functions/` beside this folder. It is its own git repository, its default branch is `master`, and the app repo ignores it. To get a fresh clone, use Work locally on the repository in Foundry.

The functions each take an `eventUuid` (`matchMaps` also a `matchUuid`):

- `teamsTab`: everything the Teams tab shows (status figures, team profiles, coverage grid, scouts).
- `teamProfiles`: one flat row per team, for Workshop.
- `reportSummaries`: one row of figures per report.
- `scoutTally`: reports per scout, most reports first.
- `fieldMaps`: each team's heatmap (auto and teleop pieces scored and pick-ups per square, per match), for the strategy app.
- `matchMaps`: one match's alliance heatmaps and where the alliances will meet.
- `pointSplits`: each robot's share of its alliance's official score, split by rating.
- `teamCycles`: each team's teleop cycles (shot, collect, travel, shot): cycles per match, mean time in three parts, a map of where they go, the routes used most and every cycle. The rule is at the top of `src/teams/cycles.ts`.

Each function is a short file in `typescript-functions/src/functions/`. The sums are in `typescript-functions/src/teams/` (points values per season in `season.ts`, the Foundry reads in `load.ts`), with their tests in `src/teams/__tests__/`. To test and type check:

```sh
cd scout-functions/typescript-functions
npm test
npm run compile
```

For a first set-up, run `.palantir-scripts/install-rune` then `./rune env prepare` from `scout-functions/`. `rune env prepare` writes the token in plain text into `typescript-functions/.npmrc`; change that line back to `_authToken=${FOUNDRY_TOKEN}` each time.

The clone holds no token. Clone, fetch and push hand it over through a one-off credential helper, with the token loaded:

```sh
git -c credential.helper= -c credential.helper='!f(){ echo username=token; echo "password=$FOUNDRY_TOKEN"; }; f' <clone|push|fetch> ...
```

The clone address is `https://lebob.euw-3.palantirfoundry.co.uk/stemma/git/ri.stemma.main.repository.8254d75d-4849-4e74-ae91-650908735cd8/scout-functions`. Commit with your Foundry user id as the email (Foundry warns on push otherwise).

`rune` does not run on Windows. There, the local stand-ins are: `typescript-functions/.sdk/@ontology/sdk` as a junction to `scout-app/node_modules/@lebob-scout/sdk` (same ontology, same objects), only the public packages installed (`@palantir/functions-sources`, `@palantir/orchestrator` and `@foundry/functions-typescript-runtime` live in Foundry's registry, and our code does not import them), and a git-excluded `vitest.local.config.ts` holding `test: { include: ["src/**/__tests__/**/*.test.ts"] }`. Run the tests with `npx vitest run --config vitest.local.config.ts` and type check with `npx tsc -p src/tsconfig.json --noEmit`. Foundry's own checks build with the real SDK.

## Publishing a function change

1. Edit the function or the sums in `src/teams/`, with a test for the change.
2. Run `npm test` and `npm run compile` in `typescript-functions/`. Both must pass.
3. Commit from `scout-functions/` (Foundry warns on push if the author email is a real address and suggests your Foundry user id instead).
4. Push with the token loaded, through the credential helper above (`... push origin master`).
5. Wait for the "Checks" job on that commit to pass in the repository in Foundry (about a minute).
6. Tag the commit with the next version, either in Foundry (Branches > Tag version) or with `git tag <version>` and a push of the tag through the credential helper. 0.3.0 is the latest. A tag publishes every function in the repository.
7. Wait for the release check to pass (about a minute). Its output lists "Published Functions" with the new version.

Whether a failing test stops the checks has not been tried.

## When a function change needs Developer Console

A change inside a function (its sums or its reads) needs only a new published version. The SDK marks our functions `isFixedVersion: false`, so the app asks Foundry for the latest published version on each call and should pick up the change with no new SDK and no redeploy. We have not yet seen this happen, so open the Teams tab after publishing and check. It also means a published change reaches scouts' phones straight away.

Adding a function, or changing a parameter or the shape of a result, also needs the app updated:

1. Publish the new version as above.
2. Add the function to the scout app's resources in Developer Console (the SDK in use is 0.3.0).
3. Generate a new SDK version there.
4. Bump `@lebob-scout/sdk` in `package.json` and install it with the token loaded, as in "When the ontology changes".
5. Update `src/api.ts` (the result types there come from `teamsTab.ReturnType`), run the checks and deploy.

## Checking the live figures

`scripts/teams-tab-check.mjs` calls `teamsTab` three times through the SDK and prints the timing and counts of each call, then the figures of up to three teams that have a report. It only reads. The event defaults to AUPEQ; pass another event's uuid to change it.

```sh
set -a; . ~/.config/lebob-foundry.env; set +a; node scripts/teams-tab-check.mjs [eventUuid]
```

## Known data problems

Both were open on 25 November 2026. They come from the schedule import in the old project.

- Playoff matches are all stored as match number 1 (AUPEQ has six). Once playoff reports exist, the grid shows six rows labelled P1, a playoff report counts in every P1 row its team is in, and a team's playoff matches merge into one match in its profile. Qualification matches are fine.
- Schedule times look like Perth local time stored as UTC (AUPEQ Q1 is 10:30Z). If so, the Teams tab shows scheduled times 8 hours late and a match counts as played by its scheduled time 8 hours late. A match still counts as played as soon as its actual time is filled.

## A new season

1. Add an entry to `FIELDS` in `src/field.ts` with the new grid size and phase times.
2. Add a picture for it to `PICTURES` in `src/components/FieldPicture.tsx`.
3. Change `CURRENT_FIELD_KEY` in `src/field.ts` to the new key.
4. Keep the old entries. Saved reports carry their field key, and corrections draw them with the old picture.
5. The grid covers the middle 75% of the picture (`inset: 0 12.5%` on `.grid` and `.pad-surface` in `src/app.css`). If the new picture's margins differ, change both.
6. Add the season's points values and auto length to `SEASONS` in `scout-functions/typescript-functions/src/teams/season.ts`, keyed by the new field key, and publish the functions. An unknown key uses the 2026 values.
