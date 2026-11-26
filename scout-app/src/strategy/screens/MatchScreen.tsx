import { useState, type ReactNode } from "react";
import { Dropdown } from "../../components/Dropdown";
import type { Ctx } from "../StrategyApp";
import { defaultMatch, favouriteWon, one, overlapCells, pct, pointsTitle, rangeText, robotsOf, scoutedMatchPoints, scoutedTotal, splitsByMatch, teamCells, type Side } from "../logic";
import { CycleTimeFig } from "../CyclesCard";
import { cycleTime, cyclesFigure } from "../cycles";
import { Card, HeatField, PtsFig, Switch, TeamName, Waiting } from "../parts";
import { useLoad } from "../useLoad";
import type { Forecast, MatchMaps } from "../types";

// The season's ranking-point bonuses, in the model's order.
const BONUSES = ["SWARM", "POLLINATOR 1", "POLLINATOR 2"];
type Scope = "scored" | "pickedUp";
const SCOPES: [Scope, string][] = [["scored", "Scored"], ["pickedUp", "Picked up"]];

// The planner: pick a match (our next one first) and see how it should go and where the robots will be.
export function MatchScreen({ ctx, matchUuid, onMatch }: { ctx: Ctx; matchUuid: string | null; onMatch(m: string): void }) {
  const { model, labels } = ctx;
  const f = model.forecasts.find((x) => x.matchUuid === matchUuid) ?? defaultMatch(model.forecasts, ctx.ourTeam);
  if (!f) return <div className="strategy-screen"><p>No forecasts yet for this event.</p></div>;
  const picker = (
    <Dropdown label="Match" mono value={f.matchUuid} onChange={onMatch}
      items={model.forecasts.map((x) => ({ value: x.matchUuid, label: labels.get(x.matchUuid) ?? "", sub: `${x.red.join(" ")} v ${x.blue.join(" ")}${x.played ? " (played)" : ""}` }))} />
  );
  return <div className="strategy-screen"><Plan key={f.matchUuid} ctx={ctx} f={f} picker={picker} /></div>;
}

