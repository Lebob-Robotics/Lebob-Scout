import type { Api, PitUpload } from "./api";
import { photoStore } from "./photos";
import type { PhotoStore } from "./photos";
import { reportId } from "./storage";
import type { Store } from "./storage";

// Schedule reads and the user lookup give up after this, so a weak signal never leaves a screen waiting.
export const READ_LIMIT_MS = 8_000;

// A server call that never answers counts as a failure, so the queue can't hang.
export function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new Error("Timed out")), ms); });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

// What the scout sees under the waiting banner: one line, no stack trace.
export const shortError = (e: unknown) => (e instanceof Error ? e.message : String(e)).split("\n")[0].slice(0, 120);

// Match reports: attempts > 0 means a create may have reached the server, so check before creating a second copy.
// Pit and breakage reports are saved as "create or replace", which is safe to send again. A pit report's new photos
// are read from the phone's photo store and go up with it; they are deleted from the phone once it is saved. A photo the
// phone no longer holds is skipped, so the report still sends.
export async function flush(
  api: Pick<Api, "exists" | "create" | "savePit" | "saveBreakage">, store: Store, timeoutMs = 20_000, photos: PhotoStore = photoStore,
): Promise<{ saved: number; waiting: number }> {
  let saved = 0;
  for (const p of [...store.pending()]) {
    const id = reportId(p);
    if (p.kind === "pit" || p.kind === "breakage") {
      try {
        if (p.kind === "pit") {
          const ids = p.pit.photoIds ?? [];
          const uploads: PitUpload[] = [];
          for (const [i, photoId] of ids.entries()) {
            const blob = await photos.get(photoId);
            if (blob) uploads.push({ id: photoId, name: `robot-${p.pit.teamNumber}-${Date.now()}-${i + 1}.jpg`, blob });
          }
          await withTimeout(api.savePit(p.pit, uploads), timeoutMs);
          await photos.remove(ids);
        } else {
          await withTimeout(api.saveBreakage(p.breakage), timeoutMs);
        }
        store.remove(id);
        saved++;
      } catch (e) {
        store.setError(id, shortError(e));
      }
      continue;
    }
    const { observation, attempts } = p;
    let found = false;
    if (attempts > 0) {
      try {
        found = await withTimeout(api.exists(id), timeoutMs);
      } catch (e) {
        store.setError(id, shortError(e));
        continue; // can't tell; stay queued
      }
    } else {
      store.bump(id); // recorded before sending, so a reload mid-request checks first
    }
    try {
      if (!found) await withTimeout(api.create(observation), timeoutMs);
      store.remove(id);
      saved++;
    } catch (e) {
      store.setError(id, shortError(e)); // stays queued; attempts already says a create may have landed
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
