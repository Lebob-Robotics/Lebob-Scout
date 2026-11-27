import type { Field } from "../shared/field";

export type Phase = "auto" | "changeover" | "teleop" | "endgame" | "over";

export function matchSeconds(startedAtMs: number, nowMs: number): number {
  return Math.max(0, Math.round((nowMs - startedAtMs) / 100) / 10); // a phone clock set back never reads below 0
}

export function phaseAt(
  seconds: number,
  field: Field,
): { phase: Phase; remaining: number } {
  const teleopStart = field.auto + field.changeover;
  const matchEnd = teleopStart + field.teleop;

  if (seconds < field.auto) {
    return { phase: "auto", remaining: field.auto - seconds };
  }
  if (seconds < teleopStart) {
    return { phase: "changeover", remaining: teleopStart - seconds };
  }
  if (seconds < matchEnd - field.endgame) {
    return { phase: "teleop", remaining: matchEnd - seconds };
  }
  if (seconds < matchEnd) {
    return { phase: "endgame", remaining: matchEnd - seconds };
  }
  return { phase: "over", remaining: 0 };
}

export function skipToTeleop(nowMs: number, field: Field): number {
  return nowMs - (field.auto + field.changeover) * 1000;
}
