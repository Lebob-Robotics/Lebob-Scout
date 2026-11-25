import { test, expect } from "vitest";
import { createStore } from "./storage";
import { matchSeconds } from "./clock";
import { draft, tap, obs, fakeStorage, throwingStorage } from "./testHelpers";

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
