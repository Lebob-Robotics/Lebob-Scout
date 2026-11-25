import { useEffect, useState } from "react";
import type { Api, EventRow } from "../api";
import { StartPad } from "../components/StartPad";
import { CURRENT_FIELD_KEY, FIELDS } from "../field";
import type { Target } from "../observation";
import { startSquareFor } from "../startWall";
import { firstEvent, remember, rememberedEvent, withEvent } from "../schedule";
import { READ_LIMIT_MS, withTimeout } from "../sync";
import { MatchRobotPicker } from "./MatchRobotPicker";

const field = FIELDS[CURRENT_FIELD_KEY];
const localToday = () => new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 10);
const FLIP_KEY = "lsa:flip";
const rememberedFlip = () => {
  try { return localStorage.getItem(FLIP_KEY) === "1"; } catch { return false; }
};

export function SetupScreen({ api, onStart }: { api: Api; onStart(target: Target, startSquare: string, flipped: boolean, startWallPos: number): void }) {
  const [events, setEvents] = useState<EventRow[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [tries, setTries] = useState(0);
  const [eventUuid, setEventUuid] = useState<string | null>(null);
  const [target, setTarget] = useState<Target | null>(null);
  // Kept when the robot or match changes: a robot on the other alliance gets the same spot on its own wall.
  const [wallPos, setWallPos] = useState<number | null>(null);
  const [flipped, setFlipped] = useState(rememberedFlip);
  const [retrying, setRetrying] = useState(false);
  const [offlineEvent] = useState(rememberedEvent);

  useEffect(() => {
    let live = true;
    withTimeout(api.ourEvents(), READ_LIMIT_MS).then(
      (es) => {
        if (!live) return;
        const first = firstEvent(es, rememberedEvent(), localToday());
        if (first) remember(first); // the remembered event follows the calendar, so a later offline start uses it
        setEvents(es);
        setEventUuid(first?.eventUuid ?? null);
        setFailed(false);
        setRetrying(false);
      },
      () => { if (live) { setFailed(true); setRetrying(false); } },
    );
    return () => { live = false; };
  }, [api, tries]);

  // Once per robot picked, scroll to the end so the whole pad, its caption and the sticky Start are in view and clear
  // of each other (the pad takes every touch, so a swipe on it cannot scroll). Not on dragging, flipping or typing:
  // a hand-typed robot keeps one key while it is edited, and nothing scrolls while a number box has the focus.
  const robotKey = target && (target.presenceUuid ?? "typed");
  useEffect(() => {
    if (!robotKey || document.activeElement instanceof HTMLInputElement) return;
    const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
    window.scrollTo({ top: document.documentElement.scrollHeight, behavior: reduce ? "auto" : "smooth" });
  }, [robotKey]);

  // Offline: the schedule failed but the phone remembers the event, so the scout types the match in.
  const offline = failed && offlineEvent !== null;
  const event = offline ? offlineEvent : events?.find((e) => e.eventUuid === eventUuid);

  const chooseEvent = (id: string) => {
    setEventUuid(id);
    setTarget(null);
    const e = events?.find((x) => x.eventUuid === id);
    if (e) remember(e);
  };

  const square = target && wallPos !== null ? startSquareFor(wallPos, target.alliance, field) : null;

  // Never waits: the clock starts on the tap.
  const start = () => {
    if (!target || !square || wallPos === null || !event) return;
    remember(event);
    onStart(withEvent(target, event), square, flipped, wallPos);
  };
  const flip = () => {
    setFlipped(!flipped);
    try { localStorage.setItem(FLIP_KEY, flipped ? "0" : "1"); } catch { /* not remembered */ }
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
        {/* With no robot the pad says "Pick the robot first."; one instruction at a time. */}
        <span className="label">{target && `Start: ${square ?? "tap along your wall"}`}</span>
        <button type="button" onClick={flip}>Flip field</button>
      </div>
      <StartPad fieldKey={field.key} flipped={flipped} alliance={target?.alliance ?? null} value={wallPos} onChange={setWallPos} />

      <button type="button" className="start" disabled={!target || !square} onClick={start}>Start</button>
    </div>
  );
}
