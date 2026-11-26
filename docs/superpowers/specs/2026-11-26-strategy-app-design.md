# Strategy app: design

Job 4. The strategy dashboard is the most important part of the stack: it takes what the scouts record in Foundry and shows it to the strategy team so they can act on it, and where an insight can be worked out automatically, it is. This builds on the match scout page, scout polish, Teams tab and pit and breakage designs.

## What was asked (26 Nov)

- "The strategy dashboard is the heart of this data." It shows the scouts' data to the strategy team "such that they can make actionable insights, if any of the insights can be automated that would be great."
- Baseline: everything the strategists used at regionals in the "Lebob Scout" Workshop (`ri.workshop.main.module.86a3e972-…`, old project), and from lebob.com.au/strategy: team ratings, the robot point split, and the match list with video.
- New in v2: heatmaps of robot positions, used to the full: single team heatmaps, alliance heatmaps, cold spots, free alleys of movement, predicted pathing from heatmap data, "including but not limited to".
- A separate strategy web app, with the same design as lebob.com.au/scout (the look the scout app now has).
- By AUCMP (5 and 6 Dec): the core. After AUCMP, once there is real data to tune on: cold spots, free alleys, predicted pathing and automated insights.

## The regionals Workshop, from its data

The Workshop's pages could not be opened, so this baseline is built from the 15 object types it reads (its lineage): Event, Match, Presence, Participation, Team, Robot, the old scouting (MatchReport, ScoutSummary, PitSurvey, BreakageReport), and the match model the old project rebuilds on every FIRST sync:

- **EventRating**, one per team at an event: rating (points added to its alliance per match) with standard error, auto and teleop parts, how much still comes from the prior and why.
- **RatingHistory**: the rating and rank after each qualification match.
- **MatchForecast**, one per match: expected scores with 80% ranges, win, tie and loss chances, expected ranking points and bonus chances, the same before the match was played, and whether the favourite won.
- **RankProjection**: rank and ranking score now, expected final rank, chances of finishing first, top 4 and top 8, ranking score needed for 1st, 4th and 8th.
- **AlliancePick**: simulated playoffs for each possible partner: chance of reaching the finals and of winning the event, seed, whether the pair is natural and both still free.

The strategy app reads these as they are. It never changes them and changes nothing in the old project.

## The app

### Where it lives

A second app on the scout app's hosted site, at the path `/strategy` (same build, loaded only when opened), built from the same code base. It has its own address, its own screens and its own tab bar, laptop-first but working on a phone, and it shares the scout app's sign-in, SDK, design and Foundry functions.

Ruling S1: one hosted site with two pages rather than a second Developer Console application. A second application would need its own sign-in client, its own SDK and its own deploy, and would drift. The strategy team gets its own app at its own address either way; a link from the scout app's Settings tab and back. (Built as the path `/strategy` rather than `strategy.html`, because the sign-in always returns through the scout app's start-up, which now sends the strategist back to `/strategy`.)

### Design

The same look as the scout app (which follows lebob.com.au/scout): the same colours, type, header, pixel rule, buttons, tiles and field picture. The same CSS file. Wider screens get two and three columns.

### Screens

The event is picked once (defaults to the event running today, as the scout app does) and kept.

1. **Event** (home)
   - Status: matches played of total, our rank now and expected, our next match and its forecast.
   - **Ratings table** (from lebob.com.au/strategy "Who scores the most" and EventRating): every team, sortable, with rating and its likely range (rating ± 1.28 × standard error, the 80% range), auto and teleop parts, scouted points per match, matches scouted, breakages, rank now, expected rank, top 4 and top 8 chances. Tap a team to open it.
2. **Team**
   - Header: number, name, rating with range, rank now and expected, the rating's prior note when much of it is still prior.
   - Rating history chart (RatingHistory).
   - **Heatmaps** (single team): where it scores and where it picks up, per match, on the field picture; auto and teleop shown apart; start spots; recent auto paths drawn.
   - Scouting figures (the Teams tab profile: points, cycles, cycle time, driver, speed), pit reports, breakages.
   - Its matches: schedule, results, forecasts, robot point split.
   - Best partners (AlliancePick, when this team picks).
3. **Match** (the planner)
   - Pick any match; opens on our next one.
   - Forecast: expected scores with ranges, win and tie chances, ranking-point bonus chances; once played, the result against the forecast.
   - Red against blue side by side, each robot with rating, scouted figures, start spot and its heatmaps.
   - **Alliance heatmaps**: each alliance's robots added together on one field, and where the two alliances' robots use the same squares (where they will meet).
   - Once played: the **robot point split**.
