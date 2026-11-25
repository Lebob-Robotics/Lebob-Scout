import { useEffect, useRef, useState } from "react";
import type { Api } from "./api";
import { CURRENT_FIELD_KEY } from "./field";
import { buildObservation } from "./observation";
import type { Draft, Target } from "./observation";
import { rememberedEvent } from "./schedule";
import { FinalScreen } from "./screens/FinalScreen";
import { LiveScreen } from "./screens/LiveScreen";
import { ReportsScreen } from "./screens/ReportsScreen";
import { SetupScreen } from "./screens/SetupScreen";
import { createStore } from "./storage";
import { linkUnlinked } from "./sync";
import { useSaveQueue } from "./useSaveQueue";

type User = { id: string; name: string };
type Screen = "setup" | "reports" | "live" | "final";

const store = createStore();
const USER_KEY = "lsa:user";
const rememberedUser = (): User | null => {
  try {
    const u = JSON.parse(localStorage.getItem(USER_KEY) ?? "null");
    return u && typeof u.id === "string" && typeof u.name === "string" ? u : null;
  } catch {
    return null;
  }
};
const rememberUser = (u: User) => {
  try { localStorage.setItem(USER_KEY, JSON.stringify(u)); } catch { /* kept for this page load only */ }
};

const newDraft = (target: Target, startSquare: string, flipped: boolean): Draft => ({
  ...target,
  observationId: crypto.randomUUID(), fieldKey: CURRENT_FIELD_KEY, startSquare,
  startedAtMs: Date.now(), taps: [], flipped, stage: "live",
  final: {
    autoLeave: false, autoPark: false, teleopPark: false, brokeDown: false,
    minorFouls: 0, majorFouls: 0, driverSkill: null, robotSpeed: null,
    autoNotes: null, notes: null, autoPathPoints: null,
  },
});

export default function App({ api }: { api: Api }) {
  const [draft, setDraft] = useState(store.loadDraft);
  const [screen, setScreen] = useState<Screen>(() => draft?.stage ?? (rememberedEvent() ? "reports" : "setup"));
  const [user, setUser] = useState(rememberedUser);
  const [saveError, setSaveError] = useState<string | null>(null);
  const saving = useRef(false);
  const linked = useRef(false);
  const queue = useSaveQueue(api, store);
  const event = rememberedEvent();
  const eventUuid = event?.eventUuid;

  useEffect(() => {
    api.currentUser().then((u) => { rememberUser(u); setUser(u); }, () => { /* keep the remembered user */ });
  }, [api]);

  useEffect(() => {
    if (!eventUuid || linked.current) return;
    linked.current = true;
    linkUnlinked(api, eventUuid, Date.now()).catch(() => {});
  }, [api, eventUuid]);

  // Only nag when a reload would lose work: storage is broken and something is unsaved.
  useEffect(() => {
    const warn = (e: BeforeUnloadEvent) => {
      if (!store.ok && (store.loadDraft() || store.pending().length)) {
        e.preventDefault();
        e.returnValue = ""; // older browsers
      }
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, []);

  // The store is written before React state, so a refresh always finds the latest draft.
  const keep = (d: Draft) => { store.saveDraft(d); setDraft(d); };

  const save = async () => {
    if (saving.current || !store.loadDraft()) return; // a second tap, or the draft is already queued
    saving.current = true;
    setSaveError(null);
    try {
      let who = user;
      if (!who) {
        try {
          who = await api.currentUser();
          rememberUser(who);
          setUser(who);
        } catch {
          setSaveError("Couldn't confirm who you are. Check your signal and tap Save again.");
          return;
        }
      }
      const d = store.loadDraft(); // read after the wait, so edits made meanwhile are kept
      if (!d) return;
      let observation;
      try {
        observation = buildObservation(d, who, Date.now());
      } catch (e) {
        setSaveError(e instanceof Error ? e.message : String(e));
        return;
      }
      store.enqueue(observation);
      store.clearDraft(); // only once the report is safely queued
      setDraft(null);
      setScreen("reports");
      queue.queued();
    } finally {
      saving.current = false;
    }
  };

  const top = [
    !store.ok && <p key="ok" className="banner" role="alert">This phone can't store data. Keep this page open until your report has saved.</p>,
    screen === "setup" && event && <button key="back" type="button" onClick={() => setScreen("reports")}>Back to reports</button>,
    screen === "final" && draft && (
      <button key="flip" type="button" onClick={() => keep({ ...draft, flipped: !draft.flipped })}>
        Flip field ({draft.flipped ? "flipped" : "not flipped"})
      </button>
    ),
  ].filter(Boolean);

  let body;
  if (screen === "live" && draft) {
    return <LiveScreen draft={draft} onChange={keep} onEnd={() => { keep({ ...draft, stage: "final" }); setScreen("final"); }} />;
  } else if (screen === "final" && draft) {
    body = (
      <FinalScreen
        value={draft.final}
        onChange={(f) => keep({ ...draft, final: f })}
        onSave={save}
        saveLabel="Save report"
        fieldKey={draft.fieldKey}
        flipped={draft.flipped}
      >
        {saveError && <p className="save-note error" role="alert">{saveError}</p>}
      </FinalScreen>
    );
  } else if (screen === "reports" && eventUuid) {
    body = <ReportsScreen api={api} eventUuid={eventUuid} userId={user?.id ?? ""} waiting={queue.waiting} refresh={queue.saved} onNew={() => setScreen("setup")} />;
  } else {
    body = <SetupScreen api={api} onStart={(t, square, flipped) => { keep(newDraft(t, square, flipped)); setScreen("live"); }} />;
  }

  return (
    <>
      {top.length > 0 && <div className="top">{top}</div>}
      {body}
    </>
  );
}
