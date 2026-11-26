// The sums behind the dropdown (components/Dropdown.tsx), ported from the old site's ddOpen: which items a search
// leaves, where the arrow keys and typed letters move to, and where the panel sits under or over its button.

// One choice. `sub` is small muted text after the label (a team's name); `tone` marks an alliance.
export type DdItem = { value: string; label: string; sub?: string; tone?: "red" | "blue" };

// Lists longer than this get a search box.
export const SEARCH_OVER = 12;

// The items whose label or sub-text holds the search, ignoring case and outer spaces.
export function filterItems(items: DdItem[], query: string): DdItem[] {
  const t = query.trim().toLowerCase();
  return t ? items.filter((it) => `${it.label} ${it.sub ?? ""}`.toLowerCase().includes(t)) : items;
}

// Where an arrow, Home or End key moves to in a list of n, from i (-1 when nothing has focus). Stops at the ends.
// Null for any other key.
export function stepIndex(i: number, key: string, n: number): number | null {
  if (!n) return null;
  if (key === "ArrowDown") return i < 0 ? 0 : Math.min(n - 1, i + 1);
  if (key === "ArrowUp") return i < 0 ? n - 1 : Math.max(0, i - 1);
  if (key === "Home") return 0;
  if (key === "End") return n - 1;
  return null;
}

// Typing in a list without a search box: the next item whose label (or sub-text) starts with what was typed. One
// letter moves on from the current item, so pressing it again steps through the matches; more letters keep the
// current item while it still matches. -1 when none does.
export function typeAhead(items: DdItem[], typed: string, from: number): number {
  const t = typed.toLowerCase();
  if (!t) return -1;
  const starts = (it: DdItem) => it.label.toLowerCase().startsWith(t) || (it.sub ?? "").toLowerCase().startsWith(t);
  const first = t.length > 1 ? Math.max(0, from) : from + 1;
  for (let k = 0; k < items.length; k++) {
    const i = (first + k) % items.length;
    if (starts(items[i])) return i;
  }
  return -1;
}

// The panel on a wide screen: under the button, or over it when there is more room above and little below; at least
// as wide as the button (240 px or more) and kept 8 px inside the window.
export type Place = { left: number; width: number; maxHeight: number; top?: number; bottom?: number; up: boolean };
export function placePanel(r: { left: number; top: number; bottom: number; width: number }, vw: number, vh: number): Place {
  const below = vh - r.bottom - 12, above = r.top - 12, up = below < 240 && above > below, width = Math.max(r.width, 240);
  const left = Math.max(8, Math.min(r.left, vw - width - 8));
  const maxHeight = Math.max(160, Math.min(380, up ? above : below));
  return up ? { left, width, maxHeight, bottom: vh - r.top + 4, up } : { left, width, maxHeight, top: r.bottom + 4, up };
}
