import { useRef, useState, type PointerEvent } from "react";
import { clamp100, decPath, encPath, simplifyPath, type Stroke } from "../autoPath";
import { FieldPicture } from "./FieldPicture";

const line = (s: Stroke) => s.map((p) => p.join(",")).join(" ");

// Draws on the grid area of the field. Points are stored unflipped: x 0 is the red wall, y 0 the top row.
export function AutoPathPad({ fieldKey, flipped, value, onChange }: {
  fieldKey: string;
  flipped: boolean;
  value: string | null;
  onChange(text: string | null): void;
}) {
  const [strokes, setStrokes] = useState(() => decPath(value));
  const [drawing, setDrawing] = useState<Stroke | null>(null);
  const points = useRef<Stroke | null>(null);

  const save = (next: Stroke[]) => {
    setStrokes(next);
    onChange(encPath(next));
  };

  const add = (e: PointerEvent<HTMLDivElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    const x = clamp100((e.clientX - r.left) / r.width), y = clamp100((e.clientY - r.top) / r.height);
    const p: [number, number] = flipped ? [100 - x, 100 - y] : [x, y];
    const pts = points.current!;
    const last = pts[pts.length - 1];
    if (!last || last[0] !== p[0] || last[1] !== p[1]) pts.push(p);
    setDrawing([...pts]);
  };

  const end = (keep: boolean) => {
    const pts = points.current;
    points.current = null;
    setDrawing(null);
    if (keep && pts && pts.length > 1) save(simplifyPath([...strokes, pts])); // a tap is not a stroke
  };

  return (
    <div className="pad">
      <div className="field-space">
        <div className="field">
          <FieldPicture fieldKey={fieldKey} flipped={flipped} />
          <div
            className="pad-surface"
            onPointerDown={(e) => {
              e.currentTarget.setPointerCapture(e.pointerId);
              points.current = [];
              add(e);
            }}
            onPointerMove={(e) => points.current && add(e)}
            onPointerUp={() => end(true)}
            onPointerCancel={() => end(false)}
          >
            <svg className={flipped ? "pad-lines flipped" : "pad-lines"} viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
              {[...strokes, ...(drawing ? [drawing] : [])].map((s, i) => <polyline key={i} points={line(s)} />)}
            </svg>
          </div>
        </div>
      </div>
      <div className="pad-buttons">
        <button type="button" disabled={!strokes.length} onClick={() => save(strokes.slice(0, -1))}>Undo</button>
        <button type="button" disabled={!strokes.length} onClick={() => save([])}>Clear</button>
      </div>
    </div>
  );
}
