import type { ReactNode } from "react";

// One picture per field. Next season adds an entry.
const PICTURES: Record<string, ReactNode> = {
  "ftc-2026": (
    <>
      <rect width="40" height="240" fill="#3a2224" />
      <rect x="280" width="40" height="240" fill="#1d2a44" />
      <rect x="40" width="240" height="240" fill="#3d4046" />
      <rect x="16" y="109" width="19" height="23" fill="#e5484d" />
      <rect x="285" y="109" width="19" height="23" fill="#3b82f6" />
      <text x="20" y="88">RED<tspan x="20" dy="6">ALLIANCE</tspan><tspan x="20" dy="6">AREA</tspan></text>
      <text x="300" y="88">BLUE<tspan x="300" dy="6">ALLIANCE</tspan><tspan x="300" dy="6">AREA</tspan></text>

      <rect x="40" y="42" width="24" height="38" fill="#e5484d55" stroke="#e5484d" />
      <text x="52" y="59">LOADING<tspan x="52" dy="6">ZONE</tspan></text>
      <rect x="256" y="162" width="24" height="38" fill="#3b82f655" stroke="#3b82f6" />
      <text x="268" y="179">LOADING<tspan x="268" dy="6">ZONE</tspan></text>

      <rect x="234" width="44" height="7" fill="#3b82f6" />
      <text x="256" y="16">BLUE GARDEN</text>
      <rect x="42" y="233" width="44" height="7" fill="#e5484d" />
      <text x="64" y="228">RED GARDEN</text>

      <rect x="124" y="80" width="33" height="82" rx="4" fill="#e5484d88" stroke="#e5484d" />
      <text x="140.5" y="123">HIVE</text>
      <rect x="163" y="80" width="33" height="82" rx="4" fill="#3b82f688" stroke="#3b82f6" />
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

// An unknown key draws only the field outline.
export function FieldPicture({ fieldKey, flipped }: { fieldKey: string; flipped: boolean }) {
  return (
    <svg className={flipped ? "field-picture flipped" : "field-picture"} viewBox="0 0 320 240" aria-hidden="true">
      {PICTURES[fieldKey] ?? <rect width="320" height="240" fill="none" stroke="#fff4" />}
    </svg>
  );
}
