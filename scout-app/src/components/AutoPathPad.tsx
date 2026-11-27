import { useRef, useState, type PointerEvent } from "react";
import { AUTO_DOTS, SPOT_NEAR, clamp100, joinPath, simplifyPath, splitPath, type Stroke } from "../autoPath";
import { FieldPicture } from "./FieldPicture";

type Point = [number, number];
const line = (s: Stroke) => s.map((p) => p.join(",")).join(" ");
const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

// The old site's AUTO diagram. "Drive path" draws with a finger (the first line starts at the start spot);
// "Shooting spot" drops a spot (at most AUTO_DOTS, tap one to remove it). Undo takes back the last line or spot.
// Points are stored unflipped, 0 to 100: x 0 is the red wall, y 0 the top row. start is the start spot in that frame, 0 to 1.
export function AutoPathPad({ fieldKey, flipped, value, onChange, start, alliance, onFlip }: {
  fieldKey: string;
  flipped: boolean;
  value: string | null;
  onChange(text: string | null): void;
  start: { x: number; y: number } | null;
  alliance: "red" | "blue";
  onFlip(): void;
}) {
  const [{ lines, dots }, setMarks] = useState(() => splitPath(value));
  const [tool, setTool] = useState<"line" | "dot">("line");
  const [drawing, setDrawing] = useState<Stroke | null>(null);
  const [full, setFull] = useState(false); // the "6 spots" message, until the next change
  // What was added, in order, for Undo. A reopened report has none, so Undo takes lines first, then spots.
  const hist = useRef<("l" | "d")[]>([]);
  const points = useRef<Stroke | null>(null);

  const save = (l: Stroke[], d: Point[]) => {
    setMarks({ lines: simplifyPath(l), dots: d });
    setFull(false);
    onChange(joinPath(l, d));
  };

  const at = (e: PointerEvent<HTMLDivElement>): Point => {
    const r = e.currentTarget.getBoundingClientRect();
    const x = clamp100((e.clientX - r.left) / r.width), y = clamp100((e.clientY - r.top) / r.height);
    return flipped ? [100 - x, 100 - y] : [x, y];
  };

  const spot = (q: Point) => {
    const near = dots.findIndex(([x, y]) => Math.hypot(x - q[0], y - q[1]) <= SPOT_NEAR);
    if (near >= 0) {
      const h = hist.current.lastIndexOf("d");
      if (h >= 0) hist.current.splice(h, 1);
      save(lines, dots.filter((_, i) => i !== near));
    } else if (dots.length >= AUTO_DOTS) setFull(true);
    else {
      hist.current.push("d");
      save(lines, [...dots, q]);
    }
  };

  const add = (q: Point) => {
    const pts = points.current!, last = pts[pts.length - 1];
    if (!last || Math.hypot(q[0] - last[0], q[1] - last[1]) >= 1) pts.push(q);
    setDrawing([...pts]);
  };
  const end = (keep: boolean) => {
    const pts = points.current;
    points.current = null;
    setDrawing(null);
    if (keep && pts && pts.length > 1) { // a tap is not a line
      hist.current.push("l");
      save([...lines, pts], dots);
    }
  };

  const undo = () => {
    const h = hist.current.pop() ?? (lines.length ? "l" : dots.length ? "d" : null);
    if (h === "l" && lines.length) save(lines.slice(0, -1), dots);
    else if (h === "d" && dots.length) save(lines, dots.slice(0, -1));
  };
  const clear = () => {
    if (!(lines.length + dots.length) || !confirm("Clear the AUTO lines and dots?")) return;
    hist.current = [];
    save([], []);
  };

  const nl = lines.length, nd = dots.length;
  const caption = full ? `That's ${AUTO_DOTS} shooting spots, the most for one match. Tap a spot to remove it first.`
    : (tool === "dot" ? `Shooting spot: tap where it shot from in AUTO (up to ${AUTO_DOTS}); tap a spot to remove it.`
      : start ? "Drive path: draw it with your finger, from the start spot." : "Drive path: draw it with your finger (no start spot was marked).")
      + (nl || nd ? ` ${plural(nl, "path line")}, ${plural(nd, "shooting spot")}.` : "");

  return (
    <div className="pad">
      <div className="fbar">
        <div className="seg tools">
          <button type="button" aria-pressed={tool === "line"} onClick={() => { setTool("line"); setFull(false); }}><span aria-hidden="true">✎</span> Drive path</button>
          <button type="button" aria-pressed={tool === "dot"} onClick={() => setTool("dot")}><span aria-hidden="true">◎</span> Shooting spot</button>
        </div>
        <button type="button" onClick={undo}>Undo</button>
        <button type="button" onClick={clear}>Clear</button>
        <button type="button" onClick={onFlip}>Rotate view</button>
      </div>
      <div className="field-space">
        <div className="field">
          <FieldPicture fieldKey={fieldKey} flipped={flipped} scoring={alliance} />
          <div
            className="pad-surface"
            aria-label="Field diagram: draw the AUTO path"
            // Only the first finger draws: a second one would merge into the line.
            onPointerDown={(e) => {
              if (!e.isPrimary) return;
              if (tool === "dot") return spot(at(e));
              e.currentTarget.setPointerCapture(e.pointerId);
              points.current = !lines.length && start ? [[clamp100(start.x), clamp100(start.y)]] : [];
              add(at(e));
            }}
            onPointerMove={(e) => e.isPrimary && points.current && add(at(e))}
            onPointerUp={(e) => e.isPrimary && end(true)}
            onPointerCancel={(e) => e.isPrimary && end(false)}
          >
            <svg className={flipped ? "pad-lines flipped" : "pad-lines"} viewBox="0 0 100 100" aria-hidden="true">
              {[...lines, ...(drawing ? [drawing] : [])].map((s, i) => <polyline key={i} points={line(s)} />)}
              {dots.map(([x, y], i) => (
                <g key={i} className="adot"><circle cx={x} cy={y} r={2.9} /><circle cx={x} cy={y} r={0.85} /></g>
              ))}
              {start && <circle className={`astart ${alliance}`} cx={start.x * 100} cy={start.y * 100} r={2.7} />}
            </svg>
          </div>
        </div>
      </div>
      <p className={full ? "caption keep" : "caption"} aria-live="polite">{caption}</p>
    </div>
  );
}
