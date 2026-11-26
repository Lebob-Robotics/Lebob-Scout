import { useEffect, useRef, useState } from "react";
import { CURRENT_FIELD_KEY, FIELDS } from "../field";
import type { Ctx } from "./StrategyApp";
import { PATH_COLOURS } from "./autos";
import {
  averageLabel, cycleCells, cycleTime, cyclesFigure, foldNote, roundedLine, routeLines, routeWidth, timeParts, type CycleMeasure, type CycleTime, type Part,
} from "./cycles";
import { one, popPlace } from "./logic";
import { Card, HeatField, RangeBar, Switch, Tiles, Waiting } from "./parts";
import type { CycleRoute, TeamCycles } from "./types";

const MEASURES: [CycleMeasure, string][] = [["passes", "Crossed"], ["intakes", "Collect"], ["shots", "Shoot"]];
const TONE: Record<CycleMeasure, "cross" | "pickedUp" | "scored"> = { passes: "cross", intakes: "pickedUp", shots: "scored" };
const PART_NAMES: Record<Part["name"], string> = { collect: "Collect", travel: "Travel", shoot: "Shoot" };

// The cycle time: scouted, or (in italics, tagged) what the pit report claims.
export function CycleTimeFig({ time }: { time: CycleTime | null }) {
  if (!time) return <>–</>;
  if (time.source === "scouted") return <span className="fig" title="Scouted">{one(time.value)}s</span>;
  return <span className="fig model" title="The pit report's claim: no cycles scouted yet">{one(time.value)}s<small> pit claim</small></span>;
}

// One team's teleop cycles, from our scouting only: how many a match, how long and where the time goes, pieces each
// time, and a map of where they run with the routes they use most (or every cycle, with "As drawn").
export function CyclesCard({ ctx, team }: { ctx: Ctx; team: number }) {
  const [measure, setMeasure] = useState<CycleMeasure>("passes");
  const c = ctx.teamCycles(team);
  const fig = cyclesFigure(c);
  const time = cycleTime(fig ? c : undefined, ctx.profile(team)?.pits ?? []);
  const parts = fig ? timeParts(c) : null;
  return (
    <Card title="Cycles" control={fig && <Switch label="Cycle map" value={measure} options={MEASURES} onChange={setMeasure} />}>
      {ctx.cycles.state !== "ok" && <Waiting load={ctx.cycles} what="the cycles" retry={ctx.retryCycles} />}
      {fig || time ? (
        <Tiles tiles={[
          ["cycles / match", fig ? <RangeBar value={fig.value} low={fig.low} high={fig.high} max={ctx.scale.cycles} title={`${one(fig.low)} to ${one(fig.high)} a match`} /> : "–"],
          ["cycle time", <CycleTimeFig key="time" time={time} />],
          ["pieces / cycle", one(c?.piecesPerCycle)],
        ]} />
      ) : ctx.cycles.state === "ok" && <p>Not scouted yet.</p>}
      {parts && <TimeBar parts={parts} />}
      {fig && c && (
        <>
          <CycleMap c={c} measure={measure} smooth={ctx.settings.heatStyle === "smooth"} drawn={ctx.settings.autoStyle === "drawn"} />
          <p className="caption">{foldNote(c.mirroredShare)}</p>
        </>
      )}
    </Card>
  );
}

// The average cycle time split into collect, travel and shoot, end to end.
function TimeBar({ parts }: { parts: Part[] }) {
  return (
    <div className="time-bar">
      <div className="time-track" role="img" aria-label={parts.map((p) => `${PART_NAMES[p.name]} ${one(p.seconds)} seconds`).join(", ")}>
        {parts.map((p) => <span key={p.name} className={`time-part ${p.name}`} style={{ width: `${p.share}%` }} />)}
      </div>
      <ul className="time-legend">
        {parts.map((p) => <li key={p.name}><span className={`time-swatch ${p.name}`} />{PART_NAMES[p.name]} <b>{one(p.seconds)}s</b></li>)}
      </ul>
    </div>
  );
}

