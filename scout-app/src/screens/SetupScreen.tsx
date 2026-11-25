import { useEffect, useState } from "react";
import type { Api, EventRow } from "../api";
import { FieldPicture } from "../components/FieldPicture";
import { Grid } from "../components/Grid";
import { CURRENT_FIELD_KEY, FIELDS } from "../field";
import type { Target } from "../observation";
import { firstEvent } from "../schedule";
import { MatchRobotPicker } from "./MatchRobotPicker";

const EVENT_KEY = "lsa:event";
const field = FIELDS[CURRENT_FIELD_KEY];
const localToday = () => new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 10);

// The last event used, kept whole so set-up still works when the schedule won't load.
function rememberedEvent(): EventRow | null {
  try {
    const e = JSON.parse(localStorage.getItem(EVENT_KEY) ?? "null");
    return e && typeof e.eventUuid === "string" ? e : null;
  } catch {
    return null; // storage blocked or not JSON
  }
}
const remember = (e: EventRow) => {
  try { localStorage.setItem(EVENT_KEY, JSON.stringify(e)); } catch { /* not remembered; still usable */ }
};

export function SetupScreen({ api, onStart }: { api: Api; onStart(target: Target, startSquare: string, flipped: boolean): void }) {
  const [events, setEvents] = useState<EventRow[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [tries, setTries] = useState(0);
  const [eventUuid, setEventUuid] = useState<string | null>(null);
  const [target, setTarget] = useState<Target | null>(null);
  const [square, setSquare] = useState<string | null>(null);
  const [flipped, setFlipped] = useState(false);
  const [retrying, setRetrying] = useState(false);
  const [offlineEvent] = useState(rememberedEvent);

  useEffect(() => {
    let live = true;
    api.ourEvents().then(
      (es) => {
        if (!live) return;
        setEvents(es);
        setEventUuid(firstEvent(es, rememberedEvent(), localToday())?.eventUuid ?? null);
        setFailed(false);
        setRetrying(false);
      },
      () => { if (live) { setFailed(true); setRetrying(false); } },
    );
    return () => { live = false; };
  }, [api, tries]);

  // Offline: the schedule failed but the phone remembers the event, so the scout types the match in.
  const offline = failed && offlineEvent !== null;
  const event = offline ? offlineEvent : events?.find((e) => e.eventUuid === eventUuid);

  const chooseEvent = (id: string) => {
    setEventUuid(id);
    setTarget(null);
    const e = events?.find((x) => x.eventUuid === id);
    if (e) remember(e);
  };

  // Never waits: the clock starts on the tap.
  const start = () => {
    if (!target || !square) return;
    if (event) remember(event);
    onStart(target, square, flipped);
  };

  const retry = (
    <p>
      Couldn't load the schedule.{" "}
      <button type="button" className="retry" disabled={retrying} onClick={() => { setRetrying(true); setTries((t) => t + 1); }}>
        {retrying ? "Retrying…" : "Retry"}
      </button>
    </p>
  );
  if (failed && !offline) return <div className="setup">{retry}</div>;
  if (!failed && !events) return <div className="setup"><p>Loading…</p></div>;
  if (!event) return <div className="setup"><p>No events are listed for our team, so there is nothing to scout yet.</p></div>;

  return (
    <div className="setup">
      {offline ? (
        <>
          {retry}
          <span className="label">Event</span>
          <p>{event.eventName}</p>
        </>
      ) : (
        <>
          <label htmlFor="event">Event</label>
          <select id="event" value={event.eventUuid} onChange={(e) => chooseEvent(e.target.value)}>
            {events!.map((e) => <option key={e.eventUuid} value={e.eventUuid}>{e.eventName}</option>)}
          </select>
        </>
      )}

      <MatchRobotPicker key={event.eventUuid} api={api} eventUuid={event.eventUuid} value={target} onChange={setTarget} startTyped={offline} />

      <div className="square-bar">
        <span className="label">Start square: {square ?? "tap where the robot starts"}</span>
        <button type="button" onClick={() => setFlipped(!flipped)}>Flip field</button>
      </div>
      <div className="field-space">
        <div className="field">
          <FieldPicture fieldKey={field.key} flipped={flipped} />
          <Grid field={field} flipped={flipped} selected={square} onPick={setSquare} />
        </div>
      </div>

      <button type="button" className="start" disabled={!target || !square} onClick={start}>Start</button>
    </div>
  );
}
