import { useSyncExternalStore } from "react";

function subscribe(cb: () => void) {
  document.addEventListener("visibilitychange", cb);
  return () => document.removeEventListener("visibilitychange", cb);
}

function getSnapshot() {
  return !document.hidden;
}

export function usePageVisible(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, () => true);
}
