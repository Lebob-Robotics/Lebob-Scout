import { TEAM_MAX, MATCH_MAX, whole } from "./schedule";

// The old site's option lists (reference/lebob-scout-site.html, CFG.enums), saved as these values.
export const DRIVETRAINS = ["mecanum", "tank-traction", "swerve", "x-drive-omni", "other", "unknown"] as const;
export const ARCHETYPES = ["fixed-shooter", "dual-adjustable-shooter", "shooter-flower-hybrid", "flower-specialist", "turret-shooter", "catapult-drum", "pusher-defender", "unknown"] as const;
export const FAILURE_TYPES = ["cracked-bent", "loose-disconnected", "jammed", "slipped", "overheated", "sensor-software", "brownout-disconnect", "immobilised", "tipped-over", "other"] as const;
export const SEVERITY: [number, string][] = [
  [0, "0 no effect"], [1, "1 brief, self-recovered"], [2, "2 reduced / lost cycles"], [3, "3 unavailable for a while"], [4, "4 immobilised / match over"],
];

// "tank-traction" shows as "Tank traction"; the saved value keeps its hyphen.
export const optionLabel = (value: string) => {
  const words = value.replace(/-/g, " ");
  return words.charAt(0).toUpperCase() + words.slice(1);
};

// Field names follow the PitSurvey and BreakageReport objects. null is an empty field.
// A pit report's photos: `images` are the attachment ids of those already in Foundry; `photoIds` are the ids of new
// ones still on this phone (photos.ts), which go up when the report is sent. Reports queued by an older build have neither.
export type PitReport = {
  pitReportId: string; eventCode: string; teamNumber: number; scout: string; createdAt: string;
  drivetrain: string | null; archetype: string | null;
  canHive: boolean | null; canFlower: boolean | null; canNectar: boolean | null;
  canFloorIntake: boolean | null; canFlowerIntake: boolean | null;
  notes: string | null;
  images: string[]; photoIds: string[];
};
export type BreakageReport = {
  breakageId: string; eventCode: string; teamNumber: number; teamUuid: string | null; reporter: string; createdAt: string;
  matchKey: string | null; mechanism: string | null; component: string | null;
  failureType: string | null; severity: number | null; notes: string | null;
};

// What a form holds: every field as the text its input shows. "" is blank; yes/no fields hold "", "yes" or "no".
export type PitForm = { teamNumber: string } & { [K in Exclude<keyof PitReport, "pitReportId" | "eventCode" | "teamNumber" | "scout" | "createdAt" | "images" | "photoIds">]: string };
export type BreakageForm = { teamNumber: string; matchNumber: string; matchType: "q" | "p" } &
  { [K in Exclude<keyof BreakageReport, "breakageId" | "eventCode" | "teamNumber" | "teamUuid" | "reporter" | "createdAt" | "matchKey">]: string };

export const PIT_YES_NO = ["canHive", "canFlower", "canNectar", "canFloorIntake", "canFlowerIntake"] as const;
const PIT_TEXT = ["drivetrain", "archetype", "notes"] as const;
export const BREAKAGE_NUMBERS = ["severity"] as const;
const BREAKAGE_TEXT = ["mechanism", "component", "failureType", "notes"] as const;

const fromYesNo = (s: string) => (s === "yes" ? true : s === "no" ? false : null);
const toYesNo = (b: boolean | null | undefined) => (b === true ? "yes" : b === false ? "no" : "");
const fromNumber = (s: string) => (s.trim() === "" || !Number.isFinite(Number(s)) ? null : Number(s));
const toText = (v: string | number | null | undefined) => (v == null ? "" : String(v));
const fromText = (s: string) => (s.trim() ? s.trim() : null);

export const emptyPitForm = (teamNumber = ""): PitForm => ({
  teamNumber,
  ...Object.fromEntries([...PIT_YES_NO, ...PIT_TEXT].map((k) => [k, ""])) as Omit<PitForm, "teamNumber">,
});
export const emptyBreakageForm = (teamNumber = ""): BreakageForm => ({
  teamNumber, matchNumber: "", matchType: "q",
  ...Object.fromEntries([...BREAKAGE_NUMBERS, ...BREAKAGE_TEXT].map((k) => [k, ""])) as Omit<BreakageForm, "teamNumber" | "matchNumber" | "matchType">,
});

// "AUCMP-q12" or "AUCMP-p3"; null for pit or practice. The old site wrote only q.
export const matchKey = (eventCode: string, type: "q" | "p", matchNumber: number | null) =>
  matchNumber == null ? null : `${eventCode}-${type}${matchNumber}`;
