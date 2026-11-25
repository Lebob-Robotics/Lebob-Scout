import { createClient } from "@osdk/client";
import { createPublicOauthClient } from "@osdk/oauth";
import { $ontologyRid } from "@lebob-scout/sdk";

const url = import.meta.env.VITE_FOUNDRY_URL;

// auth.signIn() does the whole sign-in: refreshes a stored token, or finishes the /auth/callback return
// (then puts back the address the user started from), or sends the browser to Foundry's sign-in page.
export const auth = createPublicOauthClient(import.meta.env.VITE_FOUNDRY_CLIENT_ID, url, import.meta.env.VITE_FOUNDRY_REDIRECT_URL, {
  // The library's defaults plus api:admin-read, which getCurrent needs.
  scopes: ["api:read-data", "api:write-data", "api:use-ontologies-read", "api:use-ontologies-write", "api:admin-read"],
});

export const client = createClient(url, $ontologyRid, auth);
