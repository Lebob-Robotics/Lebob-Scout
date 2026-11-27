// Imported first by main.tsx, so the kept look is on the page before anything else runs or renders.
// Both apps share these choices, so they are applied here rather than in either app.
import { applyMotion, applyNotes } from "./prefs";
import { startTheme } from "./theme";

startTheme();
applyMotion();
applyNotes();