export function parseMatchKey(key: string | null): { matchType: "q" | "p"; matchNumber: number } | null {
  const m = /-([qp])(\d+)$/.exec(key ?? "");
  return m ? { matchType: m[1] as "q" | "p", matchNumber: Number(m[2]) } : null;
}

// The team number the form holds, or null when it isn't a whole number in range.
export const formTeam = (f: { teamNumber: string }) => whole(f.teamNumber.trim(), TEAM_MAX);

export function pitFormOf(p: PitReport): PitForm {
  const f = emptyPitForm(String(p.teamNumber));
  for (const k of PIT_YES_NO) f[k] = toYesNo(p[k]);
  for (const k of PIT_TEXT) f[k] = toText(p[k]);
  return f;
}
export function breakageFormOf(b: BreakageReport): BreakageForm {
  const f = emptyBreakageForm(String(b.teamNumber));
  const m = parseMatchKey(b.matchKey);
  if (m) { f.matchType = m.matchType; f.matchNumber = String(m.matchNumber); }
  for (const k of BREAKAGE_NUMBERS) f[k] = toText(b[k]);
  for (const k of BREAKAGE_TEXT) f[k] = toText(b[k]);
  return f;
}

// `base` is the report being changed, which keeps its id, author, event and time; with none it is a new report.
export function buildPit(
  f: PitForm, base: Pick<PitReport, "pitReportId" | "eventCode" | "scout" | "createdAt">, photos: Pick<PitReport, "images" | "photoIds"> = { images: [], photoIds: [] },
): PitReport {
  const teamNumber = formTeam(f);
  if (teamNumber == null) throw new Error("Enter the team number.");
  const p = { ...base, teamNumber, images: [...photos.images], photoIds: [...photos.photoIds] } as PitReport;
  for (const k of PIT_YES_NO) p[k] = fromYesNo(f[k]);
  for (const k of PIT_TEXT) p[k] = fromText(f[k]);
  return p;
}
export function buildBreakage(
  f: BreakageForm, base: Pick<BreakageReport, "breakageId" | "eventCode" | "reporter" | "createdAt">, teamUuid: string | null,
): BreakageReport {
  const teamNumber = formTeam(f);
  if (teamNumber == null) throw new Error("Enter the team number.");
  const typed = f.matchNumber.trim();
  const matchNumber = typed ? whole(typed, MATCH_MAX) : null;
  if (typed && matchNumber == null) throw new Error(`Match number must be 1 to ${MATCH_MAX}, or blank for pit or practice.`);
  const b = { ...base, teamNumber, teamUuid, matchKey: matchKey(base.eventCode, f.matchType, matchNumber) } as BreakageReport;
  for (const k of BREAKAGE_NUMBERS) b[k] = fromNumber(f[k]);
  for (const k of BREAKAGE_TEXT) b[k] = fromText(f[k]);
  return b;
}

// One pit report per scout per team per event: this scout's other report for the team, if any.
export const myPit = (pits: PitReport[], teamNumber: number | null, scout: string, eventCode: string, notId?: string) =>
  teamNumber == null || !scout ? null
    : pits.find((p) => p.teamNumber === teamNumber && p.eventCode === eventCode && p.scout === scout && p.pitReportId !== notId) ?? null;

// The match a breakage happened in, as the lists show it.
export const breakageMatch = (key: string | null) => {
  const m = parseMatchKey(key);
  return m ? `${m.matchType.toUpperCase()}${m.matchNumber}` : "pit/practice";
};

// The breakage form's match dropdown: "" is pit or practice, else "q12" or "p3". The label is how set-up writes it.
export const matchValue = (type: "q" | "p", number: number) => `${type}${number}`;
export const matchOptionLabel = (m: { matchType: string; matchNumber: number; actualTime: string | null }) =>
  `${m.matchType === "qualification" ? "Q" : "P"}${m.matchNumber}${m.actualTime ? " (played)" : ""}`;
// What the dropdown shows for the form's match boxes.
export const formMatchValue = (f: Pick<BreakageForm, "matchNumber" | "matchType">) => {
  const n = whole(f.matchNumber.trim(), MATCH_MAX);
  return n == null ? "" : matchValue(f.matchType, n);
};
// The form's match boxes for a dropdown value.
export const matchFromValue = (v: string): Pick<BreakageForm, "matchNumber" | "matchType"> => {
  const m = /^([qp])(\d+)$/.exec(v);
  return m ? { matchType: m[1] as "q" | "p", matchNumber: m[2] } : { matchType: "q", matchNumber: "" };
};
