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
  // Mode and square are local; draft.taps is the only copy of the records.
  const [pick, setPick] = useState<Pick<LiveState, "mode" | "square">>({ mode: null, square: null });
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
    setPick({ mode: next.mode, square: next.square });
    if (next.taps !== draft.taps) onChange({ ...draft, taps: next.taps });
  };

  const { phase, remaining } = phaseAt(matchSeconds(draft.startedAtMs, now), field);
  const { mode, square } = pick;
  const ready = mode !== null && square !== null;
  const hint = !mode ? "Pick Shoot or Intake." : !square ? "Tap the square." : mode === "shoot" ? "How many scored?" : "How many picked up?";
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
          <Grid field={field} flipped={draft.flipped} selected={square} disabled={!mode} onPick={(s) => act({ type: "square", square: s })} />
        </div>
      </div>

      <div className="side counts">
        {[1, 2, 3, 4].map((n) => (
          <button key={n} type="button" disabled={!ready} onClick={() => act({ type: "count", count: n, seconds: matchSeconds(draft.startedAtMs, Date.now()) })}>
            {n} {mode && <small>{mode === "shoot" ? "scored" : "picked up"}</small>}
          </button>
        ))}
      </div>

      <div className="bar">
        <output className="clock">{phase.toUpperCase()} {clockText(remaining)}</output>
        {confirming ? (
          <>
            <p className="hint" aria-live="polite">End the match now?</p>
            <button type="button" onClick={() => setConfirming(false)}>Keep going</button>
            <button type="button" className="end confirmed" onClick={onEnd}>End match</button>
          </>
        ) : (
          <>
            {(phase === "auto" || phase === "changeover") && (
              <button type="button" onClick={() => onChange({ ...draft, startedAtMs: skipToTeleop(Date.now(), field) })}>Skip to teleop</button>
            )}
            <p className="hint" aria-live="polite">{hint}</p>
            <button type="button" className="flip" onClick={() => onChange({ ...draft, flipped: !draft.flipped })}>Flip field</button>
            <button type="button" className="end" onClick={() => (phase === "over" ? onEnd() : setConfirming(true))}>End match</button>
          </>
        )}
      </div>

      <div className="turn">Turn your phone sideways</div>
    </div>
  );
}
