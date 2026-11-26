import { FIELDS } from "./field";
import type { Draft, Observation } from "./observation";
import type { BreakageReport, PitReport } from "./pitBreakage";

// A match report is stored with no kind, as before pit and breakage reports joined the queue.
export type Report = { kind?: "match"; observation: Observation } | { kind: "pit"; pit: PitReport } | { kind: "breakage"; breakage: BreakageReport };
export type Pending = Report & { attempts: number; lastError?: string };
export const reportId = (r: Report) =>
  r.kind === "pit" ? r.pit.pitReportId : r.kind === "breakage" ? r.breakage.breakageId : r.observation.observationId;
// How a waiting report reads in the Reports list: a match report by its label, the others by kind and team.
export const pendingLabel = (r: Report) =>
  r.kind === "pit" ? `Pit · ${r.pit.teamNumber}` : r.kind === "breakage" ? `Breakage · ${r.breakage.teamNumber}` : r.observation.label;

const DRAFT_KEY = "lsa:draft";
const OUTBOX_KEY = "lsa:outbox";

// Stored data may be from an older build or corrupt: keep only what the app can use.
const isObject = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
const isDraft = (d: unknown): d is Draft =>
  isObject(d) && typeof d.observationId === "string" && Array.isArray(d.taps) && typeof d.startedAtMs === "number"
  && isObject(d.final) && (d.stage === "live" || d.stage === "final") && typeof d.fieldKey === "string" && d.fieldKey in FIELDS;
const isPending = (p: unknown): p is Pending =>
  isObject(p) && typeof p.attempts === "number" && (
    p.kind === "pit" ? isObject(p.pit) && typeof p.pit.pitReportId === "string"
    : p.kind === "breakage" ? isObject(p.breakage) && typeof p.breakage.breakageId === "string"
    : p.kind === undefined && isObject(p.observation) && typeof p.observation.observationId === "string");

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
    // A pit or breakage report changed while still waiting replaces its waiting copy. Its attempts carry over, so a
    // create that may have landed is still checked for.
    enqueueReport(r: Exclude<Report, { observation: Observation }>) {
      const id = reportId(r), old = outbox.find((p) => reportId(p) === id);
      outbox = [...outbox.filter((p) => reportId(p) !== id), { ...r, attempts: old?.attempts ?? 0 }];
      saveOutbox();
    },
    bump(id: string) {
      outbox = outbox.map(p => reportId(p) === id ? { ...p, attempts: p.attempts + 1 } : p);
      saveOutbox();
    },
    setError(id: string, message: string) {
      outbox = outbox.map(p => reportId(p) === id ? { ...p, lastError: message } : p);
      saveOutbox();
    },
    remove(id: string) { outbox = outbox.filter(p => reportId(p) !== id); saveOutbox(); },
  };
}

export type Store = ReturnType<typeof createStore>;
