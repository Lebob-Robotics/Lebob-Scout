import type { BreakageSummary, PitSummary, ReportSummary, TeamProfile } from "./api";
import { optionLabel } from "./pitBreakage";

export type Filter = "all" | "need" | "mine";
export type Chip = { text: string; tone: "ok" | "warn" | "plain" };

// The teams the search box and filter leave on the list.
export function shown(teams: TeamProfile[], query: string, filter: Filter, userId: string): TeamProfile[] {
  const q = query.trim().toLowerCase();
  return teams.filter((t) =>
    (filter !== "need" || t.need) &&
    (filter !== "mine" || t.reports.some((r) => r.scoutUserId === userId)) &&
    (!q || String(t.teamNumber).includes(q) || t.name.toLowerCase().includes(q)));
}

const matches = (n: number) => `${n} match${n === 1 ? "" : "es"}`;

// The chips beside a team, as on the old tab.
export function chips(t: TeamProfile): Chip[] {
  const out: Chip[] = [t.matches
    ? { text: `≈${Math.round(t.points)} pts · ${matches(t.matches)}`, tone: "ok" }
    : { text: "not scouted", tone: "warn" }];
  if (!t.scheduled) out.push({ text: matches(t.matches), tone: t.matches ? "ok" : "warn" });
  else if (!t.played) out.push({ text: `${matches(t.scheduled)} to come`, tone: "plain" });
  else out.push({
    text: `matches ${t.played - t.missing.length}/${t.played}${t.toCome ? ` · ${t.toCome} to come` : ""}`,
    tone: t.missing.length ? "warn" : "ok",
  });
  if (t.missing.length) out.push({ text: `missing ${t.missing.join(", ")}`, tone: "warn" });
  if (t.twice.length) out.push({ text: `twice in ${t.twice.join(", ")}`, tone: "plain" });
  if (t.pits.length) out.push({ text: "pit ✓", tone: "ok" });
  if (t.breakages.length) out.push({ text: `${t.breakages.length} breakage${t.breakages.length === 1 ? "" : "s"}`, tone: "warn" });
  return out;
}

const CAN: [keyof PitSummary, string][] = [
  ["canHive", "HIVE"], ["canFlower", "FLOWER"], ["canNectar", "NECTAR"], ["canFloorIntake", "floor intake"],
  ["canFlowerIntake", "FLOWER intake"],
];
const words = (v: string | undefined) => (v ? optionLabel(v) : null);
const join = (parts: (string | false | null | undefined)[]) => parts.filter(Boolean).join(" · ");

// A pit report as lines for the team's profile: who and what it is, what it can and can't do, notes.
// Blank fields are left out; a line with nothing in it is dropped.
export function pitLines(p: PitSummary): string[] {
  const can = CAN.filter(([k]) => p[k] === true).map(([, l]) => l);
  const cannot = CAN.filter(([k]) => p[k] === false).map(([, l]) => l);
  return [
    join([p.scout || "?", words(p.archetype), words(p.drivetrain)]),
    can.length ? `Can: ${can.join(", ")}` : "",
    cannot.length ? `Can't: ${cannot.join(", ")}` : "",
    p.notes ?? "",
  ].filter(Boolean);
}

// One breakage as a line: when, what broke, how badly, and who reported it.
export const breakageLine = (b: BreakageSummary) => join([
  b.matchLabel ?? "pit/practice",
  b.component && b.mechanism ? `${b.mechanism}: ${b.component}` : b.component || b.mechanism,
  words(b.failureType)?.toLowerCase(),
  b.severity != null && `severity ${b.severity}`,
  b.reporter,
]);

export const reportLine = (r: ReportSummary) =>
  [`${r.matchType === "qualification" ? "Q" : "P"}${r.matchNumber}`, `${r.autoScored} auto`, `${r.cycles} cycle${r.cycles === 1 ? "" : "s"}`, `${r.teleopScored} scored`, r.scoutName]
    .filter(Boolean).join(" · ");

// How strongly a map square is filled: its value over the map's largest, from 0.15 so the smallest still shows, to 0.85.
export const shade = (value: number, max: number) => (value > 0 && max > 0 ? 0.15 + 0.7 * value / max : 0);
