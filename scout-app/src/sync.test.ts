import { test, expect } from "vitest";
import { flush, linkUnlinked, shortError } from "./sync";
import { createStore } from "./storage";
import { anyPresence, breakageReport, fake, fakeStorage, obs, pitReport, storeWith } from "./testHelpers";

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
test("a failed save keeps a short last error, and a later failure replaces it", async () => {
  const s = storeWith(obs("a")); const api = fake({ createThrows: true });
  await flush(api, s);
  expect(s.pending()[0].lastError).toBe("network");
  api.createThrows = false; api.existsThrows = true;
  await flush(api, s);
  expect(s.pending()[0].lastError).toBe("exists failed");
});
test("a long or many-line error is cut to one short line", () => {
  expect(shortError(new Error("Failed to fetch 400 Bad Request\n    at applyAction (client.js:1)"))).toBe("Failed to fetch 400 Bad Request");
  expect(shortError(new Error("x".repeat(300)))).toHaveLength(120);
  expect(shortError("plain")).toBe("plain");
});
test("one failure does not block the rest", async () => {
  const s = storeWith(obs("a"), obs("b")); const api = fake({ createThrowsFor: "a" });
  expect(await flush(api, s)).toEqual({ saved: 1, waiting: 1 });
});
test("a reload while the first create is in flight does not create a second copy", async () => {
  const backing = fakeStorage();
  createStore(backing).enqueue(obs("a"));
  void flush(fake({ createHangs: true }), createStore(backing)); // the page is reloaded before the reply
  const api = fake({}); api.existing.add("a");
  expect(await flush(api, createStore(backing))).toEqual({ saved: 1, waiting: 0 });
  expect(api.calls).toEqual(["exists a"]);
});
test("a request that never answers gives up after the limit and stays queued", async () => {
  const s = storeWith(obs("a"));
  expect(await flush(fake({ createHangs: true }), s, 10)).toEqual({ saved: 0, waiting: 1 });
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

test("pit and breakage reports send as create-or-replace alongside match reports", async () => {
  const s = storeWith(obs("a"));
  s.enqueueReport({ kind: "pit", pit: pitReport("p1") });
  s.enqueueReport({ kind: "breakage", breakage: breakageReport("b1") });
  const api = fake({});
  expect(await flush(api, s)).toEqual({ saved: 3, waiting: 0 });
  expect(api.calls).toEqual(["create a", "savePit p1", "saveBreakage b1"]);
});
test("a pit report that fails to send stays queued with its error, and the rest still send", async () => {
  const s = createStore(fakeStorage());
  s.enqueueReport({ kind: "pit", pit: pitReport("p1") });
  s.enqueueReport({ kind: "breakage", breakage: breakageReport("b1") });
  const api = fake({}); api.saveThrows = true;
  expect(await flush(api, s)).toEqual({ saved: 0, waiting: 2 });
  expect(s.pending().map((p) => p.lastError)).toEqual(["network", "network"]);
  api.saveThrows = false;
  expect(await flush(api, s)).toEqual({ saved: 2, waiting: 0 });
});
