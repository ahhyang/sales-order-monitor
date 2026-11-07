import { NextResponse, type NextRequest } from "next/server";
import { createRateLimiter } from "@/lib/rateLimit";

// Next.js proxy (formerly "middleware"): rate-limits the API routes before they reach the upstream ERP.
const apiLimit = createRateLimiter({ limit: Number(process.env.RATE_LIMIT_PER_MIN) || 120, windowMs: 60_000 });
// Exports read the whole dataset, so they get a tighter budget.
const exportLimit = createRateLimiter({ limit: Number(process.env.EXPORT_LIMIT_PER_MIN) || 10, windowMs: 60_000 });

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (pathname === "/api/health") return NextResponse.next(); // never block the uptime monitor

  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || request.headers.get("x-real-ip") || "unknown";
  const isExport = pathname === "/api/orders/export";
  const result = (isExport ? exportLimit : apiLimit)(ip);

  if (!result.ok) {
    return NextResponse.json(
      { error: "Too many requests — please wait a moment and try again." },
      { status: 429, headers: { "retry-after": String(result.retryAfterSec), "cache-control": "no-store" } },
    );
  }
  return NextResponse.next();
}

export const config = { matcher: "/api/:path*" };
