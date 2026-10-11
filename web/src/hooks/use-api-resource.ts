"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { ApiError } from "@/lib/api";

/** Keep loading, missing, and failure separate and ignore stale route responses. */
export function useApiResource<T>(loader: () => Promise<T>) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [missing, setMissing] = useState(false);
  const sequence = useRef(0);
  const reload = useCallback(async () => {
    const request = ++sequence.current;
    setLoading(true);
    setError(null);
    setMissing(false);
    try {
      const value = await loader();
      if (sequence.current === request) setData(value);
    } catch (error) {
      if (sequence.current !== request) return;
      if (error instanceof ApiError && error.status === 404) setMissing(true);
      else
        setError(
          error instanceof Error
            ? error.message
            : "This request failed. Please try again.",
        );
    } finally {
      if (sequence.current === request) setLoading(false);
    }
  }, [loader]);
  useEffect(() => {
    setData(null);
    void reload();
    return () => {
      sequence.current += 1;
    };
  }, [reload]);
  return { data, loading, error, missing, reload };
}
