import { useEffect, useRef, useState } from "react";
import type { Api, TeamsTab } from "../api";
import { CoverageGrid } from "../components/CoverageGrid";
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
// The search, filter, open rows and the gaps switch live here, so a refresh or a correction leaves them as they were.
// onScout opens set-up for a robot tapped in the coverage grid.
// hidden: kept by App, out of sight, while a match started from the grid runs; it renders nothing but keeps its state.
// onPit and onBreakage open those forms for a team.
export function TeamsScreen({ api, eventUuid, userId, waiting, refresh = 0, hidden = false, onScout, onPit, onBreakage, onCorrecting }: {
  api: Api;
  eventUuid: string;
  userId: string;
  waiting: number;
  refresh?: number;
  hidden?: boolean;
  onScout(target: Target): void;
  onPit(teamNumber: number): void;
  onBreakage(teamNumber: number): void;
  onCorrecting(open: boolean): void;
}) {
  const [tries, setTries] = useState(0);
  // Which load the figures answer: busy until the current one does.
  const load = `${eventUuid}|${refresh}|${tries}`;
  // `at`: when the figures arrived, the "today" their times are read against.
  const [last, setLast] = useState<{ load: string; data: TeamsTab | null; at: number; failed: boolean }>({ load: "", data: null, at: 0, failed: false });

  useEffect(() => {
    let live = true;
    withTimeout(api.teamsTab(eventUuid), LIMIT_MS).then(
      (data) => { if (live) setLast({ load, data, at: Date.now(), failed: false }); },
      () => { if (live) setLast((l) => ({ ...l, load, failed: true })); },
    );
    return () => { live = false; };
  }, [api, eventUuid, load]);

  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [open, setOpen] = useState<ReadonlySet<number>>(new Set());
  const [gapsOnly, setGapsOnly] = useState(false);
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
  // Leaving for set-up drops any report line still opening, so a late answer cannot act while hidden.
  const scout = (t: Target) => { ask.current++; setPick(null); onScout(t); };
  if (hidden) return null;
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
          {failed && <p className="save-note error" role="alert">Couldn't refresh. Showing the last figures.</p>}
          <section className="card">
            <h2>Scouting status</h2>
            <dl className="tiles">
              <div><dt>teams</dt><dd>{data.teams.length}</dd></div>
              <div><dt>need scouting</dt><dd>{data.needScouting}</dd></div>
              <div><dt>matches covered</dt><dd>{data.coverage.slots ? `${data.coverage.have}/${data.coverage.slots}` : "–"}</dd></div>
              <div><dt>waiting to save</dt><dd>{waiting}</dd></div>
            </dl>
            <p className="caption">{noteLine(event?.eventName || event?.eventCode || "", data.coverage.playedBy, data.timeZone)}</p>
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
                    now={last.at}
                    timeZone={data.timeZone}
                    open={open.has(t.teamNumber)}
                    onToggle={(o) => toggle(t.teamNumber, o)}
                    opening={pick && !pick.failed ? pick.id : null}
                    failed={pick?.failed ? pick.id : null}
                    onReport={openReport}
                    onPit={() => onPit(t.teamNumber)}
                    onBreakage={() => onBreakage(t.teamNumber)}
                  />
                ))}
              </div>
            ) : (
              <p>{data.teams.length ? "No teams match." : "No teams yet for this event."}</p>
            )}
          </section>
          <section className="card">
            <h2>Match coverage</h2>
            <CoverageGrid coverage={data.coverage} eventUuid={eventUuid} gapsOnly={gapsOnly} onGapsOnly={setGapsOnly} onScout={scout} />
          </section>
          <section className="card">
            <h2>Scouts</h2>
            {data.scouts.length ? (
              <ul className="scouts">{data.scouts.map((s) => <li key={s.scoutUserId}>{scoutLine(s, userId, last.at, data.timeZone)}</li>)}</ul>
            ) : (
              <p>No reports yet for this event.</p>
            )}
          </section>
        </>
      )}
    </div>
  );
}
