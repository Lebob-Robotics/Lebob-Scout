import { useEffect, useRef, useState } from "react";
import type { Api } from "./api";
import { Header } from "./components/Header";
import { CURRENT_FIELD_KEY } from "./field";
import { buildObservation } from "./observation";
import type { Draft, Target } from "./observation";
import { rememberedEvent } from "./schedule";
import { FinalScreen } from "./screens/FinalScreen";
import { LiveScreen } from "./screens/LiveScreen";
import { ReportsScreen } from "./screens/ReportsScreen";
import { SetupScreen } from "./screens/SetupScreen";
import { TeamsScreen } from "./screens/TeamsScreen";
import { createStore } from "./storage";
import { READ_LIMIT_MS, linkUnlinked, withTimeout } from "./sync";
import { useSaveQueue } from "./useSaveQueue";

type User = { id: string; name: string };
type Screen = "setup" | "reports" | "teams" | "live" | "final";

const store = createStore();
const USER_KEY = "lsa:user";
const rememberedUser = (): User | null => {
  try {
    const u = JSON.parse(localStorage.getItem(USER_KEY) ?? "null");
    return u && typeof u.id === "string" && typeof u.name === "string" ? u : null;
  } catch {
    return null;
  }
};
const rememberUser = (u: User) => {
  try { localStorage.setItem(USER_KEY, JSON.stringify(u)); } catch { /* kept for this page load only */ }
};

const newDraft = (target: Target, startSquare: string, flipped: boolean, startWallPos: number): Draft => ({
  ...target,
  observationId: crypto.randomUUID(), fieldKey: CURRENT_FIELD_KEY, startSquare, startWallPos,
  startedAtMs: Date.now(), taps: [], flipped, stage: "live",
  final: {
    autoLeave: false, autoPark: false, teleopPark: false, brokeDown: false,
    minorFouls: 0, majorFouls: 0, driverSkill: null, robotSpeed: null,
    autoNotes: null, notes: null, autoPathPoints: null,
  },
});

// Secondary and away from Save; asks first, with Cancel where Discard match was.
function DiscardMatch({ onDiscard, disabled }: { onDiscard(): void; disabled: boolean }) {
  const [asking, setAsking] = useState(false);
  if (!asking) return <button type="button" className="discard" disabled={disabled} onClick={() => setAsking(true)}>Discard match</button>;
  return (
    <div className="confirm">
      <button type="button" onClick={() => setAsking(false)}>Cancel</button>
      <button type="button" className="danger" disabled={disabled} onClick={onDiscard}>Discard</button>
      <p role="alert">Discard this match? Its taps will be lost.</p>
    </div>
  );
}

