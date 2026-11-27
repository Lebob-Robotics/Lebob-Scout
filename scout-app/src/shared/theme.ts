// Light and dark: Auto follows the device, or the person picks Light or Dark. Kept per device under one key, so the
// scout app and the strategy app (one site) always match. The chosen look is `data-theme` on <html>.
import { useSyncExternalStore } from "react";

export type ThemeChoice = "auto" | "light" | "dark";
export type Theme = "light" | "dark";
export const THEME_KEY = "lsa:theme";
export const CHOICES: ThemeChoice[] = ["auto", "light", "dark"];
// The browser's bar colour for each look: the page background.
export const META_COLOUR: Record<Theme, string> = { dark: "#1a1b1e", light: "#f3f3ee" };

type Store = { getItem(k: string): string | null; setItem(k: string, v: string): void };
const local = (): Store => localStorage;

// The kept choice; Auto when there is none, it is not one we know, or storage refuses.
export function readTheme(store: () => Store = local): ThemeChoice {
  try {
    const v = store().getItem(THEME_KEY);
    return v === "light" || v === "dark" ? v : "auto";
  } catch {
    return "auto";
  }
}
export function keepTheme(choice: ThemeChoice, store: () => Store = local): void {
  try { store().setItem(THEME_KEY, choice); } catch { /* this page load only */ }
}

// Auto takes the device's setting.
export const resolveTheme = (choice: ThemeChoice, deviceDark: boolean): Theme => (choice === "auto" ? (deviceDark ? "dark" : "light") : choice);

// The next choice for the strategy app's one-button switch.
export const nextChoice = (choice: ThemeChoice): ThemeChoice => CHOICES[(CHOICES.indexOf(choice) + 1) % CHOICES.length];

// Puts a look on the page: the attribute the CSS reads, and the browser bar colour.
export function paint(theme: Theme, doc: Document = document): void {
  doc.documentElement.dataset.theme = theme;
  doc.querySelector('meta[name="theme-color"]')?.setAttribute("content", META_COLOUR[theme]);
}

// The page's current choice, shared by every screen that shows the switch.
let choice: ThemeChoice = "auto";
const listeners = new Set<() => void>();
const deviceDark = () => typeof matchMedia === "function" && matchMedia("(prefers-color-scheme: dark)").matches;

// Called once, before anything renders: paints the kept choice and follows the device while on Auto.
export function startTheme(): void {
  choice = readTheme();
  paint(resolveTheme(choice, deviceDark()));
  if (typeof matchMedia === "function") {
    matchMedia("(prefers-color-scheme: dark)").addEventListener("change", (e) => { if (choice === "auto") paint(resolveTheme("auto", e.matches)); });
  }
}

export function setTheme(next: ThemeChoice): void {
  choice = next;
  keepTheme(next);
  paint(resolveTheme(next, deviceDark()));
  listeners.forEach((f) => f());
}

export function useTheme(): [ThemeChoice, (c: ThemeChoice) => void] {
  const c = useSyncExternalStore((f) => { listeners.add(f); return () => { listeners.delete(f); }; }, () => choice);
  return [c, setTheme];
}
