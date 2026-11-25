import { createClient } from "@osdk/client";
import { createPublicOauthClient } from "@osdk/oauth";
import { $ontologyRid } from "@lebob-scout/sdk";
import { tokenWithoutRedirect } from "./token";

const url = import.meta.env.VITE_FOUNDRY_URL;

const auth = createPublicOauthClient(import.meta.env.VITE_FOUNDRY_CLIENT_ID, url, import.meta.env.VITE_FOUNDRY_REDIRECT_URL, {
  // useHistory: a refresh that lands on /auth/callback goes back with history.replaceState, never location.assign.
  useHistory: true,
  // The library's defaults plus api:admin-read, which getCurrent needs.
  scopes: ["api:read-data", "api:write-data", "api:use-ontologies-read", "api:use-ontologies-write", "api:admin-read"],
});

let signedOut = false;
const listeners = new Set<() => void>();
const setSignedOut = (v: boolean) => {
  if (v === signedOut) return;
  signedOut = v;
  listeners.forEach((f) => f());
};
export const isSignedOut = () => signedOut;
export const onSignedOutChange = (f: () => void) => { listeners.add(f); };

export const refreshSilently = () => tokenWithoutRedirect(auth, setSignedOut);

// The only thing that may send the browser to Foundry's login page. It also finishes the /auth/callback return,
// then puts back the address the user started from. It touches only the library's own storage keys.
export const signIn = async () => {
  // Never send the browser to a login page it can't reach: offline, this rejects and the caller offers to carry on.
  await fetch(url, { mode: "no-cors", cache: "no-store" });
  await auth.signIn();
  setSignedOut(false);
};

export const client = createClient(url, $ontologyRid, refreshSilently);
