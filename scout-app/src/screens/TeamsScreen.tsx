import { useEffect, useRef, useState } from "react";
import type { Api, TeamsTab } from "../api";
import { TeamRow } from "../components/TeamRow";
import type { Observation, Target } from "../observation";
import { rememberedEvent } from "../schedule";
import { withTimeout } from "../sync";
import { noteLine, scoutLine } from "../teams";
import { type Filter, shown } from "../teamsView";
import { Correction } from "./Correction";

const LIMIT_MS = 20_000;

const FILTERS: [Filter, string][] = [["all", "All"], ["need", "Needs scouting"], ["mine", "Scouted by me"]];

// Loads on opening and whenever `refresh` changes; a reload keeps the last figures on screen.
// The search, filter and open rows live here, so a refresh or a correction leaves them as they were.
// onScout opens set-up for a robot from the coverage grid (Task 9).
export function TeamsScreen({ api, eventUuid, userId, waiting, refresh = 0, onCorrecting }: {
  api: Api;
  eventUuid: string;
  userId: string;
  waiting: number;
  refresh?: number;
  onScout(target: Target): void;
  onCorrecting(open: boolean): void;
}) {
  const [tries, setTries] = useState(0);
  // Which load the figures answer: busy until the current one does.
  const load = `${eventUuid}|${refresh}|${tries}`;
  const [last, setLast] = useState<{ load: string; data: TeamsTab | null; failed: boolean }>({ load: "", data: null, failed: false });

  useEffect(() => {
    let live = true;
    withTimeout(api.teamsTab(eventUuid), LIMIT_MS).then(
      (data) => { if (live) setLast({ load, data, failed: false }); },
      () => { if (live) setLast((l) => ({ load, data: l.data, failed: true })); },
    );
    return () => { live = false; };
  }, [api, eventUuid, load]);

  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [open, setOpen] = useState<ReadonlySet<number>>(new Set());
  // The report line being opened, or the one that couldn't be; then the report open for correction.
  const [pick, setPick] = useState<{ id: string; failed: boolean } | null>(null);
  const [report, setReport] = useState<Observation | null>(null);
  // Where the list was scrolled when the report opened: Correction starts at the top, and Back returns here.
  const listY = useRef(0);
  // Numbers each report-line tap: only the latest one's answer counts, and closing or leaving drops any late one.
  const ask = useRef(0);
  useEffect(() => () => { ask.current++; }, []);

  // Tells App while a correction is open; false again on closing or leaving the screen.
  useEffect(() => {
    onCorrecting(report !== null);
    return () => onCorrecting(false);
  }, [report, onCorrecting]);

  const { data } = last;
  const busy = last.load !== load;
  const failed = !busy && last.failed;

  const reload = () => setTries((t) => t + 1);
  const event = rememberedEvent();
  const retry = <button type="button" onClick={reload}>Retry</button>;

  const toggle = (n: number, isOpen: boolean) => setOpen((o) => {
    const next = new Set(o);
    if (isOpen) next.add(n); else next.delete(n);
    return next;
  });
  const openReport = (id: string) => {
    const n = ++ask.current;
    setPick({ id, failed: false });
    withTimeout(api.observation(id), LIMIT_MS).then(
      (o) => { if (n !== ask.current) return; setPick(null); setReport(o); listY.current = window.scrollY; window.scrollTo(0, 0); },
      () => { if (n === ask.current) setPick({ id, failed: true }); },
    );
  };

  const closeReport = () => { ask.current++; setReport(null); requestAnimationFrame(() => window.scrollTo(0, listY.current)); };
  if (report) {
    return (
      <Correction
        key={report.observationId}
        api={api}
        report={report}
        onBack={closeReport}
        onSaved={() => { closeReport(); reload(); }}
      />
    );
  }

  const list = data && shown(data.teams, query, filter, userId);

  return (
    <div className="reports teams">
      <div className="teams-head">
        <h1>Teams</h1>
        {data && <button type="button" onClick={reload} disabled={busy}>{busy ? "Refreshing…" : "Refresh"}</button>}
      </div>
      {!data ? (
        busy ? <p>Loading…</p> : <p>Couldn't load teams. {retry}</p>
      ) : (
        <>
          {failed && <p className="save-note error" role="alert">Couldn't refresh. Showing the last figures. {retry}</p>}
          <section className="card">
            <h2>Scouting status</h2>
            <dl className="tiles">
              <div><dt>teams</dt><dd>{data.teams.length}</dd></div>
              <div><dt>need scouting</dt><dd>{data.needScouting}</dd></div>
              <div><dt>matches covered</dt><dd>{data.coverage.slots ? `${data.coverage.have}/${data.coverage.slots}` : "–"}</dd></div>
              <div><dt>waiting to save</dt><dd>{waiting}</dd></div>
            </dl>
            <p className="caption">{noteLine(event?.eventName || event?.eventCode || "", data.coverage.playedBy)}</p>
          </section>
          <section className="card">
            <h2>Teams</h2>
            <input type="search" aria-label="Search teams" placeholder="Number or name" value={query} onChange={(e) => setQuery(e.target.value)} />
            <div className="filters">
              {FILTERS.map(([f, text]) => (
                <button key={f} type="button" aria-pressed={filter === f} onClick={() => setFilter(f)}>{text}</button>
              ))}
            </div>
            {list?.length ? (
              <div className="team-list">
                {list.map((t) => (
                  <TeamRow
                    key={t.teamNumber}
                    team={t}
                    open={open.has(t.teamNumber)}
                    onToggle={(o) => toggle(t.teamNumber, o)}
                    opening={pick && !pick.failed ? pick.id : null}
                    failed={pick?.failed ? pick.id : null}
                    onReport={openReport}
                  />
                ))}
              </div>
            ) : (
              <p>{data.teams.length ? "No teams match." : "No teams yet for this event."}</p>
            )}
          </section>
          <section className="card">
            <h2>Scouts</h2>
            {data.scouts.length ? (
              <ul className="scouts">{data.scouts.map((s) => <li key={s.scoutUserId}>{scoutLine(s, userId)}</li>)}</ul>
            ) : (
              <p>No reports yet for this event.</p>
            )}
          </section>
        </>
      )}
    </div>
  );
}
