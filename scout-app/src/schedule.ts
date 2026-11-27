import type { EventRow, MatchRow } from "./api";
import type { Target } from "./observation";

const EVENT_KEY = "lsa:event";

// The last event used, kept whole so set-up still works when the schedule won't load.
export function rememberedEvent(): EventRow | null {
  try {
    const e = JSON.parse(localStorage.getItem(EVENT_KEY) ?? "null");
    return e && typeof e.eventUuid === "string" ? e : null;
  } catch {
    return null; // storage blocked or not JSON
  }
}
export const remember = (e: EventRow) => {
  try { localStorage.setItem(EVENT_KEY, JSON.stringify(e)); } catch { /* not remembered; still usable */ }
};

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

const time = (m: MatchRow) => (m.scheduledTime ? Date.parse(m.scheduledTime) : Infinity);
const byTime = (a: MatchRow, b: MatchRow) =>
  time(a) - time(b) || a.matchNumber - b.matchNumber || a.matchUuid.localeCompare(b.matchUuid);

// The schedule import stores every playoff match as number 1. When a match type's numbers repeat, its matches are
// numbered 1 to n by scheduled time instead. The functions (numbering.ts) use the same rule, so the picker, the
// reports and the Teams tab all agree.
export function numbered(matches: MatchRow[]): MatchRow[] {
  const renumbered = new Map<string, MatchRow>();
  for (const type of new Set(matches.map((m) => m.matchType))) {
    const ofType = matches.filter((m) => m.matchType === type);
    if (new Set(ofType.map((m) => m.matchNumber)).size === ofType.length) continue;
    [...ofType].sort(byTime).forEach((m, i) => renumbered.set(m.matchUuid, { ...m, matchNumber: i + 1 }));
  }
  return matches.map((m) => renumbered.get(m.matchUuid) ?? m);
}

// Qualifications first, then playoffs, each by number: the order the match picker lists them in.
export const order = (a: MatchRow, b: MatchRow) =>
  Number(a.matchType === "playoff") - Number(b.matchType === "playoff") || a.matchNumber - b.matchNumber;

// Hand-typed numbers: whole, from 1 up to the cap. Foundry refuses a team number past its integer range for good.
export const MATCH_MAX = 999;
export const TEAM_MAX = 99999;
export const whole = (text: string, max: number) => (/^\d+$/.test(text) && Number(text) >= 1 && Number(text) <= max ? Number(text) : null);

// A report is always filed under the event on screen, whatever event the picker's target was typed under.
// The picked robot if it was picked under this event, else nothing: its match and presence ids belong to its own event.
export const onEvent = (target: Target | null, eventUuid: string | undefined): Target | null =>
  target && target.eventUuid === eventUuid ? target : null;

export const withEvent = (target: Target, event: EventRow): Target => ({ ...target, eventUuid: event.eventUuid });

export function pickMatch(matches: MatchRow[]): MatchRow | null {
  const sorted = [...matches].sort(order);
  return sorted.find((x) => !x.actualTime) ?? sorted.at(-1) ?? null;
}
