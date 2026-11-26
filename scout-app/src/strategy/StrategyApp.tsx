import { useEffect, useMemo, useRef, useState } from "react";
import type { EventRow, TeamProfile, TeamsTab } from "../api";
import mark from "../assets/strategy-mark.png";
import { firstEvent } from "../schedule";
import type { StrategyApi } from "./api";
import { keepShut, likely, matchLabels, orderForecasts, pointsFigure, scaleMax } from "./logic";
import type { Figure, OprRow } from "./logic";
import { fitOpr, oprHistory, type Played } from "./opr";
import { bonusRates, isPlayed, label, officialShare, scoutForecasts, strengths, type Game, type Strength } from "./scouted";
import { defaultSettings, keepSettings, readSettings, type Settings } from "./settings";
import { useLoad, type Load } from "./useLoad";
import { AllianceScreen } from "./screens/AllianceScreen";
import { EventScreen } from "./screens/EventScreen";
import { MatchScreen } from "./screens/MatchScreen";
import { MatchesScreen } from "./screens/MatchesScreen";
import { SettingsScreen } from "./screens/SettingsScreen";
import { TeamScreen } from "./screens/TeamScreen";
import type { Forecast, HistoryPoint, Projection, Rating, TeamCycles, TeamMap } from "./types";

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

// The event's figures. Read: the model's EventRating (only for TIPS and names), RankProjection (only the standing
// now) and every match with its official scores. Worked out here from scouting and those scores: the forecasts,
// our own OPR and its history. No rating is used for any of them.
export type Model = {
  ratings: Rating[]; projections: Projection[]; games: Game[];
  forecasts: Forecast[]; teams: OprRow[]; history: HistoryPoint[];
};
type Read = { ratings: Rating[]; projections: Projection[]; games: Game[] };

// What every screen gets: the model (always loaded), and the scouting figures, maps and splits, each of which may
// still be loading or have failed without stopping the rest.
export type Ctx = {
  api: StrategyApi; eventUuid: string; ourTeam: number; settings: Settings; changeSettings(patch: Partial<Settings>): void;
  model: Model; labels: Map<string, string>;
  scouting: Load<TeamsTab>; retryScouting(): void; profile(team: number): TeamProfile | undefined;
  maps: Load<TeamMap[]>; retryMaps(): void;
  // Each team's strength from scouting (or its official share), and bonus RP per qualification match.
  strengths: Map<number, Strength>; bonusRates: Map<number, number>;
  // A robot's official share of a played match: the alliance's score less its scouted partner, or half.
  officialShare(matchUuid: string, team: number): number | null;
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
        {event && <EventView key={event.eventUuid} api={api} eventUuid={event.eventUuid} tab={tab} go={go} tick={tick} settings={settings} onSettings={change} />}
      </div>
      <footer className="foot-brand foot-wide">Lebob Strategy · FTC team 29550</footer>
    </>
  );
}

