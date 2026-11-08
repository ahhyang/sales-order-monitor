"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { formatCurrency, formatInt } from "@/lib/format";
import type { Insights as InsightsData } from "@/lib/orders";
import { todayInSabah } from "@/lib/orders";
import { DEFAULT_PAGE_SIZE, type SortField } from "@/lib/query";
import type { MetaResponse, OrdersListResponse } from "@/lib/types";
import { useApi } from "@/lib/useApi";
import { exportUrl, insightsUrl, listUrl, readView } from "@/lib/view";
import { Filters } from "./Filters";
import { Insights } from "./Insights";
import { KpiCards } from "./KpiCards";
import { OrderDrawer } from "./OrderDrawer";
import { OrdersTable, TableSkeleton } from "./OrdersTable";
import { Pagination } from "./Pagination";

const SEARCH_DEBOUNCE_MS = 300;
const AUTO_REFRESH_MS = 60_000;
// Newest / largest first is the more useful default when a user first clicks these columns.
const DESC_FIRST: SortField[] = ["CreatedDateTime1", "HAR_TotalSOAmount"];
const MOBILE_SORTS = [
  { value: "", label: "Order no. (default)" },
  { value: "CreatedDateTime1:desc", label: "Newest first" },
  { value: "CreatedDateTime1:asc", label: "Oldest first" },
  { value: "HAR_TotalSOAmount:desc", label: "Amount: high to low" },
  { value: "HAR_TotalSOAmount:asc", label: "Amount: low to high" },
  { value: "SalesStatus:asc", label: "Status" },
  { value: "InventSiteId:asc", label: "Branch" },
];

export interface DashboardSeed {
  listUrl: string;
  list?: OrdersListResponse;
  meta?: MetaResponse;
}

