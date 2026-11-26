import { useState } from "react";
import { breakageLine, pitLines } from "../../teamsView";
import type { Ctx } from "../StrategyApp";
import { one, partnersFor, pct, rangeText, scoutTiles, sideOf, splitsByMatch, squareValues, whole, winChance, type Measure } from "../logic";
import { HeatField, RatingChart, Switch, TeamName, Tiles, Waiting } from "../parts";
import { PartnersTable } from "./AllianceScreen";

const MEASURES: [Measure, string][] = [["auto", "Auto scored"], ["teleop", "Teleop scored"], ["pickedUp", "Picked up"]];

// One team: its rating and how it moved, where it plays, what the scouts saw, its matches and its best partners.
export function TeamScreen({ ctx, team, onTeam }: { ctx: Ctx; team: number; onTeam(team: number): void }) {
  const { model, labels } = ctx;
  const [measure, setMeasure] = useState<Measure>("teleop");
  const rating = model.ratings.find((r) => r.teamNumber === team);
  const proj = model.projections.find((p) => p.teamNumber === team);
  const profile = ctx.profile(team);
  const history = model.history.filter((h) => h.teamNumber === team);
  const map = ctx.maps.state === "ok" ? ctx.maps.data.find((m) => m.teamNumber === team) : undefined;
  const splits = ctx.splits.state === "ok" ? splitsByMatch(ctx.splits.data) : null;
  const matches = model.forecasts.filter((f) => sideOf(f, team));
  const teams = [...model.ratings].sort((a, b) => a.teamNumber - b.teamNumber);

  return (
    <div className="strategy-screen">
      <label className="event-pick">
        <span className="label">Team</span>
        <select value={team} onChange={(e) => onTeam(Number(e.target.value))}>
          {teams.map((r) => <option key={r.teamNumber} value={r.teamNumber}>{r.teamNumber} {r.teamName}</option>)}
        </select>
      </label>

      <div className="cols">
        <div className="col">
          <section className="card">
            <h1 className="team-title"><b>{team}</b> {rating?.teamName ?? profile?.name ?? ""}</h1>
            <Tiles tiles={[
              ["rating", one(rating?.opr)],
              ["likely range", rating ? rangeText(rating.opr, rating.oprSe) || "–" : "–"],
              ["rank now", whole(proj?.rankNow)],
              ["expected rank", one(proj?.expRank)],
            ]} />
            {rating && (rating.priorWeight ?? 0) > 0.5 && rating.priorNote && <p className="caption">{rating.priorNote}</p>}
          </section>

          <section className="card">
            <h2>Rating after each match</h2>
            <RatingChart points={history} />
            <p className="caption">The line is the rating; the band is one standard error either side.</p>
          </section>

          <section className="card">
            <h2>Scouting</h2>
            {ctx.scouting.state !== "ok" ? <Waiting load={ctx.scouting} what="the scouting figures" retry={ctx.retryScouting} />
              : !profile || !profile.matches ? <p>Nothing scouted yet.</p>
              : <Tiles tiles={scoutTiles(profile)} />}
            {profile && profile.pits.length > 0 && (
              <div className="team-notes">
                <h3>Pit</h3>
                {profile.pits.map((p) => <div key={p.pitReportId} className="note-block">{pitLines(p).map((l, i) => <p key={i}>{l}</p>)}</div>)}
              </div>
            )}
            {profile && profile.breakages.length > 0 && (
              <div className="team-notes">
                <h3>Breakages</h3>
                <ul>{profile.breakages.map((b) => <li key={b.breakageId}>{breakageLine(b)}</li>)}</ul>
              </div>
            )}
          </section>
        </div>

        <div className="col">
          <section className="card">
            <h2>Where it plays</h2>
            {ctx.maps.state !== "ok" ? <Waiting load={ctx.maps} what="the heatmaps" retry={ctx.retryMaps} /> : (
              <>
                <Switch value={measure} options={MEASURES} onChange={setMeasure} />
                <HeatField values={squareValues(map?.squares ?? [], measure)} tone={measure === "pickedUp" ? "pickedUp" : "scored"}
                  starts={profile?.starts ?? []} label={`${team}: ${MEASURES.find(([m]) => m === measure)![1].toLowerCase()} per match`} />
                <p className="caption">
                  {map?.matches ? `Per match, over ${map.matches} scouted match${map.matches === 1 ? "" : "es"}.` : "Nothing scouted yet."}
                  {profile?.starts.length ? " Dots: where it started each match." : ""}
                </p>
              </>
            )}
          </section>

          <section className="card">
            <h2>Its matches</h2>
            {ctx.splits.state === "failed" && <Waiting load={ctx.splits} what="the point splits" retry={ctx.retrySplits} />}
            {matches.length ? (
              <div className="table-wrap">
                <table className="stable">
                  <thead><tr><th>Match</th><th>With</th><th>Against</th><th className="num">Win</th><th className="num">Result</th><th className="num">Its pts</th></tr></thead>
                  <tbody>
                    {matches.map((f) => {
                      const side = sideOf(f, team)!;
                      const partner = (side === "red" ? f.red : f.blue).filter((t) => t !== team);
                      const opp = side === "red" ? f.blue : f.red;
                      const [mine, theirs] = side === "red" ? [f.redActual, f.blueActual] : [f.blueActual, f.redActual];
                      return (
                        <tr key={f.matchUuid} className="pick" onClick={() => ctx.openMatch(f.matchUuid)}>
                          <td><span className={`alliance ${side}`}>{labels.get(f.matchUuid)}</span></td>
                          <td>{partner.map((t) => <TeamName key={t} team={t} onOpen={ctx.openTeam} />)}</td>
                          <td>{opp.map((t) => <TeamName key={t} team={t} onOpen={ctx.openTeam} />)}</td>
                          <td className="num">{pct(winChance(f, side))}</td>
                          <td className="num">{f.played && mine != null && theirs != null ? `${mine > theirs ? "Won" : mine < theirs ? "Lost" : "Tied"} ${mine}–${theirs}` : "–"}</td>
                          <td className="num">{one(splits?.get(f.matchUuid)?.get(team))}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : <p>No matches yet for this team.</p>}
          </section>

          <section className="card">
            <h2>Best partners</h2>
            <PartnersTable ctx={ctx} picks={partnersFor(model.picks, team)} />
          </section>
        </div>
      </div>
    </div>
  );
}
