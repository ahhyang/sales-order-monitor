import { NextResponse } from "next/server";
import { fetchUpstream } from "@/lib/upstream";

// GET /api/health -> 200 when the app can reach the sales order API, 503 otherwise.
// Polled by the scheduled GitHub Actions uptime check (.github/workflows/uptime.yml).
export async function GET() {
  const started = Date.now();
  let upstream: { ok: boolean; latencyMs: number; error?: string };
  try {
    await fetchUpstream("/meta", undefined, { fresh: true });
    upstream = { ok: true, latencyMs: Date.now() - started };
  } catch (err) {
    upstream = { ok: false, latencyMs: Date.now() - started, error: err instanceof Error ? err.message : "unknown" };
  }

  return NextResponse.json(
    {
      status: upstream.ok ? "ok" : "degraded",
      upstream,
      region: process.env.VERCEL_REGION ?? "local",
      commit: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? "local",
      time: new Date().toISOString(),
    },
    { status: upstream.ok ? 200 : 503, headers: { "cache-control": "no-store" } },
  );
}
