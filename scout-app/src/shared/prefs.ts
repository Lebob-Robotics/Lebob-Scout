// Per-phone choices kept in localStorage: the field view set-up starts with, animations on or off, and help notes on or off.
const FLIP_KEY = "lsa:flip";
const MOTION_KEY = "lsa:motion";
const NOTES_KEY = "lsa:notes";

export const rememberedFlip = () => {
  try { return localStorage.getItem(FLIP_KEY) === "1"; } catch { return false; }
};
export const rememberFlip = (flipped: boolean) => {
  try { localStorage.setItem(FLIP_KEY, flipped ? "1" : "0"); } catch { /* not remembered */ }
};

// Off sets data-motion="off" on the page, which app.css reads.
export const motionOn = () => {
  try { return localStorage.getItem(MOTION_KEY) !== "off"; } catch { return true; }
};
export const setMotion = (on: boolean) => {
  try { localStorage.setItem(MOTION_KEY, on ? "on" : "off"); } catch { /* this page load only */ }
  document.documentElement.dataset.motion = on ? "on" : "off";
};
export const applyMotion = () => { document.documentElement.dataset.motion = motionOn() ? "on" : "off"; };

// Off sets data-notes="off" on the page; app.css then hides the grey help text (not warnings or status, which carry .keep).
export const notesOn = () => {
  try { return localStorage.getItem(NOTES_KEY) !== "off"; } catch { return true; }
};
export const setNotes = (on: boolean) => {
  try { localStorage.setItem(NOTES_KEY, on ? "on" : "off"); } catch { /* this page load only */ }
  document.documentElement.dataset.notes = on ? "on" : "off";
};
export const applyNotes = () => { document.documentElement.dataset.notes = notesOn() ? "on" : "off"; };
