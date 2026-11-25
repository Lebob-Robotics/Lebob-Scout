import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@fontsource/ibm-plex-sans/latin-400.css'
import '@fontsource/ibm-plex-sans/latin-500.css'
import '@fontsource/ibm-plex-sans/latin-600.css'
import '@fontsource/ibm-plex-mono/latin-500.css'
import './app.css'
import App from './App.tsx'
import { createApi } from './api'
import { Header } from './components/Header'
import type { Api } from './api'
import { createDevApi } from './devApi'
import { client, isSignedOut, onSignedOutChange, refreshSilently, signIn } from './client'
import { createStore } from './storage'

// Rule: the app never sends the browser to the login page by itself while a match is in progress,
// and never needs the network to show a match that is in progress. Only signIn() redirects.
const params = new URLSearchParams(location.search)
const root = createRoot(document.getElementById('root')!)
const callbackPath = new URL(import.meta.env.VITE_FOUNDRY_REDIRECT_URL).pathname

const showApp = (api: Api, signedOut = false, onSignIn?: () => Promise<void>) =>
  root.render(<StrictMode><App api={api} signedOut={signedOut} onSignIn={onSignIn} /></StrictMode>)

function showReal() {
  const api = createApi(client)
  const render = () => showApp(api, isSignedOut(), signIn)
  onSignedOutChange(render)
  render()
}

// The initial no-draft load: one signIn() attempt with its time limit. Once it fails or times out,
// signIn() guarantees nothing left over from it redirects, so "Continue without signing in" is safe.
function signInFirst() {
  root.render(<><Header /><div className="signin"><p>Signing in…</p></div></>)
  signIn().then(
    () => {
      if (location.pathname === callbackPath) history.replaceState(null, '', '/')
      showReal()
    },
    () => root.render(
      <>
        <Header />
        <div className="signin">
          <p>Couldn't sign in to Foundry.</p>
          <button type="button" className="primary" onClick={signInFirst}>Retry</button>
          <button type="button" onClick={showReal}>Continue without signing in</button>
        </div>
      </>,
    ),
  )
}

// Development builds only: ?dev=1 uses made-up data instead of Foundry.
// With it, ?fail makes the schedule fail, ?failsave makes corrections fail, ?failcreate makes saving a new report fail, ?failteams makes the Teams tab fail,
// ?signedout shows the signed-out line, and ?signinfails makes its Sign in button fail.
if (import.meta.env.DEV && params.has('dev')) {
  showApp(createDevApi({ failSchedule: params.has('fail'), failSave: params.has('failsave'), failCreate: params.has('failcreate'), failTeams: params.has('failteams') }), params.has('signedout'), () => new Promise((resolve, reject) => setTimeout(params.has('signinfails') ? reject : resolve, 1500)))
} else if (createStore().loadDraft() && location.pathname !== callbackPath) {
  // A match is in progress: show it now, and get a token in the background without redirecting.
  showReal()
  refreshSilently().catch(() => {})
} else {
  signInFirst()
}