export default function App({ api, signedOut = false, onSignIn }: { api: Api; signedOut?: boolean; onSignIn?: () => Promise<void> }) {
  const [draft, setDraft] = useState(store.loadDraft);
  const [screen, setScreen] = useState<Screen>(() => draft?.stage ?? (rememberedEvent() ? "reports" : "setup"));
  const [user, setUser] = useState(rememberedUser);
  const [saveError, setSaveError] = useState<string | null>(null);
  // A correction is open in Reports or Teams: the tab bar hides so a stray tap cannot throw it away.
  const [correcting, setCorrecting] = useState(false);
  const [signIn, setSignIn] = useState<"idle" | "working" | "failed">("idle");
  const [savingNow, setSavingNow] = useState(false);
  // Where set-up was opened from, and the robot picked from the coverage grid. A draft restored after a reload goes back to Reports.
  const [from, setFrom] = useState<"reports" | "teams">("reports");
  const [scoutTarget, setScoutTarget] = useState<Target | null>(null);
  const teamsY = useRef(0);
  const saving = useRef(false);
  const linked = useRef(false);
  const queue = useSaveQueue(api, store);
  const wasSignedOut = useRef(signedOut);
  const event = rememberedEvent();
  const eventUuid = event?.eventUuid;

  useEffect(() => {
    api.currentUser().then((u) => { rememberUser(u); setUser(u); }, () => { /* keep the remembered user */ });
  }, [api]);

  useEffect(() => {
    if (!eventUuid || linked.current) return;
    linked.current = true;
    linkUnlinked(api, eventUuid, Date.now()).catch(() => {});
  }, [api, eventUuid]);

  // The Teams figures' first call after a quiet spell is slow: make it once in the background, result unused.
  const warmed = useRef(false);
  useEffect(() => {
    if (!eventUuid || signedOut || warmed.current) return;
    warmed.current = true;
    api.teamsTab(eventUuid).catch(() => {});
  }, [api, eventUuid, signedOut]);

  // Signed back in without leaving the page: send waiting reports now rather than at the next 30 s tick.
  useEffect(() => {
    if (wasSignedOut.current && !signedOut) queue.queued();
    wasSignedOut.current = signedOut;
  });

  // Signed in or out from elsewhere: the Sign in button starts fresh.
  const [signInFor, setSignInFor] = useState(signedOut);
  if (signInFor !== signedOut) {
    setSignInFor(signedOut);
    setSignIn("idle");
  }

  const tapSignIn = () => {
    setSignIn("working");
    onSignIn?.().then(() => setSignIn("idle"), () => setSignIn("failed"));
  };

  // Only nag when a reload would lose work: storage is broken and something is unsaved.
  useEffect(() => {
    const warn = (e: BeforeUnloadEvent) => {
      if (!store.ok && (store.loadDraft() || store.pending().length)) {
        e.preventDefault();
        e.returnValue = ""; // older browsers
      }
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, []);

  // The store is written before React state, so a refresh always finds the latest draft.
  const keep = (d: Draft) => { store.saveDraft(d); setDraft(d); };

  // Back to a tab; to Teams at the place in the grid the scout tapped from.
  const backTo = (next: Screen) => {
    setScreen(next);
    if (next === "teams") requestAnimationFrame(() => window.scrollTo(0, teamsY.current));
  };

  const save = async () => {
    if (saving.current || !store.loadDraft()) return; // a second tap, or the draft is already queued
    saving.current = true;
    setSavingNow(true);
    setSaveError(null);
    try {
      let who = user;
      if (!who) {
        try {
          who = await withTimeout(api.currentUser(), READ_LIMIT_MS);
          rememberUser(who);
          setUser(who);
        } catch {
          setSaveError("Couldn't confirm who you are. Check your signal and tap Save again.");
          return;
        }
      }
      const d = store.loadDraft(); // read after the wait, so edits made meanwhile are kept
      if (!d || d.stage !== "final") return; // gone back to the match meanwhile: never queue a match still running
      let observation;
      try {
        observation = buildObservation(d, who, Date.now());
      } catch (e) {
        setSaveError(e instanceof Error ? e.message : String(e));
        return;
      }
      store.enqueue(observation);
      store.clearDraft(); // only once the report is safely queued
      setDraft(null);
      backTo(from);
      queue.queued();
    } finally {
      saving.current = false;
      setSavingNow(false);
    }
  };

  const top = [
    !store.ok && <p key="ok" className="banner" role="alert">This phone can't store data. Keep this page open until your report has saved.</p>,
    signedOut && <p key="signed-out" className="banner">You're signed out. Reports will save after you sign in.</p>,
    signedOut && (
      <button key="sign-in" type="button" onClick={tapSignIn} disabled={signIn === "working"}>
        {signIn === "working" ? "Signing in…" : "Sign in"}
      </button>
    ),
    signedOut && signIn === "failed" && <p key="sign-in-failed" className="save-note error" role="alert">Couldn't reach Foundry. Check your signal and try again.</p>,
    screen === "setup" && event && (
      <button key="back" type="button" onClick={() => backTo(from)}>
        {from === "teams" ? "Back to teams" : "Back to reports"}
      </button>
    ),
    screen === "final" && draft && (
      <button key="back-to-match" type="button" disabled={savingNow} onClick={() => { keep({ ...draft, stage: "live" }); setScreen("live"); }}>
        Back to match
      </button>
    ),
    screen === "final" && draft && (
      <button key="flip" type="button" onClick={() => keep({ ...draft, flipped: !draft.flipped })}>
        Flip field ({draft.flipped ? "flipped" : "not flipped"})
      </button>
    ),
    screen === "final" && draft && (
      <DiscardMatch
        key="discard"
        disabled={savingNow}
        onDiscard={() => { store.clearDraft(); setDraft(null); setSaveError(null); backTo(event ? from : "setup"); }}
      />
    ),
  ].filter(Boolean);

  // The live screen stands alone: no header, tab bar or top buttons.
  const live = screen === "live" && draft;
  let body;
  if (live) {
    body = <LiveScreen draft={draft} onChange={keep} onEnd={() => { keep({ ...draft, stage: "final" }); setScreen("final"); }} />;
  } else if (screen === "final" && draft) {
    body = (
      <FinalScreen
        value={draft.final}
        onChange={(f) => keep({ ...draft, final: f })}
        onSave={save}
        saveLabel={savingNow ? "Saving…" : "Save report"}
        saveDisabled={savingNow}
        fieldKey={draft.fieldKey}
        flipped={draft.flipped}
      >
        {saveError && <p className="save-note error" role="alert">{saveError}</p>}
      </FinalScreen>
    );
  } else if (screen === "reports" && eventUuid) {
    body = <ReportsScreen api={api} eventUuid={eventUuid} userId={user?.id ?? ""} waiting={queue.waiting} lastError={queue.lastError} refresh={queue.saved} onNew={() => { setFrom("reports"); setScoutTarget(null); setScreen("setup"); }} onCorrecting={setCorrecting} />;
  } else if (screen === "teams" && eventUuid) {
    body = null; // kept below
  } else {
    body = <SetupScreen api={api} initial={scoutTarget ?? undefined} onStart={(t, square, flipped, wallPos) => { keep(newDraft(t, square, flipped, wallPos)); setScreen("live"); }} />;
  }

  return (
    <>
      {!live && <Header />}
      {!live && (screen === "reports" || screen === "teams") && eventUuid && !correcting && (
        <nav className="tabs" aria-label="Screens">
          <button type="button" aria-current={screen === "reports" ? "page" : undefined} onClick={() => setScreen("reports")}>Reports</button>
          <button type="button" aria-current={screen === "teams" ? "page" : undefined} onClick={() => setScreen("teams")}>Teams</button>
        </nav>
      )}
      {!live && top.length > 0 && <div className="top">{top}</div>}
      {/* Kept, hidden, from a tapped cell through set-up, the match and the final page, so coming back finds the search,
          filter, open rows, gaps switch and figures as they were. Hidden, it only reloads when a report saves. */}
      {eventUuid && (screen === "teams" || (from === "teams" && screen !== "reports")) && (
        <div hidden={screen !== "teams"}>
          <TeamsScreen
            api={api}
            eventUuid={eventUuid}
            userId={user?.id ?? ""}
            waiting={queue.waiting}
            refresh={queue.saved}
            onScout={(t) => { teamsY.current = window.scrollY; setFrom("teams"); setScoutTarget(t); setScreen("setup"); }}
            onCorrecting={setCorrecting}
          />
        </div>
      )}
      {body}
    </>
  );
}