// The cycle map: the chosen measure shaded per square, and on top the one averaged cycle (bold, labelled with the
// average time and how many cycles), over the routes the team uses most (fainter, thicker for more of its cycles;
// hover or tap one for where it goes). With "As drawn", every cycle as a thin line. Every cycle arrives folded onto
// the upper half (see foldCycle), so the map is always the half field.
function CycleMap({ c, measure, smooth, drawn }: { c: TeamCycles; measure: CycleMeasure; smooth: boolean; drawn: boolean }) {
  const field = FIELDS[CURRENT_FIELD_KEY];
  const [open, setOpen] = useState<number | null>(null);
  const wrap = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (open == null) return;
    const close = (e: PointerEvent) => { if (!wrap.current?.contains(e.target as Node)) setOpen(null); };
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, [open]);

  const routes = c.routes.map((r, i) => ({ r, line: roundedLine(r.points), colour: PATH_COLOURS[i % PATH_COLOURS.length] }));
  const average = roundedLine(c.average ?? []);
  const avgMid = average[Math.floor(average.length / 2)] ?? [0, 0];
  const overlay = drawn ? (
    <g className="cycle-lines">
      {c.cycles.map((row, i) => (
        <polyline key={i} points={roundedLine(row.points).map((q) => q.join(",")).join(" ")}>
          <title>{`${row.label}: ${[row.from, ...row.via, row.to].filter(Boolean).join(" to ")}${row.seconds != null ? `, ${one(row.seconds)}s` : ""}`}</title>
        </polyline>
      ))}
    </g>
  ) : (
    <>
    <g className="routes faint">
      {routes.map(({ r, line, colour }, i) => {
        const pts = line.map((q) => q.join(",")).join(" ");
        const end = line[line.length - 1];
        const width = Math.max(1.5, routeWidth(r.share) * 0.6);
        const show = (e: { pointerType: string }) => { if (e.pointerType === "mouse") setOpen(i); };
        return (
          <g key={i} className={open === i ? "route on" : "route"} style={{ color: colour }}
            onPointerEnter={show} onPointerLeave={(e) => { if (e.pointerType === "mouse") setOpen(null); }}
            onPointerDown={(e) => { if (e.pointerType !== "mouse") setOpen(open === i ? null : i); }}>
            <polyline className="route-hit" points={pts} />
            <polyline className="route-halo" points={pts} strokeWidth={width + 3} />
            <polyline className="route-line" points={pts} strokeWidth={width} />
            <circle className="route-end" cx={end[0]} cy={end[1]} r="1.6" />
          </g>
        );
      })}
    </g>
    {average.length > 1 && (
      <g className="avg-cycle">
        <polyline className="avg-halo" points={average.map((q) => q.join(",")).join(" ")} />
        <polyline className="avg-line" points={average.map((q) => q.join(",")).join(" ")} />
        <circle cx={average[average.length - 1][0]} cy={average[average.length - 1][1]} r="2.6" />
        <text className="avg-label" x={avgMid[0]} y={avgMid[1] - 3.5}>{averageLabel(c)}</text>
      </g>
    )}
    </>
  );
  const pick = open != null ? routes[open] : null;
  return (
    <div ref={wrap}>
      <HeatField cells={cycleCells(c.squares, measure)} tone={TONE[measure]} smooth={smooth} overlay={overlay} hidePop={pick != null} half tracked
        label={`Cycle map, folded onto the upper half: ${MEASURES.find(([m]) => m === measure)![1].toLowerCase()} per match${drawn ? ", every cycle drawn" : `, the averaged cycle over ${c.routes.length} routes`}`}>
        {pick && <RoutePop route={pick.r} at={pick.line[Math.floor(pick.line.length / 2)]} cols={field.cols} rows={field.rows} />}
      </HeatField>
    </div>
  );
}

// A route's pop-up at its middle point, on the half field: the picture shows rows 1 to 3, so heights are measured
// against half the field.
function RoutePop({ route, at, cols, rows }: { route: CycleRoute; at: [number, number]; cols: number; rows: number }) {
  const shown = rows / 2, squareH = 100 / rows;
  const col = Math.min(cols - 1, Math.floor((at[0] / 100) * cols)), row = Math.min(shown - 1, Math.floor(at[1] / squareH));
  const p = popPlace(col, row, cols, shown);
  return (
    <div className={`heat-pop ${p.below ? "below" : "above"} lean-${p.lean}`} style={{ left: `${12.5 + at[0] * 0.75}%`, top: `${(at[1] / (shown * squareH)) * 100}%` }} role="status">
      <b>Route</b>
      <dl>{routeLines(route).map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}</dl>
    </div>
  );
}
