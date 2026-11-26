import { Suspense, lazy } from "react";
import type { StrategyApi } from "./api";

// The strategy app's code loads only at /strategy, so the scout app stays small.
const StrategyApp = lazy(() => import("./StrategyApp"));

export function StrategyRoot(props: { api: StrategyApi; ourTeam: number; signedOut?: boolean; onSignIn?: () => Promise<void> }) {
  return (
    <Suspense fallback={<div className="signin"><p>Loading…</p></div>}>
      <StrategyApp {...props} />
    </Suspense>
  );
}
