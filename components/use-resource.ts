"use client";

import { useCallback, useEffect, useState } from "react";

export function useResource<T>(url: string) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const reload = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch(url, { cache: "no-store" });
      const result = await response.json() as T & { error?: string };
      if (!response.ok) throw new Error(result.error ?? "Could not load this information.");
      setData(result);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not load this information.");
    } finally {
      setLoading(false);
    }
  }, [url]);

  useEffect(() => {
    let active = true;
    (async () => {
      setLoading(true);
      setError("");
      try {
        const response = await fetch(url, { cache: "no-store" });
        const result = await response.json() as T & { error?: string };
        if (!response.ok) throw new Error(result.error ?? "Could not load this information.");
        if (active) setData(result);
      } catch (caught) {
        if (active) setError(caught instanceof Error ? caught.message : "Could not load this information.");
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, [url]);

  return { data, loading, error, reload };
}
