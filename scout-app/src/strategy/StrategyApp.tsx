import { useState } from "react";
import type { EventRow, MatchRow, TeamProfile, TeamsTab } from "../api";
import mark from "../assets/lebob-mark.svg";
import { firstEvent } from "../schedule";
import type { StrategyApi } from "./api";
import { matchLabels, orderForecasts } from "./logic";
import { useLoad, type Load } from "./useLoad";
import { AllianceScreen } from "./screens/AllianceScreen";
import { EventScreen } from "./screens/EventScreen";
import { MatchScreen } from "./screens/MatchScreen";
import { MatchesScreen } from "./screens/MatchesScreen";
import { TeamScreen } from "./screens/TeamScreen";
import type { Forecast, HistoryPoint, Pick, PointSplit, Projection, Rating, TeamMap } from "./types";

type Tab = "event" | "team" | "match" | "matches" | "alliance";
const TABS: [Tab, string][] = [["event", "Event"], ["team", "Team"], ["match", "Match"], ["matches", "Matches"], ["alliance", "Alliance"]];

// The strategy app keeps its own event, so picking one on a laptop never changes what a scout's phone shows.
const EVENT_KEY = "lsa:strategy-event";
const rememberedEvent = (): EventRow | null => {
  try {
    const e = JSON.parse(localStorage.getItem(EVENT_KEY) ?? "null");
    return e && typeof e.eventUuid === "string" ? e : null;
  } catch {
    return null;
  }
};
const remember = (e: EventRow) => { try { localStorage.setItem(EVENT_KEY, JSON.stringify(e)); } catch { /* this page load only */ } };
const localToday = () => new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 10);

// The match model's figures for the event, read together: the screens need them all.
export type Model = { ratings: Rating[]; history: HistoryPoint[]; forecasts: Forecast[]; projections: Projection[]; picks: Pick[]; matches: MatchRow[] };

// What every screen gets: the model (always loaded), and the scouting figures, maps and splits, each of which may
// still be loading or have failed without stopping the rest.
export type Ctx = {
  api: StrategyApi; eventUuid: string; ourTeam: number; model: Model; labels: Map<string, string>;
  scouting: Load<TeamsTab>; retryScouting(): void; profile(team: number): TeamProfile | undefined;
  maps: Load<TeamMap[]>; retryMaps(): void; splits: Load<PointSplit[]>; retrySplits(): void;
  openTeam(team: number): void; openMatch(matchUuid: string): void;
};

function Header({ event }: { event?: string }) {
  return (
    <header className="header">
      <span className="brand"><img src={mark} alt="" width={30} height={30} />Strategy</span>
      {event && <span className="hdrmeta">{event}</span>}
      <a className="hdrlink" href="/">Scout app</a>
    </header>
  );
}

