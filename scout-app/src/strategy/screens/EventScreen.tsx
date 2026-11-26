import type { Ctx } from "../StrategyApp";
import { pointsTitle, rangeText, ratingRows, whole, type RatingRow } from "../logic";
import { BreakButton, BreakIcon, Card, RangeBar, SortTable, TeamName, Waiting, type Col } from "../parts";

// Home: every team's rating and likely range, points per match, real rank, and breakages.
export function EventScreen({ ctx }: { ctx: Ctx }) {
  const { model, scale } = ctx;
  const rows = ratingRows(model.ratings, model.projections, ctx.profile, ctx.points);
  const cols: Col<RatingRow>[] = [
    { key: "team", label: "Team", value: (r) => r.teamNumber, natural: "asc", show: (r) => <TeamName team={r.teamNumber} name={r.teamName} onOpen={ctx.openTeam} /> },
    {
      key: "opr", label: "Rating", value: (r) => r.opr, title: "Points a team adds to its alliance per match, with its likely (80%) range",
      show: (r) => <RangeBar value={r.opr} low={r.low} high={r.high} max={scale.rating} title={`${rangeText(r.low, r.high)} likely`} />,
    },
    {
      key: "points", label: "Points / match", value: (r) => r.points?.value, title: "Scouted points per match, lowest to highest match. Grey: official points share, not scouted",
      show: (r) => (r.points ? <RangeBar value={r.points.value} low={r.points.low} high={r.points.high} max={scale.points} title={pointsTitle(r.points)} grey={r.points.official} /> : ""),
    },
    { key: "rank", label: "Real rank", num: true, natural: "asc", value: (r) => r.rankNow, show: (r) => whole(r.rankNow), title: "Rank now" },
    {
      key: "breakages", label: <BreakIcon />, title: "Breakages", num: true, value: (r) => r.breakages,
      show: (r) => (r.breakages > 0 ? <BreakButton count={r.breakages} onOpen={() => ctx.openBreakages(r.teamNumber)} /> : ""),
    },
  ];

  return (
    <div className="strategy-screen">
      <Card title="Ratings">
        {ctx.scouting.state !== "ok" && <Waiting load={ctx.scouting} what="the scouting figures" retry={ctx.retryScouting} />}
        {rows.length ? (
          <SortTable label="Ratings" rows={rows} cols={cols} initial={{ key: "opr", dir: "desc" }} rowKey={(r) => r.teamNumber} onRow={(r) => ctx.openTeam(r.teamNumber)} />
        ) : <p>No ratings yet for this event.</p>}
      </Card>
    </div>
  );
}
