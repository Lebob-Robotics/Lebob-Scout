import { FIELDS } from "./field";
import type { Draft, Observation } from "./observation";

export type Pending = { observation: Observation; attempts: number; lastError?: string };

const DRAFT_KEY = "lsa:draft";
const OUTBOX_KEY = "lsa:outbox";

// Stored data may be from an older build or corrupt: keep only what the app can use.
const isObject = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
const isDraft = (d: unknown): d is Draft =>
  isObject(d) && typeof d.observationId === "string" && Array.isArray(d.taps) && typeof d.startedAtMs === "number"
  && isObject(d.final) && (d.stage === "live" || d.stage === "final") && typeof d.fieldKey === "string" && d.fieldKey in FIELDS;
const isPending = (p: unknown): p is Pending =>
  isObject(p) && isObject(p.observation) && typeof p.observation.observationId === "string" && typeof p.attempts === "number";

export function createStore(backing?: Storage) {
  let ok = true;
  let store: Storage | null = null;
  try {
    store = backing ?? window.localStorage;
    // Probe now, so a phone that can't store data is warned before the match, not after.
    store.setItem("lsa:probe", "1");
    store.removeItem("lsa:probe");
  } catch {
    ok = false;
  }

  const read = (key: string): unknown => {
    let text: string | null = null;
    try {
      text = store?.getItem(key) ?? null;
    } catch {
      ok = false;
    }
    try {
      return text ? JSON.parse(text) : null;
    } catch {
      return null; // corrupt text is treated as empty; storage itself still works
    }
  };
  const write = (key: string, value: unknown) => {
    try {
      store?.setItem(key, JSON.stringify(value));
    } catch {
      ok = false;
    }
  };

  const storedDraft = read(DRAFT_KEY);
  const storedOutbox = read(OUTBOX_KEY);
  let draft: Draft | null = isDraft(storedDraft) ? storedDraft : null;
  let outbox: Pending[] = Array.isArray(storedOutbox) ? storedOutbox.filter(isPending) : [];

  const saveOutbox = () => write(OUTBOX_KEY, outbox);

  return {
    get ok() { return ok; },
    loadDraft: () => draft,
    saveDraft(d: Draft) { draft = d; write(DRAFT_KEY, d); },
    clearDraft() {
      draft = null;
      try { store?.removeItem(DRAFT_KEY); } catch { ok = false; }
    },
    pending: () => outbox,
    enqueue(o: Observation) { outbox = [...outbox, { observation: o, attempts: 0 }]; saveOutbox(); },
    bump(id: string) {
      outbox = outbox.map(p => p.observation.observationId === id ? { ...p, attempts: p.attempts + 1 } : p);
      saveOutbox();
    },
    setError(id: string, message: string) {
      outbox = outbox.map(p => p.observation.observationId === id ? { ...p, lastError: message } : p);
      saveOutbox();
    },
    remove(id: string) { outbox = outbox.filter(p => p.observation.observationId !== id); saveOutbox(); },
  };
}

export type Store = ReturnType<typeof createStore>;
