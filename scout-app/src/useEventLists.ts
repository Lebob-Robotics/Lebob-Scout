import { useEffect, useState } from "react";
import type { Api, MatchRow, TeamOption } from "./api";
import { READ_LIMIT_MS, withTimeout } from "./sync";

export type ListLoad<T> = { state: "loading" } | { state: "ok"; data: T } | { state: "failed" };

// One list read for a form's dropdown: the event's teams, or its matches. A failure (no signal, no schedule yet) is
// not fatal: the form falls back to typed number boxes, and `retry` tries again.
function useList<T>(read: () => Promise<T>, key: string): [ListLoad<T>, () => void] {
  const [tries, setTries] = useState(0);
  const [load, setLoad] = useState<{ k: string; value: ListLoad<T> }>({ k: "", value: { state: "loading" } });
  const k = `${key}|${tries}`;
  useEffect(() => {
    let live = true;
    withTimeout(read(), READ_LIMIT_MS).then(
      (data) => live && setLoad({ k, value: { state: "ok", data } }),
      () => live && setLoad({ k, value: { state: "failed" } }),
    );
    return () => { live = false; };
    // `read` is a new function every render; the key and retries say when to read again.
  }, [k]); // eslint-disable-line react-hooks/exhaustive-deps
  return [load.k === k ? load.value : { state: "loading" }, () => setTries((t) => t + 1)];
}

// The event's teams and, when asked for, matches. An event with none listed counts as failed, so the typed boxes show.
export function useEventLists(api: Api, eventUuid: string, withMatches: boolean) {
  const [teams, retryTeams] = useList<TeamOption[]>(async () => {
    const t = await api.eventTeams(eventUuid);
    if (!t.length) throw new Error("No teams");
    return t;
  }, `teams|${eventUuid}`);
  const [matches, retryMatches] = useList<MatchRow[]>(async () => {
    if (!withMatches) return [];
    const m = await api.matches(eventUuid);
    if (!m.length) throw new Error("No matches");
    return m;
  }, `matches|${eventUuid}|${withMatches}`);
  return { teams, matches, retry: () => { retryTeams(); retryMatches(); } };
}
export type EventLists = ReturnType<typeof useEventLists>;
