import type { Field } from "./field";
import type { Tap } from "./taps";

// The final page's figures, as on the old site's summary: pieces scored in auto and in teleop, and intake squares.
// A tap in the transition (between AUTO and TELEOP) counts as teleop, as it does in the Teams tab.
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

// What the header's warning sign says when tapped. Nothing waiting means no sign, so no text.
export function unsentNote(online: boolean, waiting: number, lastError: string | null) {
  if (waiting <= 0) return "";
  const what = waiting === 1 ? "1 report hasn't" : `${waiting} reports haven't`;
  const why = !online
    ? "This phone has no internet. Reports need internet to send, and send by themselves once it is back online."
    : lastError
      ? `They need internet to send. The last try failed: ${lastError}. They try again by themselves.`
      : "They need internet to send, and are sending now.";
  return `${what} been sent yet. ${why}`;
}
