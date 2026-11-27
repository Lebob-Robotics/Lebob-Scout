// The public strategy page at lebob.com.au/strategy: the strategy app as it is, reading the static copy of our data
// that scripts/export-public.mjs writes (scout names blanked), with no sign-in. Built by vite.public.config.ts.
import './themeStart'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@fontsource/ibm-plex-sans/latin-400.css'
import '@fontsource/ibm-plex-sans/latin-500.css'
import '@fontsource/ibm-plex-sans/latin-600.css'
import '@fontsource/ibm-plex-mono/latin-500.css'
import './app.css'
import { createPublicStrategyApi } from './strategy/publicApi'
import { StrategyRoot } from './strategy/StrategyRoot'
import { OUR_TEAM } from './strategy/types'

createRoot(document.getElementById('root')!).render(
  <StrictMode><StrategyRoot api={createPublicStrategyApi(`${import.meta.env.BASE_URL}data/`)} ourTeam={OUR_TEAM} /></StrictMode>,
)
