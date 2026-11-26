import type { Ctx } from "../StrategyApp";
import { one } from "../logic";
import { ordinal, ourView, playOut, type Alliance } from "../playout";
import { Card, TeamName } from "../parts";

// Alliance selection as a play-out from scouting: the rest of the qualifications, the predicted ranks, the alliances
// captains are predicted to pick, and the playoffs by strength. The most likely outcome, no chances.
export function AllianceScreen({ ctx }: { ctx: Ctx }) {
  const { model, ourTeam, settings } = ctx;
  const p = playOut(model.games, model.projections, ctx.strengths, ctx.bonusRates, settings.alliances);
  const v = ourView(p, ourTeam);
  const name = (t: number) => model.teams.find((r) => r.teamNumber === t)?.teamName;
  const team = (t: number | null) => (t == null ? "–" : <TeamName team={t} name={name(t)} onOpen={ctx.openTeam} />);
  // An alliance in one short line: seed and team numbers (each opens its team).
  const num = (t: number) => <TeamName team={t} onOpen={ctx.openTeam} />;
  const pair = (a: Alliance) => <>Seed {a.seed}: {num(a.captain)}{a.pick != null && <> and {num(a.pick)}</>}</>;
  if (!p.rows.length) return <div className="strategy-screen"><p>No standings yet for this event.</p></div>;

  return (
    <div className="strategy-screen">
      <Card title={`Prediction for ${ourTeam}`}>
        <p className="caption">{p.finished
          ? "Qualifications are over: these are the last standings, and the play-out is finished."
          : `Each remaining match goes to the higher scouted alliance (${p.remaining} qualification${p.remaining === 1 ? "" : "s"} left).`}</p>
        <dl className="facts pred-facts">
          <div>
            <dt>Our predicted rank</dt>
            <dd>{v.row ? ordinal(v.row.predRank) : "–"}
              {v.row && <small>RS {one(v.row.predRs)}{v.row.rankNow != null && ` · now ${ordinal(v.row.rankNow)}`}</small>}
            </dd>
          </div>
          <div><dt>Our seed</dt><dd>{v.alliance ? `${v.alliance.seed} (${v.captain ? "captain" : "picked"})` : "Not in an alliance"}</dd></div>
          <div><dt>{v.alliance && !v.captain ? "Picked by" : "Our partner"}</dt><dd>{team(v.partner)}</dd></div>
          <div><dt>Most likely to beat us</dt><dd>{v.threat ? pair(v.threat) : v.alliance ? "Nobody: ours is the strongest alliance" : "–"}</dd></div>
          <div><dt>Predicted winner</dt><dd>{v.winner ? pair(v.winner) : "–"}</dd></div>
        </dl>
      </Card>

      <Card title="Predicted alliances">
        {!p.alliances.length ? <p>Too few teams for alliances.</p> : (
          <div className="table-wrap">
            <table className="stable" aria-label="Predicted alliances">
              <thead>
                <tr>
                  <th className="num">Seed</th><th>Captain</th><th>Pick</th>
                  <th className="num" title="The two teams' strengths added: scouted points per match, or the official share">Strength</th><th className="num">Finish</th>
                </tr>
              </thead>
              <tbody>
                {p.alliances.map((a) => (
                  <tr key={a.seed} className={a.captain === ourTeam || a.pick === ourTeam ? "ours" : undefined}>
                    <td className="num">{a.seed}</td>
                    <td>{team(a.captain)}</td>
                    <td>{team(a.pick)}</td>
                    <td className="num" title={a.complete ? undefined : "A team with no data counts as 0"}>{one(a.strength)}{!a.complete && "*"}</td>
                    <td className="num">{ordinal(a.finish)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Card title="Predicted ranks">
        <div className="table-wrap">
          <table className="stable" aria-label="Predicted ranks">
            <thead>
              <tr>
                <th className="num">Rank</th><th>Team</th><th className="num" title="Ranking score now">RS now</th>
                <th className="num" title={p.finished ? "Ranking score at the end of qualifications" : "Ranking score after the remaining qualifications"}>Predicted RS</th>
              </tr>
            </thead>
            <tbody>
              {p.rows.map((r) => (
                <tr key={r.teamNumber} className={r.teamNumber === ourTeam ? "ours" : undefined}>
                  <td className="num">{r.predRank}</td>
                  <td>{team(r.teamNumber)}{r.teamNumber === ourTeam && <span className="tag">us</span>}</td>
                  <td className="num">{one(r.rsNow)}</td>
                  <td className="num">{one(r.predRs)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

    </div>
  );
}
