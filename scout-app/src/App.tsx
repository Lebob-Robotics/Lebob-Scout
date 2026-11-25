import { useState } from "react";
import { CURRENT_FIELD_KEY } from "./field";
import { createDevApi } from "./devApi";
import type { Draft, Target } from "./observation";
import { FinalScreen } from "./screens/FinalScreen";
import { LiveScreen } from "./screens/LiveScreen";
import { SetupScreen } from "./screens/SetupScreen";
import { createStore } from "./storage";

// TEMPORARY dev harness for the set-up, live and final screens. A later task replaces it with the real app.
const store = createStore();
const api = createDevApi({ failSchedule: new URLSearchParams(location.search).has("fail") });

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
  const [saved, setSaved] = useState(false);
  const save = (d: Draft) => { store.saveDraft(d); setDraft(d); };
  const reset = () => { store.clearDraft(); setDraft(null); setSaved(false); };

  if (!draft) return <SetupScreen api={api} onStart={(t, square, flipped) => save(newDraft(t, square, flipped))} />;

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
