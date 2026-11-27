import { useEffect, useState } from "react";
import type { Api, EventRow } from "../../shared/api";
import { Dropdown } from "../../shared/components/Dropdown";
import { StartPad } from "../components/StartPad";
import { CURRENT_FIELD_KEY, FIELDS } from "../../shared/field";
import type { Target } from "../../shared/observation";
import { rememberFlip, rememberedFlip } from "../../shared/prefs";
import { startSquareFor } from "../../shared/startWall";
import { firstEvent, onEvent, remember, rememberedEvent, withEvent } from "../../shared/schedule";
import { READ_LIMIT_MS, withTimeout } from "../../shared/sync";
import { MatchRobotPicker } from "./MatchRobotPicker";

const field = FIELDS[CURRENT_FIELD_KEY];
const localToday = () => new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 10);
// initial: the event, match and robot already picked, as if by hand (from the Teams tab's coverage grid).
export function SetupScreen({ api, initial, onStart }: {
  api: Api;
  initial?: Target;
  onStart(target: Target, startSquare: string, flipped: boolean, startWallPos: number): void;
}) {
  const [events, setEvents] = useState<EventRow[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [tries, setTries] = useState(0);
  const [eventUuid, setEventUuid] = useState<string | null>(null);
  const [target, setTarget] = useState<Target | null>(initial ?? null);
  const initialEvent = initial?.eventUuid;
  // The picker has its match and robots on screen: only then is the end of the page where the pad will stay.
  const [shown, setShown] = useState(false);
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
        const first = es.find((e) => e.eventUuid === initialEvent) ?? firstEvent(es, rememberedEvent(), localToday());
        if (first) remember(first); // the remembered event follows the calendar, so a later offline start uses it
        setEvents(es);
        setEventUuid(first?.eventUuid ?? null);
        setTarget((t) => onEvent(t, first?.eventUuid)); // a robot picked under another event never carries over its ids
        setFailed(false);
        setRetrying(false);
      },
      () => { if (live) { setFailed(true); setRetrying(false); setTarget((t) => onEvent(t, offlineEvent?.eventUuid)); } },
    );
    return () => { live = false; };
  }, [api, tries, initialEvent, offlineEvent]);

  // Once per robot picked, and once the picker is on screen (a robot picked before set-up opens waits for it), scroll to the end so the whole pad, its caption and the sticky Start are in view and clear
  // of each other (the pad takes every touch, so a swipe on it cannot scroll). Not on dragging, flipping or typing:
  // a hand-typed robot keeps one key while it is edited, and the scroll waits until the focus leaves the number boxes.
  const robotKey = target && (target.presenceUuid ?? "typed");
  useEffect(() => {
    if (!robotKey || !shown) return;
    const scroll = () => {
      const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
      window.scrollTo({ top: document.documentElement.scrollHeight, behavior: reduce ? "auto" : "smooth" });
    };
    if (!(document.activeElement instanceof HTMLInputElement)) return scroll();
    // Owed: once, when the focus leaves for anything but another box. A new or cleared robot drops it.
    const leave = (e: FocusEvent) => {
      if (e.relatedTarget instanceof HTMLInputElement) return;
      document.removeEventListener("focusout", leave);
      scroll();
    };
    document.addEventListener("focusout", leave);
    return () => document.removeEventListener("focusout", leave);
  }, [robotKey, shown]);

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
    rememberFlip(!flipped);
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
      <div className="card">
        <h2>Match setup</h2>
        {offline ? (
          <>
            {retry}
            <span className="label">Event</span>
            <p>{event.eventName}</p>
          </>
        ) : (
          <>
            <label htmlFor="event">Event</label>
            <Dropdown id="event" label="Event" value={event.eventUuid} onChange={chooseEvent}
              items={events!.map((e) => ({ value: e.eventUuid, label: e.eventName }))} />
          </>
        )}

        <MatchRobotPicker key={event.eventUuid} api={api} eventUuid={event.eventUuid} value={target} onChange={setTarget} startTyped={offline} onShown={() => setShown(true)} />

        <span className="label">Start position</span>
        <StartPad fieldKey={field.key} flipped={flipped} alliance={target?.alliance ?? null} value={wallPos} onChange={setWallPos} onFlip={flip} />

        <button type="button" className="start" disabled={!target || !square} onClick={start}>Start match timer</button>
      </div>
    </div>
  );
}
