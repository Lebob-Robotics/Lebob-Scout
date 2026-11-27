import { useEffect, useState, type ReactNode } from "react";
import { clockTime } from "../../teams";
import { breakageLine, pitLines } from "../../teamsView";
import type { Ctx } from "../StrategyApp";
import {
  likely, one, pct, pointsTitle, rangeText, scoutMoreTiles, scoutTiles, scoutedMatchPoints, scoutingFirst, sideOf, teamCells, tipsPerMatch,
  whole, winChance,
  type Measure,
} from "../logic";
import { Dropdown } from "../../components/Dropdown";
import { AutoPaths, Card, HeatField, PtsFig, RangeBar, RatingChart, Switch, TeamName, Tiles, Waiting } from "../parts";
import { CyclesCard } from "../CyclesCard";
import type { HeatField as FieldView } from "../settings";

const MEASURES: [Measure, string][] = [["auto", "Auto scored"], ["teleop", "Teleop scored"], ["pickedUp", "Picked up"]];
const FIELDS: [FieldView, string][] = [["full", "Full field"], ["half", "Half field"]];

// One team: its OPR (from this event's official scores) and how it moved, what the scouts saw, where it plays, and
// its matches.
export function TeamScreen({ ctx, team, onTeam }: { ctx: Ctx; team: number; onTeam(team: number): void }) {
  const { model, labels, scale } = ctx;
  const [measure, setMeasure] = useState<Measure>(ctx.settings.measure);
  const half = ctx.settings.heatField === "half";
  const row = model.teams.find((r) => r.teamNumber === team);
  const opr = row?.opr ?? null;
  const range = opr == null ? null : likely(opr, row!.oprSe);
  const proj = model.projections.find((p) => p.teamNumber === team);
  const profile = ctx.profile(team);
  const points = ctx.points(team);
  const history = model.history.filter((h) => h.teamNumber === team);
  const map = ctx.maps.state === "ok" ? ctx.maps.data.find((m) => m.teamNumber === team) : undefined;
  const matches = model.forecasts.filter((f) => sideOf(f, team));
  const teams = [...model.teams].sort((a, b) => a.teamNumber - b.teamNumber);
  const [now] = useState(() => Date.now());

  // A breakage button brought us here: show the Breakages card.
  const ask = ctx.breakageAsk;
  useEffect(() => {
    if (ask && ctx.takeBreakageAsk()) requestAnimationFrame(() => document.getElementById("breakages")?.scrollIntoView({ block: "start" }));
  }, [ask, ctx]);

  const scouted = (body: () => ReactNode) =>
    ctx.scouting.state !== "ok" ? <Waiting load={ctx.scouting} what="the scouting figures" retry={ctx.retryScouting} /> : body();

  return (
    <div className="strategy-screen">
      <div className="cols">
        <div className="col">
          <Card title="Team" control={(
            <Dropdown label="Team" value={String(team)} onChange={(v) => onTeam(Number(v))}
              items={teams.map((r) => ({ value: String(r.teamNumber), label: String(r.teamNumber), sub: r.teamName }))} />
          )}>
            <Tiles tiles={[
              ["OPR", opr != null ? <RangeBar value={opr} low={range?.low ?? opr} high={range?.high ?? opr} max={scale.rating}
                title={range ? `${rangeText(range.low, range.high)} likely` : "Too few matches for a likely range"} /> : "–"],
              ["points / match", points ? <RangeBar value={points.value} low={points.low} high={points.high} max={scale.points} title={pointsTitle(points)} grey={points.official} /> : "–"],
              ["tips / match", one(tipsPerMatch(row?.hiveRating ?? null))],
              ["real rank", whole(proj?.rankNow)],
              ["times scouted", profile ? String(profile.matches) : "–"],
              ["pit report", profile ? (profile.pits.length ? "Yes" : "No") : "–"],
              ["breakages", profile ? <button type="button" className="tile-link" onClick={() => ctx.openBreakages(team)}>{profile.breakages.length}</button> : "–"],
            ]} />
          </Card>

          <Card title="OPR">
            {model.oprReady ? <RatingChart points={history} /> : <p className="caption">OPR shows once every team has played 3 matches with a score.</p>}
          </Card>

          <Card title="Scouting">
            {scouted(() => (!profile || !profile.matches ? <p>Nothing scouted yet.</p> : <Tiles tiles={[...scoutTiles(profile), ...scoutMoreTiles(profile)]} />))}
            {profile && profile.pits.length > 0 && (
              <div className="team-notes">
                <h3>Pit</h3>
                {profile.pits.map((p) => <div key={p.pitReportId} className="note-block">{pitLines(p).map((l, i) => <p key={i}>{l}</p>)}</div>)}
              </div>
            )}
          </Card>

          <Card title="Scout notes">
            {scouted(() => (!profile?.notes.length ? <p>No scout notes yet.</p> : (
              <ul className="note-list">
                {profile.notes.map((n, i) => (
                  <li key={i} className="note-block">
                    <p>{[n.label, n.scoutName, clockTime(n.createdAt, now, ctx.timeZone)].filter(Boolean).join(" · ")}</p>
                    {n.autoNotes && <p>Auto: {n.autoNotes}</p>}
                    {n.notes && <p>{n.notes}</p>}
                  </li>
                ))}
              </ul>
            )))}
          </Card>

          <Card title="Breakages" id="breakages" openKey={ctx.breakageAsk}>
            {scouted(() => (!profile?.breakages.length ? <p>No breakages reported.</p> : (
              <ul className="note-list">
                {profile.breakages.map((b) => {
                  const at = clockTime(b.createdAt, now, ctx.timeZone);
                  return <li key={b.breakageId} className="note-block"><p>{breakageLine(b)}</p>{at && <p>{at}</p>}</li>;
                })}
              </ul>
            )))}
          </Card>
        </div>

        <div className="col">
          <Card title="Heatmap" control={ctx.maps.state === "ok" && <>
            <Switch label="Measure" value={measure} options={MEASURES} onChange={setMeasure} />
            <Switch label="Field" value={ctx.settings.heatField} options={FIELDS} onChange={(v) => ctx.changeSettings({ heatField: v })} />
          </>}>
            {ctx.maps.state !== "ok" ? <Waiting load={ctx.maps} what="the heatmaps" retry={ctx.retryMaps} /> : <>
              <HeatField tracked cells={teamCells((half ? map?.half : map?.aligned) ?? [], measure)} tone={measure === "pickedUp" ? "pickedUp" : "scored"}
                smooth={ctx.settings.heatStyle === "smooth"} half={half}
                label={`${team}: ${MEASURES.find(([k]) => k === measure)![1].toLowerCase()} per match${half ? ", the lower half folded onto the upper half" : ""}`} />
              <p className="caption">{half ? "The yellow alliance's side, the lower half folded onto the upper half." : "Every match turned to the yellow alliance's side."}</p>
            </>}
          </Card>

          <Card title="Auto paths">
            {scouted(() => (!profile?.autoPaths.length && !profile?.starts.length ? <p>No auto paths drawn yet.</p>
              : <AutoPaths paths={profile.autoPaths} starts={profile.starts} averaged={ctx.settings.autoStyle === "averaged"} />))}
          </Card>

          <CyclesCard ctx={ctx} team={team} />

          <Card title="Matches">
            {matches.length ? (
              <div className="table-wrap">
                <table className="stable">
                  <thead>
                    <tr><th>Match</th><th>With</th><th>Against</th><th className="num">Win</th><th className="num">Result</th>
                      <th className="num" title="Scouted points in the match; in italics: the official share (the alliance's score less its scouted partner, or half) where nobody scouted">Pts</th></tr>
                  </thead>
                  <tbody>
                    {matches.map((f) => {
                      const side = sideOf(f, team)!;
                      const partner = (side === "red" ? f.red : f.blue).filter((t) => t !== team);
                      const opp = side === "red" ? f.blue : f.red;
                      const [mine, theirs] = side === "red" ? [f.redActual, f.blueActual] : [f.blueActual, f.redActual];
                      return (
                        <tr key={f.matchUuid} className={`pick row-${side}`} onClick={() => ctx.openMatch(f.matchUuid)}>
                          <td>{labels.get(f.matchUuid)}</td>
                          <td>{partner.map((t) => <TeamName key={t} team={t} onOpen={ctx.openTeam} />)}</td>
                          <td>{opp.map((t) => <TeamName key={t} team={t} onOpen={ctx.openTeam} />)}</td>
                          <td className="num">{pct(winChance(f, side))}</td>
                          <td className="num">{f.played && mine != null && theirs != null ? `${mine > theirs ? "Won" : mine < theirs ? "Lost" : "Tied"} ${mine}–${theirs}` : "–"}</td>
                          <td className="num"><PtsFig pts={scoutingFirst(scoutedMatchPoints(profile?.matchPoints, f), ctx.officialShare(f.matchUuid, team))} /></td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : <p>No matches yet for this team.</p>}
          </Card>

        </div>
      </div>
    </div>
  );
}
