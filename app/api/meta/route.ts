import { NextResponse } from "next/server";
import type { MetaResponse } from "@/lib/types";
import { fetchUpstream, UpstreamError } from "@/lib/upstream";

// GET /api/meta -> status and site facets, so filter options come from the API rather than hard-coded lists
export async function GET() {
  try {
    const { facets } = await fetchUpstream<MetaResponse>("/meta");
    return NextResponse.json(
      { facets },
      { headers: { "cache-control": "public, s-maxage=300, stale-while-revalidate=600" } },
    );
  } catch (err) {
    const status = err instanceof UpstreamError ? err.status : 500;
    const message = err instanceof UpstreamError ? err.message : "Unexpected server error.";
    if (status >= 500) console.error("[api/meta]", err);
    return NextResponse.json({ error: message }, { status });
  }
}
