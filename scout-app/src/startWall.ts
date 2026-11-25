import { squareName, type Field } from "./field";

// A start position is a whole number 0 to 200 along the robot's own wall, measured on the red side:
// 0 to 50 top wall from the centre line to the corner, 50 to 150 outer wall, 150 to 200 bottom wall back to the centre line.
// Points are fractions 0 to 1 across the grid area. Blue's wall is the same path turned a half-turn.
type Alliance = "red" | "blue";

export const startXY = (v: number) =>
  v <= 50 ? { x: 0.5 - v / 100, y: 0 } : v <= 150 ? { x: 0, y: v / 100 - 0.5 } : { x: v / 100 - 1.5, y: 1 };

export const startAllowed = (v: number, field: Field) => field.startOk.some(([a, b]) => v >= a && v <= b);

// The nearest allowed whole number; a tie goes to the lower end.
export function startSnap(v: number, field: Field): number {
  v = Math.max(0, Math.min(200, Math.round(v)));
  if (startAllowed(v, field)) return v;
  let best = field.startOk[0][0];
  for (const c of field.startOk.flat()) if (Math.abs(c - v) < Math.abs(best - v)) best = c;
  return best;
}

// The allowed position closest to a point in the red frame; a tie goes to the lower number.
export function startNearest(x: number, y: number, field: Field): number {
  let best = 0, bd = Infinity;
  for (let v = 0; v <= 200; v++) {
    if (!startAllowed(v, field)) continue;
    const p = startXY(v), d = (p.x - x) ** 2 + (p.y - y) ** 2;
    if (d < bd) { bd = d; best = v; }
  }
  return best;
}

export function wallPoint(v: number, alliance: Alliance) {
  const p = startXY(v);
  return alliance === "blue" ? { x: 1 - p.x, y: 1 - p.y } : p;
}

export function startSquareFor(v: number, alliance: Alliance, field: Field): string {
  const { x, y } = wallPoint(v, alliance);
  return squareName(Math.min(field.cols - 1, Math.floor(x * field.cols)), Math.min(field.rows - 1, Math.floor(y * field.rows)));
}