export function OrdersDashboard({ seed }: { seed?: DashboardSeed }) {
  const pathname = usePathname();
  const params = useSearchParams();

  // The URL is the source of truth for filters, so views can be bookmarked and shared.
  const view = readView((k) => params.get(k));
  const { q, status, site, page, pageSize, sort, order, from, to, overdue, live } = view;
  const today = todayInSabah();

  // Reads and writes window.location synchronously (Next syncs useSearchParams with history.replaceState),
  // so two quick changes in a row can't overwrite each other with a stale snapshot of the params.
  const update = useCallback(
    (changes: Record<string, string | number | null>, resetPage = true) => {
      const next = new URLSearchParams(window.location.search);
      for (const [key, value] of Object.entries(changes)) {
        if (value === null || value === "") next.delete(key);
        else next.set(key, String(value));
      }
      if (resetPage) next.delete("page");
      if (next.get("page") === "1") next.delete("page");
      if (next.get("pageSize") === String(DEFAULT_PAGE_SIZE)) next.delete("pageSize");
      const qs = next.toString();
      window.history.replaceState(null, "", qs ? `${pathname}?${qs}` : pathname);
    },
    [pathname],
  );

  // Search box: local draft, debounced into the URL. Re-sync if the URL changes underneath (clear, back button).
  const [search, setSearch] = useState(q);
  const [syncedQ, setSyncedQ] = useState(q);
  if (q !== syncedQ) {
    setSyncedQ(q);
    if (q !== search.trim()) setSearch(q);
  }
  useEffect(() => {
    const cleaned = search.trim();
    if (cleaned === q) return;
    const t = setTimeout(() => update({ q: cleaned }), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [search, q, update]);

  // The server already rendered the first page for this exact URL; reuse it instead of refetching.
  const list = useApi<OrdersListResponse>(listUrl(view), seed?.list && { url: seed.listUrl, data: seed.list });
  const meta = useApi<MetaResponse>("/api/meta", seed?.meta && { url: "/api/meta", data: seed.meta });
  const insights = useApi<InsightsData>(insightsUrl(view));
  const { retry: retryList } = list;
  const { retry: retryInsights } = insights;
  const refreshAll = useCallback(() => {
    retryList();
    retryInsights();
  }, [retryList, retryInsights]);

  // Wall-display mode (?live=1): refresh every minute while the tab is visible.
  useEffect(() => {
    if (!live) return;
    const id = setInterval(() => document.visibilityState === "visible" && refreshAll(), AUTO_REFRESH_MS);
    return () => clearInterval(id);
  }, [live, refreshAll]);

  const [openId, setOpenId] = useState<string | null>(null);
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);
  const [seen, setSeen] = useState<OrdersListResponse | undefined>(undefined);
  if (list.data && list.data !== seen) {
    setSeen(list.data);
    setUpdatedAt(new Date());
  }

  // `shown` keeps the previous rows visible (dimmed) while loading; `fresh` is only the current filter's result.
  const shown = list.data ?? list.staleData;
  const fresh = list.data;
  const ins = insights.data ?? insights.staleData;
  const hasFilters = Boolean(q || status || site || from || to || overdue);
  const clearFilters = () => {
    setSearch("");
    update({ q: null, status: null, site: null, from: null, to: null, overdue: null });
  };
  const toggleStatus = (value: string) => update({ status: status === value ? null : value });
  const setDates = (r: { from: string; to: string } | null) => update({ from: r?.from ?? null, to: r?.to ?? null });
  const onSort = (field: SortField) => {
    const nextOrder = sort === field ? (order === "asc" ? "desc" : "asc") : DESC_FIRST.includes(field) ? "desc" : "asc";
    update({ sort: field, order: nextOrder });
  };

  return (
    <div className="min-h-dvh bg-slate-100/70">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-4 sm:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <div aria-hidden className="grid size-9 shrink-0 place-items-center rounded-lg bg-slate-900 text-sm font-bold text-white">SO</div>
            <div className="min-w-0">
              <h1 className="truncate text-base font-semibold leading-tight text-slate-900 sm:text-lg">Sales Order Monitor</h1>
              <p className="text-xs text-slate-500">Orders across all branches</p>
            </div>
          </div>
          <div className="flex items-center gap-2 text-xs text-slate-500">
            {updatedAt && (
              <span className="hidden lg:inline" suppressHydrationWarning>
                Updated {updatedAt.toLocaleTimeString("en-MY", { hour: "2-digit", minute: "2-digit" })}
              </span>
            )}
            <button
              type="button"
              onClick={() => update({ live: live ? null : 1 }, false)}
              aria-pressed={live}
              title="Refresh automatically every minute (for wall displays)"
              className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm font-medium focus-visible:outline-2 focus-visible:outline-slate-900 ${
                live ? "border-emerald-600 bg-emerald-50 text-emerald-800" : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
              }`}
            >
              <span aria-hidden className={`size-2 rounded-full ${live ? "animate-pulse bg-emerald-500" : "bg-slate-300"}`} />
              <span className="hidden sm:inline">Auto-refresh</span>
              <span className="sm:hidden">Live</span>
            </button>
            <button
              type="button"
              onClick={refreshAll}
              disabled={list.loading}
              aria-label="Refresh now"
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-slate-900"
            >
              <svg aria-hidden viewBox="0 0 20 20" className={`size-4 fill-current ${list.loading ? "animate-spin" : ""}`}>
                <path d="M10 3a7 7 0 0 1 6.32 4H14a.75.75 0 0 0 0 1.5h4.25A.75.75 0 0 0 19 7.75V3.5a.75.75 0 0 0-1.5 0v2.02A8.5 8.5 0 1 0 18.5 10a.75.75 0 0 0-1.5 0A7 7 0 1 1 10 3Z" />
              </svg>
              <span className="hidden sm:inline">Refresh</span>
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl space-y-6 px-4 py-6 sm:px-6">
        <section aria-labelledby="overview-heading">
          <div className="mb-3 flex items-baseline justify-between gap-3">
            <h2 id="overview-heading" className="text-sm font-semibold text-slate-700">Overview</h2>
            <p className="text-right text-xs text-slate-500">All branches · tap a status to filter</p>
          </div>
          {!shown?.summary && list.error ? (
            <div className="rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-500">Dashboard figures unavailable.</div>
          ) : (
            <KpiCards summary={shown?.summary} activeStatus={status} onStatus={toggleStatus} />
          )}
        </section>

        <section aria-labelledby="insights-heading">
          <div className="mb-3 flex items-baseline justify-between gap-3">
            <h2 id="insights-heading" className="text-sm font-semibold text-slate-700">Insights</h2>
            <p className="text-right text-xs text-slate-500">
              {hasFilters ? "Reflects your filters" : "All orders"}
              {insights.data && ` · ${formatInt(insights.data.filtered.count)} orders · ${formatCurrency(insights.data.filtered.value)}`}
            </p>
          </div>
          <Insights
            data={ins}
            loading={insights.loading}
            error={insights.error}
            onRetry={insights.retry}
            site={site}
            from={from}
            to={to}
            overdueOnly={overdue}
            onSite={(v) => update({ site: v })}
            onMonth={setDates}
            onOverdue={(on) => update({ overdue: on ? 1 : null })}
            onOpenOrder={setOpenId}
          />
        </section>

        <section aria-labelledby="orders-heading" className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3 px-4 pt-4">
            <div className="flex items-baseline gap-3">
              <h2 id="orders-heading" className="text-base font-semibold text-slate-900">Sales orders</h2>
              {/* Counts come from fresh data only, never from the previous filter's results */}
              {fresh && hasFilters && (
                <span className="text-xs text-slate-500">
                  {formatInt(fresh.summary.filtered_orders)} of {formatInt(fresh.summary.total_orders)} match
                </span>
              )}
            </div>
            <a
              href={exportUrl(view)}
              download
              aria-disabled={fresh?.total === 0}
              className={`inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-slate-900 ${
                fresh?.total === 0 ? "pointer-events-none opacity-40" : ""
              }`}
            >
              <svg aria-hidden viewBox="0 0 20 20" className="size-4 fill-current">
                <path d="M10 2.75a.75.75 0 0 1 .75.75v7.69l2.72-2.72a.75.75 0 1 1 1.06 1.06l-4 4a.75.75 0 0 1-1.06 0l-4-4a.75.75 0 0 1 1.06-1.06l2.72 2.72V3.5a.75.75 0 0 1 .75-.75ZM3.5 13a.75.75 0 0 1 .75.75v1.5c0 .41.34.75.75.75h10a.75.75 0 0 0 .75-.75v-1.5a.75.75 0 0 1 1.5 0v1.5A2.25 2.25 0 0 1 15 17.5H5a2.25 2.25 0 0 1-2.25-2.25v-1.5A.75.75 0 0 1 3.5 13Z" />
              </svg>
              Export CSV{fresh?.total ? ` (${formatInt(fresh.total)})` : ""}
            </a>
          </div>

          <Filters
            search={search}
            onSearch={setSearch}
            status={status}
            onStatus={(v) => update({ status: v })}
            site={site}
            onSite={(v) => update({ site: v })}
            from={from}
            to={to}
            onDates={setDates}
            overdue={overdue}
            onOverdue={(on) => update({ overdue: on ? 1 : null })}
            today={today}
            statuses={meta.staleData?.facets.statuses ?? []}
            sites={meta.staleData?.facets.sites ?? []}
            facetsError={meta.error}
            hasFilters={hasFilters}
            onClear={clearFilters}
          />

          {/* Column headers are hidden on phones, so sorting gets its own control there */}
          <label className="flex items-center gap-2 px-4 pt-3 text-xs font-medium text-slate-600 md:hidden">
            Sort by
            <select
              value={sort ? `${sort}:${order}` : ""}
              onChange={(e) => {
                const [field, dir] = e.target.value.split(":");
                update({ sort: field || null, order: dir || null });
              }}
              className="flex-1 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus-visible:outline-2 focus-visible:outline-slate-900"
            >
              {MOBILE_SORTS.map((s) => (
                <option key={s.value} value={s.value}>{s.label}</option>
              ))}
              {/* A sort set from a shared desktop link may not be in the preset list */}
              {sort && !MOBILE_SORTS.some((s) => s.value === `${sort}:${order}`) && (
                <option value={`${sort}:${order}`}>{`${sort} (${order})`}</option>
              )}
            </select>
          </label>

          <div className="relative">
            {list.loading && shown && (
              <div aria-hidden className="absolute inset-x-0 top-0 z-10 h-0.5 overflow-hidden bg-slate-100">
                <div className="h-full w-1/3 animate-[loading_1s_ease-in-out_infinite] bg-slate-900" />
              </div>
            )}

            {list.error ? (
              <ErrorState message={list.error} onRetry={list.retry} />
            ) : !shown ? (
              <TableSkeleton />
            ) : shown.data.length === 0 ? (
              <EmptyState
                outOfRange={shown.total > 0}
                hasFilters={hasFilters}
                onClear={clearFilters}
                onFirstPage={() => update({}, true)}
              />
            ) : (
              <div className={list.loading ? "opacity-60 transition-opacity" : "transition-opacity"} aria-busy={list.loading}>
                <OrdersTable orders={shown.data} sort={sort} order={order} onSort={onSort} onOpen={setOpenId} today={today} />
              </div>
            )}
          </div>

          {shown && !list.error && shown.total > 0 && (
            <Pagination
              page={page}
              pageSize={pageSize}
              total={shown.total}
              totalPages={shown.totalPages}
              onPage={(p) => update({ page: p }, false)}
              onPageSize={(n) => update({ pageSize: n })}
            />
          )}
        </section>

        <p className="text-center text-xs text-slate-500">
          Fictional assessment data from the HSSB mock sales-orders API. Overview figures cover the whole dataset; insights and the table reflect your filters. Overdue = open order past its requested ship date (Sabah time).
        </p>
      </main>

      <OrderDrawer id={openId} onClose={() => setOpenId(null)} />
    </div>
  );
}

function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div role="alert" className="flex flex-col items-center px-4 py-16 text-center">
      <div aria-hidden className="grid size-12 place-items-center rounded-full bg-rose-50 text-xl text-rose-600">!</div>
      <h3 className="mt-4 font-semibold text-slate-900">Couldn’t load sales orders</h3>
      <p className="mt-1 max-w-sm text-sm text-slate-500">{message}</p>
      <button
        type="button"
        onClick={onRetry}
        className="mt-5 rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900"
      >
        Try again
      </button>
    </div>
  );
}

function EmptyState(props: { outOfRange: boolean; hasFilters: boolean; onClear: () => void; onFirstPage: () => void }) {
  const { outOfRange, hasFilters, onClear, onFirstPage } = props;
  return (
    <div className="flex flex-col items-center px-4 py-16 text-center">
      <div aria-hidden className="grid size-12 place-items-center rounded-full bg-slate-100">
        <svg viewBox="0 0 20 20" className="size-5 fill-slate-400">
          <path d="M8.5 3a5.5 5.5 0 0 1 4.38 8.82l3.65 3.65a.75.75 0 1 1-1.06 1.06l-3.65-3.65A5.5 5.5 0 1 1 8.5 3Zm0 1.5a4 4 0 1 0 0 8 4 4 0 0 0 0-8Z" />
        </svg>
      </div>
      <h3 className="mt-4 font-semibold text-slate-900">{outOfRange ? "This page is empty" : "No orders found"}</h3>
      <p className="mt-1 max-w-sm text-sm text-slate-500">
        {outOfRange
          ? "There are fewer results than this page number. Go back to the first page."
          : hasFilters
            ? "No sales orders match your search and filters. Try a different term, date range, or clear the filters."
            : "There are no sales orders to show."}
      </p>
      {(outOfRange || hasFilters) && (
        <button
          type="button"
          onClick={outOfRange ? onFirstPage : onClear}
          className="mt-5 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-slate-900"
        >
          {outOfRange ? "Go to first page" : "Clear filters"}
        </button>
      )}
    </div>
  );
}
