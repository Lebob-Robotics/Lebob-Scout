import { useEffect, useId, useState } from "react";
import type { Api } from "../api";
import { Choice, PickField, Text, TeamPicker } from "../components/FormFields";
import {
  FAILURE_TYPES, SEVERITY, breakageFormOf, breakageMatch, buildBreakage, emptyBreakageForm, formMatchValue, formTeam,
  matchFromValue, matchOptionLabel, matchValue,
} from "../pitBreakage";
import type { BreakageForm, BreakageReport } from "../pitBreakage";
import { READ_LIMIT_MS, withTimeout } from "../sync";
import { useEventLists } from "../useEventLists";
import { savedAt } from "./reportTime";

const SEVERITY_VALUES = SEVERITY.map(([n]) => String(n));
const SEVERITY_LABELS = Object.fromEntries(SEVERITY.map(([n, l]) => [String(n), l]));

// The Breakage tab: the breakage form (ours or theirs) and this event's saved breakages.
// As many breakages per team as needed. Saving hands the report to App, which queues it.
export function BreakageScreen({ api, eventUuid, eventCode, waiting, refresh, initialTeam, whoAmI, onSave }: {
  api: Api;
  eventUuid: string;
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
  const notesId = useId();
  const lists = useEventLists(api, eventUuid, true);

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
      if (teamNumber == null) throw new Error("Choose the team.");
      // The team's id links the breakage to the team: from the team list if it loaded, else looked up; with no signal it saves without one.
      const sameTeam = editing && editing.teamNumber === teamNumber;
      const listed = lists.teams.state === "ok" ? lists.teams.data.find((t) => t.teamNumber === teamNumber)?.teamUuid : undefined;
      const teamUuid = sameTeam ? editing.teamUuid : listed ?? await withTimeout(api.findTeamUuid(teamNumber), READ_LIMIT_MS).catch(() => null);
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

  // The match dropdown: pit or practice first, then the qualifications and the playoffs. A match already chosen that the
  // schedule doesn't list (an old report's) stays in the list.
  const matchItems = () => {
    if (lists.matches.state !== "ok") return [];
    const sorted = [...lists.matches.data].sort((a, b) => Number(a.matchType === "playoff") - Number(b.matchType === "playoff") || a.matchNumber - b.matchNumber);
    const items = [
      { value: "", label: "Pit / practice (no match)" },
      ...sorted.map((m) => ({ value: matchValue(m.matchType === "playoff" ? "p" : "q", m.matchNumber), label: matchOptionLabel(m) })),
    ];
    const now = formMatchValue(form);
    if (now && !items.some((it) => it.value === now)) items.push({ value: now, label: `${now[0].toUpperCase()}${now.slice(1)}` });
    return items;
  };

  return (
    <div className="form-screen">
      <div className="card">
        <h2>Breakage (ours or theirs)</h2>
        {editing && <p className="banner">Editing the breakage for {editing.teamNumber}, saved {savedAt(editing.createdAt)}.</p>}

        <div className="pair">
          <TeamPicker value={form.teamNumber} onChange={(v) => set({ teamNumber: v })} teams={lists.teams} retry={lists.retry} />
          {lists.matches.state === "ok" ? (
            <PickField label="Match" value={formMatchValue(form)} items={matchItems()} onChange={(v) => set(matchFromValue(v))} placeholder="Pit / practice (no match)" />
          ) : lists.matches.state === "loading" ? (
            <div className="form-field"><span className="label">Match</span><p className="caption keep">Loading matches…</p></div>
          ) : (
            <Text label="Match # (blank = practice/pit)" value={form.matchNumber} numeric onChange={(v) => set({ matchNumber: v })} />
          )}
        </div>
        {lists.matches.state === "failed" && (
          <Choice label="Match type" value={form.matchType} options={["q", "p"]} labels={{ q: "Qualification", p: "Playoff" }}
            onChange={(v) => set({ matchType: v === "p" ? "p" : "q" })} />
        )}
        <div className="pair">
          <Text label="Mechanism" value={form.mechanism} placeholder="intake, launcher, drive…" onChange={(v) => set({ mechanism: v })} />
          <Text label="Component" value={form.component} placeholder="belt, servo horn…" onChange={(v) => set({ component: v })} />
        </div>
        <Choice label="Failure type" value={form.failureType} options={FAILURE_TYPES} onChange={(v) => set({ failureType: v })} />
        <Choice label="Severity" value={form.severity} options={SEVERITY_VALUES} labels={SEVERITY_LABELS} onChange={(v) => set({ severity: v })} />

        <div className="form-field">
          <label htmlFor={notesId}>Notes</label>
          <div className="notehelp" id={`${notesId}-help`}>
            <p className="caption">Write about:</p>
            <ul className="notelist">
              <li>how bad it was (severity)</li>
              <li>what you saw (the symptoms)</li>
              <li>what the robot was doing</li>
              <li>what caused it</li>
              <li>anything else</li>
            </ul>
          </div>
          <textarea id={notesId} aria-describedby={`${notesId}-help`} value={form.notes} onChange={(e) => set({ notes: e.target.value })} />
        </div>

        {error && <p className="save-note error" role="alert">{error}</p>}
        <button type="button" className="save" disabled={busy} onClick={save}>{flash ? `${flash} ✓` : editing ? "Save changes" : "Save breakage"}</button>
        {editing && <button type="button" onClick={stopEdit}>Cancel editing</button>}
      </div>

      <div className="card">
        <h2>Saved breakages</h2>
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
    </div>
  );
}
