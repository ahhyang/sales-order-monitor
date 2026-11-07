import "server-only";
import { NextResponse } from "next/server";

// Server-side client for the mock API. The access key lives in an env var and never reaches the browser.

const DEFAULT_BASE_URL = "https://hiring.harrisons.my/api/mock/sales-orders";
const TIMEOUT_MS = 10_000;

export class UpstreamError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message);
  }
}

export async function fetchUpstream<T>(path: string, query?: URLSearchParams): Promise<T> {
  const key = process.env.SALES_API_KEY;
  if (!key) throw new UpstreamError("Server is missing SALES_API_KEY configuration.", 500);

  const base = process.env.SALES_API_BASE_URL ?? DEFAULT_BASE_URL;
  const url = `${base}${path}${query && query.size ? `?${query}` : ""}`;

  let res: Response;
  try {
    res = await fetch(url, {
      headers: { "x-assessment-key": key, accept: "application/json" },
      signal: AbortSignal.timeout(TIMEOUT_MS),
      // Fixture data changes rarely; a short cache keeps the UI snappy and spares the upstream.
      next: { revalidate: 30 },
    });
  } catch (err) {
    const timedOut = err instanceof Error && err.name === "TimeoutError";
    throw new UpstreamError(
      timedOut ? "The sales order service timed out." : "Could not reach the sales order service.",
      timedOut ? 504 : 502,
    );
  }

  if (res.status === 404) throw new UpstreamError("Order not found.", 404);
  if (res.status === 401 || res.status === 403) {
    throw new UpstreamError("The sales order service rejected our credentials.", 502);
  }
  if (!res.ok) throw new UpstreamError(`Sales order service returned ${res.status}.`, 502);

  try {
    return (await res.json()) as T;
  } catch {
    throw new UpstreamError("Sales order service returned an invalid response.", 502);
  }
}

// Shared by the route handlers so every endpoint fails the same way: JSON `{ error }`, logged if it's on us.
export function errorResponse(err: unknown, route: string): NextResponse {
  const status = err instanceof UpstreamError ? err.status : 500;
  const message = err instanceof UpstreamError ? err.message : "Unexpected server error.";
  if (status >= 500) console.error(`[${route}]`, err);
  return NextResponse.json({ error: message }, { status, headers: { "cache-control": "no-store" } });
}
