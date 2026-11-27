import { test, expect } from "vitest";
import { createStore } from "../shared/storage";
import type { Draft } from "../shared/observation";
import { matchSeconds } from "./clock";
import { draft, tap, obs, fakeStorage, throwingStorage, pitReport, breakageReport } from "../shared/testHelpers";

test("a draft survives a reload with its start time", () => {
  const backing = fakeStorage();
  createStore(backing).saveDraft(draft({ startedAtMs: 1_000_000, taps: [tap(12.3)] }));
  const d = createStore(backing).loadDraft()!;
  expect(d.startedAtMs).toBe(1_000_000);
  expect(matchSeconds(d.startedAtMs, 1_045_000)).toBe(45);
  expect(d.taps).toHaveLength(1);
});
test("blocked storage does not throw and still holds the match in memory", () => {
  const s = createStore(throwingStorage());
  expect(s.ok).toBe(false);
  s.saveDraft(draft({}));
  expect(s.loadDraft()).not.toBeNull();
  s.enqueue(obs("a"));
  expect(s.pending()).toHaveLength(1);
});
test("corrupt stored text is treated as empty", () => {
  const backing = fakeStorage({ "lsa:draft": "{not json", "lsa:outbox": "42" });
  const s = createStore(backing);
  expect(s.loadDraft()).toBeNull();
  expect(s.pending()).toEqual([]);
});
test("queue", () => {
  const s = createStore(fakeStorage());
  s.enqueue(obs("a")); s.enqueue(obs("b")); s.bump("a"); s.remove("b");
  expect(s.pending()).toEqual([{ observation: obs("a"), attempts: 1 }]);
});
test("queue survives a reload and clearDraft empties the draft", () => {
  const backing = fakeStorage();
  const s = createStore(backing);
  s.enqueue(obs("a")); s.saveDraft(draft({})); s.clearDraft();
  const r = createStore(backing);
  expect(r.pending()).toHaveLength(1);
  expect(r.loadDraft()).toBeNull();
});
test("no argument and a throwing window.localStorage counts as blocked", () => {
  const w = globalThis as { window?: unknown };
  const old = w.window;
  w.window = { get localStorage(): Storage { throw new Error("blocked"); } };
  try {
    expect(createStore().ok).toBe(false);
  } finally {
    w.window = old;
  }
});
test("storage that reads but refuses writes counts as blocked before anything is saved", () => {
  const backing = fakeStorage();
  backing.setItem = () => { throw new Error("quota"); };
  expect(createStore(backing).ok).toBe(false);
});
test("a stored draft missing its essentials is treated as no draft", () => {
  const good = draft({});
  const bad: unknown[] = [
    { ...good, observationId: 7 },
    { ...good, taps: "none" },
    { ...good, startedAtMs: "0" },
    { ...good, final: null },
    { ...good, stage: "done" },
    { ...good, fieldKey: "nope" },
    "a draft",
  ];
  for (const d of bad) expect(createStore(fakeStorage({ "lsa:draft": JSON.stringify(d) })).loadDraft()).toBeNull();
  expect(createStore(fakeStorage({ "lsa:draft": JSON.stringify(good) })).loadDraft()).toEqual(good);
});
test("bad outbox entries are dropped and good ones kept, with or without a last error", () => {
  const entries = [
    { observation: obs("a"), attempts: 1 },
    { observation: obs("b"), attempts: 2, lastError: "Bad Request" },
    { observation: { observationId: 5 }, attempts: 0 },
    { observation: obs("c"), attempts: "1" },
    { attempts: 0 },
    null,
  ];
  const s = createStore(fakeStorage({ "lsa:outbox": JSON.stringify(entries) }));
  expect(s.pending()).toEqual([entries[0], entries[1]]);
});
test("a queued report keeps its last error across a reload", () => {
  const backing = fakeStorage();
  const s = createStore(backing);
  s.enqueue(obs("a")); s.setError("a", "Bad Request");
  expect(createStore(backing).pending()).toEqual([{ observation: obs("a"), attempts: 0, lastError: "Bad Request" }]);
});

test("a draft from the previous version still loads", () => {
  const old = draft({ taps: [{ seconds: 1, square: "A1", kind: "intake", count: 3 }] }); delete (old as Partial<Draft>).startWallPos;
  const backing = fakeStorage({ "lsa:draft": JSON.stringify(old) });
  expect(createStore(backing).loadDraft()).not.toBeNull();
});

test("pit and breakage reports survive a reload; a match report queued by an older build still loads", () => {
  const backing = fakeStorage({ "lsa:outbox": JSON.stringify([{ observation: obs("old"), attempts: 2 }]) });
  const s = createStore(backing);
  s.enqueueReport({ kind: "pit", pit: pitReport("p1") });
  s.enqueueReport({ kind: "breakage", breakage: breakageReport("b1") });
  expect(createStore(backing).pending().map((p) => [p.kind ?? "match", p.attempts])).toEqual([["match", 2], ["pit", 0], ["breakage", 0]]);
});
test("a pit report changed while waiting replaces its waiting copy and keeps its attempts", () => {
  const s = createStore(fakeStorage());
  s.enqueueReport({ kind: "pit", pit: pitReport("p1", 7) });
  s.bump("p1");
  s.enqueueReport({ kind: "pit", pit: pitReport("p1", 8) });
  expect(s.pending()).toEqual([{ kind: "pit", pit: pitReport("p1", 8), attempts: 1 }]);
  s.remove("p1");
  expect(s.pending()).toEqual([]);
});
test("stored items of an unknown kind or shape are dropped", () => {
  const backing = fakeStorage({ "lsa:outbox": JSON.stringify([{ kind: "pit", attempts: 0 }, { kind: "other", attempts: 0 }, { kind: "breakage", breakage: { breakageId: "b" }, attempts: 0 }]) });
  expect(createStore(backing).pending().map((p) => p.kind)).toEqual(["breakage"]);
});

test("pendingLabel names a waiting match report by its label and the others by kind and team", async () => {
  const { pendingLabel } = await import("../shared/storage");
  expect(pendingLabel({ observation: obs("a") })).toBe(obs("a").label);
  expect(pendingLabel({ kind: "pit", pit: pitReport("p1", 12345) })).toBe("Pit · 12345");
  expect(pendingLabel({ kind: "breakage", breakage: breakageReport("b1", 7) })).toBe("Breakage · 7");
});
