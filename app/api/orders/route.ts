import { NextResponse, type NextRequest } from "next/server";
import { listOrders } from "@/lib/service";
import { errorResponse } from "@/lib/upstream";

// GET /api/orders?page&pageSize&status&site&q&sort&order&from&to&overdue -> list + summary
export async function GET(request: NextRequest) {
  try {
    const body = await listOrders(request.nextUrl.searchParams);
    return NextResponse.json(body, {
      headers: { "cache-control": "public, s-maxage=30, stale-while-revalidate=60" },
    });
  } catch (err) {
    return errorResponse(err, "api/orders");
  }
}
