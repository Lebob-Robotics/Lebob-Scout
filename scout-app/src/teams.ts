import type { Coverage, CoverageCell, CoverageRow, ScoutTally } from "./api";
import type { Target } from "./observation";

const PLAYED_RULE: Record<string, string> = {
  times: "A match counts as played once its start time passes.",
  scouted: "The schedule has no start times, so matches up to the last one anyone scouted count as played.",
  none: "No schedule for this event yet.",
};

// The line under the status tiles: the event, then how the figures decide a match is played.
export const noteLine = (eventName: string, playedBy: string) =>
  [eventName, PLAYED_RULE[playedBy]].filter(Boolean).join(" · ");

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

// A time in the phone's own time; with the short weekday in front when it is not on the same day as `now`.
export const clockTime = (iso: string, now: number) => {
  const d = new Date(iso);
  const day = d.toDateString() === new Date(now).toDateString() ? "" : `${DAYS[d.getDay()]} `;
  return `${day}${d.getHours() % 12 || 12}:${String(d.getMinutes()).padStart(2, "0")}\u00a0${d.getHours() < 12 ? "am" : "pm"}`;
};

export const scoutLine = (s: ScoutTally, userId: string, now: number) =>
  `${s.scoutName || "?"}${s.scoutUserId === userId ? " (you)" : ""} · ${s.reports} match report${s.reports === 1 ? "" : "s"} · last ${clockTime(s.lastAt, now)}`;

// The coverage card's summary, from the counts the function gives.
export const coverageLine = (c: Coverage) =>
  `${c.have} of ${c.slots} robot-matches have a report · ${c.slots - c.have} missing · ${c.duplicates} with more than one`
  + (c.strays > 0 ? ` · ${c.strays} for a team not in that match (check team numbers)` : "")
  + (c.unscheduled > 0 ? ` · ${c.unscheduled} for matches not in the schedule` : "");

// "Only matches with gaps": played matches where some robot has no report or more than one.
export const gapRows = (rows: CoverageRow[]) => rows.filter((r) => r.played && r.cells.some((c) => c.reports !== 1));

const isMatchType = (x: string): x is Target["matchType"] => x === "qualification" || x === "playoff";
const isAlliance = (x: string): x is Target["alliance"] => x === "red" || x === "blue";

// The set-up target for a cell; null when the match type or alliance is one set-up does not know.
export function cellTarget(eventUuid: string, row: CoverageRow, cell: CoverageCell): Target | null {
  const { matchType } = row, { alliance } = cell;
  if (!isMatchType(matchType) || !isAlliance(alliance)) return null;
  return {
    eventUuid, matchUuid: row.matchUuid || null, presenceUuid: cell.presenceUuid || null, teamUuid: cell.teamUuid || null,
    matchNumber: row.matchNumber, matchType, teamNumber: cell.teamNumber, alliance,
  };
}

// The cell's accessible name; "scout this robot" only when a tap opens set-up.
export const cellName = (row: CoverageRow, c: CoverageCell, tappable = true) =>
  `${row.label}, ${c.alliance}, ${c.teamNumber} ${c.name}, ${c.reports ? `${c.reports} report${c.reports === 1 ? "" : "s"}` : "no report"}${tappable ? ", scout this robot" : ""}`;
