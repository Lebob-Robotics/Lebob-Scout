import type { Ctx } from "../StrategyApp";
import { favouriteWon, one, pct, robotsOf, splitsByMatch, type Robot } from "../logic";
import { Waiting } from "../parts";

// Every match in order: who played, the score (or the expected one), the forecast, and whether it went that way.
export function MatchesScreen({ ctx }: { ctx: Ctx }) {
  const { model, labels } = ctx;
  const splits = ctx.splits.state === "ok" ? splitsByMatch(ctx.splits.data) : null;
  if (!model.forecasts.length) return <div className="strategy-screen"><p>No forecasts yet for this event.</p></div>;
  const teams = (rs: Robot[], played: boolean) => rs.map((r) => (
    <span key={r.team} className="robot-cell">
      <button type="button" className="team-link" onClick={(e) => { e.stopPropagation(); ctx.openTeam(r.team); }}><b>{r.team}</b></button>
      {played && r.points != null && <small>{one(r.points)}</small>}
    </span>
  ));
  return (
    <div className="strategy-screen">
      <section className="card">
        <h2>Matches</h2>
        {ctx.splits.state === "failed" && <Waiting load={ctx.splits} what="the point splits" retry={ctx.retrySplits} />}
        <div className="table-wrap">
          <table className="stable" aria-label="Matches">
            <thead>
              <tr><th>Match</th><th><span className="alliance red">Red</span></th><th><span className="alliance blue">Blue</span></th><th className="num">Score</th><th className="num">Red win</th><th className="num">As forecast</th></tr>
            </thead>
            <tbody>
              {model.forecasts.map((f) => {
                const rs = robotsOf(f, splits?.get(f.matchUuid));
                const won = favouriteWon(f);
                return (
                  <tr key={f.matchUuid} className="pick" onClick={() => ctx.openMatch(f.matchUuid)}>
                    <td>{labels.get(f.matchUuid)}</td>
                    <td>{teams(rs.filter((r) => r.side === "red"), f.played)}</td>
                    <td>{teams(rs.filter((r) => r.side === "blue"), f.played)}</td>
                    <td className="num">{f.played ? `${f.redActual ?? "–"}–${f.blueActual ?? "–"}` : <span className="expected">≈{Math.round(f.redScore ?? 0)}–{Math.round(f.blueScore ?? 0)}</span>}</td>
                    <td className="num">{pct(f.pRed)}</td>
                    <td className="num">{won == null ? "" : won ? "✓" : "✗"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="caption">Scores marked ≈ are expected. As forecast: ✓ when the favourite won. Small figures: each robot's share of its alliance's score, by rating.</p>
      </section>
    </div>
  );
}
