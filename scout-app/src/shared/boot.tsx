import { createRoot, type Root } from "react-dom/client";
import { signIn } from "./client";
import { Header } from "./components/Header";
import { UpdateBanner } from "./components/UpdateBanner";

// How both apps start: the scout app (index.html, src/scout/main.tsx) and the strategy app (strategy/index.html,
// src/strategy/main.tsx) are separate pages on one site, with one Foundry sign-in between them.

// Sign-in always comes back to this address, which the scout page answers (a path the site has no file for gets
// index.html).
export const callbackPath = new URL(import.meta.env.VITE_FOUNDRY_REDIRECT_URL).pathname;

// The strategy app's page. A real file, so it is served as itself whatever the host does with /strategy/.
export const STRATEGY_PAGE = "/strategy/index.html";

// Where a sign-in started, to go back to once the callback is done: the strategy app keeps its address here, the
// scout app clears it. sessionStorage is shared by both pages in one tab.
const RETURN_KEY = "lsa:return-to";
export const keepReturn = (path: string | null) => {
  try {
    if (path) sessionStorage.setItem(RETURN_KEY, path);
    else sessionStorage.removeItem(RETURN_KEY);
  } catch { /* goes back to the scout app */ }
};
export const takeReturn = () => {
  try {
    const path = sessionStorage.getItem(RETURN_KEY);
    sessionStorage.removeItem(RETURN_KEY);
    return path || "/";
  } catch {
    return "/";
  }
};

// The update banner sits in its own root on top of the app, whatever screen it is on.
export function showUpdateBanner() {
  if (import.meta.env.DEV) return;
  const bar = document.body.appendChild(document.createElement("div"));
  createRoot(bar).render(<UpdateBanner />);
}

// The initial no-draft load: one signIn() attempt with its time limit. Once it fails or times out, signIn()
// guarantees nothing left over from it redirects, so "Continue without signing in" (onSkip) is safe.
export function signInFirst(root: Root, onSignedIn: () => void, onSkip: () => void) {
  root.render(<><Header /><div className="signin"><p>Signing in…</p></div></>);
  signIn().then(
    onSignedIn,
    () => root.render(
      <>
        <Header />
        <div className="signin">
          <p>Couldn't sign in to Foundry.</p>
          <button type="button" className="primary" onClick={() => signInFirst(root, onSignedIn, onSkip)}>Retry</button>
          <button type="button" onClick={onSkip}>Continue without signing in</button>
        </div>
      </>,
    ),
  );
}
