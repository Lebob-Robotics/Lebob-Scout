import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import { FIELDS } from "../field";
import { startAllowed, startNearest, startSquareFor, startZoneText, wallPoint } from "../startWall";
import { FieldPicture } from "./FieldPicture";

type Alliance = "red" | "blue";
const GRID_LEFT = 0.125, GRID_WIDTH = 0.75; // the grid area is the middle 75% of the picture's width
const EDGE = 0.02; // the track sits just inside the grid area's edge
const inset = (c: number) => (EDGE + c * (1 - 2 * EDGE)) * 100;
const ALLIANCE_NAME = { red: "RED", blue: "BLUE" } as const;

// The start position as the old site drew it: the other alliance's half shaded, the robot's own wall as a thin line,
// and a dot that slides along it and rests only where a robot may start. Under it, the caption, Rotate view and Fullscreen.
export function StartPad({ fieldKey, flipped, alliance, value, onChange, onFlip }: {
  fieldKey: string;
  flipped: boolean;
  alliance: Alliance | null;
  value: number | null;
  onChange(v: number): void;
  onFlip(): void;
}) {
  const field = FIELDS[fieldKey];
  const dragging = useRef(false);
  const [full, setFull] = useState(false);
  const [wrongHalf, setWrongHalf] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);

  // Fullscreen: the pad fills the page; the browser's own fullscreen too where it has one. Esc or Exit closes it.
  const openFull = () => {
    setFull(true);
    wrap.current?.requestFullscreen?.().catch(() => {});
  };
  const closeFull = () => {
    setFull(false);
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
  };
  useEffect(() => {
    if (!full) return;
    const left = () => { if (!document.fullscreenElement) setFull(false); };
    const esc = (e: globalThis.KeyboardEvent) => { if (e.key === "Escape") setFull(false); };
    document.addEventListener("fullscreenchange", left);
    window.addEventListener("keydown", esc);
    return () => { document.removeEventListener("fullscreenchange", left); window.removeEventListener("keydown", esc); };
  }, [full]);

  // Screen to stored: fraction of the grid area on screen, undo the scout's flip, undo blue's half-turn, then the
  // nearest allowed spot. A press on the other alliance's half does nothing. Drawing (onScreen) goes the other way.
  const pick = (e: PointerEvent<HTMLDivElement>, first: boolean) => {
    if (!alliance) return;
    const r = e.currentTarget.getBoundingClientRect();
    let x = ((e.clientX - r.left) / r.width - GRID_LEFT) / GRID_WIDTH, y = (e.clientY - r.top) / r.height;
    if (flipped) { x = 1 - x; y = 1 - y; }
    if (alliance === "blue") { x = 1 - x; y = 1 - y; }
    if (x > 0.5) {
      if (first) setWrongHalf(true);
      return;
    }
    setWrongHalf(false);
    onChange(startNearest(x, y, field));
  };
  const onScreen = (v: number) => {
    const p = wallPoint(v, alliance ?? "red");
    return flipped ? { x: 1 - p.x, y: 1 - p.y } : p;
  };
  const line = () => {
    const pts: string[] = [];
    for (let v = 0; v <= 200; v += 2) { const p = onScreen(v); pts.push(`${inset(p.x)},${inset(p.y)}`); }
    return pts.join(" ");
  };

  // Arrow keys step to the next allowed position.
  const step = (e: KeyboardEvent) => {
    const d = e.key === "ArrowRight" || e.key === "ArrowDown" ? 1 : e.key === "ArrowLeft" || e.key === "ArrowUp" ? -1 : 0;
    if (!d || !alliance) return;
    e.preventDefault();
    let v = value ?? (d > 0 ? -1 : 201);
    do v += d; while (v >= 0 && v <= 200 && !startAllowed(v, field));
    if (v >= 0 && v <= 200) onChange(v);
  };

  const caption = !alliance ? "Pick the robot first."
    : wrongHalf ? `That's the other alliance's half. Tap the ${ALLIANCE_NAME[alliance]} half.`
    : value === null ? "Drag the dot along your wall, or tap where the robot starts. The dot moves to the nearest spot rule G304 allows."
    : `Start: ${startZoneText(value) ?? startSquareFor(value, alliance, field)}.`;
  const dot = alliance && value !== null ? onScreen(value) : null;

  return (
    <div ref={wrap} className={full ? "start-wrap fs" : "start-wrap"}>
      <div className="field-space">
        <div className="field">
          <FieldPicture fieldKey={fieldKey} flipped={flipped} />
          {alliance && (
            <>
              {/* The other alliance's half, shaded. Red's wall is on the left unless the view is rotated. */}
              <div className={(alliance === "red") !== flipped ? "start-dim right" : "start-dim"} aria-hidden="true" />
              <div
                className={`start-surface ${alliance}`}
                role="slider"
                tabIndex={0}
                aria-label="Start position: drag the dot along your wall, or use the arrow keys"
                aria-valuemin={0}
                aria-valuemax={200}
                aria-valuenow={value ?? undefined}
                aria-valuetext={value === null ? undefined : `Start: ${startZoneText(value) ?? startSquareFor(value, alliance, field)}`}
                onKeyDown={step}
                onPointerDown={(e) => {
                  if (!e.isPrimary) return;
                  // A finger on the pad while a number box still has the keyboard up is a scout scrolling down to it, or
                  // the page about to move: set-up scrolls the pad into place once the typing ends. So that touch only
                  // puts the keyboard away (which sets the scroll off) and never moves the dot.
                  const typing = document.activeElement;
                  if (e.pointerType !== "mouse" && typing instanceof HTMLInputElement) {
                    typing.blur();
                    return;
                  }
                  e.currentTarget.setPointerCapture(e.pointerId);
                  dragging.current = true;
                  pick(e, true);
                }}
                onPointerMove={(e) => e.isPrimary && dragging.current && pick(e, false)}
                onPointerUp={(e) => { if (e.isPrimary) dragging.current = false; }}
                onPointerCancel={(e) => { if (e.isPrimary) dragging.current = false; }}
              >
                <svg className="start-track" viewBox="0 0 100 100" aria-hidden="true">
                  <polyline points={line()} />
                </svg>
                {dot && <span className="start-dot" style={{ left: `${(GRID_LEFT + GRID_WIDTH * inset(dot.x) / 100) * 100}%`, top: `${inset(dot.y)}%` }} />}
              </div>
            </>
          )}
        </div>
      </div>
      <div className="start-bar">
        <p className={!alliance || wrongHalf || value !== null ? "caption keep" : "caption"} aria-live="polite">{caption}</p>
        <button type="button" onClick={onFlip}>Rotate view</button>
        {!full && <button type="button" onClick={openFull}><span aria-hidden="true">⛶</span> Fullscreen</button>}
      </div>
      {full && <button type="button" className="primary fsx" onClick={closeFull}>✕ Exit fullscreen</button>}
    </div>
  );
}
