import { useEffect, useRef, useState } from "react";
import type { EventRow, MatchRow, TeamProfile, TeamsTab } from "../api";
import mark from "../assets/strategy-mark.png";
import { firstEvent } from "../schedule";
import type { StrategyApi } from "./api";
import { keepShut, likely, matchLabels, orderForecasts, pointsFigure, scaleMax, sharesByTeam } from "./logic";
import type { Figure } from "./logic";
import { defaultSettings, keepSettings, readSettings, type Settings } from "./settings";
import { useLoad, type Load } from "./useLoad";
import { AllianceScreen } from "./screens/AllianceScreen";
import { EventScreen } from "./screens/EventScreen";
import { MatchScreen } from "./screens/MatchScreen";
import { MatchesScreen } from "./screens/MatchesScreen";
import { SettingsScreen } from "./screens/SettingsScreen";
import { TeamScreen } from "./screens/TeamScreen";
import type { Forecast, HistoryPoint, Pick, PointSplit, Projection, Rating, TeamCycles, TeamMap } from "./types";

export type Tab = "event" | "team" | "match" | "schedule" | "alliance" | "settings";
const TABS: [Tab, string][] = [["event", "Event"], ["team", "Team"], ["match", "Match"], ["schedule", "Schedule"], ["alliance", "Alliance"], ["settings", "Settings"]];

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
  api: StrategyApi; eventUuid: string; ourTeam: number; settings: Settings; model: Model; labels: Map<string, string>;
  scouting: Load<TeamsTab>; retryScouting(): void; profile(team: number): TeamProfile | undefined;
  maps: Load<TeamMap[]>; retryMaps(): void; splits: Load<PointSplit[]>; retrySplits(): void;
  // Cycles from our scouting (teamCycles), one entry per scouted team.
  cycles: Load<TeamCycles[]>; retryCycles(): void; teamCycles(team: number): TeamCycles | undefined;
  // Points per match (scouted, else the official share) and each bar column's track length.
  points(team: number): Figure | null; scale: { rating: number; points: number; cycles: number };
  // Times on the event's clock when the settings say so and the Teams tab knows its zone; else this device's.
  timeZone?: string;
  // Goes up on every refresh, so reads made by a screen (a match's maps) refresh too.
  tick: number;
  openTeam(team: number): void; openMatch(matchUuid: string): void; openBreakages(team: number): void;
  // Goes up each time a breakage button is pressed: the Team tab opens and shows its Breakages card.
  // takeBreakageAsk is true once per press, so coming back to the tab later does not scroll again.
  breakageAsk: number; takeBreakageAsk(): boolean;
};

function Header({ event }: { event?: string }) {
  return (
    <header className="header">
      <span className="brand"><img src={mark} alt="" width={30} height={30} />Strategy</span>
      {event && <span className="hdrmeta">{event}</span>}
    </header>
  );
}

// The browser tab shows the strategy mark while this app is open.
function useTabIcon() {
  useEffect(() => {
    const link = document.querySelector<HTMLLinkElement>('link[rel="icon"]');
    if (link) { link.type = "image/png"; link.href = mark; }
    document.title = "Lebob Strategy";
  }, []);
}

export default function StrategyApp({ api, ourTeam, signedOut = false, onSignIn }: {
  api: StrategyApi; ourTeam: number; signedOut?: boolean; onSignIn?: () => Promise<void>;
}) {
  useTabIcon();
  const [settings, setSettings] = useState(() => readSettings(defaultSettings(ourTeam)));
  const change = (patch: Partial<Settings>) => setSettings((s) => { const next = { ...s, ...patch }; keepSettings(next); return next; });
  const [tab, setTab] = useState<Tab>("event");
  const go = (t: Tab) => { setTab(t); window.scrollTo(0, 0); };
  // Refreshing: every few minutes when the settings say so, and on "Refresh now".
  const [tick, setTick] = useState(0);
  const refresh = () => setTick((t) => t + 1);
  useEffect(() => {
    if (!settings.refreshMinutes) return;
    const timer = setInterval(() => setTick((t) => t + 1), settings.refreshMinutes * 60_000);
    return () => clearInterval(timer);
  }, [settings.refreshMinutes]);

  const [events, retryEvents] = useLoad("events", () => api.ourEvents());
  const [picked, setPicked] = useState<EventRow | null>(null);
  const [signIn, setSignIn] = useState<"idle" | "working" | "failed">("idle");
  const list = events.state === "ok" ? events.data : [];
  const event = picked ?? (list.length ? firstEvent(list, rememberedEvent(), localToday()) : null);
  const pickEvent = (id: string) => {
    const next = list.find((x) => x.eventUuid === id);
    if (next) { remember(next); setPicked(next); }
  };

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
        <nav className="tabs" aria-label="Screens">
          {TABS.map(([t, label]) => <button key={t} type="button" aria-current={tab === t ? "page" : undefined} onClick={() => go(t)}>{label}</button>)}
        </nav>
        {tab === "settings" && (
          <SettingsScreen events={events} retryEvents={retryEvents} event={event} onEvent={pickEvent} settings={settings} onChange={change} onRefresh={refresh} />
        )}
        {tab !== "settings" && (events.state === "loading" ? <p>Loading…</p>
          : events.state === "failed" ? <p>Couldn't load the event list. <button type="button" onClick={retryEvents}>Retry</button></p>
          : !event ? <p>No events yet.</p> : null)}
        {/* Kept while Settings is open, so the team and match picked and the figures stay as they were. */}
        {event && <EventView key={event.eventUuid} api={api} eventUuid={event.eventUuid} tab={tab} go={go} tick={tick} settings={settings} />}
      </div>
      <footer className="foot-brand foot-wide">Lebob Strategy · FTC team 29550</footer>
    </>
  );
}

