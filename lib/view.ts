// The dashboard's view state lives in the URL. Shared by the server-rendered first page and the client,
// so both build byte-identical API URLs (which lets the client reuse the server's data without refetching).

import { cleanDate, DEFAULT_PAGE_SIZE, PAGE_SIZES, SORT_FIELDS, type SortField } from "./query";

export interface ViewState {
  q: string;
  status: string;
  site: string;
  page: number;
  pageSize: number;
  sort: SortField | "";
  order: "asc" | "desc";
  from: string;
  to: string;
  overdue: boolean;
  live: boolean;
}

export function readView(get: (key: string) => string | null): ViewState {
  const size = Number(get("pageSize"));
  const sort = get("sort") ?? "";
  return {
    q: get("q") ?? "",
    status: get("status") ?? "",
    site: get("site") ?? "",
    page: Math.max(1, Number(get("page")) || 1),
    pageSize: (PAGE_SIZES as readonly number[]).includes(size) ? size : DEFAULT_PAGE_SIZE,
    sort: (SORT_FIELDS as readonly string[]).includes(sort) ? (sort as SortField) : "",
    order: get("order") === "desc" ? "desc" : "asc",
    from: cleanDate(get("from")) ?? "",
    to: cleanDate(get("to")) ?? "",
    overdue: get("overdue") === "1",
    live: get("live") === "1",
  };
}

/** Filter params only (shared by list, insights and export). */
export function filterParams(v: ViewState): URLSearchParams {
  const p = new URLSearchParams();
  if (v.q) p.set("q", v.q);
  if (v.status) p.set("status", v.status);
  if (v.site) p.set("site", v.site);
  if (v.from) p.set("from", v.from);
  if (v.to) p.set("to", v.to);
  if (v.overdue) p.set("overdue", "1");
  return p;
}

function withSort(p: URLSearchParams, v: ViewState) {
  if (v.sort) {
    p.set("sort", v.sort);
    p.set("order", v.order);
  }
  return p;
}

export const listUrl = (v: ViewState) => {
  const p = withSort(filterParams(v), v);
  p.set("page", String(v.page));
  p.set("pageSize", String(v.pageSize));
  return `/api/orders?${p}`;
};
export const insightsUrl = (v: ViewState) => `/api/insights?${filterParams(v)}`;
export const exportUrl = (v: ViewState) => `/api/orders/export?${withSort(filterParams(v), v)}`;

// ---- Order-date presets (relative to today in Sabah) ----

const shift = (ymd: string, days: number) => {
  const d = new Date(`${ymd}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
};

export function datePresets(today: string) {
  return [
    { id: "30d", label: "Last 30 days", from: shift(today, -29), to: today },
    { id: "90d", label: "Last 90 days", from: shift(today, -89), to: today },
    { id: "ytd", label: "This year", from: `${today.slice(0, 4)}-01-01`, to: today },
  ];
}

/** First and last day of a YYYY-MM month. */
export function monthRange(month: string) {
  const [y, m] = month.split("-").map(Number);
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return { from: `${month}-01`, to: `${month}-${String(last).padStart(2, "0")}` };
}
