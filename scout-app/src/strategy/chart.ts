// The Team tab's rating chart: a y-axis fitted to the rating line with round ticks, match labels that never crowd,
// and for each match a tall strip that a hover or tap picks.
import type { HistoryPoint } from "./types";

// A round step near `raw`: 1, 2, 2.5 or 5 times a power of ten.
export function niceStep(raw: number): number {
  if (!(raw > 0) || !Number.isFinite(raw)) return 1;
  const p = 10 ** Math.floor(Math.log10(raw));
  const f = raw / p;
  return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10) * p;
}

// Round ticks covering lo to hi in about `count` steps.
export function niceTicks(lo: number, hi: number, count = 4): { min: number; max: number; ticks: number[] } {
  if (hi - lo < 1e-9) { lo -= 1; hi += 1; }
  const step = niceStep((hi - lo) / count);
  const min = Math.floor(lo / step + 1e-9) * step, max = Math.ceil(hi / step - 1e-9) * step;
  const ticks: number[] = [];
  for (let v = min; v <= max + step / 2; v += step) ticks.push(Math.round(v * 1000) / 1000);
  return { min, max, ticks };
}

// The axis fits the OPR line, with room above and below: a quarter of its spread, or three quarters of its median
// standard error (but never more than the spread, or 10), or 2, whichever is most. The likely band may run past the
// edges and is clipped, so a wide band never flattens the line.
export function fitAxis(points: HistoryPoint[]): { lo: number; hi: number } {
  const ys = points.map((p) => p.opr);
  const lo = Math.min(...ys), hi = Math.max(...ys);
  const ses = points.map((p) => p.oprSe).filter((s): s is number => s != null).sort((a, b) => a - b);
  const medianSe = ses.length ? ses[Math.floor(ses.length / 2)] : 0;
  const room = Math.max((hi - lo) * 0.25, Math.min(medianSe * 0.75, Math.max(hi - lo, 10)), 2);
  return { lo: lo - room, hi: hi + room };
}

// Which x-axis labels to show, given each label's x: the first, then each one at least `gap` past the last shown;
// the last always shows, taking the place of the one before it when they would touch.
export function pickLabels(xs: number[], gap: number): number[] {
  const out: number[] = [];
  xs.forEach((x, i) => { if (!out.length || x - xs[out[out.length - 1]] >= gap) out.push(i); });
  const last = xs.length - 1;
  if (last > 0 && out[out.length - 1] !== last) {
    if (xs[last] - xs[out[out.length - 1]] < gap && out.length > 1) out.pop();
    out.push(last);
  }
  return out;
}

// Which match a point on the chart belongs to: the strip it falls in, kept to the first and last.
export function hitIndex(hits: { x: number; w: number }[], x: number): number {
  const i = hits.findIndex((h) => x < h.x + h.w);
  return i < 0 ? hits.length - 1 : i;
}

export type Pad = { left: number; right: number; top: number; bottom: number };
export type Chart = {
  plot: { x: number; y: number; w: number; h: number };
  line: string; band: string;
  ticks: { y: number; label: string }[];
  labels: { x: number; text: string }[];
  dots: { x: number; y: number; point: HistoryPoint }[];
  // Each dot's strip: from halfway to the dot before to halfway to the dot after, the plot's full height.
  hits: { x: number; w: number }[];
};

const r1 = (v: number) => Math.round(v * 10) / 10;
export const matchName = (p: HistoryPoint) => p.lastMatch || `Q${p.afterMatch}`;

export function ratingChart(points: HistoryPoint[], w: number, h: number, pad: Pad = { left: 32, right: 10, top: 10, bottom: 22 }, labelGap = 24): Chart | null {
  const ps = [...points].sort((a, b) => a.afterMatch - b.afterMatch);
  if (!ps.length) return null;
  const { lo, hi } = fitAxis(ps);
  const { min, max, ticks } = niceTicks(lo, hi);
  const plot = { x: pad.left, y: pad.top, w: w - pad.left - pad.right, h: h - pad.top - pad.bottom };
  const x0 = ps[0].afterMatch, x1 = ps[ps.length - 1].afterMatch;
  const x = (v: number) => r1(plot.x + (x1 === x0 ? 0.5 : (v - x0) / (x1 - x0)) * plot.w);
  const y = (v: number) => r1(plot.y + (1 - (v - min) / (max - min)) * plot.h);
  const path = (pts: [number, number][]) => pts.map(([a, b], i) => `${i ? "L" : "M"}${a} ${b}`).join(" ");
  const upper = ps.map((p): [number, number] => [x(p.afterMatch), y(p.opr + (p.oprSe ?? 0))]);
  const lower = ps.map((p): [number, number] => [x(p.afterMatch), y(p.opr - (p.oprSe ?? 0))]).reverse();
  const dots = ps.map((p) => ({ x: x(p.afterMatch), y: y(p.opr), point: p }));
  const xs = dots.map((d) => d.x);
  const hits = xs.map((v, i) => {
    const a = i ? (xs[i - 1] + v) / 2 : plot.x, b = i < xs.length - 1 ? (v + xs[i + 1]) / 2 : plot.x + plot.w;
    return { x: r1(a), w: r1(b - a) };
  });
  return {
    plot, dots, hits,
    line: path(dots.map((d): [number, number] => [d.x, d.y])),
    band: `${path([...upper, ...lower])} Z`,
    ticks: ticks.map((t) => ({ y: y(t), label: String(t) })),
    labels: pickLabels(xs, labelGap).map((i) => ({ x: xs[i], text: matchName(ps[i]) })),
  };
}
