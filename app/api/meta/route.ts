import { NextResponse } from "next/server";
import type { MetaResponse } from "@/lib/types";
import { errorResponse, fetchUpstream } from "@/lib/upstream";

// GET /api/meta -> status and site facets, so filter options come from the API rather than hard-coded lists
export async function GET() {
  try {
    const { facets } = await fetchUpstream<MetaResponse>("/meta");
    return NextResponse.json(
      { facets },
      { headers: { "cache-control": "public, s-maxage=300, stale-while-revalidate=600" } },
    );
  } catch (err) {
    return errorResponse(err, "api/meta");
  }
}
