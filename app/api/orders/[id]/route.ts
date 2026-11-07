import { NextResponse } from "next/server";
import { isValidSalesId } from "@/lib/query";
import type { SalesOrder } from "@/lib/types";
import { fetchUpstream, UpstreamError } from "@/lib/upstream";

// GET /api/orders/:id -> proxied single order
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!isValidSalesId(id)) {
    return NextResponse.json({ error: "Invalid order number." }, { status: 400 });
  }

  try {
    const body = await fetchUpstream<{ data: SalesOrder }>(`/${encodeURIComponent(id)}`);
    return NextResponse.json(body, {
      headers: { "cache-control": "public, s-maxage=30, stale-while-revalidate=60" },
    });
  } catch (err) {
    const status = err instanceof UpstreamError ? err.status : 500;
    const message = err instanceof UpstreamError ? err.message : "Unexpected server error.";
    if (status >= 500) console.error("[api/orders/:id]", err);
    return NextResponse.json({ error: message }, { status });
  }
}
