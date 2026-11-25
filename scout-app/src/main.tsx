import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './app.css'
import App from './App.tsx'
import { createDevApi } from './devApi'

// A later task swaps in the real server here.
// ?fail makes the schedule fail, ?failsave makes corrections fail, ?failcreate makes saving a new report fail.
const params = new URLSearchParams(location.search)
const api = createDevApi({ failSchedule: params.has('fail'), failSave: params.has('failsave'), failCreate: params.has('failcreate') })

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App api={api} />
  </StrictMode>,
)
