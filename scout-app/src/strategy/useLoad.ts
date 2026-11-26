import { useEffect, useState } from "react";
import { shortError, withTimeout } from "../sync";

const LIMIT_MS = 20_000;

export type Load<T> = { state: "loading" } | { state: "ok"; data: T } | { state: "failed"; why: string };

// One read, made again when `key` changes or on retry. Until the answer for the current key arrives it is loading.
export function useLoad<T>(key: string, get: () => Promise<T>): [Load<T>, () => void] {
  const [tries, setTries] = useState(0);
  const k = `${key}|${tries}`;
  const [last, setLast] = useState<{ k: string; load: Load<T> }>({ k: "", load: { state: "loading" } });
  useEffect(() => {
    let live = true;
    withTimeout(get(), LIMIT_MS).then(
      (data) => { if (live) setLast({ k, load: { state: "ok", data } }); },
      (e) => { if (live) setLast({ k, load: { state: "failed", why: shortError(e) } }); },
    );
    return () => { live = false; };
    // `get` is a new function every render; the key says when to read again.
  }, [k]); // eslint-disable-line react-hooks/exhaustive-deps
  return [last.k === k ? last.load : { state: "loading" }, () => setTries((t) => t + 1)];
}

