import { useState } from "react";
import { CURRENT_FIELD_KEY } from "./field";
import type { Draft } from "./observation";
import { LiveScreen } from "./screens/LiveScreen";
import { createStore } from "./storage";

// TEMPORARY dev harness for the live screen. A later task replaces it with the real app.
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
  const [ended, setEnded] = useState(false);

  if (ended) {
    return (
      <p style={{ padding: 16 }}>
        Ended with {draft.taps.length} records{" "}
        <button type="button" onClick={() => { const d = newDraft(); store.saveDraft(d); setDraft(d); setEnded(false); }}>Reset</button>
      </p>
    );
  }
  return (
    <LiveScreen
      draft={draft}
      onChange={(d) => { store.saveDraft(d); setDraft(d); }}
      onEnd={() => setEnded(true)}
    />
  );
}
