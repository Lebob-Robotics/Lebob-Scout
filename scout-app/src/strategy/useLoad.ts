import { useEffect, useState } from "react";
import { shortError, withTimeout } from "../sync";

const LIMIT_MS = 20_000;

export type Load<T> = { state: "loading" } | { state: "ok"; data: T } | { state: "failed"; why: string };

// One read, made again when `key` changes, on retry, or when `tick` goes up (a refresh). A new key loads from
// scratch; a retry or refresh of the same key keeps the figures on screen until the new ones arrive, and keeps them
// if the new read fails.
export function useLoad<T>(key: string, get: () => Promise<T>, tick = 0): [Load<T>, () => void] {
  const [tries, setTries] = useState(0);
  const k = `${key}|${tries}|${tick}`;
  const [last, setLast] = useState<{ key: string; k: string; load: Load<T> }>({ key: "", k: "", load: { state: "loading" } });
  useEffect(() => {
    let live = true;
    withTimeout(get(), LIMIT_MS).then(
      (data) => { if (live) setLast({ key, k, load: { state: "ok", data } }); },
      (e) => {
        if (!live) return;
        setLast((l) => (l.key === key && l.load.state === "ok" ? { ...l, k } : { key, k, load: { state: "failed", why: shortError(e) } }));
      },
    );
    return () => { live = false; };
    // `get` is a new function every render; the key, retries and ticks say when to read again.
  }, [k]); // eslint-disable-line react-hooks/exhaustive-deps
  const shown: Load<T> = last.k === k || (last.key === key && last.load.state === "ok") ? last.load : { state: "loading" };
  return [shown, () => setTries((t) => t + 1)];
}
