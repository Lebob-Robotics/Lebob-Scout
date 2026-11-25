import type { PublicOauthClient } from "@osdk/oauth";

// Hands API calls a token without ever leaving the page: the current one, else a silent refresh, else "signed out".
// auth.refresh only uses a stored refresh token; the login redirect lives in auth.signIn, which this never calls.
export async function tokenWithoutRedirect(a: Pick<PublicOauthClient, "getTokenOrUndefined" | "refresh">, report: (signedOut: boolean) => void): Promise<string> {
  let token = a.getTokenOrUndefined();
  if (!token) {
    try { token = (await a.refresh())?.access_token; } catch { /* no usable refresh token */ }
  }
  report(!token);
  if (!token) throw new Error("signed out");
  return token;
}
