import { expect, test } from "vitest";
import { earlierEvents } from "./api";

const ev = (eventUuid: string, eventCode: string, country: string | undefined, dateStart: string | undefined) => ({ eventUuid, eventCode, country, dateStart });

test("earlierEvents: same country, began before this event and within the season, oldest first", () => {
  const cmp = ev("c", "AUCMP", "Australia", "2026-12-05T00:00:00Z");
  const all = [
    cmp,
    ev("b", "AUPEQ", "Australia", "2026-11-15T00:00:00Z"),
    ev("a2", "AUBRQ2", "Australia", "2026-11-14T00:00:00Z"),
    ev("a1", "AUWAQ", "Australia", "2026-11-14T00:00:00Z"),
    ev("us", "USCAQ", "USA", "2026-11-01T00:00:00Z"),          // another country
    ev("late", "AULATE", "Australia", "2026-12-12T00:00:00Z"),  // after it
    ev("same", "AUSAME", "Australia", "2026-12-05T00:00:00Z"),  // the same day: not before
    ev("old", "AUOLD", "Australia", "2025-12-06T00:00:00Z"),    // last season
    ev("nodate", "AUNOD", "Australia", undefined),
    ev("best", "LBBEST", "Australia", "2026-11-29T00:00:00Z"),  // made up from other events' matches
  ];
  expect(earlierEvents(cmp, all).map((e) => e.eventCode)).toEqual(["AUBRQ2", "AUWAQ", "AUPEQ"]);
});

test("earlierEvents: nothing for an event with no country or no date, or an event we do not know", () => {
  const all = [ev("b", "AUPEQ", "Australia", "2026-11-15T00:00:00Z")];
  expect(earlierEvents(ev("c", "X", undefined, "2026-12-05T00:00:00Z"), all)).toEqual([]);
  expect(earlierEvents(ev("c", "X", "Australia", undefined), all)).toEqual([]);
  expect(earlierEvents(undefined, all)).toEqual([]);
});
