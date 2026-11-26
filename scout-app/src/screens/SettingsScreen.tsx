import { useEffect, useState } from "react";
import type { Api, EventRow } from "../api";
import { remember, rememberedEvent } from "../schedule";
import { READ_LIMIT_MS, withTimeout } from "../sync";
import { rememberFlip, rememberedFlip, setMotion as storeMotion } from "../prefs";


// The old site's Settings tab, for what still lives on the phone. The schedule, team names and the scout's name come from Foundry.
export function SettingsScreen({ api, userName, online, waiting, lastError, storeOk, onEventChange, onSendNow }: {
  api: Api;
  userName: string | null;
  online: boolean;
  waiting: number;
  lastError: string | null;
  storeOk: boolean;
  onEventChange(): void;
  onSendNow(): void;
}) {
  const [events, setEvents] = useState<EventRow[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [tries, setTries] = useState(0);
  const [current, setCurrent] = useState(rememberedEvent);
  const [flipped, setFlipped] = useState(rememberedFlip);
  const [motion, setMotion] = useState(() => document.documentElement.dataset.motion !== "off");

  useEffect(() => {
    let live = true;
    withTimeout(api.ourEvents(), READ_LIMIT_MS).then(
      (es) => { if (live) { setEvents(es); setFailed(false); } },
      () => { if (live) setFailed(true); },
    );
    return () => { live = false; };
  }, [api, tries]);

  const chooseEvent = (id: string) => {
    const e = events?.find((x) => x.eventUuid === id);
    if (!e) return;
    remember(e);
    setCurrent(e);
    onEventChange();
  };
  const chooseFlip = (f: boolean) => { rememberFlip(f); setFlipped(f); };
  const chooseMotion = (on: boolean) => {
    storeMotion(on);
    setMotion(on);
  };

  return (
    <div className="setup">
      <div className="card">
        <h2>Event</h2>
        {failed ? (
          <>
            <p>{current ? current.eventName : "No event picked yet."}</p>
            <p className="caption">
              Couldn't load the event list.{" "}
              <button type="button" className="retry" onClick={() => { setFailed(false); setTries((t) => t + 1); }}>Retry</button>
            </p>
          </>
        ) : !events ? (
          <p>Loading…</p>
        ) : (
          <>
            <label htmlFor="settings-event">Event this phone scouts</label>
            <select id="settings-event" value={current?.eventUuid ?? ""} onChange={(e) => chooseEvent(e.target.value)}>
              {!current && <option value="">Pick an event</option>}
              {events.map((e) => <option key={e.eventUuid} value={e.eventUuid}>{e.eventName}</option>)}
            </select>
            <p className="caption">Reports and Teams show this event. On a day an event is running, set-up picks that one.</p>
          </>
        )}
      </div>

      <div className="card">
        <h2>This phone</h2>
        <dl className="facts">
          <div><dt>Scout</dt><dd>{userName ?? "Not signed in yet"}</dd></div>
          <div><dt>Signal</dt><dd>{online ? "Online" : "No internet"}</dd></div>
          <div><dt>Waiting to send</dt><dd>{waiting === 1 ? "1 report" : `${waiting} reports`}</dd></div>
          <div><dt>Storage</dt><dd>{storeOk ? "Working: reports are kept if the page closes" : "Not working: keep this page open until reports send"}</dd></div>
        </dl>
        {lastError && waiting > 0 && <p className="caption">Last try: {lastError}</p>}
        <button type="button" disabled={!waiting} onClick={onSendNow}>Send waiting reports now</button>
        <p className="caption">Reports save on this phone first and send by themselves when there is signal.</p>
      </div>

      <div className="card">
        <h2>Display</h2>
        <span className="label">Field view at the start</span>
        <div className="seg">
          <button type="button" aria-pressed={!flipped} onClick={() => chooseFlip(false)}>Red on the left</button>
          <button type="button" aria-pressed={flipped} onClick={() => chooseFlip(true)}>Rotated</button>
        </div>
        <span className="label">Animations</span>
        <div className="seg">
          <button type="button" aria-pressed={motion} onClick={() => chooseMotion(true)}>On</button>
          <button type="button" aria-pressed={!motion} onClick={() => chooseMotion(false)}>Off</button>
        </div>
      </div>
    </div>
  );
}
