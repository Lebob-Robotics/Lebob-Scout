import { expect, test } from "vitest";
import { MAPS_NOT_READY } from "./api";
import { createPublicStrategyApi, type EventFile, type IndexFile } from "./publicApi";

const E = "ev-1";
const index: IndexFile = { exportedAt: "2026-11-27T05:00:00Z", events: [{ eventUuid: E, eventCode: "AUX", eventName: "Test", dateStart: "2026-11-29T00:00:00Z", dateEnd: "2026-11-29T00:00:00Z" }] };
const match = (id: string, at: string, red: number | null) => ({ matchUuid: id, matchNumber: 1, matchType: "playoff", scheduledTime: at, eventUuid: E, redScore: red, blueScore: red == null ? null : 10 });
const slot = (m: string, alliance: string, station: number, teamNumber: number) => ({ presenceUuid: `${m}-${alliance}${station}`, matchUuid: m, teamUuid: `t${teamNumber}`, teamNumber, alliance, station });
const file = {
  matches: [match("m2", "2026-11-29T09:10:00Z", null), match("m1", "2026-11-29T09:00:00Z", 50)],
  presences: [slot("m1", "red", 1, 1), slot("m1", "red", 2, 2), slot("m1", "blue", 1, 3), slot("m1", "blue", 2, 4),
    slot("m2", "red", 1, 1), slot("m2", "red", 2, 3), slot("m2", "blue", 1, 2), slot("m2", "blue", 2, 4)],
  ratings: [], projections: [], teamsTab: null, fieldMaps: [], pointSplits: null, teamCycles: [],
  matchMaps: {}, pitImages: { "pit-1": ["photo-a"] },
} as unknown as EventFile;
const files: Record<string, unknown> = { "/d/index.json": index, [`/d/${E}.json`]: file };
const get = (async (url: string) => {
  if (url === "/d/photos/photo-a") return new Response(new Blob(["jpg"]));
  return url in files ? new Response(JSON.stringify(files[url])) : new Response("", { status: 404 });
}) as unknown as typeof fetch;

test("the public API reads the exported files through the real app's converters", async () => {
  const api = createPublicStrategyApi("/d/", get);
  expect((await api.ourEvents()).map((e) => e.eventCode)).toEqual(["AUX"]);
  // Repeated playoff numbers are renumbered by time, as the real app does.
  expect((await api.matches(E)).map((m) => [m.matchUuid, m.matchNumber])).toEqual([["m2", 2], ["m1", 1]]);
  expect((await api.presences("m1")).map((p) => p.teamNumber).sort()).toEqual([1, 2, 3, 4]);
  const games = await api.games(E);
  expect(games.find((g) => g.matchUuid === "m1")).toMatchObject({ red: [1, 2], blue: [3, 4], redScore: 50 });
  expect(games.find((g) => g.matchUuid === "m2")?.redScore).toBeNull();
  expect(await api.exportedAt()).toBe("2026-11-27T05:00:00Z");
});

test("a function that failed in the export, or an unknown event, behaves as in the real app", async () => {
  const api = createPublicStrategyApi("/d/", get);
  await expect(api.pointSplits(E)).rejects.toThrow(MAPS_NOT_READY);
  await expect(api.matchMaps(E, "m1")).rejects.toThrow(MAPS_NOT_READY);
  await expect(api.teamsTab(E)).rejects.toThrow();
  expect(await api.games("other")).toEqual([]);
  expect((await api.teamsTab("other")).teams).toEqual([]);
});

test("pit photos come from the exported copies", async () => {
  const api = createPublicStrategyApi("/d/", get);
  expect(await api.pitPhotoIds(["pit-1", "pit-2"])).toEqual(["photo-a"]);
  expect(await (await api.pitPhoto("photo-a")).text()).toBe("jpg");
});
