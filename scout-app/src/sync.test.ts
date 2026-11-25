import { test, expect } from "vitest";
import { flush, linkUnlinked } from "./sync";
import { anyPresence, fake, obs, storeWith } from "./testHelpers";

test("a good save leaves the queue empty", async () => {
  const s = storeWith(obs("a")); const api = fake({});
  expect(await flush(api, s)).toEqual({ saved: 1, waiting: 0 });
  expect(api.calls).toEqual(["create a"]); // no exists check on a first attempt
});
test("a failed save stays queued", async () => {
  const s = storeWith(obs("a")); const api = fake({ createThrows: true });
  expect(await flush(api, s)).toEqual({ saved: 0, waiting: 1 });
  expect(s.pending()[0].attempts).toBe(1);
});
test("a lost reply does not create a second report", async () => {
  const s = storeWith(obs("a")); const api = fake({ createThrows: true });
  await flush(api, s); // Foundry stored it, the reply was lost
  api.createThrows = false; api.existing.add("a");
  expect(await flush(api, s)).toEqual({ saved: 1, waiting: 0 });
  expect(api.calls).toEqual(["create a", "exists a"]); // no second create
});
test("one failure does not block the rest", async () => {
  const s = storeWith(obs("a"), obs("b")); const api = fake({ createThrowsFor: "a" });
  expect(await flush(api, s)).toEqual({ saved: 1, waiting: 1 });
});
test("hand-typed reports are linked once the match exists", async () => {
  const api = fake({ observations: [obs("a", { matchUuid: null, presenceUuid: null, teamUuid: null, matchType: "qualification", matchNumber: 3, teamNumber: 29550 })],
    presence: { key: "qualification 3 29550", row: { presenceUuid: "p", matchUuid: "m", teamUuid: "t", teamNumber: 29550, alliance: "red", station: 1 } } });
  expect(await linkUnlinked(api, "e", 5)).toBe(1);
  expect(api.modified).toEqual([["a", { matchUuid: "m", presenceUuid: "p", teamUuid: "t", alliance: "red" }]]);
});
test("qualification 3 is not linked to playoff 3, and linked reports are left alone", async () => {
  const api = fake({ observations: [obs("a", { matchUuid: null, matchType: "playoff", matchNumber: 3, teamNumber: 29550 }), obs("b", { matchUuid: "m", matchType: "qualification", matchNumber: 3, teamNumber: 29550 })],
    presence: { key: "qualification 3 29550", row: anyPresence } });
  expect(await linkUnlinked(api, "e", 5)).toBe(0);
  expect(api.modified).toEqual([]);
});
