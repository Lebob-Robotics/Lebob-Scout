import { useSyncExternalStore } from "react";

// Whether the browser thinks it has a network. It can say yes on Wi-Fi with no internet;
// the save queue's last error covers that case.
const subscribe = (change: () => void) => {
  window.addEventListener("online", change);
  window.addEventListener("offline", change);
  return () => {
    window.removeEventListener("online", change);
    window.removeEventListener("offline", change);
  };
};

export const useOnline = () => useSyncExternalStore(subscribe, () => navigator.onLine, () => true);
