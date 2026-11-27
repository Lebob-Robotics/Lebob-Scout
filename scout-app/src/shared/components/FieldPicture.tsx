import type { ReactNode } from "react";

// The two alliances' colours and names on the picture. The scout app draws real red and blue. The strategy app's
// team maps draw "tracked": every match is turned to the left-hand (red) side, so that side is the tracked alliance,
// yellow, and the other side grey (see TeamMap.aligned in the functions).
type Look = { left: string; leftArea: string; leftName: string; right: string; rightArea: string; rightName: string };
const ALLIANCES: Look = { left: "#e5484d", leftArea: "#3a2224", leftName: "RED", right: "#3b82f6", rightArea: "#1d2a44", rightName: "BLUE" };
const TRACKED: Look = { left: "#facc15", leftArea: "#38330f", leftName: "YELLOW", right: "#8b919c", rightArea: "#26282c", rightName: "GREY" };
// A scouted robot's own scoring places (its HIVE, LOADING ZONE and GARDEN) filled solid in a darker shade of its colour.
const DARK = { left: "#9f1d22", right: "#1d4ed8" };
type Side = "left" | "right";

// The grid area: x 40 to 280 of the 320 by 240 picture, six squares a side. The bare picture is only this part.
const GRID = { x: 40, size: 240, squares: 6 };

// The grid's inner lines, as a path in the picture's units.
const cell = GRID.size / GRID.squares;
const GRID_LINES = Array.from({ length: GRID.squares - 1 }, (_, i) => (i + 1) * cell)
  .map((k) => `M${GRID.x + k} 0V${GRID.size}M${GRID.x} ${k}H${GRID.x + GRID.size}`).join("");

// One picture per field. Next season adds an entry. `bare` (the strategy app) leaves out the alliance areas, rounds
// every place and draws the grid's lines on the floor.
const PICTURES: Record<string, (c: Look, own: Side | null, bare: boolean) => ReactNode> = {
  "ftc-2026": (c, own, bare) => {
    // A place on `side`: solid dark when it is the robot's own, else its usual see-through fill.
    const fill = (side: Side, usual: string) => (own === side ? DARK[side] : usual);
    const r = bare ? 3 : 0;
    // Bare: places against a wall stand off it a little, so their outline shows whole on the cropped, rounded field.
    const w = bare ? 1.5 : 0;
    return (
    <>
      {!bare && <>
        <rect width="40" height="240" fill={c.leftArea} />
        <rect x="280" width="40" height="240" fill={c.rightArea} />
        <rect x="16" y="109" width="19" height="23" fill={c.left} />
        <rect x="285" y="109" width="19" height="23" fill={c.right} />
        <text className="area-label" x="20" y="88">{c.leftName}<tspan x="20" dy="6">ALLIANCE</tspan><tspan x="20" dy="6">AREA</tspan></text>
        <text className="area-label" x="300" y="88">{c.rightName}<tspan x="300" dy="6">ALLIANCE</tspan><tspan x="300" dy="6">AREA</tspan></text>
      </>}
      <rect className="floor" x="40" width="240" height="240" fill={bare ? undefined : "#3d4046"} />
      {bare && <path className="grid-lines" d={GRID_LINES} />}

      <rect x={40 + w} y="42" width={24 - w} height="38" rx={r} fill={fill("left", `${c.left}55`)} stroke={c.left} />
      <text x="52" y="59">LOADING<tspan x="52" dy="6">ZONE</tspan></text>
      <rect x="256" y="162" width={24 - w} height="38" rx={r} fill={fill("right", `${c.right}55`)} stroke={c.right} />
      <text x="268" y="179">LOADING<tspan x="268" dy="6">ZONE</tspan></text>

      <rect x={234 - w} y={w} width="44" height="7" rx={r && 2} fill={fill("right", c.right)} stroke={own === "right" ? c.right : undefined} />
      <text x="256" y="16">{c.rightName} GARDEN</text>
      <rect x={42 + w} y={233 - w} width="44" height="7" rx={r && 2} fill={fill("left", c.left)} stroke={own === "left" ? c.left : undefined} />
      <text x="64" y="228">{c.leftName} GARDEN</text>

      <rect x="124" y="80" width="33" height="82" rx={bare ? 6 : 4} fill={fill("left", `${c.left}88`)} stroke={c.left} />
      <text x="140.5" y="123">HIVE</text>
      <rect x="163" y="80" width="33" height="82" rx={bare ? 6 : 4} fill={fill("right", `${c.right}88`)} stroke={c.right} />
      <text x="179.5" y="123">HIVE</text>

      <g fill="#fbbf24">
        <circle cx="121" cy="5" r="3.5" /><circle cx="271" cy="80" r="3.5" />
        <circle cx="47" cy="159" r="3.5" /><circle cx="198" cy="235" r="3.5" />
      </g>
      <text x="121" y="14">FLOWER</text><text x="255" y="81.5">FLOWER</text>
      <text x="63" y="160.5">FLOWER</text><text x="214" y="231">FLOWER</text>
    </>
    );
  },
};

// An unknown key draws only the field outline. `tracked` draws the tracked alliance (left) yellow and the other grey.
// `scoring` is the scouted robot's alliance: its own scoring places are filled dark, so the scout sees where it scores.
// `bare` draws only the grid area (square, no alliance areas), in the strategy app's look.
export function FieldPicture({ fieldKey, flipped, tracked = false, scoring, bare = false }: {
  fieldKey: string; flipped: boolean; tracked?: boolean; scoring?: "red" | "blue" | null; bare?: boolean;
}) {
  const picture = PICTURES[fieldKey];
  const cls = ["field-picture", flipped && "flipped", bare && "bare"].filter(Boolean).join(" ");
  return (
    <svg className={cls} viewBox={bare ? `${GRID.x} 0 ${GRID.size} ${GRID.size}` : "0 0 320 240"} aria-hidden="true">
      {picture ? picture(tracked ? TRACKED : ALLIANCES, tracked || !scoring ? null : scoring === "red" ? "left" : "right", bare) : <rect width="320" height="240" fill="none" stroke="#fff4" />}
    </svg>
  );
}
