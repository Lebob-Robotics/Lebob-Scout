import { expect, test } from "vitest";
import { createPhotoStore, fitSize } from "./photos";

test("fitSize shrinks the longest side to the limit and never scales up", () => {
  expect(fitSize(4000, 3000)).toEqual({ width: 1600, height: 1200 });
  expect(fitSize(3000, 4000)).toEqual({ width: 1200, height: 1600 });
  expect(fitSize(800, 600)).toEqual({ width: 800, height: 600 });
  expect(fitSize(10000, 1)).toEqual({ width: 1600, height: 1 });
});

// Node has no IndexedDB, so the store falls back to memory, as on a phone that blocks it.
test("without IndexedDB a photo is kept in memory, the store says so, and remove forgets it", async () => {
  const s = createPhotoStore();
  expect(s.keeps).toBe(true);
  const blob = new Blob(["x"]);
  await s.put("a", blob);
  expect(s.keeps).toBe(false);
  expect(await s.get("a")).toBe(blob);
  await s.remove(["a"]);
  expect(await s.get("a")).toBeNull();
});