export default function StrategyApp({ api, ourTeam, signedOut = false, onSignIn }: {
  api: StrategyApi; ourTeam: number; signedOut?: boolean; onSignIn?: () => Promise<void>;
}) {
  const [events, retryEvents] = useLoad("events", () => api.ourEvents());
  const [picked, setPicked] = useState<EventRow | null>(null);
  const [signIn, setSignIn] = useState<"idle" | "working" | "failed">("idle");
  const list = events.state === "ok" ? events.data : [];
  const event = picked ?? (list.length ? firstEvent(list, rememberedEvent(), localToday()) : null);

  const tapSignIn = () => {
    setSignIn("working");
    onSignIn?.().then(() => setSignIn("idle"), () => setSignIn("failed"));
  };

  return (
    <>
      <Header event={event?.eventCode} />
      <div className="strategy">
        {signedOut && (
          <div className="banner signed-out">
            <p>You're signed out. Sign in to see this event's figures.</p>
            <button type="button" onClick={tapSignIn} disabled={signIn === "working"}>{signIn === "working" ? "Signing in…" : "Sign in"}</button>
            {signIn === "failed" && <p className="save-note error" role="alert">Couldn't reach Foundry. Check your signal and try again.</p>}
          </div>
        )}
        {events.state === "loading" ? <p>Loading…</p>
          : events.state === "failed" ? <p>Couldn't load the event list. <button type="button" onClick={retryEvents}>Retry</button></p>
          : !event ? <p>No events yet.</p>
          : (
            <>
              <label className="event-pick">
                <span className="label">Event</span>
                <select value={event.eventUuid} onChange={(e) => {
                  const next = list.find((x) => x.eventUuid === e.target.value);
                  if (next) { remember(next); setPicked(next); }
                }}>
                  {list.map((e) => <option key={e.eventUuid} value={e.eventUuid}>{e.eventName}</option>)}
                </select>
              </label>
              <EventView key={event.eventUuid} api={api} eventUuid={event.eventUuid} ourTeam={ourTeam} />
            </>
          )}
      </div>
      <footer className="foot-brand">Lebob Strategy · FTC team 29550</footer>
    </>
  );
}

function EventView({ api, eventUuid, ourTeam }: { api: StrategyApi; eventUuid: string; ourTeam: number }) {
  const [tab, setTab] = useState<Tab>("event");
  const [team, setTeam] = useState<number | null>(null);
  const [matchUuid, setMatchUuid] = useState<string | null>(null);
  const [model, retryModel] = useLoad(eventUuid, async (): Promise<Model> => {
    const [ratings, history, forecasts, projections, picks, matches] = await Promise.all([
      api.ratings(eventUuid), api.history(eventUuid), api.forecasts(eventUuid), api.projections(eventUuid), api.picks(eventUuid), api.matches(eventUuid),
    ]);
    return { ratings, history, forecasts: orderForecasts(forecasts), projections, picks, matches };
  });
  const [scouting, retryScouting] = useLoad(eventUuid, () => api.teamsTab(eventUuid));
  const [maps, retryMaps] = useLoad(eventUuid, () => api.fieldMaps(eventUuid));
  const [splits, retrySplits] = useLoad(eventUuid, () => api.pointSplits(eventUuid));

  const go = (t: Tab) => { setTab(t); window.scrollTo(0, 0); };
  const tabs = (
    <nav className="tabs" aria-label="Screens">
      {TABS.map(([t, label]) => <button key={t} type="button" aria-current={tab === t ? "page" : undefined} onClick={() => go(t)}>{label}</button>)}
    </nav>
  );
  if (model.state !== "ok") {
    return <>{tabs}{model.state === "loading" ? <p>Loading…</p> : <p>Couldn't load the match model's figures. <button type="button" onClick={retryModel}>Retry</button></p>}</>;
  }
  if (!model.data.ratings.length && !model.data.forecasts.length) return <>{tabs}<p>No ratings or forecasts yet for this event.</p></>;

  const profiles = new Map(scouting.state === "ok" ? scouting.data.teams.map((t) => [t.teamNumber, t]) : []);
  const ctx: Ctx = {
    api, eventUuid, ourTeam, model: model.data, labels: matchLabels(model.data.forecasts),
    scouting, retryScouting, profile: (n) => profiles.get(n), maps, retryMaps, splits, retrySplits,
    openTeam: (n) => { setTeam(n); go("team"); },
    openMatch: (m) => { setMatchUuid(m); go("match"); },
  };
  const teams = model.data.ratings.map((r) => r.teamNumber);
  const shownTeam = team ?? (teams.includes(ourTeam) ? ourTeam : [...teams].sort((a, b) => a - b)[0] ?? null);

  return (
    <>
      {tabs}
      {tab === "event" && <EventScreen ctx={ctx} />}
      {tab === "team" && (shownTeam == null ? <p>No teams yet for this event.</p> : <TeamScreen ctx={ctx} team={shownTeam} onTeam={setTeam} />)}
      {tab === "match" && <MatchScreen ctx={ctx} matchUuid={matchUuid} onMatch={setMatchUuid} />}
      {tab === "matches" && <MatchesScreen ctx={ctx} />}
      {tab === "alliance" && <AllianceScreen ctx={ctx} />}
    </>
  );
}
