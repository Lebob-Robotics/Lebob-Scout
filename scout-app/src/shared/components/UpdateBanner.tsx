import { useEffect, useState } from "react";
import { CHECK_MS, RUNNING_VERSION, deployedVersion, isNewer } from "../updateCheck";

// A banner offering to reload once a newer version is deployed (the check is in updateCheck.ts).
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
