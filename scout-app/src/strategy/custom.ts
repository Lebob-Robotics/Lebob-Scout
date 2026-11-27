// A custom match: any four of the event's teams, Red 1, Red 2, Blue 1, Blue 2, that a strategist sets up on the Match
// tab to see how it would go. It is forecast exactly as a scheduled match still to play (scouted.ts), as a
// qualification so the expected RP shows, and its maps are built from each team's map as the matchMaps function does.
import type { Game } from "./scouted";
import type { Forecast } from "./types";

// The Match tab's picker value for the custom match.
export const CUSTOM = "custom";
export const SLOT_NAMES = ["Red 1", "Red 2", "Blue 1", "Blue 2"] as const;
export type Four = [number, number, number, number];

// The custom match as a game still to play.
export const customGame = (t: Four): Game => ({
  matchUuid: CUSTOM, level: "qual", number: 0, time: null, red: [t[0], t[1]], blue: [t[2], t[3]], redScore: null, blueScore: null,
});

// Its first teams: the match on screen, else us and the first other teams by number. Null with fewer than four teams.
export function startTeams(f: Pick<Forecast, "red" | "blue"> | null, teams: number[], ourTeam: number): Four | null {
  if (f) return [f.red[0], f.red[1], f.blue[0], f.blue[1]];
  const sorted = [...new Set(teams)].sort((a, b) => a - b);
  const order = sorted.includes(ourTeam) ? [ourTeam, ...sorted.filter((t) => t !== ourTeam)] : sorted;
  return order.length >= 4 ? [order[0], order[1], order[2], order[3]] : null;
}

// A team put in a slot. A team already in another slot swaps places with the one it replaces, so no team plays twice.
export function placeTeam(t: Four, slot: number, team: number): Four {
  const next = [...t] as Four;
  const was = next.indexOf(team);
  if (was >= 0) next[was] = next[slot];
  next[slot] = team;
  return next;
}

// Red and blue swapped, each pair keeping its order.
export const swapSides = (t: Four): Four => [t[2], t[3], t[0], t[1]];

// "11115 14469 v 12345 16021", for the picker.
export const fourText = (t: Four) => `${t[0]} ${t[1]} v ${t[2]} ${t[3]}`;
