import type { Kind, Tap } from "./taps";

export type LiveState = { mode: Kind | null; square: string | null; taps: Tap[] };
export type LiveAction =
  | { type: "mode"; mode: Kind }
  | { type: "square"; square: string }
  | { type: "count"; count: number; seconds: number }
  | { type: "undo" };

export const emptyLive: LiveState = { mode: null, square: null, taps: [] };

export function liveReducer(state: LiveState, action: LiveAction): LiveState {
  switch (action.type) {
    case "mode":
      return { ...state, mode: action.mode, square: null };
    case "square":
      return state.mode ? { ...state, square: action.square } : state;
    case "count": {
      if (!state.mode || !state.square || action.count < 1 || action.count > 4) return state;
      const tap: Tap = { seconds: action.seconds, square: state.square, kind: state.mode, count: action.count };
      return { ...state, square: null, taps: [...state.taps, tap] };
    }
    case "undo":
      return state.taps.length ? { ...state, taps: state.taps.slice(0, -1) } : state;
  }
}
