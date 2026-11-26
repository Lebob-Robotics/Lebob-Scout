import { useState } from "react";
import type { EventRow } from "../../api";
import { Dropdown } from "../../components/Dropdown";
import { useTheme, type ThemeChoice } from "../../theme";
import { Card } from "../parts";
import { REFRESH_CHOICES, parseTeam, type Settings } from "../settings";
import type { Load } from "../useLoad";

// A row of buttons, one pressed: the scout app's Settings style.
// `quiet` leaves out the visible label when the card's title already says it.
function Seg<T extends string | number>({ label, value, options, onChange, quiet = false }: {
  label: string; value: T; options: [T, string][]; onChange(v: T): void; quiet?: boolean;
}) {
  return (
    <>
      {!quiet && <span className="label">{label}</span>}
      <div className="seg" role="group" aria-label={label}>
        {options.map(([v, name]) => <button key={String(v)} type="button" aria-pressed={value === v} onClick={() => onChange(v)}>{name}</button>)}
      </div>
    </>
  );
}

const THEMES: [ThemeChoice, string][] = [["auto", "Auto"], ["light", "Light"], ["dark", "Dark"]];

// Settings for this device: the event, our team, how maps and autos are drawn, the theme, and refreshing.
export function SettingsScreen({ events, retryEvents, event, onEvent, settings, onChange, onRefresh }: {
  events: Load<EventRow[]>; retryEvents(): void; event: EventRow | null; onEvent(eventUuid: string): void;
  settings: Settings; onChange(patch: Partial<Settings>): void; onRefresh(): void;
}) {
  const [theme, setTheme] = useTheme();
  const [teamText, setTeamText] = useState(String(settings.ourTeam));
  const typed = parseTeam(teamText);
  const [asked, setAsked] = useState(false);

  return (
    <div className="strategy-screen">
      <div className="cols">
        <div className="col">
          <Card title="Event">
            {events.state === "loading" ? <p>Loading…</p>
              : events.state === "failed" ? <p>Couldn't load the event list. <button type="button" onClick={retryEvents}>Retry</button></p>
              : !events.data.length ? <p>No events yet.</p>
              : (
                <div className="event-pick">
                  <span className="label">Event</span>
                  <Dropdown label="Event" mono value={event?.eventUuid ?? ""} placeholder="Pick an event" onChange={onEvent}
                    items={events.data.map((e) => ({ value: e.eventUuid, label: e.eventName }))} />
                </div>
              )}
          </Card>

          <Card title="Our team">
            <label className="label" htmlFor="our-team">Team number</label>
            <div className="team-entry">
              <input id="our-team" type="text" inputMode="numeric" value={teamText} onChange={(e) => {
                setTeamText(e.target.value);
                const n = parseTeam(e.target.value);
                if (n) onChange({ ourTeam: n });
              }} />
            </div>
            {!typed && <p className="save-note error" role="alert">Type a whole team number.</p>}
            <p className="caption">Used for our next match, our partners and the "us" tag.</p>
          </Card>

          <Card title="Data">
            <Seg label="Refresh every" value={settings.refreshMinutes} onChange={(v) => onChange({ refreshMinutes: v })}
              options={REFRESH_CHOICES.map((m): [number, string] => [m, m ? `${m} min` : "Off"])} />
            <button type="button" onClick={() => { setAsked(true); onRefresh(); }}>Refresh now</button>
            {asked && <p className="caption" role="status">Asked for the latest figures. They show when they arrive.</p>}
          </Card>
        </div>

        <div className="col">
          <Card title="Display">
            <Seg label="Heatmaps" value={settings.heatStyle} onChange={(v) => onChange({ heatStyle: v })} options={[["squares", "Squares"], ["smooth", "Smooth"]]} />
            <Seg label="Autos and cycles" value={settings.autoStyle} onChange={(v) => onChange({ autoStyle: v })} options={[["averaged", "Averaged"], ["drawn", "As drawn"]]} />
            <Seg label="Team heatmap opens on" value={settings.measure} onChange={(v) => onChange({ measure: v })}
              options={[["auto", "Auto scored"], ["teleop", "Teleop scored"], ["pickedUp", "Picked up"]]} />
            <Seg label="Times" value={settings.clock} onChange={(v) => onChange({ clock: v })} options={[["event", "Event's clock"], ["device", "This device"]]} />
          </Card>

          <Card title="Theme">
            <Seg label="Theme" quiet value={theme} onChange={setTheme} options={THEMES} />
            <p className="caption">Auto follows this device's light or dark setting. The scout app uses the same choice.</p>
          </Card>
        </div>
      </div>
    </div>
  );
}
