import { isSquare } from "./field";
import type { Field } from "./field";

export type Kind = "shoot" | "intake";
export type Tap = { seconds: number; square: string; kind: Kind; count: number };
export type TapLists = { tapSeconds: number[]; tapSquares: string[]; tapKinds: string[]; tapCounts: number[] };

export const toLists = (taps: Tap[]): TapLists => ({
  tapSeconds: taps.map(t => t.seconds),
  tapSquares: taps.map(t => t.square),
  tapKinds: taps.map(t => t.kind),
  tapCounts: taps.map(t => t.count),
});

export function checkTaps(taps: Tap[], field: Field): string[] {
  const problems: string[] = [];
  taps.forEach((t, i) => {
    const at = `Tap ${i + 1}`;
    if (!isSquare(t.square, field)) problems.push(`${at}: ${t.square} is not a square on the field`);
    if (t.kind !== "shoot" && t.kind !== "intake") problems.push(`${at}: kind ${t.kind} is not shoot or intake`);
    // An intake is an area with count 0; reports saved before that have 1 to 4.
    const min = t.kind === "intake" ? 0 : 1;
    if (!Number.isInteger(t.count) || t.count < min || t.count > 4) problems.push(`${at}: count ${t.count} is not a whole number from ${min} to 4`);
    if (!(t.seconds >= 0)) problems.push(`${at}: seconds ${t.seconds} is below 0`);
  });
  return problems;
}
