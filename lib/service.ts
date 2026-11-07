import "server-only";
import { buildInsights, matchesFilters, sortOrders, summarize, toCsv, todayInSabah, type OrderFilters } from "./orders";
import { buildUpstreamQuery, needsDataset, parseExtraFilters, SORT_FIELDS, type SortField } from "./query";
import type { Facet, MetaResponse, OrdersListResponse, SalesOrder } from "./types";
import { fetchUpstream } from "./upstream";

// Business logic behind the route handlers and the server-rendered first page.

const MAX_PAGES = 50; // safety cap: 5,000 orders at 100 per page

/**
 * Every order, read through the API in pages of 100 (the API's maximum). Each page fetch is cached for 30 s,
 * so repeated date/overdue/chart/export requests reuse the same data. For a real ERP this should be replaced
 * by API-side date filters and aggregate endpoints rather than reading the whole table.
 */
export async function getAllOrders(): Promise<SalesOrder[]> {
  const page = (n: number) =>
    fetchUpstream<OrdersListResponse>("", new URLSearchParams({ page: String(n), pageSize: "100", sort: "SalesId" }));
  const first = await page(1);
  const pages = Math.min(first.totalPages, MAX_PAGES);
  const rest = await Promise.all(Array.from({ length: pages - 1 }, (_, i) => page(i + 2)));
  return [first, ...rest].flatMap((p) => p.data);
}

function filtersFrom(params: URLSearchParams): OrderFilters {
  const clean = buildUpstreamQuery(params); // reuse the same trimming/allow-listing as the pass-through path
  return {
    q: clean.get("q") ?? undefined,
    status: clean.get("status") ?? undefined,
    site: clean.get("site") ?? undefined,
    ...parseExtraFilters(params),
  };
}

async function filteredOrders(params: URLSearchParams) {
  const all = await getAllOrders();
  const today = todayInSabah();
  const f = filtersFrom(params);
  return { all, today, matches: all.filter((o) => matchesFilters(o, f, today)) };
}

function sortFrom(params: URLSearchParams): { sort: SortField; order: "asc" | "desc" } {
  const s = params.get("sort");
  return {
    sort: s && (SORT_FIELDS as readonly string[]).includes(s) ? (s as SortField) : "SalesId",
    order: params.get("order") === "desc" ? "desc" : "asc",
  };
}

/** List + summary. Passes straight through to the API unless a date/overdue filter needs the full dataset. */
export async function listOrders(params: URLSearchParams): Promise<OrdersListResponse> {
  const upstreamQuery = buildUpstreamQuery(params);

  if (!needsDataset(params)) {
    const { summary, page, pageSize, total, totalPages, sort, order, data } =
      await fetchUpstream<OrdersListResponse>("", upstreamQuery);
    return { summary, page, pageSize, total, totalPages, sort, order, data };
  }

  const { all, matches } = await filteredOrders(params);
  const { sort, order } = sortFrom(params);
  const page = Number(upstreamQuery.get("page"));
  const pageSize = Number(upstreamQuery.get("pageSize"));
  const sorted = sortOrders(matches, sort, order);
  return {
    summary: summarize(all, matches.length),
    page,
    pageSize,
    total: matches.length,
    totalPages: Math.max(1, Math.ceil(matches.length / pageSize)),
    sort,
    order,
    data: sorted.slice((page - 1) * pageSize, page * pageSize),
  };
}

export async function getFacets(): Promise<{ statuses: Facet[]; sites: Facet[] }> {
  const { facets } = await fetchUpstream<MetaResponse>("/meta");
  return facets;
}

export async function getInsights(params: URLSearchParams) {
  const all = await getAllOrders();
  const today = todayInSabah();
  const f = filtersFrom(params);
  const pick = (filters: OrderFilters) => all.filter((o) => matchesFilters(o, filters, today));
  return buildInsights(pick(f), today, {
    forBranches: f.site ? pick({ ...f, site: undefined }) : undefined,
    forMonths: f.from || f.to ? pick({ ...f, from: undefined, to: undefined }) : undefined,
  });
}

export async function exportCsv(params: URLSearchParams) {
  const { matches, today } = await filteredOrders(params);
  const { sort, order } = sortFrom(params);
  return { csv: toCsv(sortOrders(matches, sort, order), today), rows: matches.length, today };
}
