import { test, expect, vi } from "vitest";
import { tokenSource } from "./token";

const fakeAuth = (token: string | undefined, refresh: () => Promise<{ access_token: string } | undefined>) => {
  const signIn = vi.fn();
  return { signIn, getTokenOrUndefined: () => token, refresh: vi.fn(refresh) as never as () => Promise<never> };
};
const online = () => true;

test("uses the current token without refreshing", async () => {
  const a = fakeAuth("now", async () => ({ access_token: "x" }));
  const report = vi.fn();
  expect(await tokenSource(a, report, online)()).toBe("now");
  expect(a.refresh).not.toHaveBeenCalled();
  expect(report).toHaveBeenCalledWith(false);
  expect(a.signIn).not.toHaveBeenCalled();
});

test("refreshes silently when there is no current token", async () => {
  const a = fakeAuth(undefined, async () => ({ access_token: "fresh" }));
  const report = vi.fn();
  expect(await tokenSource(a, report, online)()).toBe("fresh");
  expect(report).toHaveBeenCalledWith(false);
  expect(a.signIn).not.toHaveBeenCalled();
});

test("rejects as signed out when the refresh fails, and never signs in", async () => {
  const report = vi.fn();
  for (const refresh of [async () => { throw new Error("No refresh token found"); }, async () => undefined]) {
    const a = fakeAuth(undefined, refresh);
    await expect(tokenSource(a, report, online)()).rejects.toThrow("signed out");
    expect(a.signIn).not.toHaveBeenCalled();
  }
  expect(report.mock.calls).toEqual([[true], [true]]);
});

test("four requests at once share one refresh; a later one starts a new refresh", async () => {
  let n = 0;
  const a = fakeAuth(undefined, async () => ({ access_token: `t${++n}` }));
  const token = tokenSource(a, vi.fn(), online);
  expect(await Promise.all([token(), token(), token(), token()])).toEqual(["t1", "t1", "t1", "t1"]);
  expect(a.refresh).toHaveBeenCalledTimes(1);
  expect(await token()).toBe("t2");
  expect(a.refresh).toHaveBeenCalledTimes(2);
});

test("offline with no token rejects without refreshing and without reporting signed out", async () => {
  const a = fakeAuth(undefined, async () => ({ access_token: "x" }));
  const report = vi.fn();
  await expect(tokenSource(a, report, () => false)()).rejects.toThrow("signed out for now");
  expect(a.refresh).not.toHaveBeenCalled();
  expect(report).not.toHaveBeenCalled();
});
