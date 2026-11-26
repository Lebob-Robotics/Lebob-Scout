import { useEffect, useState } from "react";
import type { Api } from "../api";
import { Choice, Stepper, Text, YesNo } from "../components/FormFields";
import {
  CAUSES, CONFIDENCE, FAILURE_TYPES, FIELD_ZONES, PHASES, RECURRENCE, SEVERITY,
  breakageFormOf, breakageMatch, buildBreakage, emptyBreakageForm, formTeam,
} from "../pitBreakage";
import type { BreakageForm, BreakageReport } from "../pitBreakage";
import { READ_LIMIT_MS, withTimeout } from "../sync";
import { savedAt } from "./reportTime";

const SEVERITY_VALUES = SEVERITY.map(([n]) => String(n));
const SEVERITY_LABELS = Object.fromEntries(SEVERITY.map(([n, l]) => [String(n), l]));

// The Breakage tab: the old site's breakage form (ours or theirs) and this event's saved breakages (old lines 383 to 394).
// As many breakages per team as needed. Saving hands the report to App, which queues it.
export function BreakageScreen({ api, eventCode, waiting, refresh, initialTeam, whoAmI, onSave }: {
  api: Api;
  eventCode: string;
  waiting: BreakageReport[];
  refresh: number;
  initialTeam?: number;
  whoAmI(): Promise<string>;
  onSave(b: BreakageReport): void;
}) {
  const [saved, setSaved] = useState<BreakageReport[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [tries, setTries] = useState(0);
  const [form, setForm] = useState<BreakageForm>(() => emptyBreakageForm(initialTeam ? String(initialTeam) : ""));
  const [editing, setEditing] = useState<BreakageReport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [flash, setFlash] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let live = true;
    withTimeout(api.breakages(eventCode), READ_LIMIT_MS).then(
      (bs) => { if (live) { setSaved(bs); setFailed(false); } },
      () => live && setFailed(true),
    );
    return () => { live = false; };
  }, [api, eventCode, refresh, tries]);

  const waitingIds = new Set(waiting.map((b) => b.breakageId));
  const all = [...waiting, ...(saved ?? []).filter((b) => !waitingIds.has(b.breakageId))];

  const set = (change: Partial<BreakageForm>) => { setForm((f) => ({ ...f, ...change })); setFlash(null); };
  const typedSomething = () => Object.entries(form).some(([k, v]) => k !== "matchType" && v !== "");
  const startEdit = (b: BreakageReport) => {
    if (!editing && typedSomething() && !window.confirm("Replace what you typed with this report?")) return;
    setEditing(b); setForm(breakageFormOf(b)); setError(null); setFlash(null);
    window.scrollTo(0, 0);
  };
  const stopEdit = () => { setEditing(null); setForm(emptyBreakageForm()); setError(null); };

  const save = async () => {
    if (busy) return;
    setBusy(true); setError(null);
    try {
      const teamNumber = formTeam(form);
      if (teamNumber == null) throw new Error("Enter the team number.");
      // The team's id links the breakage to the team; with no signal it saves without one.
      const sameTeam = editing && editing.teamNumber === teamNumber;
      const teamUuid = sameTeam ? editing.teamUuid : await withTimeout(api.findTeamUuid(teamNumber), READ_LIMIT_MS).catch(() => null);
      const base = editing ?? { breakageId: crypto.randomUUID(), eventCode, reporter: await whoAmI(), createdAt: new Date().toISOString() };
      onSave(buildBreakage(form, base, teamUuid));
      setFlash(editing ? "Changes saved" : "Saved");
      setEditing(null); setForm(emptyBreakageForm());
      window.scrollTo(0, 0);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="form-screen">
      <h1>Breakage (ours or theirs)</h1>
      {editing && <p className="banner">Editing the breakage for {editing.teamNumber}, saved {savedAt(editing.createdAt)}.</p>}

      <Text label="Team #" value={form.teamNumber} numeric onChange={(v) => set({ teamNumber: v })} />
      <div className="pair">
        <Text label="Match # (blank = practice/pit)" value={form.matchNumber} numeric onChange={(v) => set({ matchNumber: v })} />
        <Choice label="Match type" value={form.matchType} options={["q", "p"]} labels={{ q: "Qualification", p: "Playoff" }}
          onChange={(v) => set({ matchType: v === "p" ? "p" : "q" })} />
      </div>
      <div className="pair">
        <Choice label="Phase" value={form.phase} options={PHASES} onChange={(v) => set({ phase: v })} />
        <Choice label="Field location" value={form.fieldLocation} options={FIELD_ZONES} onChange={(v) => set({ fieldLocation: v })} />
      </div>
      <div className="pair">
        <Text label="Mechanism" value={form.mechanism} placeholder="intake, launcher, drive…" onChange={(v) => set({ mechanism: v })} />
        <Text label="Component" value={form.component} placeholder="belt, servo horn…" onChange={(v) => set({ component: v })} />
      </div>
      <Choice label="Failure type" value={form.failureType} options={FAILURE_TYPES} onChange={(v) => set({ failureType: v })} />
      <Choice label="Severity" value={form.severity} options={SEVERITY_VALUES} labels={SEVERITY_LABELS} onChange={(v) => set({ severity: v })} />
      <Text label="Symptoms (what you saw)" value={form.symptoms} onChange={(v) => set({ symptoms: v })} />
      <Text label="Robot was doing…" value={form.actionBefore} onChange={(v) => set({ actionBefore: v })} />
      <div className="pair">
        <Choice label="Suspected cause" value={form.cause} options={CAUSES} onChange={(v) => set({ cause: v })} />
        <Choice label="Confidence" value={form.causeConfidence} options={CONFIDENCE} onChange={(v) => set({ causeConfidence: v })} />
      </div>
      <Stepper label="Seconds lost" value={form.lostSeconds} step={5} onChange={(v) => set({ lostSeconds: v })} />
      <Stepper label="Repair min" value={form.repairMinutes} step={5} onChange={(v) => set({ repairMinutes: v })} />
      <div className="trio">
        <YesNo label="Recovered" value={form.recovered} onChange={(v) => set({ recovered: v })} />
        <YesNo label="Seen before" value={form.happenedBefore} onChange={(v) => set({ happenedBefore: v })} />
        <Choice label="Recurrence" value={form.recurrence} options={RECURRENCE} onChange={(v) => set({ recurrence: v })} />
      </div>
      <Text label="Fix applied" value={form.fix} onChange={(v) => set({ fix: v })} />
      <Text label="Spare used" value={form.spareUsed} onChange={(v) => set({ spareUsed: v })} />
      <Text label="Evidence (photo name / video timestamp)" value={form.evidence} onChange={(v) => set({ evidence: v })} />

      {error && <p className="save-note error" role="alert">{error}</p>}
      <button type="button" className="save" disabled={busy} onClick={save}>{flash ? `${flash} ✓` : editing ? "Save changes" : "Save breakage"}</button>
      {editing && <button type="button" onClick={stopEdit}>Cancel editing</button>}

      <h2>Saved</h2>
      {failed && !waiting.length ? (
        <p>Couldn't load breakages. <button type="button" className="retry" onClick={() => { setFailed(false); setTries((t) => t + 1); }}>Retry</button></p>
      ) : !saved && !waiting.length ? (
        <p>Loading…</p>
      ) : !all.length ? (
        <p>None yet for this event.</p>
      ) : (
        <ul className="report-list">
          {all.map((b) => (
            <li key={b.breakageId}>
              <button type="button" className="report" aria-current={editing?.breakageId === b.breakageId || undefined} onClick={() => startEdit(b)}>
                <strong>{b.teamNumber}</strong>
                <span>{breakageMatch(b.matchKey)}</span>
                {waitingIds.has(b.breakageId) && <span className="tag">waiting</span>}
                <span className="meta">
                  {[b.component || b.mechanism, b.severity != null && `sev ${b.severity}`, b.reporter, savedAt(b.createdAt)].filter(Boolean).join(" · ")}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
