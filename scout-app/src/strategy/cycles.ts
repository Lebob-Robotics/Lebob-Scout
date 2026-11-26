// Sums behind the Cycles card and the Match planner's cycle figures. Cycles come only from our scouting (teamCycles),
// or, for a team nobody scouted, the cycle time its pit report claims. Never from the rating.
import { CURRENT_FIELD_KEY, FIELDS, squareName } from "../field";
import { chaikin, type Pt } from "./autos";
import type { Cell } from "./logic";
import type { CyclePoint, CycleRoute, CycleSquare, TeamCycles } from "./types";

const FIELD = FIELDS[CURRENT_FIELD_KEY];
const r1 = (x: number) => Math.round(x * 10) / 10;
const fig = (x: number) => String(Math.round(x * 100) / 100);

// What the cycle map shades: squares crossed, collected from, or shot from, per match.
export type CycleMeasure = "passes" | "intakes" | "shots";
export const cycleCells = (squares: CycleSquare[], m: CycleMeasure): Map<string, Cell> => new Map(squares.map((s) => [s.square, {
  value: s[m], lines: [["Crossed", fig(s.passes)], ["Collect", fig(s.intakes)], ["Shoot", fig(s.shots)]],
}]));

// A point in squares (0 to 6) as a point on the heatmap overlay (0 to 100).
export const onMap = (p: CyclePoint): Pt => [r1((p.x * 100) / FIELD.cols), r1((p.y * 100) / FIELD.rows)];
// A route or cycle line, rounded for drawing.
export const roundedLine = (points: CyclePoint[]): Pt[] => chaikin(points.map(onMap), 2).map(([x, y]): Pt => [r1(x), r1(y)]);

// The team's cycles per match with its lowest and highest match; null when nobody scouted a cycle.
export function cyclesFigure(c: TeamCycles | undefined): { value: number; low: number; high: number } | null {
  if (!c || !c.matches) return null;
  return { value: c.cyclesPerMatch, low: c.cyclesLow ?? c.cyclesPerMatch, high: c.cyclesHigh ?? c.cyclesPerMatch };
}

// The cycle time: scouted when we have timed cycles, else what the pit report claims, else nothing.
export type CycleTime = { value: number; source: "scouted" | "pit" };
export function cycleTime(c: TeamCycles | undefined, pits: { claimedCycleSeconds?: number }[] = []): CycleTime | null {
  if (c?.seconds != null) return { value: c.seconds, source: "scouted" };
  const claim = pits.find((p) => p.claimedCycleSeconds != null)?.claimedCycleSeconds;
  return claim != null ? { value: claim, source: "pit" } : null;
}

// The stacked bar: collect, travel and shoot, each as a share of the whole (adding up to 100). Null without all three.
export type Part = { name: "collect" | "travel" | "shoot"; seconds: number; share: number };
export function timeParts(c: TeamCycles | undefined): Part[] | null {
  if (c?.collectSeconds == null || c.travelSeconds == null || c.shootSeconds == null) return null;
  const parts = [["collect", c.collectSeconds], ["travel", c.travelSeconds], ["shoot", c.shootSeconds]] as const;
  const total = parts.reduce((a, [, s]) => a + Math.max(0, s), 0);
  return parts.map(([name, s]) => ({ name, seconds: s, share: total ? r1((Math.max(0, s) / total) * 100) : 0 }));
}

// A route's line width on screen (px), by its share of the team's timed cycles.
export const routeWidth = (share: number) => r1(2 + 8 * Math.max(0, Math.min(1, share)));
// A route's small label: how many cycles follow it, and their average time.
export const routeLabel = (r: CycleRoute) => `x${r1(r.cycles)}${r.seconds != null ? ` · ${r1(r.seconds)}s` : ""}`;
// A route's full description for its pop-up.
export const routeLines = (r: CycleRoute): [string, string][] => [
  ["From", r.from || "teleop start"], ["Via", r.via || "–"], ["To", r.to || "–"],
  ["Time", r.seconds != null ? `${r1(r.seconds)}s` : "–"], ["Cycles", `${r1(r.cycles)} (${Math.round(r.share * 100)}%)`],
];

// Every square a line through the points crosses, once each (as the function counts passes).
export function crossedSquares(points: CyclePoint[]): string[] {
  const out = new Set<string>();
  const add = (p: CyclePoint) => out.add(squareName(Math.min(FIELD.cols - 1, Math.max(0, Math.floor(p.x))), Math.min(FIELD.rows - 1, Math.max(0, Math.floor(p.y)))));
  points.forEach((p, i) => {
    add(p);
    if (!i) return;
    const a = points[i - 1], steps = Math.ceil(Math.hypot(p.x - a.x, p.y - a.y) / 0.1);
    for (let k = 1; k < steps; k++) add({ x: a.x + ((p.x - a.x) * k) / steps, y: a.y + ((p.y - a.y) * k) / steps });
  });
  return [...out];
}

// A square's centre, in squares.
export const centre = (square: string): CyclePoint => ({ x: square.charCodeAt(0) - 65 + 0.5, y: Number(square.slice(1)) - 0.5 });
