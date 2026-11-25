import { useEffect, useState } from "react";
import type { Api, EventRow } from "../api";
import { FieldPicture } from "../components/FieldPicture";
import { Grid } from "../components/Grid";
import { CURRENT_FIELD_KEY, FIELDS } from "../field";
import type { Target } from "../observation";
import { pickEvent } from "../schedule";
import { MatchRobotPicker } from "./MatchRobotPicker";

const EVENT_KEY = "lsa:event";
const field = FIELDS[CURRENT_FIELD_KEY];
const localToday = () => new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 10);

function firstEvent(events: EventRow[]): string | null {
  let remembered: string | null = null;
  try { remembered = localStorage.getItem(EVENT_KEY); } catch { /* storage blocked: fall back to the schedule */ }
  if (events.some((e) => e.eventUuid === remembered)) return remembered;
  return pickEvent(events, localToday())?.eventUuid ?? null;
}

export function SetupScreen({ api, onStart }: { api: Api; onStart(target: Target, startSquare: string, flipped: boolean): void }) {
  const [events, setEvents] = useState<EventRow[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [tries, setTries] = useState(0);
  const [eventUuid, setEventUuid] = useState<string | null>(null);
  const [target, setTarget] = useState<Target | null>(null);
  const [square, setSquare] = useState<string | null>(null);
  const [flipped, setFlipped] = useState(false);
  const [starting, setStarting] = useState(false);

  useEffect(() => {
    let live = true;
    api.ourEvents().then(
      (es) => { if (live) { setEvents(es); setEventUuid(firstEvent(es)); } },
      () => live && setFailed(true),
    );
    return () => { live = false; };
  }, [api, tries]);

  const chooseEvent = (id: string) => {
    setEventUuid(id);
    setTarget(null);
    try { localStorage.setItem(EVENT_KEY, id); } catch { /* not remembered; still usable */ }
  };

  const start = async () => {
    if (!target || !square) return;
    setStarting(true);
    // A hand-typed team may still be known to Foundry. If the lookup fails, start without the link.
    const teamUuid = target.matchUuid ? target.teamUuid : await api.findTeamUuid(target.teamNumber).catch(() => null);
    onStart({ ...target, teamUuid }, square, flipped);
  };

  if (failed) {
    return (
      <div className="setup">
        <p>Couldn't load the schedule.</p>
        <button type="button" onClick={() => { setFailed(false); setTries((t) => t + 1); }}>Retry</button>
      </div>
    );
  }
  if (!events) return <div className="setup"><p>Loading…</p></div>;
  if (!eventUuid) return <div className="setup"><p>No events are listed for our team, so there is nothing to scout yet.</p></div>;

  return (
    <div className="setup">
      <label htmlFor="event">Event</label>
      <select id="event" value={eventUuid} onChange={(e) => chooseEvent(e.target.value)}>
        {events.map((e) => <option key={e.eventUuid} value={e.eventUuid}>{e.eventName}</option>)}
      </select>

      <MatchRobotPicker key={eventUuid} api={api} eventUuid={eventUuid} value={target} onChange={setTarget} />

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

      <button type="button" className="start" disabled={!target || !square || starting} onClick={start}>Start</button>
    </div>
  );
}