function EventView({ api, eventUuid, tab, go, tick, settings }: {
  api: StrategyApi; eventUuid: string; tab: Tab; go(t: Tab): void; tick: number; settings: Settings;
}) {
  const [team, setTeam] = useState<number | null>(null);
  const [matchUuid, setMatchUuid] = useState<string | null>(null);
  const [breakageAsk, setBreakageAsk] = useState(0);
  const handledAsk = useRef(0);
  const [model, retryModel] = useLoad(eventUuid, async (): Promise<Model> => {
    const [ratings, history, forecasts, projections, picks, matches] = await Promise.all([
      api.ratings(eventUuid), api.history(eventUuid), api.forecasts(eventUuid), api.projections(eventUuid), api.picks(eventUuid), api.matches(eventUuid),
    ]);
    return { ratings, history, forecasts: orderForecasts(forecasts), projections, picks, matches };
  }, tick);
  const [scouting, retryScouting] = useLoad(eventUuid, () => api.teamsTab(eventUuid), tick);
  const [maps, retryMaps] = useLoad(eventUuid, () => api.fieldMaps(eventUuid), tick);
  const [splits, retrySplits] = useLoad(eventUuid, () => api.pointSplits(eventUuid), tick);
  const [cycles, retryCycles] = useLoad(eventUuid, () => api.teamCycles(eventUuid), tick);

  if (tab === "settings") return null;
  if (model.state !== "ok") {
    return model.state === "loading" ? <p>Loading…</p> : <p>Couldn't load the match model's figures. <button type="button" onClick={retryModel}>Retry</button></p>;
  }
  const m = model.data;
  if (!m.ratings.length && !m.forecasts.length) return <p>No ratings or forecasts yet for this event.</p>;

  const ourTeam = settings.ourTeam;
  const profiles = new Map(scouting.state === "ok" ? scouting.data.teams.map((t) => [t.teamNumber, t]) : []);
  const shares = splits.state === "ok" ? sharesByTeam(splits.data) : new Map<number, number[]>();
  const points = (n: number) => pointsFigure(profiles.get(n), shares.get(n) ?? []);
  const byTeam = new Map(cycles.state === "ok" ? cycles.data.map((c) => [c.teamNumber, c]) : []);
  const ctx: Ctx = {
    api, eventUuid, ourTeam, settings, model: m, labels: matchLabels(m.forecasts),
    scouting, retryScouting, profile: (n) => profiles.get(n), maps, retryMaps, splits, retrySplits,
    cycles, retryCycles, teamCycles: (n) => byTeam.get(n),
    points,
    scale: {
      rating: scaleMax(m.ratings.map((r) => likely(r.opr, r.oprSe)?.high ?? r.opr)),
      points: scaleMax(m.ratings.map((r) => points(r.teamNumber)?.high ?? 0)),
      cycles: scaleMax([...byTeam.values()].map((c) => c.cyclesHigh ?? c.cyclesPerMatch)),
    },
    timeZone: settings.clock === "event" && scouting.state === "ok" ? scouting.data.timeZone : undefined,
    tick,
    openTeam: (n) => { setTeam(n); go("team"); },
    openMatch: (u) => { setMatchUuid(u); go("match"); },
    openBreakages: (n) => { keepShut("Breakages", false); setTeam(n); go("team"); setBreakageAsk((a) => a + 1); },
    breakageAsk,
    takeBreakageAsk: () => {
      if (breakageAsk <= handledAsk.current) return false;
      handledAsk.current = breakageAsk;
      return true;
    },
  };
  const teams = m.ratings.map((r) => r.teamNumber);
  const shownTeam = team ?? (teams.includes(ourTeam) ? ourTeam : [...teams].sort((a, b) => a - b)[0] ?? null);

  return (
    <>
      {tab === "event" && <EventScreen ctx={ctx} />}
      {tab === "team" && (shownTeam == null ? <p>No teams yet for this event.</p> : <TeamScreen ctx={ctx} team={shownTeam} onTeam={setTeam} />)}
      {tab === "match" && <MatchScreen ctx={ctx} matchUuid={matchUuid} onMatch={setMatchUuid} />}
      {tab === "schedule" && <MatchesScreen ctx={ctx} />}
      {tab === "alliance" && <AllianceScreen ctx={ctx} />}
    </>
  );
}
