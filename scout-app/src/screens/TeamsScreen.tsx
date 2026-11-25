import { useEffect, useState } from "react";
import type { Api, TeamsTab } from "../api";
import type { Target } from "../observation";
import { rememberedEvent } from "../schedule";
import { withTimeout } from "../sync";
import { noteLine, scoutLine } from "../teams";

const LIMIT_MS = 20_000;

// Loads on opening and whenever `refresh` changes; a reload keeps the last figures on screen.
// onScout opens set-up for a robot from the coverage grid (Task 9).
export function TeamsScreen({ api, eventUuid, userId, waiting, refresh = 0 }: {
  api: Api;
  eventUuid: string;
  userId: string;
  waiting: number;
  refresh?: number;
  onScout(target: Target): void;
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

  const { data } = last;
  const busy = last.load !== load;
  const failed = !busy && last.failed;

  const reload = () => setTries((t) => t + 1);
  const event = rememberedEvent();
  const retry = <button type="button" onClick={reload}>Retry</button>;

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
