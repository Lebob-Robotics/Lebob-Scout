import { useEffect, useState } from "react";
import type { Api } from "../api";
import { Choice, Stepper, Text, YesNo } from "../components/FormFields";
import {
  ARCHETYPES, DRIVETRAINS, START_POSITIONS, buildPit, emptyPitForm, formTeam, myPit, optionLabel, pitFormOf,
} from "../pitBreakage";
import type { PitForm, PitReport } from "../pitBreakage";
import { READ_LIMIT_MS, withTimeout } from "../sync";
import { savedAt } from "./reportTime";

// The Pit tab: the old site's pit form and this event's saved pit reports (old lines 368 to 380).
// Saving hands the report to App, which queues it; `waiting` are this phone's pit reports not yet sent.
// whoAmI gives the scout's name or throws a message to show. `initialTeam` fills the team number on opening.
export function PitScreen({ api, eventCode, waiting, refresh, initialTeam, whoAmI, onSave }: {
  api: Api;
  eventCode: string;
  waiting: PitReport[];
  refresh: number;
  initialTeam?: number;
  whoAmI(): Promise<string>;
  onSave(p: PitReport): void;
}) {
  const [saved, setSaved] = useState<PitReport[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [tries, setTries] = useState(0);
  const [form, setForm] = useState<PitForm>(() => emptyPitForm(initialTeam ? String(initialTeam) : ""));
  const [editing, setEditing] = useState<PitReport | null>(null);
  const [scout, setScout] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [flash, setFlash] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let live = true;
    withTimeout(api.pits(eventCode), READ_LIMIT_MS).then(
      (ps) => { if (live) { setSaved(ps); setFailed(false); } },
      () => live && setFailed(true),
    );
    return () => { live = false; };
  }, [api, eventCode, refresh, tries]);

  // Who this phone's scout is, for the "you already pit-scouted" hint; quietly empty until known.
  useEffect(() => { whoAmI().then(setScout, () => {}); }, [whoAmI]);

  // This phone's waiting copies stand in for the server's, and show first.
  const waitingIds = new Set(waiting.map((p) => p.pitReportId));
  const all = [...waiting, ...(saved ?? []).filter((p) => !waitingIds.has(p.pitReportId))];
  const twin = myPit(all, formTeam(form), scout, eventCode, editing?.pitReportId);

  const set = (change: Partial<PitForm>) => { setForm((f) => ({ ...f, ...change })); setFlash(null); };
  const typedSomething = () => Object.values(form).some((v) => v !== "");
  const startEdit = (p: PitReport) => {
    if (editing?.pitReportId !== p.pitReportId && !editing && typedSomething() && !window.confirm("Replace what you typed with this report?")) return;
    setEditing(p); setForm(pitFormOf(p)); setError(null); setFlash(null);
    window.scrollTo(0, 0);
  };
  const stopEdit = () => { setEditing(null); setForm(emptyPitForm()); setError(null); };

  const save = async () => {
    if (busy) return;
    setBusy(true); setError(null);
    try {
      if (editing && twin) { setError(`You already have a pit report for ${twin.teamNumber}. Edit that one instead.`); return; }
      let base: PitReport | null = editing;
      if (!base && twin) {
        if (!window.confirm(`You already pit-scouted ${twin.teamNumber} (${savedAt(twin.createdAt)}). You get one pit report per team. Replace it with this one?`)) return;
        base = twin;
      }
      const who = base ? base.scout : await whoAmI();
      const p = buildPit(form, base ?? { pitReportId: crypto.randomUUID(), eventCode, scout: who, createdAt: new Date().toISOString() });
      onSave(p);
      setEditing(null); setForm(emptyPitForm());
      setFlash(base ? "Changes saved" : "Saved");
      window.scrollTo(0, 0);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="form-screen">
      <h1>Pit scouting</h1>
      {editing && <p className="banner">Editing the pit report for {editing.teamNumber}, saved {savedAt(editing.createdAt)}.</p>}
      {twin && (
        <div className="banner hint">
          <p>{editing ? `You already have a pit report for ${twin.teamNumber}. Pick another team, or edit that one instead.` : `You already pit-scouted ${twin.teamNumber}. Saving replaces that report.`}</p>
          {!editing && <button type="button" onClick={() => startEdit(twin)}>Edit that report</button>}
        </div>
      )}

      <div className="pair">
        <Text label="Team #" value={form.teamNumber} numeric onChange={(v) => set({ teamNumber: v })} />
        <Choice label="Drivetrain" value={form.drivetrain} options={DRIVETRAINS} onChange={(v) => set({ drivetrain: v })} />
      </div>
      <Choice label="Robot archetype" value={form.archetype} options={ARCHETYPES} onChange={(v) => set({ archetype: v })} />
      <div className="trio">
        <YesNo label="HIVE" value={form.canHive} onChange={(v) => set({ canHive: v })} />
        <YesNo label="FLOWER" value={form.canFlower} onChange={(v) => set({ canFlower: v })} />
        <YesNo label="NECTAR" value={form.canNectar} onChange={(v) => set({ canNectar: v })} />
      </div>
      <div className="trio">
        <YesNo label="Floor intake" value={form.canFloorIntake} onChange={(v) => set({ canFloorIntake: v })} />
        <YesNo label="FLOWER intake" value={form.canFlowerIntake} onChange={(v) => set({ canFlowerIntake: v })} />
        <YesNo label="Plays defence" value={form.canDefend} onChange={(v) => set({ canDefend: v })} />
      </div>
      <div className="pair">
        <YesNo label="AUTO leave" value={form.autoLeave} onChange={(v) => set({ autoLeave: v })} />
        <YesNo label="AUTO park" value={form.autoPark} onChange={(v) => set({ autoPark: v })} />
      </div>
      <Stepper label="AUTO TIPS claimed" value={form.autoTipsClaimed} step={0.5} onChange={(v) => set({ autoTipsClaimed: v })} />
      <Stepper label="Claimed TIPS / match" value={form.claimedTipsPerMatch} step={0.5} onChange={(v) => set({ claimedTipsPerMatch: v })} />
      <Text label="AUTO routines they have" value={form.autoRoutines} placeholder="e.g. 4-ball near, park-only" onChange={(v) => set({ autoRoutines: v })} />
      <Choice label="Preferred start" value={form.preferredStart} options={START_POSITIONS} onChange={(v) => set({ preferredStart: v })} />
      <Stepper label="Claimed cycle (s)" value={form.claimedCycleSeconds} step={1} onChange={(v) => set({ claimedCycleSeconds: v })} />
      <Stepper label="Height (in)" value={form.heightInches} step={1} onChange={(v) => set({ heightInches: v })} />
      <Stepper label="Weight (kg)" value={form.weightKg} step={0.5} onChange={(v) => set({ weightKg: v })} />
      <Text label="Known issues" value={form.knownIssues} onChange={(v) => set({ knownIssues: v })} />
      <Text label="Notes" value={form.notes} long onChange={(v) => set({ notes: v })} />

      {error && <p className="save-note error" role="alert">{error}</p>}
      <button type="button" className="save" disabled={busy} onClick={save}>{flash ? `${flash} ✓` : editing ? "Save changes" : "Save pit report"}</button>
      {editing && <button type="button" onClick={stopEdit}>Cancel editing</button>}

      <h2>Saved</h2>
      {failed && !waiting.length ? (
        <p>Couldn't load pit reports. <button type="button" className="retry" onClick={() => { setFailed(false); setTries((t) => t + 1); }}>Retry</button></p>
      ) : !saved && !waiting.length ? (
        <p>Loading…</p>
      ) : !all.length ? (
        <p>None yet for this event.</p>
      ) : (
        <ul className="report-list">
          {all.map((p) => (
            <li key={p.pitReportId}>
              <button type="button" className="report" aria-current={editing?.pitReportId === p.pitReportId || undefined} onClick={() => startEdit(p)}>
                <strong>{p.teamNumber}</strong>
                {waitingIds.has(p.pitReportId) && <span className="tag">waiting</span>}
                <span className="meta">{[p.archetype && optionLabel(p.archetype), p.scout, savedAt(p.createdAt)].filter(Boolean).join(" · ")}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
