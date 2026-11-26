import type { Ctx } from "../StrategyApp";
import { favouriteWon, one, pct, robotsOf, splitsByMatch, type Robot } from "../logic";
import { Card, Waiting } from "../parts";

// Every match in order: each alliance in its own colour block, the score (or the expected one), the forecast, and
// whether it went that way. Played matches show each robot's share of its alliance's score.
export function MatchesScreen({ ctx }: { ctx: Ctx }) {
  const { model, labels } = ctx;
  const splits = ctx.splits.state === "ok" ? splitsByMatch(ctx.splits.data) : null;
  if (!model.forecasts.length) return <div className="strategy-screen"><p>No forecasts yet for this event.</p></div>;
  const block = (side: "red" | "blue", rs: Robot[], played: boolean) => (
    <span className={`ablock ${side}`}>
      {rs.filter((r) => r.side === side).map((r) => (
        <span key={r.team} className="robot-cell">
          <button type="button" className="team-link" title={r.name} onClick={(e) => { e.stopPropagation(); ctx.openTeam(r.team); }}><b>{r.team}</b></button>
          {played && r.points != null && <small title="Its share of the alliance's score, by rating">{one(r.points)}</small>}
        </span>
      ))}
    </span>
  );
  return (
    <div className="strategy-screen">
      <Card title="Schedule">
        {ctx.splits.state === "failed" && <Waiting load={ctx.splits} what="the point splits" retry={ctx.retrySplits} />}
        <div className="table-wrap">
          <table className="stable" aria-label="Schedule">
            <thead>
              <tr>
                <th>Match</th><th>Teams</th><th className="num" title="Actual score; ≈ marks an expected one">Score</th>
                <th className="num" title="Red's chance of winning">Red win</th><th className="num" title="✓ when the favourite won">As forecast</th>
              </tr>
            </thead>
            <tbody>
              {model.forecasts.map((f) => {
                const rs = robotsOf(f, splits?.get(f.matchUuid));
                const won = favouriteWon(f);
                return (
                  <tr key={f.matchUuid} className="pick" onClick={() => ctx.openMatch(f.matchUuid)}>
                    <td>{labels.get(f.matchUuid)}</td>
                    <td><span className="ablocks">{block("red", rs, f.played)}{block("blue", rs, f.played)}</span></td>
                    <td className="num">{f.played ? `${f.redActual ?? "–"}–${f.blueActual ?? "–"}` : <span className="expected">≈{Math.round(f.redScore ?? 0)}–{Math.round(f.blueScore ?? 0)}</span>}</td>
                    <td className="num">{pct(f.pRed)}</td>
                    <td className="num">{won == null ? "" : won ? "✓" : "✗"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
