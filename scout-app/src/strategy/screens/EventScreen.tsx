import type { Ctx } from "../StrategyApp";
import { PUBLIC_PAGE, nextOurs, one, pct, playedCount, pointsTitle, rangeText, ratingRows, sideOf, whole, winChance, type RatingRow } from "../logic";
import { BreakButton, BreakIcon, Card, RangeBar, SortTable, TeamName, Waiting, type Col } from "../parts";

// Home: our status, then every team's OPR and likely range, points per match, real rank, and breakages.
export function EventScreen({ ctx }: { ctx: Ctx }) {
  const { model, scale } = ctx;
  const rows = ratingRows(model.teams, model.projections, ctx.profile, ctx.points);
  const cols: Col<RatingRow>[] = [
    { key: "team", label: "Team", value: (r) => r.teamNumber, natural: "asc", show: (r) => <TeamName team={r.teamNumber} name={r.teamName} onOpen={ctx.openTeam} /> },
    {
      key: "opr", label: "OPR", value: (r) => r.opr, title: "Points a team adds to its alliance per match, fitted on official scores, with its likely (80%) range. It starts from the team's previous event this season and moves to this event's scores as matches are played",
      show: (r) => (r.opr == null ? "–" : <RangeBar value={r.opr} low={r.low ?? r.opr} high={r.high ?? r.opr} max={scale.rating}
        title={r.low != null && r.high != null && r.low !== r.high ? `${rangeText(r.low, r.high)} likely` : ""} />),
    },
    {
      key: "points", label: "Points / match", value: (r) => r.points?.value, title: "Scouted points per match, lowest to highest match. Grey: official points share, not scouted",
      show: (r) => (r.points ? <RangeBar value={r.points.value} low={r.points.low} high={r.points.high} max={scale.points} title={pointsTitle(r.points)} grey={r.points.official} /> : ""),
    },
    { key: "rank", label: "Real rank", num: true, natural: "asc", value: (r) => r.rankNow, show: (r) => whole(r.rankNow), title: "Rank now" },
    {
      key: "breakages", label: <BreakIcon />, title: "Breakages", num: true, value: (r) => r.breakages,
      show: (r) => (r.breakages <= 0 ? "" : PUBLIC_PAGE ? String(r.breakages) : <BreakButton count={r.breakages} onOpen={() => ctx.openBreakages(r.teamNumber)} />),
    },
  ];

  return (
    <div className="strategy-screen">
      <Status ctx={ctx} />
      <Card title="Teams">
        {ctx.scouting.state !== "ok" && <Waiting load={ctx.scouting} what="the scouting figures" retry={ctx.retryScouting} />}
        {rows.length ? (
          <SortTable label="Teams" rows={rows} cols={cols} initial={{ key: rows.some((r) => r.opr != null) ? "opr" : "points", dir: "desc" }} rowKey={(r) => r.teamNumber} onRow={(r) => ctx.openTeam(r.teamNumber)} />
        ) : <p>No teams yet for this event.</p>}
        {rows.length > 0 && <p className="caption">{model.starts.size
          ? "OPR starts from each team's previous event this season and moves to this event's scores as matches are played. The bar is its likely range: wide early, narrower with every match."
          : "OPR is fitted on this event's scores. The bar is its likely range: wide early, narrower with every match. A team shows once it has played."}</p>}
      </Card>
    </div>
  );
}

// Where the event stands for us: matches played, our rank, our next match and its win chance.
function Status({ ctx }: { ctx: Ctx }) {
  const { model, ourTeam, labels } = ctx;
  const { played, total } = playedCount(model.forecasts, []);
  const us = model.projections.find((p) => p.teamNumber === ourTeam);
  const next = nextOurs(model.forecasts, ourTeam);
  const side = next && sideOf(next, ourTeam);
  return (
    <dl className="status-tiles" aria-label="Event status">
      <div><dt>played</dt><dd>{played} / {total}</dd></div>
      <div><dt>our rank</dt><dd>{whole(us?.rankNow)}</dd></div>
      <div>
        <dt>our next match</dt>
        <dd>{next ? <button type="button" className="next-link" title={`Plan ${labels.get(next.matchUuid)}`} onClick={() => ctx.openMatch(next.matchUuid)}>{labels.get(next.matchUuid)}</button> : "–"}</dd>
      </div>
      <div title={next && side ? `Expected ${one(side === "red" ? next.redScore : next.blueScore)} to ${one(side === "red" ? next.blueScore : next.redScore)}` : undefined}>
        <dt>win chance</dt><dd>{next && side ? pct(winChance(next, side)) : "–"}</dd>
      </div>
    </dl>
  );
}
