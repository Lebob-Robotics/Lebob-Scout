import { useRef, type KeyboardEvent, type PointerEvent } from "react";
import { FIELDS } from "../field";
import { startAllowed, startNearest, startSquareFor, wallPoint } from "../startWall";
import { FieldPicture } from "./FieldPicture";

type Alliance = "red" | "blue";
const GRID_LEFT = 0.125, GRID_WIDTH = 0.75; // the grid area is the middle 75% of the picture's width
const EDGE = 0.02; // the track sits just inside the grid area's edge
const inset = (c: number) => (EDGE + c * (1 - 2 * EDGE)) * 100;

// The start position as a dot that slides along the robot's own wall and rests only where a robot may start.
export function StartPad({ fieldKey, flipped, alliance, value, onChange }: {
  fieldKey: string;
  flipped: boolean;
  alliance: Alliance | null;
  value: number | null;
  onChange(v: number): void;
}) {
  const field = FIELDS[fieldKey];
  const dragging = useRef(false);
  const picture = <FieldPicture fieldKey={fieldKey} flipped={flipped} />;
  if (!alliance) {
    return (
      <>
        <p>Pick the robot first.</p>
        <div className="field-space"><div className="field">{picture}</div></div>
      </>
    );
  }

  // Screen to stored: fraction of the grid area on screen, undo the scout's flip, undo blue's half-turn, then the
  // nearest allowed spot. Drawing (onScreen) goes the other way.
  const pick = (e: PointerEvent<HTMLDivElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    let x = ((e.clientX - r.left) / r.width - GRID_LEFT) / GRID_WIDTH, y = (e.clientY - r.top) / r.height;
    if (flipped) { x = 1 - x; y = 1 - y; }
    if (alliance === "blue") { x = 1 - x; y = 1 - y; }
    onChange(startNearest(x, y, field));
  };
  const onScreen = (v: number) => {
    const p = wallPoint(v, alliance);
    return flipped ? { x: 1 - p.x, y: 1 - p.y } : p;
  };
  const line = (from: number, to: number) => {
    const pts: string[] = [];
    for (let v = from; v <= to; v++) { const p = onScreen(v); pts.push(`${inset(p.x)},${inset(p.y)}`); }
    return pts.join(" ");
  };

  // Left and right step to the next allowed position.
  const step = (e: KeyboardEvent) => {
    const d = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0;
    if (!d) return;
    e.preventDefault();
    let v = value ?? (d > 0 ? -1 : 201);
    do v += d; while (v >= 0 && v <= 200 && !startAllowed(v, field));
    if (v >= 0 && v <= 200) onChange(v);
  };

  const dot = value === null ? null : onScreen(value);
  return (
    <div className="field-space">
      <div className="field">
        {picture}
        <div
          className={`start-surface ${alliance}`}
          role="slider"
          tabIndex={0}
          aria-label="Start position along the robot's wall"
          aria-valuemin={0}
          aria-valuemax={200}
          aria-valuenow={value ?? undefined}
          aria-valuetext={value === null ? undefined : `Start: ${startSquareFor(value, alliance, field)}`}
          onKeyDown={step}
          onPointerDown={(e) => {
            if (!e.isPrimary) return;
            e.currentTarget.setPointerCapture(e.pointerId);
            dragging.current = true;
            pick(e);
          }}
          onPointerMove={(e) => e.isPrimary && dragging.current && pick(e)}
          onPointerUp={(e) => { if (e.isPrimary) dragging.current = false; }}
          onPointerCancel={(e) => { if (e.isPrimary) dragging.current = false; }}
        >
          <svg className="start-track" viewBox="0 0 100 100" aria-hidden="true">
            <polyline className="forbidden" points={line(0, 200)} />
            {field.startOk.map(([a, b]) => <polyline key={a} points={line(a, b)} />)}
          </svg>
          {dot && <span className="start-dot" style={{ left: `${(GRID_LEFT + GRID_WIDTH * inset(dot.x) / 100) * 100}%`, top: `${inset(dot.y)}%` }} />}
        </div>
      </div>
    </div>
  );
}
