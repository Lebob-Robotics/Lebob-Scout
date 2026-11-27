import { expect, test } from "vitest";
import { deployedVersion, isNewer } from "./updateCheck";

const reply = (status: number, body: unknown) => (async () => new Response(JSON.stringify(body), { status })) as unknown as typeof fetch;

test("deployedVersion reads version.json, and says nothing when it can't", async () => {
  expect(await deployedVersion(reply(200, { version: "0.5.18" }))).toBe("0.5.18");
  expect(await deployedVersion(reply(404, {}))).toBeNull();
  expect(await deployedVersion(reply(200, { version: "" }))).toBeNull();
  expect(await deployedVersion((async () => { throw new Error("offline"); }) as unknown as typeof fetch)).toBeNull();
  expect(await deployedVersion((async () => new Response("<html>sign in</html>", { status: 200 })) as unknown as typeof fetch)).toBeNull();
});

test("isNewer is true only when a different version is deployed", () => {
  expect(isNewer("0.5.18", "0.5.19")).toBe(true);
  expect(isNewer("0.5.18", "0.5.18")).toBe(false);
  expect(isNewer("0.5.18", null)).toBe(false);
  expect(isNewer("dev", "0.5.19")).toBe(false);
});
