import type { Ctx } from "../StrategyApp";
import { favouriteWon, pct, robotsOf, scoutedMatchPoints, scoutedTotal, scoutingFirst, splitsByMatch, type Robot } from "../logic";
import { Card, PtsFig, Waiting } from "../parts";

// Every match in order: each alliance in its own colour block, the score (or the expected one), the forecast, and
// whether it went that way. Played matches show each robot's points: scouted, else its rating share (grey).
// An expected score is the alliance's scouted total when both its robots have been scouted, else the model's (grey).
export function MatchesScreen({ ctx }: { ctx: Ctx }) {
  const { model, labels } = ctx;
  const splits = ctx.splits.state === "ok" ? splitsByMatch(ctx.splits.data) : null;
  if (!model.forecasts.length) return <div className="strategy-screen"><p>No forecasts yet for this event.</p></div>;
  const block = (side: "red" | "blue", rs: Robot[], played: boolean) => (
    <span className={`ablock ${side}`}>
      {rs.filter((r) => r.side === side).map((r) => (
        <span key={r.team} className="robot-cell">
          <button type="button" className="team-link" title={r.name} onClick={(e) => { e.stopPropagation(); ctx.openTeam(r.team); }}><b>{r.team}</b></button>
          {played && r.points && <small><PtsFig pts={r.points} tag={false} /></small>}
        </span>
      ))}
    </span>
  );
  const expected = (teams: number[], model: number | null) => scoutingFirst(scoutedTotal(teams.map(ctx.profile))?.value, model);
  const rows = model.forecasts.map((f) => {
    const rs = robotsOf(f, splits?.get(f.matchUuid), (t) => scoutedMatchPoints(ctx.profile(t)?.matchPoints, f));
    const [red, blue] = f.played ? [null, null] : [expected(f.red, f.redScore), expected(f.blue, f.blueScore)];
    return { f, rs, red, blue };
  });
  const anyModel = rows.some(({ f, rs, red, blue }) => (f.played && rs.some((r) => r.points?.model)) || red?.model || blue?.model);
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
              {rows.map(({ f, rs, red, blue }) => {
                const won = favouriteWon(f);
                return (
                  <tr key={f.matchUuid} className="pick" onClick={() => ctx.openMatch(f.matchUuid)}>
                    <td>{labels.get(f.matchUuid)}</td>
                    <td><span className="ablocks">{block("red", rs, f.played)}{block("blue", rs, f.played)}</span></td>
                    <td className="num">
                      {f.played ? `${f.redActual ?? "–"}–${f.blueActual ?? "–"}`
                        : <span className="expected">≈<PtsFig pts={red} tag={false} round />–<PtsFig pts={blue} tag={false} round /></span>}
                    </td>
                    <td className="num">{pct(f.pRed)}</td>
                    <td className="num">{won == null ? "" : won ? "✓" : "✗"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {anyModel && <p className="caption"><span className="fig model">Italic</span> figures are the model's (by rating) where nobody scouted; the rest were scouted.</p>}
      </Card>
    </div>
  );
}
