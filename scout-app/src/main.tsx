import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './app.css'
import App from './App.tsx'
import { createApi } from './api'
import type { Api } from './api'
import { createDevApi } from './devApi'
import { auth, client } from './client'

const params = new URLSearchParams(location.search)
const root = createRoot(document.getElementById('root')!)
const show = (api: Api) => root.render(<StrictMode><App api={api} /></StrictMode>)

// Sign-in only touches the OAuth library's own storage keys, so a draft under lsa: survives the redirect.
function signIn() {
  root.render(<p>Signing in…</p>)
  auth.signIn().then(
    () => {
      if (location.pathname === new URL(import.meta.env.VITE_FOUNDRY_REDIRECT_URL).pathname) history.replaceState(null, '', '/')
      show(createApi(client))
    },
    () => root.render(<><p>Couldn't sign in to Foundry.</p><button type="button" onClick={signIn}>Retry</button></>),
  )
}

// Development builds only: ?dev=1 uses made-up data instead of Foundry.
// With it, ?fail makes the schedule fail, ?failsave makes corrections fail, ?failcreate makes saving a new report fail.
if (import.meta.env.DEV && params.has('dev')) {
  show(createDevApi({ failSchedule: params.has('fail'), failSave: params.has('failsave'), failCreate: params.has('failcreate') }))
} else {
  signIn()
}
