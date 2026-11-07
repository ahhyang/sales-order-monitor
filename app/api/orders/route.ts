import { NextResponse, type NextRequest } from "next/server";
import { buildUpstreamQuery } from "@/lib/query";
import type { OrdersListResponse } from "@/lib/types";
import { fetchUpstream, UpstreamError } from "@/lib/upstream";

// GET /api/orders?page&pageSize&status&site&q&sort&order -> proxied list + summary
export async function GET(request: NextRequest) {
  const query = buildUpstreamQuery(request.nextUrl.searchParams);

  try {
    const body = await fetchUpstream<OrdersListResponse>("", query);
    return NextResponse.json(body, {
      headers: { "cache-control": "public, s-maxage=30, stale-while-revalidate=60" },
    });
  } catch (err) {
    const status = err instanceof UpstreamError ? err.status : 500;
    const message = err instanceof UpstreamError ? err.message : "Unexpected server error.";
    if (status >= 500) console.error("[api/orders]", err);
    return NextResponse.json({ error: message }, { status });
  }
}