function EventView({ api, eventUuid, tab, go, tick, settings, onSettings }: {
  api: StrategyApi; eventUuid: string; tab: Tab; go(t: Tab): void; tick: number; settings: Settings; onSettings(patch: Partial<Settings>): void;
}) {
  const [team, setTeam] = useState<number | null>(null);
  const [matchUuid, setMatchUuid] = useState<string | null>(null);
  const [breakageAsk, setBreakageAsk] = useState(0);
  const handledAsk = useRef(0);
  const [model, retryModel] = useLoad(eventUuid, async (): Promise<Read> => {
    const [ratings, projections, games] = await Promise.all([api.ratings(eventUuid), api.projections(eventUuid), api.games(eventUuid)]);
    return { ratings, projections, games };
  }, tick);
  const [scouting, retryScouting] = useLoad(eventUuid, () => api.teamsTab(eventUuid), tick);
  const [maps, retryMaps] = useLoad(eventUuid, () => api.fieldMaps(eventUuid), tick);
  const [cycles, retryCycles] = useLoad(eventUuid, () => api.teamCycles(eventUuid), tick);

  // Everything worked out from scouting and the official scores, once per new read.
  const worked = useMemo(() => (model.state === "ok" ? work(model.data, scouting.state === "ok" ? scouting.data : null) : null), [model, scouting]);

  if (tab === "settings") return null;
  if (model.state !== "ok") {
    return model.state === "loading" ? <p>Loading…</p> : <p>Couldn't load the match model's figures. <button type="button" onClick={retryModel}>Retry</button></p>;
  }
  const { model: m, profiles, shares, st, rates, byUuid } = worked!;
  if (!m.games.length) return <p>No matches yet for this event.</p>;

  const ourTeam = settings.ourTeam;
  const points = (n: number) => pointsFigure(profiles.get(n), shares.get(n) ?? []);
  const byTeam = new Map(cycles.state === "ok" ? cycles.data.map((c) => [c.teamNumber, c]) : []);
  const ctx: Ctx = {
    api, eventUuid, ourTeam, settings, changeSettings: onSettings, model: m, labels: matchLabels(m.forecasts),
    scouting, retryScouting, profile: (n) => profiles.get(n), maps, retryMaps,
    strengths: st, bonusRates: rates,
    officialShare: (u, t) => { const g = byUuid.get(u); return g ? officialShare(g, t, (n) => profiles.get(n)) : null; },
    cycles, retryCycles, teamCycles: (n) => byTeam.get(n),
    points,
    scale: {
      rating: scaleMax(m.teams.map((r) => (r.opr == null ? 0 : likely(r.opr, r.oprSe)?.high ?? r.opr))),
      points: scaleMax(m.teams.map((r) => points(r.teamNumber)?.high ?? 0)),
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
  const teams = m.teams.map((r) => r.teamNumber);
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

// From the read and the scouting: every team's strength, the scouting forecasts, our OPR and its history (played
// matches in time order), each team's official shares, and the names.
const timeOrder = (a: Game, b: Game) => (a.time ?? "").localeCompare(b.time ?? "") || Number(a.level === "playoff") - Number(b.level === "playoff") || a.number - b.number;
function work(read: Read, scouting: TeamsTab | null) {
  const { ratings, projections, games } = read;
  const profiles = new Map((scouting?.teams ?? []).map((t) => [t.teamNumber, t]));
  const prof = (t: number) => profiles.get(t);
  const all = [...new Set([...games.flatMap((g) => [...g.red, ...g.blue]), ...projections.map((p) => p.teamNumber), ...profiles.keys()])].sort((a, b) => a - b);
  const nameOf = (t: number) => profiles.get(t)?.name || ratings.find((r) => r.teamNumber === t)?.teamName || projections.find((p) => p.teamNumber === t)?.teamName || "";
  const st = strengths(all, games, prof);
  const rates = bonusRates(games, projections);
  const forecasts = orderForecasts(scoutForecasts(games, st, rates, nameOf));
  const played: Played[] = games.filter(isPlayed).sort(timeOrder).map((g) => ({ label: label(g), red: g.red, blue: g.blue, redScore: g.redScore!, blueScore: g.blueScore! }));
  const fit = fitOpr(played);
  const hive = new Map(ratings.map((r) => [r.teamNumber, r.hiveRating]));
  const r1 = (x: number) => Math.round(x * 10) / 10;
  const teams: OprRow[] = all.map((t) => {
    const f = fit.get(t);
    return { teamNumber: t, teamName: nameOf(t), opr: f ? r1(f.opr) : null, oprSe: f?.se == null ? null : r1(f.se), hiveRating: hive.get(t) ?? null };
  });
  const shares = new Map(all.map((t) => [t, games.map((g) => officialShare(g, t, prof)).filter((v): v is number => v != null)]));
  const model: Model = { ratings, projections, games, forecasts, teams, history: oprHistory(played) };
  return { model, profiles, shares, st, rates, byUuid: new Map(games.map((g) => [g.matchUuid, g])) };
}
