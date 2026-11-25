# Lebob Scout

A phone web app for scouting robotics matches. A scout picks the match and robot, taps what the robot does on a field grid during the match, fills in a short final page, and the report is saved to Palantir Foundry. The match in progress and any unsent reports are kept on the phone, so a refresh or a drop in signal loses nothing.

## Running it

```sh
npm install
npm run dev
```

Open http://localhost:5173/?dev=1 to use made-up data held in memory instead of Foundry (development builds only). Add `&fail=1` to make the schedule fail, `&failsave=1` to make corrections fail, or `&failcreate=1` to make saving a new report fail.

Without `?dev=1` the app signs in to Foundry with the settings in `.env.development`.

## Checks

```sh
npm run test
npm run lint
npm run build
```

All three must pass with clean output before a commit.

## Deploying

The deploy uses a Foundry token from the `FOUNDRY_TOKEN` environment variable. Keep the token in a file outside the repo (we use `~/.config/lebob-foundry.env`, one line `FOUNDRY_TOKEN=...`) and load it only for the command that needs it. Never commit it, and never paste it into a file in this folder.

```sh
npm run build
set -a; . ~/.config/lebob-foundry.env; set +a; npx @osdk/cli site deploy
```

The version comes from `git describe`, so tag a release (for example `git tag 0.2.0`) before deploying it. The site is served at https://lebob-scout-bat5hxlyj3x7fsqq.apps.euw-3.palantirfoundry.co.uk.

`npm install` also needs the token loaded, since `.npmrc` reads `FOUNDRY_TOKEN` to fetch the SDK from Foundry.

## When the ontology changes

The app talks to Foundry through the generated SDK `@lebob-scout/sdk`. After changing an object type, link type or action the app uses, add it to the app's resources in Developer Console, generate a new SDK version there, then install it with the token loaded:

```sh
npm install @lebob-scout/sdk@^<new version>
```

Then update `src/api.ts` to match, and run the checks. `scripts/spike.mjs` is a good place to try a changed action against Foundry first (it writes test rows with `eventUuid` "spike").

## A new season

1. Add an entry to `FIELDS` in `src/field.ts` with the new grid size and phase times.
2. Add a picture for it to `PICTURES` in `src/components/FieldPicture.tsx`.
3. Change `CURRENT_FIELD_KEY` in `src/field.ts` to the new key.
4. Keep the old entries. Saved reports carry their field key, and corrections draw them with the old picture.
5. The grid covers the middle 75% of the picture (`inset: 0 12.5%` on `.grid` and `.pad-surface` in `src/app.css`). If the new picture's margins differ, change both.
