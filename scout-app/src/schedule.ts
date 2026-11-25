import type { EventRow, MatchRow } from "./api";

const runningOn = (events: EventRow[], todayIso: string) => events.find((e) => e.dateStart <= todayIso && todayIso <= e.dateEnd);

export function pickEvent(events: EventRow[], todayIso: string): EventRow | null {
  const running = runningOn(events, todayIso);
  if (running) return running;
  const upcoming = events.filter((e) => e.dateStart > todayIso).sort((a, b) => a.dateStart.localeCompare(b.dateStart));
  if (upcoming.length) return upcoming[0];
  return events.reduce<EventRow | null>((best, e) => (!best || e.dateEnd > best.dateEnd ? e : best), null);
}

// Set-up's default event: one running today, else the one last used if still listed, else pickEvent.
export function firstEvent(events: EventRow[], remembered: EventRow | null, todayIso: string): EventRow | null {
  return runningOn(events, todayIso) ?? events.find((e) => e.eventUuid === remembered?.eventUuid) ?? pickEvent(events, todayIso);
}

const order = (a: MatchRow, b: MatchRow) =>
  Number(a.matchType === "playoff") - Number(b.matchType === "playoff") || a.matchNumber - b.matchNumber;

export function pickMatch(matches: MatchRow[]): MatchRow | null {
  const sorted = [...matches].sort(order);
  return sorted.find((x) => !x.actualTime) ?? sorted.at(-1) ?? null;
}
