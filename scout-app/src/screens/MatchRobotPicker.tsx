import { useEffect, useEffectEvent, useState } from "react";
import type { Api, MatchRow, PresenceRow } from "../api";
import { Dropdown } from "../components/Dropdown";
import type { Target } from "../observation";
import { MATCH_MAX, TEAM_MAX, order, pickMatch, whole } from "../schedule";
import { READ_LIMIT_MS, withTimeout } from "../sync";

type Typed = { matchType: Target["matchType"]; matchNumber: string; teamNumber: string; alliance: Target["alliance"] | null };

const emptyTyped: Typed = { matchType: "qualification", matchNumber: "", teamNumber: "", alliance: null };
const matchLabel = (m: MatchRow) => `${m.matchType === "qualification" ? "Q" : "P"}${m.matchNumber}${m.actualTime ? " (played)" : ""}`;
const robotOrder = (a: PresenceRow, b: PresenceRow) => Number(a.alliance === "blue") - Number(b.alliance === "blue") || a.station - b.station;
const typedFrom = (v: Target): Typed => ({ matchType: v.matchType, matchNumber: String(v.matchNumber), teamNumber: String(v.teamNumber), alliance: v.alliance });

// Picks the match and the robot from the schedule, or takes them hand-typed when the match is not listed.
// Use a new key per event: the schedule loads once per mount. startTyped opens the hand-typed path.
// A value whose match is not listed, or a value when the schedule is down, opens hand-typed with its details.
// onShown is called once the match and robots, or the typed boxes, are on screen.
export function MatchRobotPicker({ api, eventUuid, value, onChange, startTyped = false, onShown }: {
  api: Api;
  eventUuid: string;
  value: Target | null;
  onChange(target: Target | null): void;
  startTyped?: boolean;
  onShown?(): void;
}) {
  const [typed, setTyped] = useState<Typed | null>(() => (value && (startTyped || !value.matchUuid) ? typedFrom(value) : startTyped ? emptyTyped : null));
  const [start] = useState(value);
  const [matches, setMatches] = useState<MatchRow[] | null>(null);
  const [matchUuid, setMatchUuid] = useState(value?.matchUuid ?? null);
  const [presences, setPresences] = useState<PresenceRow[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [tries, setTries] = useState(0);
  const [found, setFound] = useState<{ teamNumber: number; teamUuid: string | null } | null>(null);
  const typedTeam = typed ? whole(typed.teamNumber, TEAM_MAX) : null;

  const unlisted = useEffectEvent((ms: MatchRow[]) => (value?.matchUuid && !ms.some((x) => x.matchUuid === value.matchUuid) ? value : null));
  useEffect(() => {
    let live = true;
    withTimeout(api.matches(eventUuid), READ_LIMIT_MS).then(
      (ms) => {
        if (!live) return;
        setMatches(ms);
        const lost = unlisted(ms);
        if (lost) setTyped(typedFrom(lost));
        setMatchUuid((m) => (m && ms.some((x) => x.matchUuid === m) ? m : pickMatch(ms)?.matchUuid ?? null));
      },
      () => live && setFailed(true),
    );
    return () => { live = false; };
  }, [api, eventUuid, tries]);

  useEffect(() => {
    if (!matchUuid) return;
    let live = true;
    withTimeout(api.presences(matchUuid), READ_LIMIT_MS).then((ps) => live && setPresences(ps), () => live && setFailed(true));
    return () => { live = false; };
  }, [api, matchUuid, tries]);

  // Hand-typed team: look it up in the background so Start never waits. Unknown or unanswered stays null.
  useEffect(() => {
    if (!typedTeam) return;
    let live = true;
    api.findTeamUuid(typedTeam).then((teamUuid) => live && setFound({ teamNumber: typedTeam, teamUuid }), () => {});
    return () => { live = false; };
  }, [api, typedTeam]);

  const shown = useEffectEvent(() => onShown?.());
  const ready = Boolean(typed || (matches && presences));
  useEffect(() => { if (ready) shown(); }, [ready]);

  // The hand-typed Target follows the inputs and the lookup.
  const emit = useEffectEvent(onChange);
  useEffect(() => {
    if (!typed) return;
    const matchNumber = whole(typed.matchNumber, MATCH_MAX), teamNumber = whole(typed.teamNumber, TEAM_MAX);
    const teamUuid = found?.teamNumber === teamNumber ? found.teamUuid : null;
    // Unchanged from the value it opened with: keep that value, links and all.
    const same = start && start.matchType === typed.matchType && start.matchNumber === matchNumber
      && start.teamNumber === teamNumber && start.alliance === typed.alliance;
    emit(same ? start : matchNumber && teamNumber && typed.alliance
      ? { eventUuid, matchUuid: null, presenceUuid: null, teamUuid, matchType: typed.matchType, matchNumber, teamNumber, alliance: typed.alliance }
      : null);
  }, [typed, found, eventUuid, start]);

  const type = (next: Typed) => setTyped(next);
  const leaveTyped = (next: Typed | null) => { setTyped(next); onChange(null); };
  const backToSchedule = () => {
    if (failed) { setFailed(false); setTries((t) => t + 1); } // the schedule failed before: try it again
    leaveTyped(null);
  };

  if (typed) {
    return (
      <div className="picker">
        <span className="label">Match type</span>
        <div className="pair">
          <button type="button" aria-pressed={typed.matchType === "qualification"} onClick={() => type({ ...typed, matchType: "qualification" })}>Qualification</button>
          <button type="button" aria-pressed={typed.matchType === "playoff"} onClick={() => type({ ...typed, matchType: "playoff" })}>Playoff</button>
        </div>
        <label htmlFor="typed-match">Match number</label>
        <input id="typed-match" type="number" inputMode="numeric" min={1} max={MATCH_MAX} value={typed.matchNumber} onChange={(e) => type({ ...typed, matchNumber: e.target.value })} />
        <label htmlFor="typed-team">Team number</label>
        <input id="typed-team" type="number" inputMode="numeric" min={1} max={TEAM_MAX} value={typed.teamNumber} onChange={(e) => type({ ...typed, teamNumber: e.target.value })} />
        <span className="label">Alliance</span>
        <div className="pair">
          <button type="button" className="red" aria-pressed={typed.alliance === "red"} onClick={() => type({ ...typed, alliance: "red" })}>Red</button>
          <button type="button" className="blue" aria-pressed={typed.alliance === "blue"} onClick={() => type({ ...typed, alliance: "blue" })}>Blue</button>
        </div>
        {/* Opened because the schedule failed: going back would only fail again. */}
        {!startTyped && <button type="button" className="link" onClick={backToSchedule}>Back to the schedule</button>}
      </div>
    );
  }

  const match = matches?.find((m) => m.matchUuid === matchUuid);
  return (
    <div className="picker">
      {failed ? (
        <p>
          Couldn't load the schedule.{" "}
          <button type="button" className="retry" onClick={() => { setFailed(false); setTries((t) => t + 1); }}>Retry</button>
        </p>
      ) : !matches ? (
        <p>Loading…</p>
      ) : !match ? (
        <p>No matches are listed for this event.</p>
      ) : (
        <>
          <label htmlFor="match">Match</label>
          <Dropdown
            id="match"
            label="Match"
            value={match.matchUuid}
            items={[...matches].sort(order).map((m) => ({ value: m.matchUuid, label: matchLabel(m) }))}
            onChange={(v) => { setMatchUuid(v); setPresences(null); onChange(null); }}
          />
          <span className="label">Robot</span>
          {!presences ? (
            <p>Loading…</p>
          ) : (
            <div className="robots">
              {[...presences].sort(robotOrder).map((p) => (
                <button
                  key={p.presenceUuid}
                  type="button"
                  className={p.alliance}
                  aria-pressed={value?.presenceUuid === p.presenceUuid}
                  onClick={() => onChange({
                    eventUuid, matchUuid: match.matchUuid, presenceUuid: p.presenceUuid, teamUuid: p.teamUuid,
                    matchType: match.matchType, matchNumber: match.matchNumber, teamNumber: p.teamNumber, alliance: p.alliance,
                  })}
                >
                  {p.teamNumber}
                </button>
              ))}
            </div>
          )}
        </>
      )}
      <button type="button" className="link" onClick={() => leaveTyped(emptyTyped)}>
        Match not listed
      </button>
    </div>
  );
}
