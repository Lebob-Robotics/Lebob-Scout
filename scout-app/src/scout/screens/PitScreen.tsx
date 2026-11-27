import { useEffect, useRef, useState } from "react";
import type { Api } from "../../shared/api";
import { Choice, Text, TeamPicker, YesNo } from "../components/FormFields";
import { NewPhoto, SavedPhoto } from "../../shared/components/PitPhotos";
import {
  ARCHETYPES, DRIVETRAINS, buildPit, emptyPitForm, formTeam, myPit, optionLabel, pitFormOf,
} from "../../shared/pitBreakage";
import type { PitForm, PitReport } from "../../shared/pitBreakage";
import { photoStore, shrinkImage } from "../../shared/photos";
import { READ_LIMIT_MS, withTimeout } from "../../shared/sync";
import { useEventLists } from "../useEventLists";
import { savedAt } from "../../shared/reportTime";

// A photo still on this phone: its id in the photo store and the address of its preview.
type Fresh = { id: string; url: string };
const photoCount = (p: PitReport) => (p.images ?? []).length + (p.photoIds ?? []).length;

// The Pit tab: the pit report form and this event's saved pit reports.
// Saving hands the report to App, which queues it; `waiting` are this phone's pit reports not yet sent.
// whoAmI gives the scout's name or throws a message to show. `initialTeam` fills the team number on opening.
// Photos: shrunk and kept in the photo store at once; the report lists their ids and sends them with it.
export function PitScreen({ api, eventUuid, eventCode, waiting, refresh, initialTeam, whoAmI, onSave }: {
  api: Api;
  eventUuid: string;
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
  const lists = useEventLists(api, eventUuid, false);
  // Photos on the report: ids of those already in Foundry, and those still on the phone.
  const [kept, setKept] = useState<string[]>([]);
  const [fresh, setFresh] = useState<Fresh[]>([]);
  const [adding, setAdding] = useState(false);
  const [photoNote, setPhotoNote] = useState<string | null>(null);
  const [offPhone, setOffPhone] = useState(false);
  // Photo ids added since the last save (deleted if never saved), and ones the scout removed from a waiting report
  // (deleted when the change is saved).
  const added = useRef(new Set<string>());
  const dropped = useRef(new Set<string>());
  const urls = useRef(new Set<string>());

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

  // Leaving the tab with photos never saved: let them go, and their previews.
  useEffect(() => {
    const keep = added.current, urlSet = urls.current;
    return () => {
      if (keep.size) void photoStore.remove([...keep]);
      urlSet.forEach((u) => URL.revokeObjectURL(u));
      urlSet.clear();
    };
  }, []);

  // This phone's waiting copies stand in for the server's, and show first.
  const waitingIds = new Set(waiting.map((p) => p.pitReportId));
  const all = [...waiting, ...(saved ?? []).filter((p) => !waitingIds.has(p.pitReportId))];
  const twin = myPit(all, formTeam(form), scout, eventCode, editing?.pitReportId);

  const preview = (blob: Blob) => { const url = URL.createObjectURL(blob); urls.current.add(url); return url; };
  const letGo = (url: string) => { URL.revokeObjectURL(url); urls.current.delete(url); };
  const clearPhotos = () => {
    fresh.forEach((f) => letGo(f.url));
    setKept([]); setFresh([]); setPhotoNote(null);
  };

  const set = (change: Partial<PitForm>) => { setForm((f) => ({ ...f, ...change })); setFlash(null); };
  const typedSomething = () => Object.values(form).some((v) => v !== "") || kept.length > 0 || fresh.length > 0;
  const startEdit = async (p: PitReport) => {
    if (editing?.pitReportId !== p.pitReportId && !editing && typedSomething() && !window.confirm("Replace what you typed with this report?")) return;
    // Photos added to the form we are leaving are never going to be saved.
    if (added.current.size) { void photoStore.remove([...added.current]); added.current.clear(); }
    dropped.current.clear();
    clearPhotos();
    setEditing(p); setForm(pitFormOf(p)); setError(null); setFlash(null);
    setKept([...(p.images ?? [])]);
    window.scrollTo(0, 0);
    // A waiting report's new photos are still on the phone: bring their previews back.
    const back: Fresh[] = [];
    for (const id of p.photoIds ?? []) {
      const blob = await photoStore.get(id);
      if (blob) back.push({ id, url: preview(blob) });
    }
    setFresh(back);
  };
  const stopEdit = () => {
    if (added.current.size) { void photoStore.remove([...added.current]); added.current.clear(); }
    dropped.current.clear();
    clearPhotos();
    setEditing(null); setForm(emptyPitForm()); setError(null);
  };

  const addPhotos = async (files: FileList | null) => {
    if (!files?.length) return;
    setAdding(true); setPhotoNote(null);
    const problems: string[] = [];
    for (const file of Array.from(files)) {
      try {
        const blob = await shrinkImage(file);
        const id = crypto.randomUUID();
        await photoStore.put(id, blob);
        added.current.add(id);
        setFresh((f) => [...f, { id, url: preview(blob) }]);
      } catch (e) {
        problems.push(e instanceof Error ? e.message : String(e));
      }
    }
    setOffPhone(!photoStore.keeps);
    setPhotoNote(problems.length ? problems.join(" ") : null);
    setAdding(false);
  };
  const removeKept = (id: string) => setKept((k) => k.filter((x) => x !== id));
  const removeFresh = (f: Fresh) => {
    letGo(f.url);
    setFresh((list) => list.filter((x) => x.id !== f.id));
    if (added.current.delete(f.id)) void photoStore.remove([f.id]);
    else dropped.current.add(f.id); // on a waiting report: gone for good once that report is changed
  };

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
      // Replacing a twin keeps the photos it had.
      const own = !editing && base ? base : null;
      const photos = {
        images: [...new Set([...(own?.images ?? []), ...kept])],
        photoIds: [...(own?.photoIds ?? []), ...fresh.map((f) => f.id)],
      };
      const p = buildPit(form, base ?? { pitReportId: crypto.randomUUID(), eventCode, scout: who, createdAt: new Date().toISOString() }, photos);
      onSave(p);
      if (dropped.current.size) void photoStore.remove([...dropped.current]);
      dropped.current.clear(); added.current.clear();
      clearPhotos();
      setEditing(null); setForm(emptyPitForm());
      setFlash(base ? "Changes saved" : "Saved");
      window.scrollTo(0, 0);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const total = kept.length + fresh.length;
  return (
    <div className="form-screen">
      <div className="card">
        <h2>Pit report</h2>
        {editing && <p className="banner">Editing the pit report for {editing.teamNumber}, saved {savedAt(editing.createdAt)}.</p>}
        {twin && (
          <div className="banner hint">
            <p>{editing ? `You already have a pit report for ${twin.teamNumber}. Pick another team, or edit that one instead.` : `You already pit-scouted ${twin.teamNumber}. Saving replaces that report.`}</p>
            {!editing && <button type="button" onClick={() => startEdit(twin)}>Edit that report</button>}
          </div>
        )}

        <TeamPicker value={form.teamNumber} onChange={(v) => set({ teamNumber: v })} teams={lists.teams} retry={lists.retry} />

        <div className="form-field">
          <span className="label">Photos of the robot{total ? ` (${total})` : ""}</span>
          {total > 0 && (
            <ul className="photos">
              {kept.map((id) => <SavedPhoto key={id} api={api} id={id} onRemove={() => removeKept(id)} />)}
              {fresh.map((f) => <NewPhoto key={f.id} url={f.url} onRemove={() => removeFresh(f)} />)}
            </ul>
          )}
          <label className={adding ? "photo-add busy" : "photo-add"}>
            {adding ? "Adding…" : total ? "Add more photos" : "Add photos"}
            <input type="file" accept="image/*" multiple disabled={adding}
              onChange={(e) => { const input = e.currentTarget; void addPhotos(input.files).then(() => { input.value = ""; }); }} />
          </label>
          {photoNote && <p className="save-note error" role="alert">{photoNote}</p>}
          {offPhone && <p className="caption keep">This phone can't keep photos for later. Keep this page open until the report has sent.</p>}
        </div>

        <div className="pair">
          <Choice label="Drivetrain" value={form.drivetrain} options={DRIVETRAINS} onChange={(v) => set({ drivetrain: v })} />
          <Choice label="Robot archetype" value={form.archetype} options={ARCHETYPES} onChange={(v) => set({ archetype: v })} />
        </div>
        <div className="trio">
          <YesNo label="HIVE" value={form.canHive} onChange={(v) => set({ canHive: v })} />
          <YesNo label="FLOWER" value={form.canFlower} onChange={(v) => set({ canFlower: v })} />
          <YesNo label="NECTAR" value={form.canNectar} onChange={(v) => set({ canNectar: v })} />
        </div>
        <div className="pair">
          <YesNo label="Floor intake" value={form.canFloorIntake} onChange={(v) => set({ canFloorIntake: v })} />
          <YesNo label="FLOWER intake" value={form.canFlowerIntake} onChange={(v) => set({ canFlowerIntake: v })} />
        </div>
        <Text label="Notes" value={form.notes} long onChange={(v) => set({ notes: v })} />

        {error && <p className="save-note error" role="alert">{error}</p>}
        <button type="button" className="save" disabled={busy || adding} onClick={save}>{flash ? `${flash} ✓` : editing ? "Save changes" : "Save pit report"}</button>
        {editing && <button type="button" onClick={stopEdit}>Cancel editing</button>}
      </div>

      <div className="card">
        <h2>Saved pit reports</h2>
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
                  <span className="meta">{[p.archetype && optionLabel(p.archetype), photoCount(p) > 0 && `${photoCount(p)} photo${photoCount(p) === 1 ? "" : "s"}`, p.scout, savedAt(p.createdAt)].filter(Boolean).join(" · ")}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
