import type { Api } from "./api";
import type { Store } from "./storage";

export async function flush(api: Pick<Api, "exists" | "create">, store: Store): Promise<{ saved: number; waiting: number }> {
  let saved = 0;
  for (const { observation, attempts } of [...store.pending()]) {
    const id = observation.observationId;
    // A retry may follow a lost reply, so check before creating a second copy.
    let found = false;
    if (attempts > 0) {
      try { found = await api.exists(id); } catch { continue; } // can't tell; stay queued, no bump
    }
    try {
      if (!found) await api.create(observation);
      store.remove(id);
      saved++;
    } catch {
      store.bump(id);
    }
  }
  return { saved, waiting: store.pending().length };
}

export async function linkUnlinked(
  api: Pick<Api, "observations" | "findPresence" | "modify">,
  eventUuid: string,
  nowMs: number,
): Promise<number> {
  let all;
  try {
    all = await api.observations(eventUuid);
  } catch {
    return 0;
  }
  let linked = 0;
  for (const o of all) {
    if (o.matchUuid) continue;
    try {
      const p = await api.findPresence(eventUuid, o.matchType, o.matchNumber, o.teamNumber);
      if (!p) continue;
      await api.modify(o.observationId, { matchUuid: p.matchUuid, presenceUuid: p.presenceUuid, teamUuid: p.teamUuid, alliance: p.alliance }, nowMs);
      linked++;
    } catch {
      // leave this one unlinked; the rest still link
    }
  }
  return linked;
}
