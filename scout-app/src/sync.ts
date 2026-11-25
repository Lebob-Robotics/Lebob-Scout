import type { Api } from "./api";
import type { Store } from "./storage";

// A server call that never answers counts as a failure, so the queue can't hang.
function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new Error("Timed out")), ms); });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

// attempts > 0 means a create may have reached the server, so check before creating a second copy.
export async function flush(api: Pick<Api, "exists" | "create">, store: Store, timeoutMs = 20_000): Promise<{ saved: number; waiting: number }> {
  let saved = 0;
  for (const { observation, attempts } of [...store.pending()]) {
    const id = observation.observationId;
    let found = false;
    if (attempts > 0) {
      try { found = await withTimeout(api.exists(id), timeoutMs); } catch { continue; } // can't tell; stay queued
    } else {
      store.bump(id); // recorded before sending, so a reload mid-request checks first
    }
    try {
      if (!found) await withTimeout(api.create(observation), timeoutMs);
      store.remove(id);
      saved++;
    } catch {
      // stays queued; attempts already says a create may have landed
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
