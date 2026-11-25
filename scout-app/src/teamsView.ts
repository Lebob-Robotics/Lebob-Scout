import type { ReportSummary, TeamProfile } from "./api";

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
  return out;
}

export const reportLine = (r: ReportSummary) =>
  [`${r.matchType === "qualification" ? "Q" : "P"}${r.matchNumber}`, `${r.autoScored} auto`, `${r.cycles} cycle${r.cycles === 1 ? "" : "s"}`, `${r.teleopScored} scored`, r.scoutName]
    .filter(Boolean).join(" · ");
