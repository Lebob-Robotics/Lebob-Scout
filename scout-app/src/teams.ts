import type { ScoutTally } from "./api";

const PLAYED_RULE: Record<string, string> = {
  times: "A match counts as played once its start time passes.",
  scouted: "The schedule has no start times, so matches up to the last one anyone scouted count as played.",
  none: "No schedule for this event yet.",
};

// The line under the status tiles: the event, then how the figures decide a match is played.
export const noteLine = (eventName: string, playedBy: string) =>
  [eventName, PLAYED_RULE[playedBy]].filter(Boolean).join(" · ");

export const clockTime = (iso: string) => {
  const d = new Date(iso);
  return `${d.getHours() % 12 || 12}:${String(d.getMinutes()).padStart(2, "0")}\u00a0${d.getHours() < 12 ? "am" : "pm"}`;
};

export const scoutLine = (s: ScoutTally, userId: string) =>
  `${s.scoutName || "?"}${s.scoutUserId === userId ? " (you)" : ""} · ${s.reports} match report${s.reports === 1 ? "" : "s"} · last ${clockTime(s.lastAt)}`;
