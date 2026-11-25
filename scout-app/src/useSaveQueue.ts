import { useCallback, useEffect, useRef, useState } from "react";
import type { Api } from "./api";
import type { Store } from "./storage";
import { flush } from "./sync";

// Sends waiting reports: on load, when the signal returns, and every 30 s while any wait.
// `saved` goes up whenever a report reaches the server, so the list can reload.
export function useSaveQueue(api: Api, store: Store) {
  const [waiting, setWaiting] = useState(() => store.pending().length);
  const [saved, setSaved] = useState(0);
  const busy = useRef(false);

  const send = useCallback(() => {
    if (busy.current) return; // never two flushes at once
    busy.current = true;
    flush(api, store)
      .then((result) => {
        setWaiting(result.waiting);
        if (result.saved) setSaved((n) => n + result.saved);
      })
      .finally(() => { busy.current = false; });
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

  return { waiting, saved, queued };
}
