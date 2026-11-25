import type { Draft, Observation } from "./observation";

export type Pending = { observation: Observation; attempts: number };

const DRAFT_KEY = "lsa:draft";
const OUTBOX_KEY = "lsa:outbox";

export function createStore(backing?: Storage) {
  let ok = true;
  let store: Storage | null = null;
  try {
    store = backing ?? window.localStorage;
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
  let draft: Draft | null = storedDraft && typeof storedDraft === "object" && !Array.isArray(storedDraft) ? (storedDraft as Draft) : null;
  let outbox: Pending[] = Array.isArray(storedOutbox) ? (storedOutbox as Pending[]) : [];

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
    remove(id: string) { outbox = outbox.filter(p => p.observation.observationId !== id); saveOutbox(); },
  };
}

export type Store = ReturnType<typeof createStore>;
