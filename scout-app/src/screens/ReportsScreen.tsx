import { useEffect, useState } from "react";
import type { Api } from "../api";
import type { FinalPage, Observation, Target } from "../observation";
import { changes, sortReports } from "../reports";
import { FinalScreen } from "./FinalScreen";
import { MatchRobotPicker } from "./MatchRobotPicker";

const taps = (o: Observation) => `${o.tapSeconds.length} tap${o.tapSeconds.length === 1 ? "" : "s"}`;

export function ReportsScreen({ api, eventUuid, userId, waiting, onNew }: {
  api: Api;
  eventUuid: string;
  userId: string;
  waiting: number;
  onNew(): void;
}) {
  const [reports, setReports] = useState<Observation[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [tries, setTries] = useState(0);
  const [open, setOpen] = useState<Observation | null>(null);

  useEffect(() => {
    let live = true;
    api.observations(eventUuid).then((os) => live && setReports(os), () => live && setFailed(true));
    return () => { live = false; };
  }, [api, eventUuid, tries]);

  const reload = () => { setReports(null); setFailed(false); setTries((t) => t + 1); };

  if (open) {
    return (
      <Correction
        key={open.observationId}
        api={api}
        report={open}
        onBack={() => setOpen(null)}
        onSaved={() => { setOpen(null); reload(); }}
      />
    );
  }

  return (
    <div className="reports">
      <h1>Reports</h1>
      {waiting > 0 && <p className="banner">{waiting === 1 ? "1 report waiting to save" : `${waiting} reports waiting to save`}</p>}
      <button type="button" className="new" onClick={onNew}>New match</button>
      {failed ? (
        <p>Couldn't load reports. <button type="button" className="retry" onClick={reload}>Retry</button></p>
      ) : !reports ? (
        <p>Loading…</p>
      ) : !reports.length ? (
        <p>No reports yet for this event.</p>
      ) : (
        <ul className="report-list">
          {sortReports(reports, userId).map((o) => (
            <li key={o.observationId}>
              <button type="button" className="report" onClick={() => setOpen(o)}>
                <span className={`alliance ${o.alliance}`}>{o.alliance === "red" ? "Red" : "Blue"}</span>
                <strong>{o.label}</strong>
                {!o.matchUuid && <span className="tag">unlinked</span>}
                <span className="meta">{o.scoutName} · {taps(o)}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function Correction({ api, report, onBack, onSaved }: { api: Api; report: Observation; onBack(): void; onSaved(): void }) {
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
        <h1>{report.label}</h1>
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
