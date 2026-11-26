import type { Field } from "./field";
import type { Tap } from "./taps";

// The final page's figures, as on the old site's summary: pieces scored in auto and in teleop, and intake squares.
// A tap in the changeover counts as teleop, as it does in the Teams tab.
export function matchSummary(taps: Tap[], field: Field) {
  let autoScored = 0;
  let teleopScored = 0;
  let intakeSquares = 0;
  for (const t of taps) {
    if (t.kind === "intake") intakeSquares += 1;
    else if (t.seconds < field.auto) autoScored += t.count;
    else teleopScored += t.count;
  }
  return { autoScored, teleopScored, intakeSquares };
}

// The header's pill: how many reports are still on this phone, and whether the phone has signal.
export const queuePill = (online: boolean, waiting: number) =>
  online ? `${waiting} unsent` : waiting ? `Offline · ${waiting} unsent` : "Offline";
