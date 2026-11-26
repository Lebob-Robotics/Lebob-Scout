import { useState } from "react";
import type { Ctx } from "../StrategyApp";
import { defaultMatch, favouriteWon, one, pct, robotsOf, splitsByMatch, squareValues, type Side } from "../logic";
import { HeatField, Switch, TeamName, Waiting } from "../parts";
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
  return (
    <div className="strategy-screen">
      <label className="event-pick">
        <span className="label">Match</span>
        <select value={f.matchUuid} onChange={(e) => onMatch(e.target.value)}>
          {model.forecasts.map((x) => (
            <option key={x.matchUuid} value={x.matchUuid}>
              {labels.get(x.matchUuid)}: {x.red.join(" ")} v {x.blue.join(" ")}{x.played ? " (played)" : ""}
            </option>
          ))}
        </select>
      </label>
      <Plan key={f.matchUuid} ctx={ctx} f={f} />
    </div>
  );
}

function Plan({ ctx, f }: { ctx: Ctx; f: Forecast }) {
  const [scope, setScope] = useState<Scope>("scored");
  const [maps, retryMaps] = useLoad(f.matchUuid, () => ctx.api.matchMaps(ctx.eventUuid, f.matchUuid));
  const label = ctx.labels.get(f.matchUuid);
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
      <section className="card">
        <h2>{label} forecast</h2>
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
      </section>

      <div className="cols">
        {(["red", "blue"] as const).map((side) => <AllianceCol key={side} ctx={ctx} f={f} side={side} maps={maps.state === "ok" ? maps.data : null} scope={scope} />)}
      </div>

      <section className="card">
        <h2>Where they play</h2>
        {maps.state !== "ok" ? <Waiting load={maps} what="the heatmaps" retry={retryMaps} /> : (
          <>
            <Switch value={scope} options={SCOPES} onChange={setScope} />
            <div className="cols three">
              {(["red", "blue"] as const).map((side) => (
                <div key={side} className="map-cell">
                  <h3><span className={`alliance ${side}`}>{side === "red" ? "Red alliance" : "Blue alliance"}</span></h3>
                  <HeatField values={squareValues(maps.data[side].squares, scope)} tone={scope} label={`${side} alliance ${scope === "scored" ? "scoring" : "pick-ups"} per match`} />
                </div>
              ))}
              <div className="map-cell">
                <h3>Where they will meet</h3>
                <HeatField values={new Map(maps.data.overlap.map((o) => [o.square, o.both]))} tone="both" label="Squares both alliances use" />
              </div>
            </div>
            <p className="caption">
              Each alliance's robots added together, per match. Where they will meet: squares both alliances use (scoring and pick-ups),
              by the smaller of the two.
            </p>
          </>
        )}
      </section>

      {f.played && (
        <section className="card">
          <h2>Point split</h2>
          {ctx.splits.state !== "ok" ? <Waiting load={ctx.splits} what="the point splits" retry={ctx.retrySplits} />
            : !split ? <p className="caption">No point split for this match yet.</p> : (
              <div className="table-wrap">
                <table className="stable">
                  <thead><tr><th>Robot</th><th className="num">Points</th></tr></thead>
                  <tbody>
                    {robotsOf(f, split).map((r) => (
                      <tr key={r.team}><td><span className={`alliance ${r.side}`} /><TeamName team={r.team} name={r.name} onOpen={ctx.openTeam} /></td><td className="num">{one(r.points)}</td></tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          <p className="caption">Each alliance's score shared between its two robots by rating.</p>
        </section>
      )}
    </>
  );
}

// One alliance's robots: rating, what the scouts saw, start spots and a small map each.
function AllianceCol({ ctx, f, side, maps, scope }: { ctx: Ctx; f: Forecast; side: Side; maps: MatchMaps | null; scope: Scope }) {
  const teams = side === "red" ? f.red : f.blue;
  const names = side === "red" ? f.redNames : f.blueNames;
  return (
    <section className={`card alliance-card ${side}`}>
      <h2><span className={`alliance ${side}`}>{side === "red" ? "Red" : "Blue"}</span></h2>
      {teams.map((team, i) => {
        const rating = ctx.model.ratings.find((r) => r.teamNumber === team);
        const p = ctx.profile(team);
        const map = maps?.[side].robots.find((r) => r.teamNumber === team);
        return (
          <div key={team} className={team === ctx.ourTeam ? "robot ours" : "robot"}>
            <TeamName team={team} name={names[i]} onOpen={ctx.openTeam} />
            <dl className="robot-facts">
              <div><dt>rating</dt><dd>{one(rating?.opr)}</dd></div>
              <div><dt>scouted pts</dt><dd>{p?.matches ? one(p.points) : "–"}</dd></div>
              <div><dt>cycle time</dt><dd>{p?.cycleSeconds != null ? `${one(p.cycleSeconds)}s` : "–"}</dd></div>
            </dl>
            {map?.matches || p?.starts.length ? (
              <HeatField small values={squareValues(map?.squares ?? [], scope)} tone={scope} starts={p?.starts ?? []} label={`${team} ${scope === "scored" ? "scoring" : "pick-ups"} per match, and start spots`} />
            ) : <p className="caption">Not scouted yet.</p>}
          </div>
        );
      })}
    </section>
  );
}
