// Pit photos on the phone: shrunk before they are kept, and held in IndexedDB (localStorage is too small for them)
// until the report that carries them is sent. If IndexedDB is blocked they are kept in memory only, and `keeps` says so.

export const MAX_SIDE = 1600;
export const JPEG_QUALITY = 0.8;

// The size to draw a w by h picture at so its longest side is at most `max`. Never scales up.
export function fitSize(w: number, h: number, max = MAX_SIDE): { width: number; height: number } {
  const scale = Math.min(1, max / Math.max(w, h));
  return { width: Math.max(1, Math.round(w * scale)), height: Math.max(1, Math.round(h * scale)) };
}

// A JPEG copy of a picked image, longest side MAX_SIDE. Throws a message to show when the browser can't read it (HEIC on
// some browsers, or a file that isn't a picture).
export async function shrinkImage(file: File): Promise<Blob> {
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {
    throw new Error(`Couldn't read ${file.name || "that photo"}. Try taking it again, or use a JPEG or PNG.`);
  }
  try {
    const { width, height } = fitSize(bitmap.width, bitmap.height);
    const canvas = document.createElement("canvas");
    canvas.width = width; canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("no canvas");
    ctx.drawImage(bitmap, 0, 0, width, height);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", JPEG_QUALITY));
    if (!blob) throw new Error("no blob");
    return blob;
  } catch {
    throw new Error(`Couldn't shrink ${file.name || "that photo"}. Try another one.`);
  } finally {
    bitmap.close();
  }
}

const DB = "lsa-photos", STORE = "photos";
const open = () => new Promise<IDBDatabase>((resolve, reject) => {
  const req = indexedDB.open(DB, 1);
  req.onupgradeneeded = () => req.result.createObjectStore(STORE);
  req.onsuccess = () => resolve(req.result);
  req.onerror = () => reject(req.error);
});
const run = async <T,>(mode: IDBTransactionMode, f: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> => {
  const db = await open();
  try {
    return await new Promise<T>((resolve, reject) => {
      const req = f(db.transaction(STORE, mode).objectStore(STORE));
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  } finally {
    db.close();
  }
};


export function createPhotoStore() {
  const memory = new Map<string, Blob>(); // holds a photo IndexedDB would not take
  let ok = true;
  return {
    // False once a write to IndexedDB has failed: photos are then kept in memory and a reload loses them.
    get keeps() { return ok; },
    async put(id: string, blob: Blob) {
      try {
        await run("readwrite", (s) => s.put(blob, id));
      } catch {
        ok = false;
        memory.set(id, blob);
      }
    },
    async get(id: string): Promise<Blob | null> {
      const m = memory.get(id);
      if (m) return m;
      try {
        return (await run<Blob | undefined>("readonly", (s) => s.get(id))) ?? null;
      } catch {
        return null;
      }
    },
    async remove(ids: string[]) {
      for (const id of ids) {
        memory.delete(id);
        try { await run("readwrite", (s) => s.delete(id)); } catch { /* nothing kept to remove */ }
      }
    },
  };
}
export type PhotoStore = ReturnType<typeof createPhotoStore>;
export const photoStore = createPhotoStore();
