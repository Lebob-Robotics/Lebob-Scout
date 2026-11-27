import { useId } from "react";
import { optionLabel } from "../../shared/pitBreakage";
import type { TeamOption } from "../../shared/api";
import type { DdItem } from "../../shared/dropdown";
import type { ListLoad } from "../useEventLists";
import { Dropdown } from "../../shared/components/Dropdown";

// The pit and breakage forms' controls. Each takes the field's text and hands back new text; "" is blank.

export function Choice({ label, value, options, onChange, labels }: {
  label: string; value: string; options: readonly string[]; onChange(v: string): void;
  labels?: Record<string, string>; // shown words, when optionLabel's aren't right
}) {
  const id = useId();
  return (
    <div className="form-field">
      <label htmlFor={id}>{label}</label>
      <Dropdown id={id} label={label} value={value} onChange={onChange}
        items={[{ value: "", label: "–" }, ...options.map((o) => ({ value: o, label: labels?.[o] ?? optionLabel(o) }))]} />
    </div>
  );
}

export function YesNo({ label, value, onChange }: { label: string; value: string; onChange(v: string): void }) {
  return <Choice label={label} value={value} options={["yes", "no"]} onChange={onChange} />;
}

export function Text({ label, value, onChange, long = false, placeholder, numeric = false }: {
  label: string; value: string; onChange(v: string): void; long?: boolean; placeholder?: string; numeric?: boolean;
}) {
  const id = useId();
  return (
    <div className="form-field">
      <label htmlFor={id}>{label}</label>
      {long
        ? <textarea id={id} value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />
        : <input id={id} type="text" inputMode={numeric ? "numeric" : undefined} value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />}
    </div>
  );
}

// A dropdown over listed items, with a blank until one is picked.
export function PickField({ label, value, items, onChange, placeholder }: {
  label: string; value: string; items: DdItem[]; onChange(v: string): void; placeholder?: string;
}) {
  const id = useId();
  return (
    <div className="form-field">
      <label htmlFor={id}>{label}</label>
      <Dropdown id={id} label={label} value={value} onChange={onChange} items={items} placeholder={placeholder} />
    </div>
  );
}

// The team: a dropdown of the event's teams (number, with the name beside it). While the list loads there is a short
// line, and when it can't be read (no signal, no schedule yet) a number box takes its place, so the form still works.
// A team already chosen that the event doesn't list (an old report's) stays in the list.
export function TeamPicker({ value, onChange, teams, retry, label = "Team" }: {
  value: string; onChange(v: string): void; teams: ListLoad<TeamOption[]>; retry(): void; label?: string;
}) {
  if (teams.state === "loading") return <div className="form-field"><span className="label">{label}</span><p className="caption keep">Loading teams…</p></div>;
  if (teams.state === "failed") {
    return (
      <div className="form-field">
        <Text label={`${label} #`} value={value} numeric onChange={onChange} />
        <p className="caption keep">Couldn't load the team list, so type the number. <button type="button" className="retry" onClick={retry}>Retry</button></p>
      </div>
    );
  }
  const items: DdItem[] = teams.data.map((t) => ({ value: String(t.teamNumber), label: String(t.teamNumber), sub: t.name }));
  if (value && !items.some((it) => it.value === value)) items.unshift({ value, label: value });
  return <PickField label={label} value={value} items={items} onChange={onChange} placeholder="Choose a team" />;
}
