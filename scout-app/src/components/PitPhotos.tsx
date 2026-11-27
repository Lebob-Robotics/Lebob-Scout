import { useEffect, useState } from "react";
import type { Api } from "../api";

// A saved photo's picture, loaded once and shown as a thumbnail; the object URL is let go when it leaves the screen.
// `open` makes it a link to the full size, for reading rather than editing.
export function SavedPhoto({ api, id, open = false, onRemove }: {
  api: Pick<Api, "pitPhoto">; id: string; open?: boolean; onRemove?(): void;
}) {
  const [shown, setShown] = useState<{ url: string | null; failed: boolean }>({ url: null, failed: false });
  useEffect(() => {
    let live = true;
    let url: string | null = null;
    api.pitPhoto(id).then(
      (blob) => { url = URL.createObjectURL(blob); if (live) setShown({ url, failed: false }); else URL.revokeObjectURL(url); },
      () => live && setShown({ url: null, failed: true }),
    );
    return () => { live = false; if (url) URL.revokeObjectURL(url); };
  }, [api, id]);
  const img = shown.url
    ? <img src={shown.url} alt="Robot" />
    : <span className="photo-wait">{shown.failed ? "Photo unavailable" : "Loading…"}</span>;
  return (
    <li className="photo">
      {open && shown.url ? <a href={shown.url} target="_blank" rel="noreferrer" aria-label="Open the photo full size">{img}</a> : img}
      {onRemove && <button type="button" className="photo-x" aria-label="Remove this photo" onClick={onRemove}>×</button>}
    </li>
  );
}

// A photo still on this phone, waiting to be sent.
export function NewPhoto({ url, onRemove }: { url: string; onRemove(): void }) {
  return (
    <li className="photo">
      <img src={url} alt="Robot, not sent yet" />
      <button type="button" className="photo-x" aria-label="Remove this photo" onClick={onRemove}>×</button>
    </li>
  );
}

// A team's saved pit photos, each opening full size. Nothing shows when there are none or they can't be read.
export function PitPhotoList({ api, pitReportIds }: { api: Pick<Api, "pitPhoto" | "pitPhotoIds">; pitReportIds: string[] }) {
  const key = pitReportIds.join(",");
  const [ids, setIds] = useState<string[]>([]);
  useEffect(() => {
    let live = true;
    api.pitPhotoIds(key ? key.split(",") : []).then((got) => live && setIds(got), () => live && setIds([]));
    return () => { live = false; };
  }, [api, key]);
  if (!ids.length) return null;
  return (
    <>
      <h3>Photos ({ids.length})</h3>
      <ul className="photos">{ids.map((id) => <SavedPhoto key={id} api={api} id={id} open />)}</ul>
    </>
  );
}
