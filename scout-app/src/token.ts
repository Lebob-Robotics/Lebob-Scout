import type { PublicOauthClient } from "@osdk/oauth";

// Makes the token function API calls use. It never leaves the page: the current token, else a silent refresh,
// else it rejects "signed out". auth.refresh only uses a stored refresh token; the login redirect lives in
// auth.signIn, which this never calls.
// - Callers that arrive while a refresh is running share it: parallel grants with one refresh token can make the
//   losers fail, and a failed refresh makes the library delete the stored refresh token.
// - Offline it doesn't try: a refresh that fails for lack of signal would delete the refresh token and force a
//   re-login. That is "signed out for now" and is not reported, since the scout is not really signed out.
export function tokenSource(
  a: Pick<PublicOauthClient, "getTokenOrUndefined" | "refresh">,
  report: (signedOut: boolean) => void,
  online = () => navigator.onLine,
): () => Promise<string> {
  let pending: Promise<string | undefined> | undefined;
  return async () => {
    let token = a.getTokenOrUndefined();
    if (!token) {
      if (!online()) throw new Error("signed out for now");
      pending ??= a.refresh().then((t) => t?.access_token, () => undefined).finally(() => { pending = undefined; });
      token = await pending;
    }
    report(!token);
    if (!token) throw new Error("signed out");
    return token;
  };
}
