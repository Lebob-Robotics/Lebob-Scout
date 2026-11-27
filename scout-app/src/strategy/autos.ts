// A team's autos for the Auto paths card: as drawn, or all averaged into one rounded path.
// Points are the scout app's: 0 to 100 across the grid area, red's wall on the left, as stored (see autoPath.ts).
import { splitPath } from "../autoPath";
import { CURRENT_FIELD_KEY, FIELDS, flipSquare, isSquare, squareName } from "../field";

export type Pt = [number, number];
export type Shot = { square: string; count: number };
export type AutoPath = { label: string; alliance: string; points: string; shots?: Shot[] };
// One auto, or several merged: `labels` names its matches; `lines` are drive paths, `dots` the spots a scout marked.
export type Auto = { labels: string[]; alliance: "red" | "blue"; lines: Pt[][]; dots: Pt[]; shots: Shot[] };

// (Kept for reference and its test; no longer used to group autos.) Two autos are the same routine when their resampled points are this far apart on average, or less (0 to 100
// units; a grid square is 16.7). Tuned on the dev data: the same route run twice sits about 2 apart, a different
// start or route 20 or more.
export const SAME_AUTO = 8;
// Light colours that read on the dark field picture: one per auto, cycle route or line.
export const PATH_COLOURS = ["#fde68a", "#a5f3fc", "#f9a8d4", "#bbf7d0", "#c4b5fd", "#fed7aa", "#e5e7eb"];
export const RESAMPLE = 24;

const FIELD = FIELDS[CURRENT_FIELD_KEY];
const side = (a: string): "red" | "blue" => (a === "blue" ? "blue" : "red");
// The field is the same turned a half-turn, so a blue auto turned that way is a red one.
export const turn = ([x, y]: Pt): Pt => [100 - x, 100 - y];
const shotsOf = (p: AutoPath) => (p.shots ?? []).filter((s) => isSquare(s.square, FIELD) && s.count > 0);

// An auto on the left-hand side, the side the strategy app shows a team on: a blue one turned a half-turn, its lines,
// marked spots and shooting squares with it. A red one is already there.
export function onOurSide(a: Auto): Auto {
  if (a.alliance !== "blue") return a;
  return {
    ...a, alliance: "red", lines: a.lines.map((l) => l.map(turn)), dots: a.dots.map(turn),
    shots: a.shots.map((s) => ({ ...s, square: flipSquare(s.square, FIELD) })),
  };
}

export function asDrawn(paths: AutoPath[]): Auto[] {
  return paths.map((p) => ({ labels: [p.label], alliance: side(p.alliance), ...splitPath(p.points), shots: shotsOf(p) }));
}

export const dist = (a: Pt, b: Pt) => Math.hypot(a[0] - b[0], a[1] - b[1]);

// n points spread evenly along a path by distance travelled; a single point repeated; none for an empty path.
export function resample(pts: Pt[], n: number): Pt[] {
  if (!pts.length) return [];
  const legs = pts.slice(1).map((p, i) => dist(pts[i], p));
  const total = legs.reduce((a, b) => a + b, 0);
  if (total === 0) return Array.from({ length: n }, () => [...pts[0]] as Pt);
  const out: Pt[] = [];
  let leg = 0, before = 0;
  for (let k = 0; k < n; k++) {
    const want = (total * k) / (n - 1);
    while (leg < legs.length - 1 && before + legs[leg] < want) { before += legs[leg]; leg++; }
    const t = legs[leg] ? Math.min(1, (want - before) / legs[leg]) : 0;
    const [a, b] = [pts[leg], pts[leg + 1]];
    out.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]);
  }
  return out;
}

export const meanDistance = (a: Pt[], b: Pt[]) => a.reduce((s, p, i) => s + dist(p, b[i]), 0) / a.length;
export const averagePath = (paths: Pt[][]): Pt[] =>
  paths[0].map((_, i) => [paths.reduce((s, p) => s + p[i][0], 0) / paths.length, paths.reduce((s, p) => s + p[i][1], 0) / paths.length]);

// Chaikin's corner cutting: each round replaces every corner with two points a quarter of the way along, so the
// path reads as a smooth curve. The ends stay where they are.
export function chaikin(pts: Pt[], rounds = 2): Pt[] {
  let p = pts;
  for (let r = 0; r < rounds && p.length > 2; r++) {
    const next: Pt[] = [p[0]];
    for (let i = 0; i < p.length - 1; i++) {
      const [a, b] = [p[i], p[i + 1]];
      next.push([0.75 * a[0] + 0.25 * b[0], 0.75 * a[1] + 0.25 * b[1]], [0.25 * a[0] + 0.75 * b[0], 0.25 * a[1] + 0.75 * b[1]]);
    }
    next.push(p[p.length - 1]);
    p = next;
  }
  return p;
}

const r1 = (x: number) => Math.round(x * 10) / 10;

// Every auto averaged into one (the "Averaged" setting). Each drawn path is joined into one line, turned into red's
// frame if blue, resampled and averaged point by point into one rounded path; each square's shots are averaged over
// all the autos, including ones scouted with no line. It is drawn on the side most of the autos ran on. A single auto
// is left as drawn.
export function averagedAutos(paths: AutoPath[], n = RESAMPLE): Auto[] {
  const drawn = asDrawn(paths);
  if (drawn.length < 2) return drawn;
  const lines = drawn
    .map((a) => ({ a, joined: a.lines.flat() }))
    .filter(({ joined }) => joined.length >= 2)
    .map(({ a, joined }) => resample(a.alliance === "blue" ? joined.map(turn) : joined, n));
  const blue = drawn.filter((a) => a.alliance === "blue").length > drawn.length / 2;
  const total = new Map<string, number>();
  drawn.forEach((a) => a.shots.forEach((s) => {
    const sq = a.alliance === "blue" ? flipSquare(s.square, FIELD) : s.square;
    total.set(sq, (total.get(sq) ?? 0) + s.count);
  }));
  const shots = [...total].sort(([a], [b]) => a.localeCompare(b))
    .map(([sq, c]) => ({ square: blue ? flipSquare(sq, FIELD) : sq, count: r1(c / drawn.length) }));
  const line = lines.length ? chaikin(averagePath(lines)).map((p) => (blue ? turn(p) : p)).map(([x, y]): Pt => [r1(x), r1(y)]) : [];
  return [{ labels: drawn.map((a) => a.labels[0]), alliance: blue ? "blue" : "red", lines: line.length ? [line] : [], dots: [], shots }];
}

// Where each auto's shots are marked: at the square's centre, autos sharing a square set side by side, each sized by
// its count.
export type ShotMark = { auto: number; square: string; count: number; x: number; y: number; r: number };
export function shotMarks(autos: Auto[]): ShotMark[] {
  const at = new Map<string, { auto: number; count: number }[]>();
  autos.forEach((a, i) => a.shots.forEach((s) => at.set(s.square, [...(at.get(s.square) ?? []), { auto: i, count: s.count }])));
  const w = 100 / FIELD.cols, h = 100 / FIELD.rows;
  const marks: ShotMark[] = [];
  for (let row = 0; row < FIELD.rows; row++) {
    for (let col = 0; col < FIELD.cols; col++) {
      const square = squareName(col, row);
      const here = at.get(square) ?? [];
      here.forEach((m, k) => marks.push({
        ...m, square, x: r1((col + 0.5) * w + (k - (here.length - 1) / 2) * 6), y: r1((row + 0.5) * h), r: r1(2.8 + 1.2 * Math.sqrt(m.count)),
      }));
    }
  }
  return marks;
}
