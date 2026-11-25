import { useEffect, useState } from "react";
import { FieldPicture } from "../components/FieldPicture";
import { Grid } from "../components/Grid";
import { matchSeconds, phaseAt, skipToTeleop } from "../clock";
import { FIELDS } from "../field";
import { liveReducer, type LiveAction, type LiveState } from "../live";
import type { Draft } from "../observation";

const clockText = (remaining: number) => {
  const s = Math.max(0, Math.ceil(remaining));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
};

export function LiveScreen({ draft, onChange, onEnd }: { draft: Draft; onChange(d: Draft): void; onEnd(): void }) {
  const field = FIELDS[draft.fieldKey];
  // Mode, square and area are local; draft.taps is the only copy of the records.
  const [pick, setPick] = useState<Omit<LiveState, "taps">>({ mode: null, square: null, area: [] });
  const [now, setNow] = useState(Date.now);
  const [confirming, setConfirming] = useState(false);

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    let lock: WakeLockSentinel | null = null;
    let gone = false;
    const request = () => {
      if (document.visibilityState !== "visible") return;
      navigator.wakeLock?.request("screen").then(
        (l) => {
          if (gone) l.release().catch(() => {});
          else lock = l;
        },
        () => {},
      );
    };
    request();
    document.addEventListener("visibilitychange", request);
    return () => {
      gone = true;
      document.removeEventListener("visibilitychange", request);
      lock?.release().catch(() => {});
    };
  }, []);

  const act = (action: LiveAction) => {
    const next = liveReducer({ ...pick, taps: draft.taps }, action);
    setPick({ mode: next.mode, square: next.square, area: next.area });
    if (next.taps !== draft.taps) onChange({ ...draft, taps: next.taps });
  };

  const { phase, remaining } = phaseAt(matchSeconds(draft.startedAtMs, now), field);
  const { mode, square, area } = pick;
  const hint = !mode ? "Pick Shoot or Intake." : mode === "intake" ? "Tap every square it collects from." : !square ? "Tap the square." : "How many scored?";
  const records = draft.taps.length;

  return (
    <div className="live" data-mode={mode ?? undefined}>
      <div className="side modes">
        <button type="button" className="shoot" aria-pressed={mode === "shoot"} onClick={() => act({ type: "mode", mode: "shoot" })}>Shoot</button>
        <button type="button" className="intake" aria-pressed={mode === "intake"} onClick={() => act({ type: "mode", mode: "intake" })}>Intake</button>
        <button type="button" className="undo" disabled={!records} onClick={() => act({ type: "undo" })}>
          Undo <small>{records} {records === 1 ? "record" : "records"}</small>
        </button>
      </div>

      <div className="field-space">
        <div className="field">
          <FieldPicture fieldKey={draft.fieldKey} flipped={draft.flipped} />
          <Grid field={field} flipped={draft.flipped} selected={mode === "intake" ? area : square} disabled={!mode}
            onPick={(s) => act({ type: "square", square: s, seconds: matchSeconds(draft.startedAtMs, Date.now()) })} />
        </div>
      </div>

      <div className="side counts">
        {mode === "shoot" && [1, 2, 3, 4].map((n) => (
          <button key={n} type="button" disabled={!square} onClick={() => act({ type: "count", count: n, seconds: matchSeconds(draft.startedAtMs, Date.now()) })}>
            {n} <small>scored</small>
          </button>
        ))}
        {mode === "intake" && <p>{area.length} <small>{area.length === 1 ? "square" : "squares"}</small></p>}
      </div>

      <div className="bar">
        <output className="clock">{phase.toUpperCase()} {clockText(remaining)}</output>
        {!confirming && (phase === "auto" || phase === "changeover") && (
          <button type="button" onClick={() => onChange({ ...draft, startedAtMs: skipToTeleop(Date.now(), field) })}>Skip to teleop</button>
        )}
        {/* One hint, always mounted, so screen readers hear the change. */}
        <p className="hint" aria-live="polite">{confirming ? "End the match now?" : hint}</p>
        {/* Keep going sits where End match was, so a double tap keeps the match running. */}
        {confirming ? (
          <>
            <button key="end-now" type="button" className="end confirmed" onClick={onEnd}>End match</button>
            <button key="keep" type="button" onClick={() => setConfirming(false)}>Keep going</button>
          </>
        ) : (
          <>
            <button key="flip" type="button" className="flip" onClick={() => onChange({ ...draft, flipped: !draft.flipped })}>Flip field</button>
            <button key="end" type="button" className="end" onClick={() => (phase === "over" ? onEnd() : setConfirming(true))}>End match</button>
          </>
        )}
      </div>

      <div className="turn">Turn your phone sideways (and turn off rotation lock)</div>
    </div>
  );
}
