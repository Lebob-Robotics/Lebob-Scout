import type { Ctx } from "../StrategyApp";
import { favouriteWon, pct, robotsOf, scoutedMatchPoints, type Robot, type Side } from "../logic";
import { Card, PtsFig } from "../parts";

// The four robot columns, each team in a block of its alliance's colour.
const SLOTS: [Side, number, string][] = [["red", 0, "Red 1"], ["red", 1, "Red 2"], ["blue", 0, "Blue 1"], ["blue", 1, "Blue 2"]];

// Every match in order: Red 1, Red 2, Blue 1 and Blue 2 each in its own column, the official score (or the expected
// one from scouting), the scouting forecast's chance for red, and whether it went that way. Played matches show each
// robot's points: scouted, else its official share (in italics). A match with a robot we know nothing about has no
// forecast.
export function MatchesScreen({ ctx }: { ctx: Ctx }) {
  const { model, labels } = ctx;
  if (!model.forecasts.length) return <div className="strategy-screen"><p>No matches yet for this event.</p></div>;
  const slot = (r: Robot | undefined, played: boolean) => r && (
    <span className={`ablock slot ${r.side}`}>
      <button type="button" className="team-link" title={r.name} onClick={(e) => { e.stopPropagation(); ctx.openTeam(r.team); }}><b>{r.team}</b></button>
      {played && r.points && <small><PtsFig pts={r.points} tag={false} /></small>}
    </span>
  );
  const rows = model.forecasts.map((f) => ({
    f, rs: robotsOf(f, (t) => scoutedMatchPoints(ctx.profile(t)?.matchPoints, f), (t) => ctx.officialShare(f.matchUuid, t)),
  }));
  const anyOfficial = rows.some(({ f, rs }) => (f.played && rs.some((r) => r.points?.official)) || (!f.played && (f.officialRed || f.officialBlue)));
  const expected = (v: number | null, official?: boolean) => <PtsFig pts={v == null ? null : { value: v, official: !!official }} tag={false} round />;
  return (
    <div className="strategy-screen">
      <Card title="Schedule">
        <div className="table-wrap">
          <table className="stable schedule" aria-label="Schedule">
            <thead>
              <tr>
                <th>Match</th>
                {SLOTS.map(([, , name]) => <th key={name}>{name}</th>)}
                <th className="num" title="Official score; ≈ marks one expected from scouting">Score</th>
                <th className="num" title="Red's chance of winning, from scouting">Red win</th><th className="num" title="✓ when the side scouting favoured won">As forecast</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(({ f, rs }) => {
                const won = favouriteWon(f);
                const none = !!f.missing?.length;
                return (
                  <tr key={f.matchUuid} className="pick" onClick={() => ctx.openMatch(f.matchUuid)}>
                    <td>{labels.get(f.matchUuid)}</td>
                    {SLOTS.map(([side, i, name]) => <td key={name}>{slot(rs.filter((r) => r.side === side)[i], f.played)}</td>)}
                    <td className="num">
                      {f.played ? `${f.redActual ?? "–"}–${f.blueActual ?? "–"}`
                        : none ? <span className="caption keep" title={`No data on ${f.missing!.join(", ")}`}>Not enough data</span>
                        : <span className="expected">≈{expected(f.redScore, f.officialRed)}–{expected(f.blueScore, f.officialBlue)}</span>}
                    </td>
                    <td className="num">{none ? "–" : pct(f.pRed)}</td>
                    <td className="num">{won == null ? "" : won ? "✓" : "✗"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {anyOfficial && <p className="caption"><span className="fig model">Italic</span> figures count a robot by its official share (the alliance's score less its scouted partner, or half) where nobody scouted it.</p>}
      </Card>
    </div>
  );
}
