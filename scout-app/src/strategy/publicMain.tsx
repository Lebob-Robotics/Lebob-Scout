// The public strategy page at lebob.com.au/strategy: the strategy app as it is, reading the static copy of our data
// that scripts/export-public.mjs writes (scout names blanked), with no sign-in. Built by vite.public.config.ts.
import '../shared/themeStart'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@fontsource/ibm-plex-sans/latin-400.css'
import '@fontsource/ibm-plex-sans/latin-500.css'
import '@fontsource/ibm-plex-sans/latin-600.css'
import '@fontsource/ibm-plex-mono/latin-500.css'
import '../shared/app.css'
import StrategyApp from './StrategyApp'
import { createPublicStrategyApi } from './publicApi'
import { OUR_TEAM } from './types'

createRoot(document.getElementById('root')!).render(
  <StrictMode><StrategyApp api={createPublicStrategyApi(`${import.meta.env.BASE_URL}data/`)} ourTeam={OUR_TEAM} /></StrictMode>,
)
