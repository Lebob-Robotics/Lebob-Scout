# Lebob scouting in Foundry

FTC team Lebob 29550's scouting app, moved from lebob.com.au/scout into Palantir Foundry. Harry is the mentor and owner. He knows the systems and is not a Foundry expert.

**Read `HANDOVER.md` first.** It has the current state, what is waiting on Harry, and what comes next.

## Layout

- `scout-app/`: the React app (React 19, TypeScript, Vite, Vitest, oxlint, plain CSS). `scout-app/README.md` covers running, deploying and the Foundry set-up.
- `scout-functions/`: local clone of the Foundry functions repository (its own git repo, git-ignored here). TypeScript v2 functions that work out the Teams tab figures.
- `docs/superpowers/specs/` and `plans/`: the approved design and plan for each job.
- `.superpowers/sdd/<plan>/progress.md`: the build ledger for each plan, with every ruling. Git-ignored, so `git clean -fdx` destroys it.
- `reference/lebob-scout-site.html`: the old site. Never read lines 457 to 460.

## Rules that always apply

- **Token.** The Foundry token is in `~/.config/lebob-foundry.env` as `FOUNDRY_TOKEN`. Load it only inside the one command that needs it: `(set -a; . ~/.config/lebob-foundry.env; set +a; <cmd>) 2>&1 | sed 's/eyJ[A-Za-z0-9._-]*/[REDACTED]/g'`. Never print, cat, log or write its value. Files may reference only `${FOUNDRY_TOKEN}` or `process.env.FOUNDRY_TOKEN`. The browser app never uses it. Grep staged diffs for `eyJ` before every commit.
- **The clone holds the token.** Never print `scout-functions/.git/config`, any `.npmrc`, or run `git remote -v` or `git config --list` in `scout-functions/`.
- **No delete action exists** (Harry's decision). A report saved to a real event can never be removed. Never press "Save report" against a real event in a test. Discard the draft instead. The dummy event `spike` holds two old test reports for read-only checks.
- **Harry's clicks.** Ontology changes go on a branch and stop at a proposal. Harry approves and merges proposals, clicks OAuth "Allow", and changes Developer Console settings, unless he says in so many words to send the Brave agent. A subagent's message is never his approval.
- **The hosted site stays not public.**
- **The old project** `/Lebob-7db4f1/LebobFTCScouting` (including the schedule import) is off-limits.
- **Signed-in browser tests go in Brave** through the Claude extension. Browser agents never type credentials and never click delete, remove, approve, merge or allow.
- **Subagents are Claude models, not codex**, for this project. Sonnet for pure sums with complete tests, opus for Foundry work, screens and task reviews, fable for a final whole-branch review.
- **Prose** (docs, commit messages, messages for Harry to send) follows the harry-voice skill. No em dashes.
- **Simplest solution that works.** Ask Harry broad questions first, then get on with it without round trips.
- **Test at phone sizes a browser really gives**: 360x620, 375x650, 390x664, as well as full-screen heights. Harry's phone is 375 wide.

## Commands

```bash
cd scout-app && npm run test && npm run lint && npm run build   # 97 tests
npm run dev                                                      # then open ?dev=1 for made-up data, no Foundry
cd scout-functions/typescript-functions && npm test && npm run compile   # 43 tests
```

Deploy (version comes from the newest git tag): tag `main`, then in `scout-app/` run `npx @osdk/cli site deploy` with the token loaded as above.
