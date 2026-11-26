import { expect, test } from "vitest";
import { META_COLOUR, THEME_KEY, keepTheme, nextChoice, paint, readTheme, resolveTheme } from "./theme";

const memory = () => {
  const kept = new Map<string, string>();
  return { kept, store: () => ({ getItem: (k: string) => kept.get(k) ?? null, setItem: (k: string, v: string) => { kept.set(k, v); } }) };
};

test("readTheme gives the kept choice, and Auto when there is none or it is unknown", () => {
  const { kept, store } = memory();
  expect(readTheme(store)).toBe("auto");
  keepTheme("light", store);
  expect(kept.get(THEME_KEY)).toBe("light");
  expect(readTheme(store)).toBe("light");
  keepTheme("dark", store);
  expect(readTheme(store)).toBe("dark");
  kept.set(THEME_KEY, "sepia");
  expect(readTheme(store)).toBe("auto");
});

test("storage that refuses leaves Auto and never throws", () => {
  const refuses = () => { throw new Error("blocked"); };
  expect(readTheme(refuses)).toBe("auto");
  expect(() => keepTheme("light", refuses)).not.toThrow();
  const full = () => ({ getItem: () => null, setItem: () => { throw new Error("full"); } });
  expect(() => keepTheme("dark", full)).not.toThrow();
});

test("resolveTheme follows the device on Auto and keeps a picked look", () => {
  expect(resolveTheme("auto", true)).toBe("dark");
  expect(resolveTheme("auto", false)).toBe("light");
  expect(resolveTheme("light", true)).toBe("light");
  expect(resolveTheme("dark", false)).toBe("dark");
});

test("nextChoice goes Auto, Light, Dark and round again", () => {
  expect([nextChoice("auto"), nextChoice("light"), nextChoice("dark")]).toEqual(["light", "dark", "auto"]);
});

test("paint sets the page's look and the browser bar colour", () => {
  const meta = { content: "", setAttribute(_: string, v: string) { this.content = v; } };
  const doc = { documentElement: { dataset: {} as Record<string, string> }, querySelector: () => meta } as unknown as Document;
  paint("light", doc);
  expect(doc.documentElement.dataset.theme).toBe("light");
  expect(meta.content).toBe(META_COLOUR.light);
  paint("dark", doc);
  expect(meta.content).toBe(META_COLOUR.dark);
});
