import '../shared/themeStart'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@fontsource/ibm-plex-sans/latin-400.css'
import '@fontsource/ibm-plex-sans/latin-500.css'
import '@fontsource/ibm-plex-sans/latin-600.css'
import '@fontsource/ibm-plex-mono/latin-500.css'
import '../shared/app.css'
import StrategyApp from './StrategyApp'
import { createStrategyApi, sdkMapFunctions } from './api'
import type { StrategyApi } from './api'
import { OUR_TEAM } from './types'
import { createApi } from '../shared/api'
import { keepReturn, showUpdateBanner, signInFirst } from '../shared/boot'
import { client, isSignedOut, onSignedOutChange, signIn } from '../shared/client'

// The strategy app: strategy/index.html, a page of its own beside the scout app, sharing its sign-in.

// The page is strategy/index.html; /strategy/ reads better (and comes back here, through the scout page if the host
// answers it with that one).
if (location.pathname.endsWith('/index.html')) {
  history.replaceState(null, '', location.pathname.replace(/index\.html$/, '') + location.search + location.hash)
}

const params = new URLSearchParams(location.search)
const root = createRoot(document.getElementById('root')!)
showUpdateBanner()

const show = (api: StrategyApi, ourTeam: number, signedOut = false, onSignIn?: () => Promise<void>) =>
  root.render(<StrictMode><StrategyApp api={api} ourTeam={ourTeam} signedOut={signedOut} onSignIn={onSignIn} /></StrictMode>)

const showReal = () => {
  const api = createStrategyApi(client, createApi(client), sdkMapFunctions(client))
  const render = () => show(api, OUR_TEAM, isSignedOut(), signIn)
  onSignedOutChange(render)
  render()
}

// Development builds only: ?dev=1 uses the strategy app's made-up data, with team 12345 playing the part of us.
// With it, ?fail makes the model fail, ?failmaps makes the heatmaps and point splits fail, ?failteams makes the Teams tab fail,
// ?signedout shows the signed-out line, and ?signinfails makes its Sign in button fail.
if (import.meta.env.DEV && params.has('dev')) {
  import('./devApi').then(({ createDevStrategyApi, DEV_OUR_TEAM }) =>
    show(createDevStrategyApi({ failModel: params.has('fail'), failMaps: params.has('failmaps'), failTeams: params.has('failteams') }), DEV_OUR_TEAM,
      params.has('signedout'), () => new Promise((resolve, reject) => setTimeout(params.has('signinfails') ? reject : resolve, 1500))))
} else {
  // A sign-in that leaves for the login page comes back through the scout page, which sends the browser back here.
  keepReturn('/strategy/')
  signInFirst(root, showReal, showReal)
}
