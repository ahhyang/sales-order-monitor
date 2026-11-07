"use client";

import { useCallback, useEffect, useState } from "react";

interface Result<T> {
  key: string;
  data?: T;
  error?: string;
}

/**
 * Fetches JSON from our own API routes. `url` is the cache key: when it changes the previous
 * request is aborted, so a slow response can never overwrite a newer one. The last good data is
 * kept while the next request is in flight so the UI can dim it instead of flashing a skeleton.
 */
export function useApi<T>(url: string | null) {
  const [nonce, setNonce] = useState(0);
  const [result, setResult] = useState<Result<T> | null>(null);
  const [lastData, setLastData] = useState<T | undefined>(undefined);
  const key = url ? `${url}#${nonce}` : "";

  useEffect(() => {
    if (!url) return;
    const controller = new AbortController();

    fetch(url, { signal: controller.signal, headers: { accept: "application/json" } })
      .then(async (res) => {
        const body = await res.json().catch(() => null);
        if (!res.ok) {
          const message = body && typeof body.error === "string" ? body.error : `Request failed (${res.status}).`;
          throw new Error(message);
        }
        return body as T;
      })
      .then((data) => {
        setResult({ key, data });
        setLastData(data);
      })
      .catch((err: unknown) => {
        if (controller.signal.aborted) return;
        const offline = typeof navigator !== "undefined" && !navigator.onLine;
        const message =
          offline ? "You appear to be offline." : err instanceof Error ? err.message : "Something went wrong.";
        setResult({ key, error: message });
      });

    return () => controller.abort();
  }, [url, key]);

  const retry = useCallback(() => setNonce((n) => n + 1), []);
  const settled = result?.key === key;

  return {
    data: settled ? result.data : undefined,
    staleData: lastData,
    error: settled ? result.error : undefined,
    loading: !!url && !settled,
    retry,
  };
}
