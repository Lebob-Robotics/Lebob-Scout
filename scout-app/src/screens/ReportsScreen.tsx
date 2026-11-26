import { useEffect, useState } from "react";
import type { Api } from "../api";
import type { Observation } from "../observation";
import { sortReports, taps } from "../reports";
import { Correction } from "./Correction";

// Changing `refresh` reloads the list without closing an open correction.
export function ReportsScreen({ api, eventUuid, userId, waiting, waitingLabels = [], lastError = null, refresh = 0, onNew, onCorrecting }: {
  api: Api;
  eventUuid: string;
  userId: string;
  waiting: number;
  waitingLabels?: string[];
  lastError?: string | null;
  refresh?: number;
  onNew(): void;
  onCorrecting(open: boolean): void;
}) {
  const [reports, setReports] = useState<Observation[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [tries, setTries] = useState(0);
  const [open, setOpen] = useState<Observation | null>(null);

  useEffect(() => {
    let live = true;
    api.observations(eventUuid).then(
      (os) => { if (live) { setReports(os); setFailed(false); } },
      () => live && setFailed(true),
    );
    return () => { live = false; };
  }, [api, eventUuid, tries, refresh]);

  // Tells App while a correction is open; false again on closing or leaving the screen.
  useEffect(() => {
    onCorrecting(open !== null);
    return () => onCorrecting(false);
  }, [open, onCorrecting]);

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
      {waiting > 0 && (
        <div className="banner">
          <p>Saved on this phone: {waiting === 1 ? "1 report waits to send" : `${waiting} reports wait to send`}</p>
          {waitingLabels.length > 0 && <p className="last-error">{waitingLabels.join(", ")}</p>}
          <p className="last-error">They send by themselves when there is signal.</p>
          {lastError && <p className="last-error">Last try: {lastError}</p>}
        </div>
      )}
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
