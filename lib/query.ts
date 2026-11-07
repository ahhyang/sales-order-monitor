// Turns untrusted browser query params into a clean, allow-listed query for the upstream API.
// Shared by the API route (server) and covered by unit tests.

export const SORT_FIELDS = [
  "SalesId",
  "CreatedDateTime1",
  "HAR_TotalSOAmount",
  "SalesStatus",
  "InventSiteId",
] as const;

export type SortField = (typeof SORT_FIELDS)[number];

export const PAGE_SIZES = [10, 25, 50, 100] as const;
export const DEFAULT_PAGE_SIZE = 25;
export const MAX_PAGE_SIZE = 100;
const MAX_TEXT_LENGTH = 100;

function toInt(value: string | null, fallback: number, min: number, max: number): number {
  const n = Number.parseInt(value ?? "", 10);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(Math.max(n, min), max);
}

function cleanText(value: string | null): string {
  // Collapse whitespace and strip control characters; cap length so a pasted blob can't hit upstream.
  return (value ?? "")
    .replace(/[\u0000-\u001f\u007f]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, MAX_TEXT_LENGTH);
}

export function buildUpstreamQuery(input: URLSearchParams): URLSearchParams {
  const out = new URLSearchParams();

  out.set("page", String(toInt(input.get("page"), 1, 1, 100_000)));
  out.set("pageSize", String(toInt(input.get("pageSize"), DEFAULT_PAGE_SIZE, 1, MAX_PAGE_SIZE)));

  for (const key of ["status", "site", "q"] as const) {
    const value = cleanText(input.get(key));
    if (value) out.set(key, value);
  }

  const sort = input.get("sort");
  if (sort && (SORT_FIELDS as readonly string[]).includes(sort)) {
    out.set("sort", sort);
    out.set("order", input.get("order") === "desc" ? "desc" : "asc");
  }

  return out;
}

// SalesIds look like SO-MOCK-00001; reject anything that could change the upstream path.
export function isValidSalesId(id: string): boolean {
  return /^[A-Za-z0-9-]{1,40}$/.test(id);
}
