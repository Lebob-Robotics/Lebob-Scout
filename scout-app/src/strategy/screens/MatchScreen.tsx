import { useState, type ReactNode } from "react";
import type { Ctx } from "../StrategyApp";
import { defaultMatch, favouriteWon, one, overlapCells, pct, robotsOf, splitsByMatch, teamCells, type Side } from "../logic";
import { Card, HeatField, Switch, TeamName, Waiting } from "../parts";
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
    <select aria-label="Match" value={f.matchUuid} onChange={(e) => onMatch(e.target.value)}>
      {model.forecasts.map((x) => (
        <option key={x.matchUuid} value={x.matchUuid}>
          {labels.get(x.matchUuid)}: {x.red.join(" ")} v {x.blue.join(" ")}{x.played ? " (played)" : ""}
        </option>
      ))}
    </select>
  );
  return <div className="strategy-screen"><Plan key={f.matchUuid} ctx={ctx} f={f} picker={picker} /></div>;
}

function Plan({ ctx, f, picker }: { ctx: Ctx; f: Forecast; picker: ReactNode }) {
  const [scope, setScope] = useState<Scope>("scored");
  const [maps, retryMaps] = useLoad(f.matchUuid, () => ctx.api.matchMaps(ctx.eventUuid, f.matchUuid));
  const won = favouriteWon(f);
  const split = ctx.splits.state === "ok" ? splitsByMatch(ctx.splits.data).get(f.matchUuid) : undefined;
  const range = (lo: number | null, hi: number | null) => (lo == null || hi == null ? "" : `${Math.round(lo)}–${Math.round(hi)}`);
  const rows: [string, string, string][] = [
    ["Expected score", one(f.redScore), one(f.blueScore)],
    ["80% range", range(f.redLow80, f.redHigh80) || "–", range(f.blueLow80, f.blueHigh80) || "–"],
    ["Win", pct(f.pRed), pct(f.pBlue)],
    ["Expected RP", one(f.redRp), one(f.blueRp)],
    ...BONUSES.map((b, i): [string, string, string] => [b, pct(f.redBonus[i]), pct(f.blueBonus[i])]),
  ];
  if (f.played) rows.unshift(["Actual score", String(f.redActual ?? "–"), String(f.blueActual ?? "–")]);

  return (
    <>
      <Card title="Forecast" control={picker}>
        <div className="table-wrap">
          <table className="stable versus">
            <thead><tr><th /><th className="num"><span className="alliance red">Red</span></th><th className="num"><span className="alliance blue">Blue</span></th></tr></thead>
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
                <h3><span className={`alliance ${side}`}>{side === "red" ? "Red alliance" : "Blue alliance"}</span></h3>
                <HeatField cells={teamCells(maps.data[side].squares, scope)} tone={scope}
                  label={`${side} alliance's robots added together: ${scope === "scored" ? "scoring" : "pick-ups"} per match`} />
              </div>
            ))}
            <div className="map-cell">
              <h3 title="Squares both alliances use, scoring and picking up, by the smaller of the two">Where they will meet</h3>
              <HeatField cells={overlapCells(maps.data.overlap)} tone="both" label="Squares both alliances use" />
            </div>
          </div>
        )}
      </Card>

      {f.played && (
        <Card title="Point split">
          {ctx.splits.state !== "ok" ? <Waiting load={ctx.splits} what="the point splits" retry={ctx.retrySplits} />
            : !split ? <p>No point split for this match yet.</p> : (
              <div className="table-wrap">
                <table className="stable">
                  <thead><tr><th>Robot</th><th className="num" title="Its share of the alliance's score, by rating">Points</th></tr></thead>
                  <tbody>
                    {robotsOf(f, split).map((r) => (
                      <tr key={r.team} className={`row-${r.side}`}><td><TeamName team={r.team} name={r.name} onOpen={ctx.openTeam} /></td><td className="num">{one(r.points)}</td></tr>
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
    <Card title={side === "red" ? "Red" : "Blue"} className={`alliance-card ${side}`}>
      {teams.map((team, i) => {
        const rating = ctx.model.ratings.find((r) => r.teamNumber === team);
        const p = ctx.profile(team);
        const map = maps?.[side].robots.find((r) => r.teamNumber === team);
        return (
          <div key={team} className="robot">
            <p className="robot-name"><TeamName team={team} name={names[i]} onOpen={ctx.openTeam} />{team === ctx.ourTeam && <span className="tag">us</span>}</p>
            <dl className="robot-facts">
              <div><dt>rating</dt><dd>{one(rating?.opr)}</dd></div>
              <div><dt>scouted pts</dt><dd>{p?.matches ? one(p.points) : "–"}</dd></div>
              <div><dt>cycle time</dt><dd>{p?.cycleSeconds != null ? `${one(p.cycleSeconds)}s` : "–"}</dd></div>
            </dl>
            {map?.matches || p?.starts.length ? (
              <HeatField small cells={teamCells(map?.squares ?? [], scope)} tone={scope} starts={p?.starts ?? []}
                label={`${team} ${scope === "scored" ? "scoring" : "pick-ups"} per match, and start spots`} />
            ) : <p className="caption">Not scouted yet.</p>}
          </div>
        );
      })}
    </Card>
  );
}
