import { createClient } from "@osdk/client";
import { createPublicOauthClient } from "@osdk/oauth";
import { $ontologyRid } from "@lebob-scout/sdk";
import { tokenSource } from "./token";

const url = import.meta.env.VITE_FOUNDRY_URL;
export const SIGN_IN_LIMIT_MS = 10_000;

const auth = createPublicOauthClient(import.meta.env.VITE_FOUNDRY_CLIENT_ID, url, import.meta.env.VITE_FOUNDRY_REDIRECT_URL, {
  // useHistory: a refresh that lands on /auth/callback goes back with history.replaceState, never location.assign.
  useHistory: true,
  // The library's defaults plus api:admin-read, which getCurrent needs.
  scopes: ["api:read-data", "api:write-data", "api:use-ontologies-read", "api:use-ontologies-write", "api:admin-read"],
});

// The library sets its own refresh timer on every sign-in and refresh. It bypasses tokenSource's offline check and
// shared refresh, and a failed refresh deletes the stored sign-in. Clear it each time (this listener runs after the
// library's own); tokenSource refreshes on the first call after the token expires. rmTimeout is missing from the types.
const stopLibraryTimer = () => (auth as typeof auth & { rmTimeout(): void }).rmTimeout();
auth.addEventListener("signIn", stopLibraryTimer);
auth.addEventListener("refresh", stopLibraryTimer);

let signedOut = false;
const listeners = new Set<() => void>();
const setSignedOut = (v: boolean) => {
  if (v === signedOut) return;
  signedOut = v;
  listeners.forEach((f) => f());
};
export const isSignedOut = () => signedOut;
export const onSignedOutChange = (f: () => void) => { listeners.add(f); };

export const refreshSilently = tokenSource(auth, setSignedOut);

// RULE: a redirect to Foundry's login page happens only as the direct result of a tap on a sign-in button,
// or during the initial no-draft load before its time limit. Both go through signIn() below, and the one
// auth.signIn() call in the app is guarded so that nothing from an attempt can redirect once its limit has passed.
//
// Why the guard is enough: auth.signIn() first retries the stored refresh token, then finishes a callback,
// then redirects. It is only reached after refreshSilently() has failed, and a failed refresh makes the library
// delete the stored refresh token. So once inside, the step before the redirect needs no network
// (a callback exchange never redirects: it returns, or it throws).
//
// signIn() resolves when the user is signed in without leaving the page (a refresh worked, or a callback finished),
// and rejects on failure, offline, or after SIGN_IN_LIMIT_MS.
export function signIn(): Promise<void> {
  let live = true;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const limit = new Promise<never>((_, reject) => {
    timer = setTimeout(() => { live = false; reject(new Error("Timed out")); }, SIGN_IN_LIMIT_MS);
  });
  const attempt = (async () => {
    try { await refreshSilently(); return; } catch { /* no token; may need the login page */ }
    if (!navigator.onLine) throw new Error("offline");
    // Never send the browser to a login page it can't reach. HEAD so a redirect to the login page has no body to
    // download (browsers refuse redirect: "manual" with mode: "no-cors").
    await fetch(url, { method: "HEAD", mode: "no-cors", cache: "no-store", signal: AbortSignal.timeout(SIGN_IN_LIMIT_MS) });
    if (!live) throw new Error("Timed out"); // too late: this attempt must not redirect any more
    await auth.signIn();
    setSignedOut(false);
  })();
  return Promise.race([attempt, limit]).finally(() => { live = false; clearTimeout(timer); });
}

export const client = createClient(url, $ontologyRid, refreshSilently);
