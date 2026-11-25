import { useState } from "react";
import type { Api } from "../api";
import type { FinalPage, Observation, Target } from "../observation";
import { changes, taps } from "../reports";
import { FinalScreen } from "./FinalScreen";
import { MatchRobotPicker } from "./MatchRobotPicker";

export function Correction({ api, report, onBack, onSaved }: { api: Api; report: Observation; onBack(): void; onSaved(): void }) {
  const [target, setTarget] = useState<Target | null>(report);
  const [final, setFinal] = useState<FinalPage>(report);
  const [saving, setSaving] = useState(false);
  const [failed, setFailed] = useState(false);

  const save = () => {
    if (!target) return;
    const patch = changes(report, target, final);
    if (!Object.keys(patch).length) return onBack();
    setSaving(true);
    setFailed(false);
    api.modify(report.observationId, patch, Date.now()).then(onSaved, () => { setSaving(false); setFailed(true); });
  };

  return (
    <>
      <div className="reports">
        <button type="button" className="back" onClick={onBack}>Back</button>
        <h1 className="match-label">{report.label}</h1>
        <p>Recorded by {report.scoutName} · {taps(report)} (taps can't be changed)</p>
        <MatchRobotPicker key={report.observationId} api={api} eventUuid={report.eventUuid} value={target} onChange={setTarget} />
      </div>
      <FinalScreen
        key={report.observationId}
        value={final}
        onChange={setFinal}
        onSave={save}
        saveLabel={saving ? "Saving…" : "Save changes"}
        saveDisabled={saving || !target}
        fieldKey={report.fieldKey}
        flipped={false}
      >
        {!target && <p className="save-note">Pick the robot first.</p>}
        {failed && <p className="save-note error" role="alert">Couldn't save. Check your signal and try again.</p>}
      </FinalScreen>
    </>
  );
}
