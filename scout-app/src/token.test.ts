import { test, expect, vi } from "vitest";
import { tokenWithoutRedirect } from "./token";

const fakeAuth = (token: string | undefined, refresh: () => Promise<{ access_token: string } | undefined>) => {
  const signIn = vi.fn();
  return { signIn, getTokenOrUndefined: () => token, refresh: refresh as never };
};

test("uses the current token without refreshing", async () => {
  const refresh = vi.fn();
  const a = fakeAuth("now", refresh);
  const report = vi.fn();
  expect(await tokenWithoutRedirect(a, report)).toBe("now");
  expect(refresh).not.toHaveBeenCalled();
  expect(report).toHaveBeenCalledWith(false);
  expect(a.signIn).not.toHaveBeenCalled();
});

test("refreshes silently when there is no current token", async () => {
  const a = fakeAuth(undefined, async () => ({ access_token: "fresh" }));
  const report = vi.fn();
  expect(await tokenWithoutRedirect(a, report)).toBe("fresh");
  expect(report).toHaveBeenCalledWith(false);
  expect(a.signIn).not.toHaveBeenCalled();
});

test("rejects as signed out when the refresh fails, and never signs in", async () => {
  const report = vi.fn();
  for (const refresh of [async () => { throw new Error("No refresh token found"); }, async () => undefined]) {
    const a = fakeAuth(undefined, refresh);
    await expect(tokenWithoutRedirect(a, report)).rejects.toThrow("signed out");
    expect(a.signIn).not.toHaveBeenCalled();
  }
  expect(report.mock.calls).toEqual([[true], [true]]);
});
