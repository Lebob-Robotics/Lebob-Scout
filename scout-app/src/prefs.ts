// Per-phone choices kept in localStorage: the field view set-up starts with, and animations on or off.
const FLIP_KEY = "lsa:flip";
const MOTION_KEY = "lsa:motion";

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
