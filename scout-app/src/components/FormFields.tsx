import { useId } from "react";
import { optionLabel } from "../pitBreakage";

// The pit and breakage forms' controls. Each takes the field's text and hands back new text; "" is blank.

export function Choice({ label, value, options, onChange, labels }: {
  label: string; value: string; options: readonly string[]; onChange(v: string): void;
  labels?: Record<string, string>; // shown words, when optionLabel's aren't right
}) {
  const id = useId();
  return (
    <div className="form-field">
      <label htmlFor={id}>{label}</label>
      <select id={id} value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="">–</option>
        {options.map((o) => <option key={o} value={o}>{labels?.[o] ?? optionLabel(o)}</option>)}
      </select>
    </div>
  );
}

export function YesNo({ label, value, onChange }: { label: string; value: string; onChange(v: string): void }) {
  return <Choice label={label} value={value} options={["yes", "no"]} onChange={onChange} />;
}

// A number box with − and + either side, as the old site's steppers. Never goes below 0.
export function Stepper({ label, value, step, onChange }: { label: string; value: string; step: number; onChange(v: string): void }) {
  const id = useId();
  const by = (d: number) => {
    const n = Number(value);
    onChange(String(Math.max(0, Math.round(((Number.isFinite(n) ? n : 0) + d * step) * 100) / 100)));
  };
  return (
    <div className="form-field">
      <label htmlFor={id}>{label}</label>
      <div className="num-stepper">
        <button type="button" aria-label={`Less ${label.toLowerCase()}`} onClick={() => by(-1)}>−</button>
        <input id={id} type="text" inputMode="decimal" value={value} onChange={(e) => onChange(e.target.value)} />
        <button type="button" aria-label={`More ${label.toLowerCase()}`} onClick={() => by(1)}>+</button>
      </div>
    </div>
  );
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
