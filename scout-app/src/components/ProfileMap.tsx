import { useState } from "react";
import type { SquareTotal, StartDot } from "../api";
import { FIELDS, squareName } from "../field";
import { wallPoint } from "../startWall";
import { shade } from "../teamsView";
import { FieldPicture } from "./FieldPicture";

const EDGE = 0.02; // dots sit just inside the grid area's edge, as on the set-up screen
const inset = (c: number) => (EDGE + c * (1 - 2 * EDGE)) * 100;

// Where a team scores or picks up in teleop, and where it started each match. Never turned, never dimmed:
// red's wall is on the left whatever alliance the team played. A picture to read, not a control.
export function ProfileMap({ fieldKey, squares, starts }: { fieldKey: string; squares: SquareTotal[]; starts: StartDot[] }) {
  const [measure, setMeasure] = useState<"scored" | "pickedUp">("scored");
  if (!squares.length && !starts.length) return null;
  const field = FIELDS[fieldKey];
  const w = 100 / field.cols, h = 100 / field.rows;
  const value = new Map(squares.map((s) => [s.square, s[measure]]));
  const max = Math.max(0, ...value.values());
  const cells = [];
  for (let row = 0; row < field.rows; row++) {
    for (let col = 0; col < field.cols; col++) {
      const v = Math.round((value.get(squareName(col, row)) ?? 0) * 10) / 10;
      cells.push(
        <g key={`${col}-${row}`}>
          <rect x={col * w} y={row * h} width={w} height={h} fillOpacity={shade(v, max)} />
          {v > 0 && <text x={(col + 0.5) * w} y={(row + 0.5) * h}>{v}</text>}
        </g>,
      );
    }
  }

  return (
    <div className="profile-map">
      <div className="map-switch">
        <button type="button" aria-pressed={measure === "scored"} onClick={() => setMeasure("scored")}>Scored</button>
        <button type="button" aria-pressed={measure === "pickedUp"} onClick={() => setMeasure("pickedUp")}>Picked up</button>
      </div>
      <div className="field">
        <FieldPicture fieldKey={fieldKey} flipped={false} />
        <svg className={`map-overlay ${measure}`} viewBox="0 0 100 100">
          {cells}
          {starts.map((s, i) => {
            const p = wallPoint(s.wallPos, s.alliance === "blue" ? "blue" : "red");
            return <circle key={i} className={s.alliance} cx={inset(p.x)} cy={inset(p.y)} r="4.5"><title>{s.label}</title></circle>;
          })}
        </svg>
      </div>
      <p className="caption">
        {measure === "scored" ? "Teleop, pieces scored from each square." : "Teleop, pick-ups in each square."}
        {starts.length > 0 && " Dots: where it started each match."}
      </p>
    </div>
  );
}
