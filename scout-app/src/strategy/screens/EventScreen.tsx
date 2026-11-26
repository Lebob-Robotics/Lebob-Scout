import type { Ctx } from "../StrategyApp";
import { nextOurs, one, pct, playedCount, rangeText, sideOf, whole, winChance } from "../logic";
import { SortTable, TeamName, Tiles, Waiting, type Col } from "../parts";
import type { Projection, Rating } from "../types";

type Row = Rating & { proj?: Projection; points: number | null; scouted: number | null; breakages: number | null };

// Home: where the event stands for us, then every team's rating and chances.
export function EventScreen({ ctx }: { ctx: Ctx }) {
  const { model, ourTeam, labels } = ctx;
  const { played, total } = playedCount(model.forecasts, model.matches);
  const us = model.projections.find((p) => p.teamNumber === ourTeam);
  const next = nextOurs(model.forecasts, ourTeam);
  const side = next && sideOf(next, ourTeam);

  const proj = new Map(model.projections.map((p) => [p.teamNumber, p]));
  const rows: Row[] = model.ratings.map((r) => {
    const t = ctx.profile(r.teamNumber);
    return { ...r, proj: proj.get(r.teamNumber), points: t?.matches ? t.points : null, scouted: t ? t.matches : null, breakages: t ? t.breakages.length : null };
  });
  const cols: Col<Row>[] = [
    { key: "team", label: "Team", value: (r) => r.teamNumber, natural: "asc", show: (r) => <TeamName team={r.teamNumber} name={r.teamName} onOpen={ctx.openTeam} /> },
    { key: "opr", label: "Rating", num: true, value: (r) => r.opr, show: (r) => one(r.opr), title: "Points added to its alliance per match" },
    { key: "range", label: "Likely", num: true, value: (r) => r.opr - 1.28 * (r.oprSe ?? 0), show: (r) => rangeText(r.opr, r.oprSe) || "–", title: "80% range" },
    { key: "auto", label: "Auto", num: true, value: (r) => r.autoRating, show: (r) => one(r.autoRating) },
    { key: "teleop", label: "Teleop", num: true, value: (r) => r.teleopRating, show: (r) => one(r.teleopRating) },
    { key: "points", label: "Scouted pts", num: true, value: (r) => r.points, show: (r) => one(r.points), title: "Scouted points per match" },
    { key: "scouted", label: "Scouted", num: true, value: (r) => r.scouted, show: (r) => whole(r.scouted), title: "Matches scouted" },
    { key: "breakages", label: "Breaks", num: true, value: (r) => r.breakages, show: (r) => whole(r.breakages), title: "Breakages reported" },
    { key: "rank", label: "Rank", num: true, natural: "asc", value: (r) => r.proj?.rankNow, show: (r) => whole(r.proj?.rankNow) },
    { key: "exp", label: "Exp rank", num: true, natural: "asc", value: (r) => r.proj?.expRank, show: (r) => one(r.proj?.expRank) },
    { key: "top4", label: "Top 4", num: true, value: (r) => r.proj?.pTop4, show: (r) => pct(r.proj?.pTop4) },
    { key: "top8", label: "Top 8", num: true, value: (r) => r.proj?.pTop8, show: (r) => pct(r.proj?.pTop8) },
  ];

  return (
    <div className="strategy-screen">
      <section className="card">
        <h2>Event status</h2>
        <Tiles tiles={[
          ["matches played", `${played} / ${total}`],
          ["our rank now", whole(us?.rankNow)],
          ["our expected rank", one(us?.expRank)],
          ["our next match", next ? labels.get(next.matchUuid) ?? "–" : "–"],
          ["its win chance", next && side ? pct(winChance(next, side)) : "–"],
        ]} />
        {next && side && (
          <p className="caption">
            {labels.get(next.matchUuid)}: we are {side}, expected {one(side === "red" ? next.redScore : next.blueScore)} to {one(side === "red" ? next.blueScore : next.redScore)}.{" "}
            <button type="button" className="link" onClick={() => ctx.openMatch(next.matchUuid)}>Plan it</button>
          </p>
        )}
        {!us && <p className="caption">Team {ourTeam} has no rank projection at this event.</p>}
      </section>

      <section className="card">
        <h2>Ratings</h2>
        {ctx.scouting.state !== "ok" && <Waiting load={ctx.scouting} what="the scouting figures" retry={ctx.retryScouting} />}
        {rows.length ? (
          <SortTable label="Ratings" rows={rows} cols={cols} initial={{ key: "opr", dir: "desc" }} rowKey={(r) => r.teamNumber} onRow={(r) => ctx.openTeam(r.teamNumber)} />
        ) : <p>No ratings yet for this event.</p>}
        <p className="caption">Rating: points a team adds to its alliance per match. Likely: its 80% range. Tap a team to open it.</p>
      </section>
    </div>
  );
}
