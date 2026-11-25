import { useState } from "react";
import { CURRENT_FIELD_KEY } from "./field";
import type { Draft } from "./observation";
import { FinalScreen } from "./screens/FinalScreen";
import { LiveScreen } from "./screens/LiveScreen";
import { createStore } from "./storage";

// TEMPORARY dev harness for the live and final screens. A later task replaces it with the real app.
const store = createStore();

const newDraft = (): Draft => ({
  eventUuid: "dev-event", matchUuid: null, presenceUuid: null, teamUuid: null,
  matchNumber: 1, matchType: "qualification", teamNumber: 1234, alliance: "red",
  observationId: crypto.randomUUID(), fieldKey: CURRENT_FIELD_KEY, startSquare: "A3",
  startedAtMs: Date.now(), taps: [], flipped: false, stage: "live",
  final: {
    autoLeave: false, autoPark: false, teleopPark: false, brokeDown: false,
    minorFouls: 0, majorFouls: 0, driverSkill: null, robotSpeed: null,
    autoNotes: null, notes: null, autoPathPoints: null,
  },
});

export default function App() {
  const [draft, setDraft] = useState(() => {
    const d = store.loadDraft() ?? newDraft();
    store.saveDraft(d);
    return d;
  });
  const [saved, setSaved] = useState(false);
  const save = (d: Draft) => { store.saveDraft(d); setDraft(d); };
  const reset = () => { save(newDraft()); setSaved(false); };

  if (saved) {
    return (
      <div style={{ padding: 16 }}>
        <pre>{JSON.stringify(draft.final, null, 2)}</pre>
        <button type="button" onClick={reset}>Reset</button>
      </div>
    );
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
          onSave={() => setSaved(true)}
          saveLabel="Save report"
          fieldKey={draft.fieldKey}
          flipped={draft.flipped}
        />
      </>
    );
  }
  return <LiveScreen draft={draft} onChange={save} onEnd={() => save({ ...draft, stage: "final" })} />;
}
