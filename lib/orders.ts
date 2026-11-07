// Pure order logic used when the API can't answer a question itself (date ranges, overdue, charts, CSV).
// No server-only imports, so it is unit-testable and safe to share with the client.

import type { OrdersSummary, SalesOrder } from "./types";
import type { SortField } from "./query";

export interface OrderFilters {
  q?: string;
  status?: string;
  site?: string;
  /** Inclusive order-date range, YYYY-MM-DD in Sabah time */
  from?: string;
  to?: string;
  overdue?: boolean;
}

const TIME_ZONE = "Asia/Kuching";
const ymd = new Intl.DateTimeFormat("en-CA", { timeZone: TIME_ZONE, year: "numeric", month: "2-digit", day: "2-digit" });
const DAY_MS = 86_400_000;

/** YYYY-MM-DD for an instant, in Sabah local time. */
export const sabahDate = (date: Date) => ymd.format(date);
export const todayInSabah = () => sabahDate(new Date());
export const orderDate = (o: SalesOrder) => sabahDate(new Date(o.CreatedDateTime1));

const daysBetween = (fromYmd: string, toYmd: string) =>
  Math.round((Date.parse(`${toYmd}T00:00:00Z`) - Date.parse(`${fromYmd}T00:00:00Z`)) / DAY_MS);

/** An open order whose requested ship date has passed. Returns days overdue, or 0 if not overdue. */
export function daysOverdue(o: SalesOrder, today: string): number {
  if (o.SalesStatus !== "Open order" || !o.ShippingDateRequested) return 0;
  return Math.max(0, daysBetween(o.ShippingDateRequested.slice(0, 10), today));
}

// Mirrors the API's own `q` semantics: case-insensitive substring over these fields.
const SEARCH_FIELDS = ["SalesId", "SalesName", "CustAccount", "CustomerRef", "SalesTaker"] as const;

export function matchesFilters(o: SalesOrder, f: OrderFilters, today: string): boolean {
  if (f.status && o.SalesStatus.toLowerCase() !== f.status.toLowerCase()) return false;
  if (f.site && o.InventSiteId.toLowerCase() !== f.site.toLowerCase()) return false;
  if (f.q) {
    const needle = f.q.toLowerCase();
    if (!SEARCH_FIELDS.some((k) => String(o[k] ?? "").toLowerCase().includes(needle))) return false;
  }
  if (f.from || f.to) {
    const d = orderDate(o);
    if (f.from && d < f.from) return false;
    if (f.to && d > f.to) return false;
  }
  if (f.overdue && daysOverdue(o, today) === 0) return false;
  return true;
}

export function sortOrders(orders: SalesOrder[], sort: SortField = "SalesId", order: "asc" | "desc" = "asc") {
  const dir = order === "desc" ? -1 : 1;
  return [...orders].sort((a, b) => {
    const x = a[sort];
    const y = b[sort];
    const cmp = typeof x === "number" && typeof y === "number" ? x - y : String(x).localeCompare(String(y));
    return cmp * dir || a.SalesId.localeCompare(b.SalesId);
  });
}

/** Same shape as the API's summary: counts are dataset-wide, `filtered_orders` reflects the filters. */
export function summarize(all: SalesOrder[], filteredCount: number): OrdersSummary {
  const count = (s: string) => all.filter((o) => o.SalesStatus === s).length;
  return {
    total_orders: all.length,
    filtered_orders: filteredCount,
    open_orders: count("Open order"),
    invoiced_orders: count("Invoiced"),
    delivered_orders: count("Delivered"),
    cancelled_orders: count("Cancelled"),
    total_order_value: round2(all.reduce((sum, o) => sum + o.HAR_TotalSOAmount, 0)),
  };
}

const round2 = (n: number) => Math.round(n * 100) / 100;

export const AGING_BUCKETS = [
  { label: "1–30 days", min: 1, max: 30 },
  { label: "31–60 days", min: 31, max: 60 },
  { label: "61–90 days", min: 61, max: 90 },
  { label: "90+ days", min: 91, max: Infinity },
] as const;

export interface Insights {
  asOf: string;
  filtered: { count: number; value: number };
  overdue: {
    count: number;
    value: number;
    buckets: { label: string; count: number; value: number }[];
    oldest: { SalesId: string; SalesName: string; InventSiteId: string; days: number; amount: number }[];
  };
  byBranch: { site: string; count: number; value: number }[];
  byMonth: { month: string; count: number; value: number }[];
}