function Plan({ ctx, f, picker }: { ctx: Ctx; f: Forecast; picker: ReactNode }) {
  const [scope, setScope] = useState<Scope>("scored");
  const [maps, retryMaps] = useLoad(f.matchUuid, () => ctx.api.matchMaps(ctx.eventUuid, f.matchUuid), ctx.tick);
  const smooth = ctx.settings.heatStyle === "smooth";
  const won = favouriteWon(f);
  const split = ctx.splits.state === "ok" ? splitsByMatch(ctx.splits.data).get(f.matchUuid) : undefined;
  const range = (lo: number | null, hi: number | null) => (lo == null || hi == null ? "" : `${Math.round(lo)}–${Math.round(hi)}`);
  // Scouting first: both robots' scouted points per match added, when both have been scouted.
  const total = (teams: number[]) => scoutedTotal(teams.map(ctx.profile));
  const [redTotal, blueTotal] = [total(f.red), total(f.blue)];
  const totalText = (t: ReturnType<typeof total>) => (t ? one(t.value) : "–");
  const rows: [string, ReactNode, ReactNode][] = [
    ["Scouted total", <span key="red" title={redTotal ? `${rangeText(redTotal.low, redTotal.high)} scouted` : "Not every robot scouted"}>{totalText(redTotal)}</span>,
      <span key="blue" title={blueTotal ? `${rangeText(blueTotal.low, blueTotal.high)} scouted` : "Not every robot scouted"}>{totalText(blueTotal)}</span>],
    ["Expected score (model)", one(f.redScore), one(f.blueScore)],
    ["80% range", range(f.redLow80, f.redHigh80) || "–", range(f.blueLow80, f.blueHigh80) || "–"],
    ["Win", pct(f.pRed), pct(f.pBlue)],
    ["Expected RP", one(f.redRp), one(f.blueRp)],
    ...BONUSES.map((b, i): [string, ReactNode, ReactNode] => [b, pct(f.redBonus[i]), pct(f.blueBonus[i])]),
  ];
  if (f.played) rows.unshift(["Actual score", String(f.redActual ?? "–"), String(f.blueActual ?? "–")]);
  // Each robot's points in this match: scouted, else its rating share.
  const robots = robotsOf(f, split, (t) => scoutedMatchPoints(ctx.profile(t)?.matchPoints, f));

  return (
    <>
      <Card title="Forecast" control={picker}>
        <div className="table-wrap">
          <table className="stable versus">
            <thead><tr><th /><th className="num"><span className="ally red">Red</span></th><th className="num"><span className="ally blue">Blue</span></th></tr></thead>
            <tbody>{rows.map(([what, r, b]) => <tr key={what}><td>{what}</td><td className="num">{r}</td><td className="num">{b}</td></tr>)}</tbody>
          </table>
        </div>
        <p className="caption">
          Tie {pct(f.pTie)}.
          {f.played && won != null && (won ? " The favourite won." : " The favourite lost.")}
          {f.played && f.preRedScore != null && ` Forecast before the match: ${one(f.preRedScore)} to ${one(f.preBlueScore)}.`}
        </p>
      </Card>

      <div className="cols">
        {(["red", "blue"] as const).map((side) => <AllianceCol key={side} ctx={ctx} f={f} side={side} maps={maps.state === "ok" ? maps.data : null} scope={scope} />)}
      </div>

      <Card title="Where they play" control={maps.state === "ok" && <Switch label="Measure" value={scope} options={SCOPES} onChange={setScope} />}>
        {maps.state !== "ok" ? <Waiting load={maps} what="the heatmaps" retry={retryMaps} /> : (
          <div className="cols three">
            {(["red", "blue"] as const).map((side) => (
              <div key={side} className="map-cell">
                <h3><span className={`ally ${side}`}>{side === "red" ? "Red alliance" : "Blue alliance"}</span></h3>
                <HeatField cells={teamCells(maps.data[side].squares, scope)} tone={scope} smooth={smooth}
                  label={`${side} alliance's robots added together: ${scope === "scored" ? "scoring" : "pick-ups"} per match`} />
              </div>
            ))}
            <div className="map-cell">
              <h3 title="Squares both alliances use, scoring and picking up, by the smaller of the two">Where they will meet</h3>
              <HeatField cells={overlapCells(maps.data.overlap)} tone="both" smooth={smooth} label="Squares both alliances use" />
            </div>
          </div>
        )}
      </Card>

      {f.played && (
        <Card title="Point split">
          {!robots.some((r) => r.points) ? (ctx.splits.state !== "ok" ? <Waiting load={ctx.splits} what="the point splits" retry={ctx.retrySplits} />
            : <p>No points for this match yet.</p>) : (
            <div className="table-wrap">
              <table className="stable">
                <thead><tr><th>Robot</th><th className="num" title="Scouted points in the match; in italics: the model's share by rating where nobody scouted">Points</th></tr></thead>
                <tbody>
                  {robots.map((r) => (
                    <tr key={r.team} className={`row-${r.side}`}><td><TeamName team={r.team} name={r.name} onOpen={ctx.openTeam} /></td><td className="num"><PtsFig pts={r.points} /></td></tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}
    </>
  );
}

// One alliance's robots: rating, what the scouts saw, and a small map each with its start spots.
function AllianceCol({ ctx, f, side, maps, scope }: { ctx: Ctx; f: Forecast; side: Side; maps: MatchMaps | null; scope: Scope }) {
  const teams = side === "red" ? f.red : f.blue;
  const names = side === "red" ? f.redNames : f.blueNames;
  return (
    <Card title={side === "red" ? "Red" : "Blue"} tone={side}>
      {teams.map((team, i) => {
        const rating = ctx.model.ratings.find((r) => r.teamNumber === team);
        const p = ctx.profile(team);
        const pts = ctx.points(team);
        // Cycles from our scouting only; a team nobody scouted shows its pit report's claimed cycle time.
        const cyc = cyclesFigure(ctx.teamCycles(team));
        const time = cycleTime(cyc ? ctx.teamCycles(team) : undefined, p?.pits ?? []);
        const map = maps?.[side].robots.find((r) => r.teamNumber === team);
        return (
          <div key={team} className="robot">
            <p className="robot-name"><TeamName team={team} name={names[i]} onOpen={ctx.openTeam} />{team === ctx.ourTeam && <span className="tag">us</span>}</p>
            <dl className="robot-facts">
              <div title={pts ? pointsTitle(pts) : undefined}>
                <dt>{pts?.official ? "pts / match (model)" : "pts / match"}</dt>
                <dd className={pts?.official ? "model" : undefined}>{pts ? <>{one(pts.value)}{pts.low !== pts.high && <small> {rangeText(pts.low, pts.high)}</small>}</> : "–"}</dd>
              </div>
              <div><dt>rating</dt><dd>{one(rating?.opr)}</dd></div>
              <div><dt>cycles / match</dt><dd>{cyc ? one(cyc.value) : "–"}</dd></div>
              <div><dt>cycle time</dt><dd><CycleTimeFig time={time} /></dd></div>
            </dl>
            {map?.matches || p?.starts.length ? (
              <HeatField small cells={teamCells(map?.squares ?? [], scope)} tone={scope} starts={p?.starts ?? []} smooth={ctx.settings.heatStyle === "smooth"}
                label={`${team} ${scope === "scored" ? "scoring" : "pick-ups"} per match, and start spots`} />
            ) : <p className="caption">Not scouted yet.</p>}
          </div>
        );
      })}
    </Card>
  );
}
