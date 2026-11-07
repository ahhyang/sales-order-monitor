import { NextResponse } from "next/server";
import { isValidSalesId } from "@/lib/query";
import type { SalesOrder } from "@/lib/types";
import { errorResponse, fetchUpstream } from "@/lib/upstream";

// GET /api/orders/:id -> proxied single order
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!isValidSalesId(id)) {
    return NextResponse.json({ error: "Invalid order number." }, { status: 400 });
  }

  try {
    const { data } = await fetchUpstream<{ data: SalesOrder }>(`/${encodeURIComponent(id)}`);
    return NextResponse.json(
      { data },
      { headers: { "cache-control": "public, s-maxage=30, stale-while-revalidate=60" } },
    );
  } catch (err) {
    return errorResponse(err, "api/orders/:id");
  }
}
