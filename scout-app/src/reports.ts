import type { Patch } from "./api";
import { labelFor } from "./observation";
import type { FinalPage, Observation, Target } from "./observation";

// What a correction may change. Never the taps, the event, the scout or the timestamps.
const TARGET_KEYS = ["matchUuid", "presenceUuid", "teamUuid", "matchNumber", "matchType", "teamNumber", "alliance"] as const satisfies readonly (keyof Target)[];
const FINAL_KEYS = [
  "autoLeave", "autoPark", "teleopPark", "brokeDown", "minorFouls", "majorFouls",
  "driverSkill", "robotSpeed", "autoNotes", "notes", "autoPathPoints",
] as const satisfies readonly (keyof FinalPage)[];

export const taps = (o: Observation) => `${o.tapSeconds.length} tap${o.tapSeconds.length === 1 ? "" : "s"}`;

// The signed-in scout's reports first, then everyone else's; newest first within each.
export const sortReports = (list: Observation[], userId: string) =>
  [...list].sort((a, b) => Number(b.scoutUserId === userId) - Number(a.scoutUserId === userId) || b.createdAt.localeCompare(a.createdAt));

// Only the fields that differ from the report as loaded, plus a new label when the match or team changed.
export function changes(report: Observation, target: Target, final: FinalPage): Patch {
  const patch: Record<string, unknown> = {};
  for (const k of TARGET_KEYS) if (target[k] !== report[k]) patch[k] = target[k];
  for (const k of FINAL_KEYS) if (final[k] !== report[k]) patch[k] = final[k];
  if ("matchType" in patch || "matchNumber" in patch || "teamNumber" in patch) patch.label = labelFor(target);
  return patch as Patch;
}
