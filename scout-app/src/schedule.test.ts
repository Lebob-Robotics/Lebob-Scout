import { test, expect } from "vitest";
import { firstEvent, pickEvent, pickMatch } from "./schedule";
import type { EventRow, MatchRow } from "./api";

const ev = (code: string, a: string, b: string): EventRow => ({ eventUuid: code, eventCode: code, eventName: code, dateStart: a, dateEnd: b });
test("pickEvent", () => {
  const es = [ev("past", "2026-10-01", "2026-10-02"), ev("now", "2026-11-24", "2026-11-26"), ev("next", "2026-12-10", "2026-12-11")];
  expect(pickEvent(es, "2026-11-25")!.eventCode).toBe("now");        // running today
  expect(pickEvent(es, "2026-12-01")!.eventCode).toBe("next");       // else the next to start
  expect(pickEvent(es, "2027-01-01")!.eventCode).toBe("next");       // else the most recent
  expect(pickEvent([], "2026-11-25")).toBeNull();
});
const m = (n: number, type: "qualification" | "playoff", played: boolean): MatchRow => ({ matchUuid: type + n, matchNumber: n, matchType: type, scheduledTime: null, actualTime: played ? "x" : null });
test("pickMatch", () => {
  expect(pickMatch([m(2, "qualification", false), m(1, "qualification", true), m(1, "playoff", false)])!.matchUuid).toBe("qualification2");
  expect(pickMatch([m(1, "qualification", true), m(1, "playoff", false)])!.matchUuid).toBe("playoff1");
  expect(pickMatch([m(1, "qualification", true), m(2, "qualification", true)])!.matchUuid).toBe("qualification2");
  expect(pickMatch([])).toBeNull();
});
test("firstEvent", () => {
  const past = ev("past", "2026-11-14", "2026-11-15"), now = ev("now", "2026-11-24", "2026-11-26"), next = ev("next", "2026-12-10", "2026-12-11");
  expect(firstEvent([past, now, next], past, "2026-11-25")!.eventCode).toBe("now");   // running beats an older remembered one
  expect(firstEvent([past, now, next], past, "2026-12-01")!.eventCode).toBe("past");  // remembered when nothing runs and it is listed
  expect(firstEvent([now, next], past, "2026-12-01")!.eventCode).toBe("next");        // remembered but no longer listed: ignored
  expect(firstEvent([past, next], null, "2026-12-01")!.eventCode).toBe("next");       // nothing remembered: pickEvent
  expect(firstEvent([], past, "2026-11-25")).toBeNull();
});
