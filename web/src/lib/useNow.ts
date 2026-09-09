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
 * Bucketed to the minute because the only consumer renders relative-day labels;
 * an unbucketed snapshot would return a new value on every call and loop.
 */
function subscribe(onStoreChange: () => void) {
  const id = setInterval(onStoreChange, MINUTE);
  return () => clearInterval(id);
}

function getSnapshot() {
  return Math.floor(Date.now() / MINUTE) * MINUTE;
}

function getServerSnapshot() {
  // Rendered only after data loads on the client; 0 signals "not yet known".
  return 0;
}

export function useNow(): number {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
