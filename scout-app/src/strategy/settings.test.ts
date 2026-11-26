import { expect, test } from "vitest";
import { SETTINGS_KEY, defaultSettings, keepSettings, parseTeam, readSettings } from "./settings";

const memory = () => {
  const kept = new Map<string, string>();
  return { kept, store: () => ({ getItem: (k: string) => kept.get(k) ?? null, setItem: (k: string, v: string) => { kept.set(k, v); } }) };
};
const D = defaultSettings(29550);

test("empty storage gives the defaults", () => {
  expect(readSettings(D, memory().store)).toEqual({ ourTeam: 29550, heatStyle: "squares", autoStyle: "averaged", measure: "teleop", refreshMinutes: 0, clock: "event", alliances: 4 });
});

test("kept settings come back, and are kept as one entry", () => {
  const { kept, store } = memory();
  const s = { ourTeam: 12345, heatStyle: "smooth" as const, autoStyle: "drawn" as const, measure: "pickedUp" as const, refreshMinutes: 5, clock: "device" as const, alliances: 6 };
  keepSettings(s, store);
  expect(JSON.parse(kept.get(SETTINGS_KEY)!)).toEqual(s);
  expect(readSettings(D, store)).toEqual(s);
});

test("each unknown or broken field falls back on its own", () => {
  const { kept, store } = memory();
  kept.set(SETTINGS_KEY, JSON.stringify({ ourTeam: -4, heatStyle: "blobs", autoStyle: "drawn", measure: 7, refreshMinutes: 3, clock: "device", alliances: 5 }));
  expect(readSettings(D, store)).toEqual({ ...D, autoStyle: "drawn", clock: "device" });
  kept.set(SETTINGS_KEY, "not json");
  expect(readSettings(D, store)).toEqual(D);
  kept.set(SETTINGS_KEY, "[1,2]");
  expect(readSettings(D, store).ourTeam).toBe(29550);
});

test("storage that refuses gives the defaults and never throws", () => {
  const refuses = () => { throw new Error("blocked"); };
  expect(readSettings(D, refuses)).toEqual(D);
  expect(() => keepSettings(D, refuses)).not.toThrow();
  const full = () => ({ getItem: () => null, setItem: () => { throw new Error("full"); } });
  expect(() => keepSettings(D, full)).not.toThrow();
});

test("parseTeam takes a whole team number only", () => {
  expect(parseTeam(" 29550 ")).toBe(29550);
  expect(parseTeam("0")).toBeNull();
  expect(parseTeam("12a")).toBeNull();
  expect(parseTeam("100000")).toBeNull();
  expect(parseTeam("")).toBeNull();
});
