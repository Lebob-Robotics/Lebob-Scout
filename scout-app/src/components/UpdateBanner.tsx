import { useEffect, useState } from "react";

// The version this page was built as (git describe at build time, the same number the site is deployed as).
declare const __APP_VERSION__: string;
export const RUNNING_VERSION = typeof __APP_VERSION__ === "string" ? __APP_VERSION__ : "dev";

// Every build writes version.json next to the app (vite.config.ts). Both apps read it every 15 minutes and whenever
// the app comes back on screen; when the deployed version is not the one running, a banner offers to reload, as the
// old site's did. Reloading keeps an unsaved match (drafts are stored), but the banner still says to finish first.
export const CHECK_MS = 15 * 60 * 1000;

export async function deployedVersion(fetchFn: typeof fetch = fetch): Promise<string | null> {
  try {
    const r = await fetchFn(`/version.json?t=${Date.now()}`, { cache: "no-store" });
    if (!r.ok) return null;
    const v = (await r.json())?.version;
    return typeof v === "string" && v ? v : null;
  } catch {
    return null; // offline, signed out, or no version.json: say nothing
  }
}

export const isNewer = (running: string, deployed: string | null) => deployed != null && running !== "dev" && deployed !== running;

export function UpdateBanner({ running = RUNNING_VERSION }: { running?: string }) {
  const [next, setNext] = useState<string | null>(null);
  useEffect(() => {
    if (running === "dev") return;
    let gone = false;
    const check = () => { deployedVersion().then((v) => { if (!gone && isNewer(running, v)) setNext(v); }); };
    const onShow = () => { if (document.visibilityState === "visible") check(); };
    check();
    const timer = setInterval(check, CHECK_MS);
    document.addEventListener("visibilitychange", onShow);
    window.addEventListener("focus", check);
    return () => {
      gone = true;
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onShow);
      window.removeEventListener("focus", check);
    };
  }, [running]);
  if (!next) return null;
  return (
    <button type="button" className="primary update-banner" onClick={() => location.reload()}>
      New version {next}: tap to update (finish and save a match first)
    </button>
  );
}
