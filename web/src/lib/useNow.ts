"use client";

import { useSyncExternalStore } from "react";

const MINUTE = 60_000;

/**
 * Current time, safe to read during render.
 *
 * `Date.now()` called directly in a component body is an impure read: it can
 * return a different value on every render, which breaks React's assumption
 * that rendering is deterministic. Reading it through an external store fixes
 * that -- the snapshot is stable within a render pass, and React re-renders
 * when it changes.
 *
 * Bucketed to the requested resolution (a minute by default for relative dates).
 * Countdown consumers can request seconds without changing date consumers.
 */
function subscribe(onStoreChange: () => void, resolution: number) {
  const id = setInterval(onStoreChange, resolution);
  return () => clearInterval(id);
}

function getSnapshot(resolution: number) {
  return Math.floor(Date.now() / resolution) * resolution;
}

function getServerSnapshot() {
  // Rendered only after data loads on the client; 0 signals "not yet known".
  return 0;
}

export function useNow(resolution = MINUTE): number {
  return useSyncExternalStore(
    (onStoreChange) => subscribe(onStoreChange, resolution),
    () => getSnapshot(resolution),
    getServerSnapshot,
  );
}
