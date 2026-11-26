import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import type { EventRow, MatchRow, TeamProfile, TeamsTab } from "../api";
import mark from "../assets/strategy-mark.png";
import { Dropdown } from "../components/Dropdown";
import { firstEvent } from "../schedule";
import { nextChoice, useTheme, type ThemeChoice } from "../theme";
import type { StrategyApi } from "./api";
import { keepShut, likely, matchLabels, nextOurs, one, orderForecasts, pct, playedCount, pointsFigure, scaleMax, sharesByTeam, sideOf, whole, winChance } from "./logic";
import type { Figure } from "./logic";
import { useLoad, type Load } from "./useLoad";
import { AllianceScreen } from "./screens/AllianceScreen";
import { EventScreen } from "./screens/EventScreen";
import { MatchScreen } from "./screens/MatchScreen";
import { MatchesScreen } from "./screens/MatchesScreen";
import { TeamScreen } from "./screens/TeamScreen";
import type { Forecast, HistoryPoint, Pick, PointSplit, Projection, Rating, TeamMap } from "./types";

type Tab = "event" | "team" | "match" | "schedule" | "alliance";
const TABS: [Tab, string][] = [["event", "Event"], ["team", "Team"], ["match", "Match"], ["schedule", "Schedule"], ["alliance", "Alliance"]];

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
  // Points per match (scouted, else the official share) and each bar column's track length.
  points(team: number): Figure | null; scale: { rating: number; points: number };
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
      <ThemeButton />
    </header>
  );
}

// One button for the look: Auto (the device's setting), Light, Dark, and round again.
const THEME_NAMES: Record<ThemeChoice, string> = { auto: "Auto", light: "Light", dark: "Dark" };
function ThemeButton() {
  const [theme, setTheme] = useTheme();
  const next = nextChoice(theme);
  return (
    <button type="button" className="theme-btn" aria-label={`Theme: ${THEME_NAMES[theme]}. Change to ${THEME_NAMES[next]}`}
      title={`Theme: ${THEME_NAMES[theme]}`} onClick={() => setTheme(next)}>
      <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true">
        {theme === "auto" && <><circle cx="8" cy="8" r="6" fill="none" stroke="currentColor" strokeWidth="1.5" /><path d="M8 2a6 6 0 0 1 0 12Z" fill="currentColor" /></>}
        {theme === "light" && <><circle cx="8" cy="8" r="3" fill="currentColor" /><path d="M8 1v2M8 13v2M1 8h2M13 8h2M3 3l1.4 1.4M11.6 11.6 13 13M3 13l1.4-1.4M11.6 4.4 13 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /></>}
        {theme === "dark" && <path d="M10.5 2.2A6 6 0 1 0 13.8 10 4.8 4.8 0 0 1 10.5 2.2Z" fill="currentColor" />}
      </svg>
      <span>{THEME_NAMES[theme]}</span>
    </button>
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
            <EventView key={event.eventUuid} api={api} eventUuid={event.eventUuid} ourTeam={ourTeam} picker={(
              <div className="event-pick">
                <span className="label">Event</span>
                <Dropdown label="Event" mono value={event.eventUuid} items={list.map((e) => ({ value: e.eventUuid, label: e.eventName }))} onChange={(v) => {
                  const next = list.find((x) => x.eventUuid === v);
                  if (next) { remember(next); setPicked(next); }
                }} />
              </div>
            )} />
          )}
      </div>
      <footer className="foot-brand foot-wide">Lebob Strategy · FTC team 29550</footer>
    </>
  );
}

function EventView({ api, eventUuid, ourTeam, picker }: { api: StrategyApi; eventUuid: string; ourTeam: number; picker: ReactNode }) {
  const [tab, setTab] = useState<Tab>("event");
  const [team, setTeam] = useState<number | null>(null);
  const [matchUuid, setMatchUuid] = useState<string | null>(null);
  const [breakageAsk, setBreakageAsk] = useState(0);
  const handledAsk = useRef(0);
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
    return (
      <>
        <div className="topbar">{picker}</div>
        {tabs}
        {model.state === "loading" ? <p>Loading…</p> : <p>Couldn't load the match model's figures. <button type="button" onClick={retryModel}>Retry</button></p>}
      </>
    );
  }
  const m = model.data;
  if (!m.ratings.length && !m.forecasts.length) return <><div className="topbar">{picker}</div>{tabs}<p>No ratings or forecasts yet for this event.</p></>;

  const profiles = new Map(scouting.state === "ok" ? scouting.data.teams.map((t) => [t.teamNumber, t]) : []);
  const shares = splits.state === "ok" ? sharesByTeam(splits.data) : new Map<number, number[]>();
  const points = (n: number) => pointsFigure(profiles.get(n), shares.get(n) ?? []);
  const ctx: Ctx = {
    api, eventUuid, ourTeam, model: m, labels: matchLabels(m.forecasts),
    scouting, retryScouting, profile: (n) => profiles.get(n), maps, retryMaps, splits, retrySplits,
    points,
    scale: {
      rating: scaleMax(m.ratings.map((r) => likely(r.opr, r.oprSe)?.high ?? r.opr)),
      points: scaleMax(m.ratings.map((r) => points(r.teamNumber)?.high ?? 0)),
    },
    openTeam: (n) => { setTeam(n); go("team"); },
    openMatch: (u) => { setMatchUuid(u); go("match"); },
    openBreakages: (n) => { keepShut("Breakages", false); setTeam(n); setTab("team"); setBreakageAsk((a) => a + 1); },
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
      <div className="topbar">{picker}<Status ctx={ctx} /></div>
      {tabs}
      {tab === "event" && <EventScreen ctx={ctx} />}
      {tab === "team" && (shownTeam == null ? <p>No teams yet for this event.</p> : <TeamScreen ctx={ctx} team={shownTeam} onTeam={setTeam} />)}
      {tab === "match" && <MatchScreen ctx={ctx} matchUuid={matchUuid} onMatch={setMatchUuid} />}
      {tab === "schedule" && <MatchesScreen ctx={ctx} />}
      {tab === "alliance" && <AllianceScreen ctx={ctx} />}
    </>
  );
}

// Where the event stands for us, on every tab: matches played, our rank, our next match and its win chance.
function Status({ ctx }: { ctx: Ctx }) {
  const { model, ourTeam, labels } = ctx;
  const { played, total } = playedCount(model.forecasts, model.matches);
  const us = model.projections.find((p) => p.teamNumber === ourTeam);
  const next = nextOurs(model.forecasts, ourTeam);
  const side = next && sideOf(next, ourTeam);
  return (
    <dl className="status-tiles" aria-label="Event status">
      <div><dt>played</dt><dd>{played} / {total}</dd></div>
      <div><dt>our rank</dt><dd>{whole(us?.rankNow)}</dd></div>
      <div>
        <dt>our next match</dt>
        <dd>{next ? <button type="button" className="next-link" title={`Plan ${labels.get(next.matchUuid)}`} onClick={() => ctx.openMatch(next.matchUuid)}>{labels.get(next.matchUuid)}</button> : "–"}</dd>
      </div>
      <div title={next && side ? `Expected ${one(side === "red" ? next.redScore : next.blueScore)} to ${one(side === "red" ? next.blueScore : next.redScore)}` : undefined}>
        <dt>its win chance</dt><dd>{next && side ? pct(winChance(next, side)) : "–"}</dd>
      </div>
    </dl>
  );
}
