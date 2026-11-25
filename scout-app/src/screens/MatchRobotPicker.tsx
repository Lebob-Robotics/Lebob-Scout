import { useEffect, useState } from "react";
import type { Api, MatchRow, PresenceRow } from "../api";
import type { Target } from "../observation";
import { pickMatch } from "../schedule";

type Typed = { matchType: Target["matchType"]; matchNumber: string; teamNumber: string; alliance: Target["alliance"] | null };

const emptyTyped: Typed = { matchType: "qualification", matchNumber: "", teamNumber: "", alliance: null };
const matchLabel = (m: MatchRow) => `${m.matchType === "qualification" ? "Q" : "P"}${m.matchNumber}${m.actualTime ? " (played)" : ""}`;
const robotOrder = (a: PresenceRow, b: PresenceRow) => Number(a.alliance === "blue") - Number(b.alliance === "blue") || a.station - b.station;
const whole = (text: string) => (/^\d+$/.test(text) && Number(text) >= 1 ? Number(text) : null);

// Picks the match and the robot from the schedule, or takes them hand-typed when the match is not listed.
// Use a new key per event: the schedule loads once per mount. startTyped opens the hand-typed path.
export function MatchRobotPicker({ api, eventUuid, value, onChange, startTyped = false }: {
  api: Api;
  eventUuid: string;
  value: Target | null;
  onChange(target: Target | null): void;
  startTyped?: boolean;
}) {
  const [typed, setTyped] = useState<Typed | null>(() =>
    value && !value.matchUuid
      ? { matchType: value.matchType, matchNumber: String(value.matchNumber), teamNumber: String(value.teamNumber), alliance: value.alliance }
      : startTyped ? emptyTyped : null,
  );
  const [matches, setMatches] = useState<MatchRow[] | null>(null);
  const [matchUuid, setMatchUuid] = useState(value?.matchUuid ?? null);
  const [presences, setPresences] = useState<PresenceRow[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [tries, setTries] = useState(0);

  useEffect(() => {
    let live = true;
    api.matches(eventUuid).then(
      (ms) => {
        if (!live) return;
        setMatches(ms);
        setMatchUuid((m) => (m && ms.some((x) => x.matchUuid === m) ? m : pickMatch(ms)?.matchUuid ?? null));
      },
      () => live && setFailed(true),
    );
    return () => { live = false; };
  }, [api, eventUuid, tries]);

  useEffect(() => {
    if (!matchUuid) return;
    let live = true;
    api.presences(matchUuid).then((ps) => live && setPresences(ps), () => live && setFailed(true));
    return () => { live = false; };
  }, [api, matchUuid, tries]);

  const type = (next: Typed) => {
    setTyped(next);
    const matchNumber = whole(next.matchNumber), teamNumber = whole(next.teamNumber);
    onChange(matchNumber && teamNumber && next.alliance
      ? { eventUuid, matchUuid: null, presenceUuid: null, teamUuid: null, matchType: next.matchType, matchNumber, teamNumber, alliance: next.alliance }
      : null);
  };
  const leaveTyped = (next: Typed | null) => { setTyped(next); onChange(null); };

  if (typed) {
    return (
      <div className="picker">
        <span className="label">Match type</span>
        <div className="pair">
          <button type="button" aria-pressed={typed.matchType === "qualification"} onClick={() => type({ ...typed, matchType: "qualification" })}>Qualification</button>
          <button type="button" aria-pressed={typed.matchType === "playoff"} onClick={() => type({ ...typed, matchType: "playoff" })}>Playoff</button>
        </div>
        <label htmlFor="typed-match">Match number</label>
        <input id="typed-match" type="number" inputMode="numeric" min={1} value={typed.matchNumber} onChange={(e) => type({ ...typed, matchNumber: e.target.value })} />
        <label htmlFor="typed-team">Team number</label>
        <input id="typed-team" type="number" inputMode="numeric" min={1} value={typed.teamNumber} onChange={(e) => type({ ...typed, teamNumber: e.target.value })} />
        <span className="label">Alliance</span>
        <div className="pair">
          <button type="button" className="red" aria-pressed={typed.alliance === "red"} onClick={() => type({ ...typed, alliance: "red" })}>Red</button>
          <button type="button" className="blue" aria-pressed={typed.alliance === "blue"} onClick={() => type({ ...typed, alliance: "blue" })}>Blue</button>
        </div>
        <button type="button" className="link" onClick={() => leaveTyped(null)}>Back to the schedule</button>
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
          <select
            id="match"
            value={match.matchUuid}
            onChange={(e) => { setMatchUuid(e.target.value); setPresences(null); onChange(null); }}
          >
            {matches.map((m) => <option key={m.matchUuid} value={m.matchUuid}>{matchLabel(m)}</option>)}
          </select>
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
