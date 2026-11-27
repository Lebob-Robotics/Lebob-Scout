// Sums behind the Cycles card and the Match planner's cycle figures. Cycles come only from our scouting (teamCycles),
// or, for a team nobody scouted, the cycle time its pit report claims. Never from the rating.
import { CURRENT_FIELD_KEY, FIELDS, squareName } from "../field";
import { chaikin, resample, type Pt } from "./autos";
import type { Cell } from "./logic";
import type { CyclePoint, CycleRoute, CycleRow, CycleSquare, TeamCycles } from "./types";

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
// A route or cycle line, rounded for drawing. A trip that comes back to where it started is drawn as a loop (loopLine).
export const roundedLine = (points: CyclePoint[]): Pt[] => chaikin(loopLine(points).map(onMap), 2).map(([x, y]): Pt => [r1(x), r1(y)]);

// A trip that ends back where it started (shoot, collect nearby, shoot from the same spot) is an out-and-back whose two
// legs lie on top of each other. Drawn as a loop instead: the line is resampled and the way out pushed to one side and
// the way back to the other (by sin 2πs along it), so it reads as a lap. A trip that never leaves its square is a small
// circle below the shot. In squares; anything else is returned as it is.
export const LOOP_CLOSE = 0.75;
export function loopLine(points: CyclePoint[]): CyclePoint[] {
  if (points.length < 2) return points;
  const a = points[0], b = points[points.length - 1];
  if (Math.hypot(a.x - b.x, a.y - b.y) > LOOP_CLOSE) return points;
  const dist = (p: CyclePoint) => Math.hypot(p.x - a.x, p.y - a.y);
  const far = points.reduce((f, p) => (dist(p) > dist(f) ? p : f), a);
  const len = dist(far);
  const n = 24;
  if (len < 0.3) {
    const r = 0.3, cx = a.x, cy = a.y + r;
    return Array.from({ length: n + 1 }, (_, i) => {
      const t = -Math.PI / 2 + (2 * Math.PI * i) / n;
      return { x: r2(cx + r * Math.cos(t)), y: r2(cy + r * Math.sin(t)) };
    });
  }
  const nx = -(far.y - a.y) / len, ny = (far.x - a.x) / len;
  const w = Math.max(0.2, Math.min(0.45, len * 0.3));
  const line = resample(points.map((p): Pt => [p.x, p.y]), n + 1);
  return line.map(([x, y], i) => {
    const o = Math.sin((2 * Math.PI * i) / n) * w;
    return { x: r2(x + nx * o), y: r2(y + ny * o) };
  });
}

// An arrowhead at the end of a drawn line (map units), pointing the way the line arrives: three corners for a polygon.
export function arrowHead(line: Pt[], size = 2.4): Pt[] | null {
  if (line.length < 2) return null;
  const tip = line[line.length - 1];
  let k = line.length - 2;
  while (k > 0 && Math.hypot(tip[0] - line[k][0], tip[1] - line[k][1]) < size) k--;
  const dx = tip[0] - line[k][0], dy = tip[1] - line[k][1], d = Math.hypot(dx, dy);
  if (!d) return null;
  const ux = dx / d, uy = dy / d, bx = tip[0] - ux * size, by = tip[1] - uy * size, h = size * 0.55;
  return [tip, [r1(bx - uy * h), r1(by + ux * h)], [r1(bx + uy * h), r1(by - ux * h)]];
}

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

// A cycle put on the upper half by its shot, as the functions do: a cycle shot from the lower half (rows 4 to 6) is
// mirrored whole across the middle line, its collecting too, so every shot is on the upper half while where it
// collects keeps its real place relative to the shot (anywhere on the full field). The shot before (`from`, the first
// point) is a shot, so it is folded onto the upper half too. `mirrored` says whether the cycle was mirrored.
const lowerSq = (sq: string) => Number(sq.slice(1)) > FIELD.rows / 2;
const mirrorSq = (sq: string) => `${sq[0]}${FIELD.rows + 1 - Number(sq.slice(1))}`;
const foldSq = (sq: string) => (lowerSq(sq) ? mirrorSq(sq) : sq);
export function alignCycle<T extends Pick2<CycleRow, "from" | "via" | "to" | "points">>(c: T): T & { mirrored: boolean } {
  const mirrored = !!c.to && lowerSq(c.to);
  const sq = (s: string) => (mirrored ? mirrorSq(s) : s);
  const points = c.points.map((p) => ({ x: p.x, y: mirrored ? r2(FIELD.rows - p.y) : p.y }));
  if (c.from && points.length) points[0] = { x: points[0].x, y: r2(Math.min(points[0].y, FIELD.rows - points[0].y)) };
  return { ...c, ...(c.from ? { from: foldSq(c.from) } : {}), via: [...new Set(c.via.map(sq))], to: c.to && sq(c.to), points, mirrored };
}
type Pick2<T, K extends keyof T> = { [P in K]: T[P] };
const r2 = (x: number) => Math.round(x * 100) / 100;

// The one averaged cycle: every timed cycle's line resampled to 12 points and averaged point by point by weight,
// as the functions do. Empty with no timed cycle.
export function averageCycle(cycles: Pick2<CycleRow, "points" | "seconds" | "weight">[], n = 12): CyclePoint[] {
  const timed = cycles.filter((c) => c.seconds != null);
  const total = timed.reduce((a, c) => a + c.weight, 0);
  if (!total) return [];
  const lines = timed.map((c) => ({ line: resample(c.points.map((p): Pt => [p.x, p.y]), n), w: c.weight }));
  return Array.from({ length: n }, (_, i) => ({
    x: r2(lines.reduce((a, l) => a + l.line[i][0] * l.w, 0) / total), y: r2(lines.reduce((a, l) => a + l.line[i][1] * l.w, 0) / total),
  }));
}

// The averaged cycle's label: the average cycle time and how many timed cycles it is drawn from.
export function averageLabel(c: Pick2<TeamCycles, "seconds" | "cycles">): string {
  const n = Math.round(c.cycles.filter((x) => x.seconds != null).reduce((a, x) => a + x.weight, 0) * 10) / 10;
  return [c.seconds != null && `${r1(c.seconds)}s`, `${n} cycle${n === 1 ? "" : "s"}`].filter(Boolean).join(" · ");
}

// The note under the cycle map: every shot is put on the upper half, and how many cycles were shot from the lower half.
export const foldNote = (share: number | undefined) =>
  `The yellow alliance's side. Each cycle is flipped so its shot is on the upper half${share != null ? ` (shot from the lower half: ${Math.round(share * 100)}%)` : ""}.`;
