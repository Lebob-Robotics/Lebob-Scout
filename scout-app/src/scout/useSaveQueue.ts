import { useCallback, useEffect, useRef, useState } from "react";
import type { Api } from "../shared/api";
import type { Store } from "../shared/storage";
import { flush } from "../shared/sync";

// Sends waiting reports: on load, when the signal returns, and every 30 s while any wait.
// `saved` goes up whenever a report reaches the server, so the list can reload.
// The distinct last errors of the waiting reports, joined, or null.
const lastErrors = (store: Store) => [...new Set(store.pending().map((p) => p.lastError).filter(Boolean))].join("; ") || null;

export function useSaveQueue(api: Api, store: Store) {
  const [waiting, setWaiting] = useState(() => store.pending().length);
  const [lastError, setLastError] = useState(() => lastErrors(store));
  const [saved, setSaved] = useState(0);
  const busy = useRef(false);
  const again = useRef(false);

  const send = useCallback(function send() {
    if (busy.current) { again.current = true; return; } // never two flushes at once; run once more after this one
    busy.current = true;
    flush(api, store)
      .then((result) => {
        setWaiting(result.waiting);
        setLastError(lastErrors(store));
        if (result.saved) setSaved((n) => n + result.saved);
      })
      .catch(() => { /* reports stay queued; the next try sends them */ })
      .finally(() => {
        busy.current = false;
        if (again.current) { again.current = false; send(); }
      });
  }, [api, store]);

  useEffect(() => {
    send();
    window.addEventListener("online", send);
    return () => window.removeEventListener("online", send);
  }, [send]);

  useEffect(() => {
    if (!waiting) return;
    const id = setInterval(send, 30000);
    return () => clearInterval(id);
  }, [waiting, send]);

  // After Save: the new report shows as waiting before the network answers.
  const queued = () => { setWaiting(store.pending().length); send(); };

  return { waiting, lastError, saved, queued };
}
