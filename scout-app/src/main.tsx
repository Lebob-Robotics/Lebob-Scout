import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './app.css'
import App from './App.tsx'
import { createApi } from './api'
import type { Api } from './api'
import { createDevApi } from './devApi'
import { client, isSignedOut, onSignedOutChange, refreshSilently, signIn } from './client'
import { createStore } from './storage'

// Rule: the app never sends the browser to the login page by itself while a match is in progress,
// and never needs the network to show a match that is in progress. Only signIn() redirects.
const params = new URLSearchParams(location.search)
const root = createRoot(document.getElementById('root')!)
const callbackPath = new URL(import.meta.env.VITE_FOUNDRY_REDIRECT_URL).pathname
const SIGN_IN_LIMIT_MS = 10_000

const showApp = (api: Api, signedOut = false, onSignIn?: () => void) =>
  root.render(<StrictMode><App api={api} signedOut={signedOut} onSignIn={onSignIn} /></StrictMode>)

function showReal() {
  const api = createApi(client)
  const render = () => showApp(api, isSignedOut(), () => { signIn().catch(() => {}) })
  onSignedOutChange(render)
  render()
}

function signInFirst() {
  root.render(<p>Signing in…</p>)
  let timer: ReturnType<typeof setTimeout> | undefined
  const limit = new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new Error('Timed out')), SIGN_IN_LIMIT_MS) })
  // Silent refresh first, so a slow refresh can't fall through to a login redirect after the limit has passed
  // and the scout has carried on. signIn() then only finishes a callback or redirects straight away.
  const attempt = refreshSilently().catch(() => signIn())
  Promise.race([attempt, limit]).finally(() => clearTimeout(timer)).then(
    () => {
      if (location.pathname === callbackPath) history.replaceState(null, '', '/')
      showReal()
    },
    () => root.render(
      <>
        <p>Couldn't sign in to Foundry.</p>
        <button type="button" onClick={signInFirst}>Retry</button>
        <button type="button" onClick={showReal}>Continue without signing in</button>
      </>,
    ),
  )
}

// Development builds only: ?dev=1 uses made-up data instead of Foundry.
// With it, ?fail makes the schedule fail, ?failsave makes corrections fail, ?failcreate makes saving a new report fail,
// and ?signedout shows the signed-out line.
if (import.meta.env.DEV && params.has('dev')) {
  showApp(createDevApi({ failSchedule: params.has('fail'), failSave: params.has('failsave'), failCreate: params.has('failcreate') }), params.has('signedout'), () => {})
} else if (createStore().loadDraft() && location.pathname !== callbackPath) {
  // A match is in progress: show it now, and get a token in the background without redirecting.
  showReal()
  refreshSilently().catch(() => {})
} else {
  signInFirst()
}
