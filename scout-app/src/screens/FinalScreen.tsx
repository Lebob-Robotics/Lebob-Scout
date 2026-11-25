import { AutoPathPad } from "../components/AutoPathPad";
import type { FinalPage } from "../observation";

type Flag = "autoLeave" | "autoPark" | "teleopPark" | "brokeDown";
const FLAGS: [Flag, string][] = [
  ["autoLeave", "Left the start in auto"],
  ["autoPark", "Parked in auto"],
  ["teleopPark", "Parked at the end"],
  ["brokeDown", "Broke down"],
];
const FOULS: ["minorFouls" | "majorFouls", string][] = [["minorFouls", "Minor fouls"], ["majorFouls", "Major fouls"]];
const RATINGS: ["driverSkill" | "robotSpeed", string][] = [
  ["driverSkill", "Driver skill (1 = struggled, 5 = excellent)"],
  ["robotSpeed", "Robot speed (1 = slow, 5 = very fast)"],
];

export function FinalScreen({ value, onChange, onSave, saveLabel, fieldKey, flipped }: {
  value: FinalPage;
  onChange(f: FinalPage): void;
  onSave(): void;
  saveLabel: string;
  fieldKey: string;
  flipped: boolean;
}) {
  const set = (change: Partial<FinalPage>) => onChange({ ...value, ...change });

  return (
    <div className="final">
      <div className="toggles">
        {FLAGS.map(([key, label]) => (
          <button key={key} type="button" aria-pressed={value[key]} onClick={() => set({ [key]: !value[key] })}>{label}</button>
        ))}
      </div>

      {FOULS.map(([key, label]) => (
        <div key={key} className="stepper">
          <span>{label}</span>
          <button type="button" aria-label={`Fewer ${label.toLowerCase()}`} disabled={value[key] === 0} onClick={() => set({ [key]: value[key] - 1 })}>−</button>
          <output>{value[key]}</output>
          <button type="button" aria-label={`More ${label.toLowerCase()}`} onClick={() => set({ [key]: value[key] + 1 })}>+</button>
        </div>
      ))}

      {RATINGS.map(([key, label]) => (
        <fieldset key={key} className="rating">
          <legend>{label}</legend>
          {[1, 2, 3, 4, 5].map((n) => (
            <button key={n} type="button" aria-pressed={value[key] === n} onClick={() => set({ [key]: value[key] === n ? null : n })}>{n}</button>
          ))}
        </fieldset>
      ))}

      <section>
        <h2>Auto path</h2>
        <p>Draw where the robot drove in auto.</p>
        <AutoPathPad fieldKey={fieldKey} flipped={flipped} value={value.autoPathPoints} onChange={(t) => set({ autoPathPoints: t })} />
      </section>

      <label htmlFor="auto-notes">Auto notes</label>
      <textarea id="auto-notes" value={value.autoNotes ?? ""} onChange={(e) => set({ autoNotes: e.target.value || null })} />
      <label htmlFor="notes">Notes</label>
      <textarea id="notes" value={value.notes ?? ""} onChange={(e) => set({ notes: e.target.value || null })} />

      <button type="button" className="save" onClick={onSave}>{saveLabel}</button>
    </div>
  );
}
