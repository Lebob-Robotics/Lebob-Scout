import { useEffect, useState } from "react";
import { CURRENT_FIELD_KEY } from "./field";
import { createDevApi } from "./devApi";
import { buildObservation } from "./observation";
import type { Draft, Target } from "./observation";
import { FinalScreen } from "./screens/FinalScreen";
import { LiveScreen } from "./screens/LiveScreen";
import { ReportsScreen } from "./screens/ReportsScreen";
import { rememberedEvent } from "./schedule";
import { SetupScreen } from "./screens/SetupScreen";
import { createStore } from "./storage";

// TEMPORARY dev harness for the reports, set-up, live and final screens. A later task replaces it with the real app and save queue.
// ?fail makes the schedule fail; ?failsave makes corrections fail.
const store = createStore();
const params = new URLSearchParams(location.search);
const api = createDevApi({ failSchedule: params.has("fail"), failSave: params.has("failsave") });

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

export default function App() {
  const [draft, setDraft] = useState(store.loadDraft);
  const [setup, setSetup] = useState(false);
  const [userId, setUserId] = useState("");
  useEffect(() => { api.currentUser().then((u) => setUserId(u.id)); }, []);
  const save = (d: Draft) => { store.saveDraft(d); setDraft(d); };
  const finish = (d: Draft) =>
    api.currentUser()
      .then((user) => api.create(buildObservation(d, user, Date.now())))
      .then(() => { store.clearDraft(); setDraft(null); setSetup(false); }, (e) => alert(String(e)));

  if (!draft) {
    const event = rememberedEvent();
    if (setup || !event) return <SetupScreen api={api} onStart={(t, square, flipped) => save(newDraft(t, square, flipped))} />;
    return <ReportsScreen api={api} eventUuid={event.eventUuid} userId={userId} waiting={0} onNew={() => setSetup(true)} />;
  }
  if (draft.stage === "final") {
    return (
      <>
        <button type="button" style={{ margin: 16 }} onClick={() => save({ ...draft, flipped: !draft.flipped })}>
          Flip field ({draft.flipped ? "flipped" : "not flipped"})
        </button>
        <FinalScreen
          value={draft.final}
          onChange={(f) => save({ ...draft, final: f })}
          onSave={() => finish(draft)}
          saveLabel="Save report"
          fieldKey={draft.fieldKey}
          flipped={draft.flipped}
        />
      </>
    );
  }
  return <LiveScreen draft={draft} onChange={save} onEnd={() => save({ ...draft, stage: "final" })} />;
}
