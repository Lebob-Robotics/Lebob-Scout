import './themeStart'
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
import type { StrategyApi } from './strategy/api'
import { StrategyRoot } from './strategy/StrategyRoot'
import { OUR_TEAM } from './strategy/types'

// Rule: the app never sends the browser to the login page by itself while a match is in progress,
// and never needs the network to show a match that is in progress. Only signIn() redirects.
const params = new URLSearchParams(location.search)
const root = createRoot(document.getElementById('root')!)
const callbackPath = new URL(import.meta.env.VITE_FOUNDRY_REDIRECT_URL).pathname

// The strategy app lives at /strategy on the same site; its code loads only there.
// Sign-in always comes back to the callback address, so where it started is kept to go back to.
const onStrategy = () => location.pathname.startsWith('/strategy')
const RETURN_KEY = 'lsa:return-to'
const keepReturn = () => {
  try {
    if (onStrategy()) sessionStorage.setItem(RETURN_KEY, location.pathname)
    else if (location.pathname !== callbackPath) sessionStorage.removeItem(RETURN_KEY)
  } catch { /* goes back to the scout app */ }
}
const takeReturn = () => {
  try {
    const path = sessionStorage.getItem(RETURN_KEY)
    sessionStorage.removeItem(RETURN_KEY)
    return path || '/'
  } catch {
    return '/'
  }
}

const showStrategy = (api: StrategyApi, ourTeam: number, signedOut = false, onSignIn?: () => Promise<void>) =>
  root.render(
    <StrictMode><StrategyRoot api={api} ourTeam={ourTeam} signedOut={signedOut} onSignIn={onSignIn} /></StrictMode>,
  )

const showApp = (api: Api, signedOut = false, onSignIn?: () => Promise<void>) =>
  root.render(<StrictMode><App api={api} signedOut={signedOut} onSignIn={onSignIn} /></StrictMode>)

function showReal() {
  if (onStrategy()) {
    import('./strategy/api').then(({ createStrategyApi, sdkMapFunctions }) => {
      const api = createStrategyApi(client, createApi(client), sdkMapFunctions(client))
      const render = () => showStrategy(api, OUR_TEAM, isSignedOut(), signIn)
      onSignedOutChange(render)
      render()
    })
    return
  }
  const api = createApi(client)
  const render = () => showApp(api, isSignedOut(), signIn)
  onSignedOutChange(render)
  render()
}

// The initial no-draft load: one signIn() attempt with its time limit. Once it fails or times out,
// signIn() guarantees nothing left over from it redirects, so "Continue without signing in" is safe.
function signInFirst() {
  keepReturn()
  root.render(<><Header /><div className="signin"><p>Signing in…</p></div></>)
  signIn().then(
    () => {
      if (location.pathname === callbackPath) history.replaceState(null, '', takeReturn())
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
// On /strategy, ?dev=1 uses the strategy app's made-up data, with team 12345 playing the part of us.
// With it, ?fail makes the model fail, ?failmaps makes the heatmaps and point splits fail, ?failteams makes the Teams tab fail.
if (import.meta.env.DEV && params.has('dev') && onStrategy()) {
  import('./strategy/devApi').then(({ createDevStrategyApi, DEV_OUR_TEAM }) =>
    showStrategy(createDevStrategyApi({ failModel: params.has('fail'), failMaps: params.has('failmaps'), failTeams: params.has('failteams') }), DEV_OUR_TEAM,
      params.has('signedout'), () => new Promise((resolve, reject) => setTimeout(params.has('signinfails') ? reject : resolve, 1500))))
} else if (import.meta.env.DEV && params.has('dev')) {
  showApp(createDevApi({ failSchedule: params.has('fail'), failSave: params.has('failsave'), failCreate: params.has('failcreate'), failTeams: params.has('failteams') }), params.has('signedout'), () => new Promise((resolve, reject) => setTimeout(params.has('signinfails') ? reject : resolve, 1500)))
} else if (createStore().loadDraft() && location.pathname !== callbackPath) {
  // A match is in progress: show it now, and get a token in the background without redirecting.
  showReal()
  refreshSilently().catch(() => {})
} else {
  signInFirst()
}