/**
 * `context` lets each chart ignore its own filter (cross-filtering): the branch chart is built without the
 * branch filter and the trend without the date filter, so the selection is highlighted among its peers
 * instead of every other bar disappearing.
 */
export function buildInsights(
  orders: SalesOrder[],
  today: string,
  context: { forBranches?: SalesOrder[]; forMonths?: SalesOrder[] } = {},
): Insights {
  const overdue = orders
    .map((o) => ({ o, days: daysOverdue(o, today) }))
    .filter((x) => x.days > 0)
    .sort((a, b) => b.days - a.days || b.o.HAR_TotalSOAmount - a.o.HAR_TotalSOAmount);

  const group = <K extends string>(source: SalesOrder[], key: (o: SalesOrder) => K) => {
    const map = new Map<K, { count: number; value: number }>();
    for (const o of source) {
      const g = map.get(key(o)) ?? { count: 0, value: 0 };
      g.count += 1;
      g.value += o.HAR_TotalSOAmount;
      map.set(key(o), g);
    }
    return [...map].map(([k, g]) => ({ key: k, count: g.count, value: round2(g.value) }));
  };

  return {
    asOf: today,
    filtered: { count: orders.length, value: round2(orders.reduce((s, o) => s + o.HAR_TotalSOAmount, 0)) },
    overdue: {
      count: overdue.length,
      value: round2(overdue.reduce((s, x) => s + x.o.HAR_TotalSOAmount, 0)),
      buckets: AGING_BUCKETS.map((b) => {
        const inBucket = overdue.filter((x) => x.days >= b.min && x.days <= b.max);
        return { label: b.label, count: inBucket.length, value: round2(inBucket.reduce((s, x) => s + x.o.HAR_TotalSOAmount, 0)) };
      }),
      oldest: overdue.slice(0, 5).map(({ o, days }) => ({
        SalesId: o.SalesId,
        SalesName: o.SalesName,
        InventSiteId: o.InventSiteId,
        days,
        amount: o.HAR_TotalSOAmount,
      })),
    },
    byBranch: group(context.forBranches ?? orders, (o) => o.InventSiteId)
      .map(({ key, ...g }) => ({ site: key, ...g }))
      .sort((a, b) => b.value - a.value),
    byMonth: group(context.forMonths ?? orders, (o) => orderDate(o).slice(0, 7))
      .map(({ key, ...g }) => ({ month: key, ...g }))
      .sort((a, b) => a.month.localeCompare(b.month)),
  };
}

// ---- CSV export ----

const CSV_COLUMNS: [string, (o: SalesOrder, today: string) => string | number][] = [
  ["Order no.", (o) => o.SalesId],
  ["Customer", (o) => o.SalesName],
  ["Customer account", (o) => o.CustAccount],
  ["Customer ref", (o) => o.CustomerRef ?? ""],
  ["Branch", (o) => o.InventSiteId],
  ["Order date", (o) => orderDate(o)],
  ["Requested ship date", (o) => o.ShippingDateRequested?.slice(0, 10) ?? ""],
  ["Status", (o) => o.SalesStatus],
  ["Days overdue", (o, today) => daysOverdue(o, today) || ""],
  ["Amount (MYR)", (o) => o.HAR_TotalSOAmount.toFixed(2)],
  ["Invoiced (MYR)", (o) => (o.HAR_InvoicedAmount ?? 0).toFixed(2)],
  ["Balance (MYR)", (o) => (o.HAR_BalanceAmount ?? 0).toFixed(2)],
  ["Sales taker", (o) => o.SalesTaker ?? ""],
];

/** Quote for CSV, and neutralise cells Excel would run as formulas (CSV injection). */
export function csvCell(value: string | number): string {
  let s = String(value);
  if (typeof value === "string" && /^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function toCsv(orders: SalesOrder[], today: string): string {
  const header = CSV_COLUMNS.map(([name]) => csvCell(name)).join(",");
  const rows = orders.map((o) => CSV_COLUMNS.map(([, get]) => csvCell(get(o, today))).join(","));
  // BOM so Excel opens UTF-8 correctly; CRLF per RFC 4180.
  return "﻿" + [header, ...rows].join("\r\n") + "\r\n";
}
