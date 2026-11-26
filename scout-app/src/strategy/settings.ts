// The strategy app's settings, kept per device. Anything missing, unknown or unreadable takes its default, and storage
// that refuses leaves the defaults for this page load.
import { TEAM_MAX } from "../schedule";

export type HeatStyle = "squares" | "smooth";
export type AutoStyle = "averaged" | "drawn";
export type HeatMeasure = "auto" | "teleop" | "pickedUp";
export type HeatField = "full" | "half";
export type Clock = "event" | "device";
export type Settings = {
  ourTeam: number; // "us": our next match, our partners, the "us" tag
  heatStyle: HeatStyle; // heatmaps as squares, or smooth shading that blends between them
  heatField: HeatField; // the Team heatmap on the full field, or the lower half folded onto the upper half
  autoStyle: AutoStyle; // similar autos averaged into one rounded path, or every path as drawn
  measure: HeatMeasure; // the Team tab heatmap's first measure
  refreshMinutes: number; // reload the figures every this many minutes; 0 is never
  clock: Clock; // scout note and breakage times on the event's clock or this device's
  alliances: number; // playoff alliances, for the Alliance tab's play-out
};
export const REFRESH_CHOICES = [0, 2, 5, 10];
export const ALLIANCE_CHOICES = [4, 6, 8];
export const SETTINGS_KEY = "lsa:strategy-settings";
export const defaultSettings = (ourTeam: number): Settings => ({
  ourTeam, heatStyle: "squares", heatField: "full", autoStyle: "averaged", measure: "teleop", refreshMinutes: 0, clock: "event", alliances: 4,
});

type Store = { getItem(k: string): string | null; setItem(k: string, v: string): void };
const local = (): Store => localStorage;
const oneOf = <T extends string | number>(v: unknown, allowed: readonly T[], fallback: T): T => (allowed.includes(v as T) ? (v as T) : fallback);
export const validTeam = (v: unknown): v is number => typeof v === "number" && Number.isInteger(v) && v >= 1 && v <= TEAM_MAX;

// The kept settings over the defaults, each field checked on its own.
export function readSettings(defaults: Settings, store: () => Store = local): Settings {
  let kept: Record<string, unknown> = {};
  try {
    const v = JSON.parse(store().getItem(SETTINGS_KEY) ?? "null");
    if (v && typeof v === "object") kept = v;
  } catch { /* unreadable or blocked: defaults */ }
  return {
    ourTeam: validTeam(kept.ourTeam) ? kept.ourTeam : defaults.ourTeam,
    heatStyle: oneOf(kept.heatStyle, ["squares", "smooth"] as const, defaults.heatStyle),
    heatField: oneOf(kept.heatField, ["full", "half"] as const, defaults.heatField),
    autoStyle: oneOf(kept.autoStyle, ["averaged", "drawn"] as const, defaults.autoStyle),
    measure: oneOf(kept.measure, ["auto", "teleop", "pickedUp"] as const, defaults.measure),
    refreshMinutes: oneOf(kept.refreshMinutes, REFRESH_CHOICES, defaults.refreshMinutes),
    clock: oneOf(kept.clock, ["event", "device"] as const, defaults.clock),
    alliances: oneOf(kept.alliances, ALLIANCE_CHOICES, defaults.alliances),
  };
}
export function keepSettings(s: Settings, store: () => Store = local): void {
  try { store().setItem(SETTINGS_KEY, JSON.stringify(s)); } catch { /* this page load only */ }
}

// A typed team number: whole, 1 to the largest team number; null otherwise.
export function parseTeam(text: string): number | null {
  const t = text.trim();
  if (!/^\d+$/.test(t)) return null;
  const n = Number(t);
  return validTeam(n) ? n : null;
}
