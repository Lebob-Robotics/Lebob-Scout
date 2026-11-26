import type { ReactNode } from "react";

// The two alliances' colours and names on the picture. The scout app draws real red and blue. The strategy app's
// team maps draw "tracked": every match is turned to the left-hand (red) side, so that side is the tracked alliance,
// yellow, and the other side grey (see TeamMap.aligned in the functions).
type Look = { left: string; leftArea: string; leftName: string; right: string; rightArea: string; rightName: string };
const ALLIANCES: Look = { left: "#e5484d", leftArea: "#3a2224", leftName: "RED", right: "#3b82f6", rightArea: "#1d2a44", rightName: "BLUE" };
const TRACKED: Look = { left: "#facc15", leftArea: "#38330f", leftName: "YELLOW", right: "#8b919c", rightArea: "#26282c", rightName: "GREY" };

// One picture per field. Next season adds an entry.
const PICTURES: Record<string, (c: Look) => ReactNode> = {
  "ftc-2026": (c) => (
    <>
      <rect width="40" height="240" fill={c.leftArea} />
      <rect x="280" width="40" height="240" fill={c.rightArea} />
      <rect x="40" width="240" height="240" fill="#3d4046" />
      <rect x="16" y="109" width="19" height="23" fill={c.left} />
      <rect x="285" y="109" width="19" height="23" fill={c.right} />
      <text className="area-label" x="20" y="88">{c.leftName}<tspan x="20" dy="6">ALLIANCE</tspan><tspan x="20" dy="6">AREA</tspan></text>
      <text className="area-label" x="300" y="88">{c.rightName}<tspan x="300" dy="6">ALLIANCE</tspan><tspan x="300" dy="6">AREA</tspan></text>

      <rect x="40" y="42" width="24" height="38" fill={`${c.left}55`} stroke={c.left} />
      <text x="52" y="59">LOADING<tspan x="52" dy="6">ZONE</tspan></text>
      <rect x="256" y="162" width="24" height="38" fill={`${c.right}55`} stroke={c.right} />
      <text x="268" y="179">LOADING<tspan x="268" dy="6">ZONE</tspan></text>

      <rect x="234" width="44" height="7" fill={c.right} />
      <text x="256" y="16">{c.rightName} GARDEN</text>
      <rect x="42" y="233" width="44" height="7" fill={c.left} />
      <text x="64" y="228">{c.leftName} GARDEN</text>

      <rect x="124" y="80" width="33" height="82" rx="4" fill={`${c.left}88`} stroke={c.left} />
      <text x="140.5" y="123">HIVE</text>
      <rect x="163" y="80" width="33" height="82" rx="4" fill={`${c.right}88`} stroke={c.right} />
      <text x="179.5" y="123">HIVE</text>

      <g fill="#fbbf24">
        <circle cx="121" cy="5" r="3.5" /><circle cx="271" cy="80" r="3.5" />
        <circle cx="47" cy="159" r="3.5" /><circle cx="198" cy="235" r="3.5" />
      </g>
      <text x="121" y="14">FLOWER</text><text x="255" y="81.5">FLOWER</text>
      <text x="63" y="160.5">FLOWER</text><text x="214" y="231">FLOWER</text>
    </>
  ),
};

// An unknown key draws only the field outline. `tracked` draws the tracked alliance (left) yellow and the other grey.
export function FieldPicture({ fieldKey, flipped, tracked = false }: { fieldKey: string; flipped: boolean; tracked?: boolean }) {
  const picture = PICTURES[fieldKey];
  return (
    <svg className={flipped ? "field-picture flipped" : "field-picture"} viewBox="0 0 320 240" aria-hidden="true">
      {picture ? picture(tracked ? TRACKED : ALLIANCES) : <rect width="320" height="240" fill="none" stroke="#fff4" />}
    </svg>
  );
}
