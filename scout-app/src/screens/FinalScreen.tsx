import { useState, type ReactNode } from "react";
import { AutoPathPad } from "../components/AutoPathPad";
import { splitPath } from "../autoPath";
import { FIELDS } from "../field";
import type { FinalPage } from "../observation";
import { wallPoint } from "../startWall";
import { matchSummary } from "../summary";
import type { Tap } from "../taps";

type Flag = "autoLeave" | "autoPark" | "teleopPark" | "brokeDown";
const FOULS: ["minorFouls" | "majorFouls", string][] = [["minorFouls", "Minor fouls"], ["majorFouls", "Major fouls"]];
const RATINGS: ["driverSkill" | "robotSpeed", string][] = [
  ["driverSkill", "Driver skill (1 = struggled, 5 = excellent)"],
  ["robotSpeed", "Robot speed (1 = slow, 5 = very fast)"],
];

// Laid out as the old site's "After the match": the summary, the AUTO path and shooting spots, what happened in auto
// and at the end, fouls folded away, the two scales, then notes with prompts. taps (the match just played) shows the
// summary and opens the AUTO diagram, as the old site did after a new match; a correction passes none and finds it
// folded, its header saying what is marked. discard sits left of Save. children show just above the Save button.
export function FinalScreen({ value, onChange, onSave, saveLabel, saveDisabled = false, fieldKey, flipped, onFlip, alliance, startWallPos, taps, discard, children }: {
  value: FinalPage;
  onChange(f: FinalPage): void;
  onSave(): void;
  saveLabel: string;
  saveDisabled?: boolean;
  fieldKey: string;
  flipped: boolean;
  onFlip(): void;
  alliance: "red" | "blue";
  startWallPos: number | null;
  taps?: Tap[];
  discard?: ReactNode;
  children?: ReactNode;
}) {
  const set = (change: Partial<FinalPage>) => onChange({ ...value, ...change });
  const toggle = (key: Flag, label: string) => (
    <button type="button" className="toggle" aria-pressed={value[key]} onClick={() => set({ [key]: !value[key] })}>{label}</button>
  );
  const field = FIELDS[fieldKey];
  const sum = taps && field ? matchSummary(taps, field) : null;
  // Folded unless something was in them on opening, so a correction shows what was recorded.
  // Read once: open tied to the values would fold the section shut under the scout's finger.
  const [fouled] = useState(value.minorFouls > 0 || value.majorFouls > 0 || value.brokeDown);
  const [pathOpen] = useState(!!taps);
  const { lines, dots } = splitPath(value.autoPathPoints);
  const marked = [lines.length && `${lines.length} stroke${lines.length === 1 ? "" : "s"}`, dots.length && `${dots.length} spot${dots.length === 1 ? "" : "s"}`, value.autoNotes?.trim() && "notes"].filter(Boolean);

  return (
    <div className="final">
      <div className="card">
        <h2>After the match</h2>

        {sum && (
          <dl className="bigstats">
            <div><dt>Auto scored</dt><dd>{sum.autoScored}</dd></div>
            <div><dt>Teleop scored</dt><dd>{sum.teleopScored}</dd></div>
            <div><dt>Intake squares</dt><dd>{sum.intakeSquares}</dd></div>
          </dl>
        )}

        <details className="oth fsec" open={pathOpen || undefined}>
          <summary>AUTO: PATH AND SHOOTING SPOTS<span className="sumtxt">{marked.length ? marked.join(" · ") : "nothing marked"}</span></summary>
          <div className="oth-body">
            <AutoPathPad
              fieldKey={fieldKey}
              flipped={flipped}
              value={value.autoPathPoints}
              onChange={(t) => set({ autoPathPoints: t })}
              start={startWallPos === null ? null : wallPoint(startWallPos, alliance)}
              alliance={alliance}
              onFlip={onFlip}
            />
            <label htmlFor="auto-notes">AUTO notes: fails, missed pieces, anything odd</label>
            <textarea id="auto-notes" className="short" maxLength={200} value={value.autoNotes ?? ""} placeholder="e.g. missed the 2nd pickup, stalled on the wall" onChange={(e) => set({ autoNotes: e.target.value || null })} />
          </div>
        </details>

        <section className="psec">
          <h3>Auto</h3>
          <div className="pgrid">
            {toggle("autoLeave", "Leave")}
            {toggle("autoPark", "Auto park")}
          </div>
        </section>
        <section className="psec">
          <h3>End</h3>
          <div className="pgrid">{toggle("teleopPark", "Teleop park")}</div>
        </section>

        <details className="oth" open={fouled || undefined}>
          <summary>FOULS / BROKE DOWN (only if it happened)</summary>
          <div className="oth-body">
            {FOULS.map(([key, label]) => (
              <div key={key} className="stepper">
                <span>{label}</span>
                <button type="button" aria-label={`Fewer ${label.toLowerCase()}`} disabled={value[key] === 0} onClick={() => set({ [key]: value[key] - 1 })}>−</button>
                <output>{value[key]}</output>
                <button type="button" aria-label={`More ${label.toLowerCase()}`} onClick={() => set({ [key]: value[key] + 1 })}>+</button>
              </div>
            ))}
            {toggle("brokeDown", "Broke down")}
          </div>
        </details>

        {RATINGS.map(([key, label]) => (
          <fieldset key={key} className="rating">
            <legend>{label}</legend>
            {[1, 2, 3, 4, 5].map((n) => (
              <button key={n} type="button" aria-pressed={value[key] === n} onClick={() => set({ [key]: value[key] === n ? null : n })}>{n}</button>
            ))}
          </fieldset>
        ))}

        <label htmlFor="notes">Notes</label>
        <div className="notehelp" id="notes-help">
          <p className="caption">Write about:</p>
          <ul className="notelist">
            <li>where it shoots from in TELEOP, and whether that changed when blocked</li>
            <li>traffic: where it got in the way, or got stuck</li>
            <li>anything that broke or looked odd</li>
          </ul>
        </div>
        <textarea id="notes" aria-describedby="notes-help" value={value.notes ?? ""} onChange={(e) => set({ notes: e.target.value || null })} />

        {children}
        <div className={discard ? "save-row" : "save-row alone"}>
          {discard}
          <button type="button" className="save" disabled={saveDisabled} onClick={onSave}>{saveLabel}</button>
        </div>
      </div>
    </div>
  );
}
