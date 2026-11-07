import { NextResponse, type NextRequest } from "next/server";
import { getInsights } from "@/lib/service";
import { errorResponse } from "@/lib/upstream";

// GET /api/insights?q&status&site&from&to&overdue -> overdue aging, value by branch, monthly trend
export async function GET(request: NextRequest) {
  try {
    const body = await getInsights(request.nextUrl.searchParams);
    return NextResponse.json(body, {
      headers: { "cache-control": "public, s-maxage=30, stale-while-revalidate=60" },
    });
  } catch (err) {
    return errorResponse(err, "api/insights");
  }
}
