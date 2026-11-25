export type Stroke = [number, number][];

export const PATH_MAX = 30;
export const clamp100 = (v: number): number => Math.max(0, Math.min(100, Math.round(v * 100)));

// Ramer-Douglas-Peucker
function rdp(pts: Stroke, eps: number): Stroke {
  if (pts.length < 3) return pts.slice();
  const [ax, ay] = pts[0], [bx, by] = pts[pts.length - 1], dx = bx - ax, dy = by - ay, L = Math.hypot(dx, dy) || 1;
  let im = 0, dm = -1;
  for (let i = 1; i < pts.length - 1; i++) {
    const d = Math.abs(dy * pts[i][0] - dx * pts[i][1] + bx * ay - by * ax) / L;
    if (d > dm) { dm = d; im = i; }
  }
  if (dm <= eps) return [pts[0], pts[pts.length - 1]];
  return [...rdp(pts.slice(0, im + 1), eps).slice(0, -1), ...rdp(pts.slice(im), eps)];
}

// 0-100 points, PATH_MAX in all; a stroke keeps at least its two ends
export function simplifyPath(strokes: Stroke[]): Stroke[] {
  let eps = 0.5, out = strokes;
  for (;;) {
    out = strokes.map((st) => rdp(st, eps)).filter((st) => st.length);
    if (out.reduce((a, st) => a + st.length, 0) <= PATH_MAX || eps > 60) break;
    eps *= 1.6;
  }
  let left = PATH_MAX;
  return out.filter((st) => (left -= st.length) >= 0); // still too many strokes: keep the first ones
}

export const encPath = (st: Stroke[]): string | null =>
  st.map((s) => s.map(([x, y]) => x + "," + y).join(" ")).join("|") || null;

export const decPath = (t: string | null): Stroke[] =>
  String(t || "").split("|")
    .map((s) => s.trim().split(/\s+/).map((p) => p.split(",").map(Number)).filter((p): p is [number, number] => p.length === 2 && p.every(Number.isFinite)))
    .filter((s) => s.length);
