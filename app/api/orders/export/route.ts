import { type NextRequest } from "next/server";
import { exportCsv } from "@/lib/service";
import { errorResponse } from "@/lib/upstream";

// GET /api/orders/export?<same filters as the list>&sort&order -> CSV download of every matching order
export async function GET(request: NextRequest) {
  try {
    const { csv, rows, today } = await exportCsv(request.nextUrl.searchParams);
    return new Response(csv, {
      headers: {
        "content-type": "text/csv; charset=utf-8",
        "content-disposition": `attachment; filename="sales-orders-${today}.csv"`,
        "x-row-count": String(rows),
        "cache-control": "private, no-store",
      },
    });
  } catch (err) {
    return errorResponse(err, "api/orders/export");
  }
}