4. **Matches**: every match with teams, score, forecast and whether it went as forecast, and the robot point split. Video links come later (see below).
5. **Alliance selection**: rank projection table and, for us (and any team picked), partners ranked by chance of winning the event, with seed and whether both are still free (AlliancePick).

### Robot point split (from lebob.com.au/strategy)

For a played match, the alliance's official score is shared between its two robots in proportion to each robot's rating, so the two add up to the official score. Ruling S2: the site also took leave and park points from the referee's per-robot record; that record is not in our Foundry data yet, so v1 splits the whole score by rating and says so. Worked out in our functions.

### Match video (from lebob.com.au/strategy)

There is no source of match video links in Foundry. Ruling S3: the Matches screen leaves a place for a video link and fills it once a source is added (after AUCMP).

## Heatmaps and what they lead to

Every report stores timed taps on the 6 by 6 grid: shots with pieces scored, and pick-up areas. Scouts tap live, so a tap's time is right to about 10 seconds, but taps are not a driven route (the first design's warning).

By AUCMP:

- **Single team heatmap.** Per square: pieces scored per match from it, pick-ups per match there, auto and teleop apart, averaged over the team's matches (each match counted once however many scouts covered it, as the Teams tab does).
- **Alliance heatmap.** The alliance's robots' maps added together; the opposing alliance's likewise; the overlap of the two (squares both alliances use often: where traffic and defence will happen).

After AUCMP (each defined now, tuned on AUCMP data):

- **Cold spots.** Across the event, squares where few robots score or pick up, per match; for a match, squares neither alliance's robots use. Where a robot can work undisturbed.
- **Free alleys.** For a match: the cheapest way across the grid from our pick-up areas to our scoring squares, where each square costs more the more the opposing robots use it (a shortest path on the grid). Drawn as a lane on the field.
- **Predicted pathing.** For a robot: its cycles (pick-ups before a shot, then that shot, by time) give pick-up to shot pairs with how often each happens; each pair is drawn as the free-alley style path between them, thicker for more often. The likely way it moves, not a recorded route.
- **Automated insights.** Short lines on the Match and Team screens, worked out in the functions, for example: an opponent scores mostly from the squares we use; a partner and we use the same pick-up area; a robot broke down in its last matches; a team's rating has moved a lot since the start; the forecast is close.

## In Foundry

- **Functions** (our repository): the per-team square maps with auto and teleop apart (extending the Teams tab sums), alliance and overlap maps for a match, the robot point split; after AUCMP the cold spots, free alleys, predicted paths and insights. All the sums live here so the scout app, the strategy app and any Workshop page agree.
- **Model objects**: EventRating, RatingHistory, MatchForecast, RankProjection, AlliancePick and Participation are imported into the "Lebob Scout App" project (as Match and Event already are) and added to the app's SDK, read-only. No action on them.
- No ontology change, so no proposal.

## Rulings made while building (26 Nov)

- In dev mode (`/strategy?dev=1`) team 12345 plays the part of us; for real it is 29550.
- The strategy app remembers its event apart from the scout app (`lsa:strategy-event`), so a laptop never changes what a scout's phone shows.
- Bonus rows are labelled SWARM, POLLINATOR 1 and POLLINATOR 2, as the model describes them.
- Playoff labels are P and the number; where playoff numbers repeat, the series is used.
- The model's figures load as one block with one Retry; the Teams tab figures, field maps and point splits each load on their own, so one failing leaves the rest of the screen working.
- "As forecast" uses the model's own record of whether the favourite won.
- Wide tables scroll sideways inside their card on a phone, team column pinned; the page never scrolls sideways.

## Not in this job

- Editing anything in the old project or its model.
- The old Workshop: it stays as it is.
- A shared, editable pick list (not asked for).

## Checks

- Tests for every sum in the functions: the maps, alliance and overlap maps, point split; after AUCMP each insight.
- Live check against AUPEQ (which has ratings and forecasts) before deploying.
- Browser check at laptop width and at 375 wide; a signed-in check; the strategy team uses it once before AUCMP.

## What would make it a failure

- Numbers on the strategy app that disagree with the scout app's Teams tab.
- A strategist who cannot answer "how do we play our next match" from the Match screen in under a minute.
- A heatmap that counts a match twice because two scouts covered it.
