import '../shared/themeStart'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@fontsource/ibm-plex-sans/latin-400.css'
import '@fontsource/ibm-plex-sans/latin-500.css'
import '@fontsource/ibm-plex-sans/latin-600.css'
import '@fontsource/ibm-plex-mono/latin-500.css'
import '../shared/app.css'
import App from './App.tsx'
import { createApi } from '../shared/api'
import type { Api } from '../shared/api'
import { STRATEGY_PAGE, callbackPath, keepReturn, showUpdateBanner, signInFirst, takeReturn } from '../shared/boot'
import { createDevApi } from '../shared/devApi'
import { client, isSignedOut, onSignedOutChange, refreshSilently, signIn } from '../shared/client'
import { createStore } from '../shared/storage'

// The scout app: index.html. The strategy app is a page of its own (strategy/index.html, src/strategy/main.tsx).

// Rule: the app never sends the browser to the login page by itself while a match is in progress,
// and never needs the network to show a match that is in progress. Only signIn() redirects.
function start() {
  const params = new URLSearchParams(location.search)
  const root = createRoot(document.getElementById('root')!)
  showUpdateBanner()

  const showApp = (api: Api, signedOut = false, onSignIn?: () => Promise<void>) =>
    root.render(<StrictMode><App api={api} signedOut={signedOut} onSignIn={onSignIn} /></StrictMode>)

  const showReal = () => {
    const api = createApi(client)
    const render = () => showApp(api, isSignedOut(), signIn)
    onSignedOutChange(render)
    render()
  }

  // Back from the login page: to the strategy app if it started the sign-in, else tidy the address and carry on.
  const signedIn = () => {
    if (location.pathname === callbackPath) {
      const to = takeReturn()
      if (to.startsWith('/strategy')) {
        location.replace(STRATEGY_PAGE)
        return
      }
      history.replaceState(null, '', to)
    }
    showReal()
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
    if (location.pathname !== callbackPath) keepReturn(null)
    signInFirst(root, signedIn, showReal)
  }
}

// An address under /strategy that the site answered with this page (it has no file there, or kept an old link) goes
// to the strategy app's own page.
if (location.pathname.startsWith('/strategy') && location.pathname !== STRATEGY_PAGE) {
  location.replace(STRATEGY_PAGE + location.search + location.hash)
} else {
  start()
}
