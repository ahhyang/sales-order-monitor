import { NextResponse, type NextRequest } from "next/server";
import { buildUpstreamQuery } from "@/lib/query";
import type { OrdersListResponse } from "@/lib/types";
import { errorResponse, fetchUpstream } from "@/lib/upstream";

// GET /api/orders?page&pageSize&status&site&q&sort&order -> proxied list + summary
export async function GET(request: NextRequest) {
  const query = buildUpstreamQuery(request.nextUrl.searchParams);

  try {
    // Return only our own contract; drop upstream extras such as `links`, which expose the backend URL.
    const { summary, page, pageSize, total, totalPages, sort, order, data } =
      await fetchUpstream<OrdersListResponse>("", query);
    return NextResponse.json(
      { summary, page, pageSize, total, totalPages, sort, order, data },
      { headers: { "cache-control": "public, s-maxage=30, stale-while-revalidate=60" } },
    );
  } catch (err) {
    return errorResponse(err, "api/orders");
  }
}
