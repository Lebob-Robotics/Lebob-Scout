import type { Kind, Tap } from "./taps";

// area: squares recorded since Intake was selected.
export type LiveState = { mode: Kind | null; square: string | null; area: string[]; taps: Tap[] };
export type LiveAction =
  | { type: "mode"; mode: Kind }
  | { type: "square"; square: string; seconds: number }
  | { type: "count"; count: number; seconds: number }
  | { type: "undo" };

export const emptyLive: LiveState = { mode: null, square: null, area: [], taps: [] };

export function liveReducer(state: LiveState, action: LiveAction): LiveState {
  switch (action.type) {
    case "mode":
      return { ...state, mode: action.mode, square: null, area: [] };
    case "square": {
      if (state.mode === "shoot") return { ...state, square: action.square };
      if (state.mode !== "intake") return state;
      const { square } = action;
      if (state.area.includes(square)) {
        // The area's records are the newest taps, so its record for this square is the last one.
        const i = state.taps.findLastIndex(t => t.square === square);
        return { ...state, area: state.area.filter(s => s !== square), taps: state.taps.toSpliced(i, 1) };
      }
      const tap: Tap = { seconds: action.seconds, square, kind: "intake", count: 0 };
      return { ...state, area: [...state.area, square], taps: [...state.taps, tap] };
    }
    case "count": {
      if (state.mode !== "shoot" || !state.square || action.count < 1 || action.count > 4) return state;
      const tap: Tap = { seconds: action.seconds, square: state.square, kind: "shoot", count: action.count };
      return { ...state, square: null, taps: [...state.taps, tap] };
    }
    case "undo": {
      const last = state.taps.at(-1);
      if (!last) return state;
      return { ...state, area: state.area.filter(s => s !== last.square), taps: state.taps.slice(0, -1) };
    }
  }
}
