import { describe, expect, it } from "vitest";
import { buildInsights, csvCell, daysOverdue, matchesFilters, sortOrders, summarize, toCsv } from "../lib/orders";
import type { SalesOrder } from "../lib/types";

const TODAY = "2026-11-08";

const order = (over: Partial<SalesOrder>): SalesOrder => ({
  SalesId: "SO-1",
  SalesName: "Siti Mart Sdn Bhd",
  CustAccount: "C10001",
  CustomerRef: "PO-1",
  SalesTaker: "Aisha Noor",
  InventSiteId: "B20",
  SalesStatus: "Open order",
  CreatedDateTime1: "2026-09-30T03:07:00.000Z",
  ShippingDateRequested: "2026-10-01",
  HAR_TotalSOAmount: 100,
  ...over,
});

describe("daysOverdue", () => {
  it("counts days past the requested ship date for open orders only", () => {
    expect(daysOverdue(order({}), TODAY)).toBe(38);
    expect(daysOverdue(order({ ShippingDateRequested: TODAY }), TODAY)).toBe(0);
    expect(daysOverdue(order({ ShippingDateRequested: "2026-12-01" }), TODAY)).toBe(0);
    expect(daysOverdue(order({ SalesStatus: "Delivered" }), TODAY)).toBe(0);
  });
});

describe("matchesFilters", () => {
  it("mirrors the API: case-insensitive substring search over the documented fields", () => {
    const o = order({});
    expect(matchesFilters(o, { q: "siti mart" }, TODAY)).toBe(true);
    expect(matchesFilters(o, { q: "mart siti" }, TODAY)).toBe(false);
    expect(matchesFilters(o, { q: "aisha" }, TODAY)).toBe(true); // SalesTaker
    expect(matchesFilters(o, { q: "c1000" }, TODAY)).toBe(true); // CustAccount
    expect(matchesFilters(o, { q: "Lahad Datu" }, TODAY)).toBe(false); // not a searchable field
  });

  it("matches status and site case-insensitively but exactly", () => {
    expect(matchesFilters(order({}), { status: "OPEN ORDER", site: "b20" }, TODAY)).toBe(true);
    expect(matchesFilters(order({}), { status: "Open" }, TODAY)).toBe(false);
  });

  it("filters the order-date range inclusively in Sabah time", () => {
    // 2026-06-30T17:00Z is 1 July 01:00 in Sabah (UTC+8)
    const o = order({ CreatedDateTime1: "2026-06-30T17:00:00.000Z" });
    expect(matchesFilters(o, { from: "2026-07-01", to: "2026-07-31" }, TODAY)).toBe(true);
    expect(matchesFilters(o, { to: "2026-06-30" }, TODAY)).toBe(false);
  });

  it("can restrict to overdue orders", () => {
    expect(matchesFilters(order({}), { overdue: true }, TODAY)).toBe(true);
    expect(matchesFilters(order({ SalesStatus: "Invoiced" }), { overdue: true }, TODAY)).toBe(false);
  });
});

describe("sortOrders / summarize", () => {
  const a = order({ SalesId: "SO-A", HAR_TotalSOAmount: 50 });
  const b = order({ SalesId: "SO-B", HAR_TotalSOAmount: 500, SalesStatus: "Cancelled" });

  it("sorts numbers numerically with SalesId as tiebreaker", () => {
    expect(sortOrders([a, b], "HAR_TotalSOAmount", "desc").map((o) => o.SalesId)).toEqual(["SO-B", "SO-A"]);
    expect(sortOrders([b, a]).map((o) => o.SalesId)).toEqual(["SO-A", "SO-B"]);
  });

  it("produces the API's summary shape", () => {
    expect(summarize([a, b], 1)).toEqual({
      total_orders: 2,
      filtered_orders: 1,
      open_orders: 1,
      invoiced_orders: 0,
      delivered_orders: 0,
      cancelled_orders: 1,
      total_order_value: 550,
    });
  });
});

describe("buildInsights", () => {
  const orders = [
    order({ SalesId: "SO-1", ShippingDateRequested: "2026-11-01", HAR_TotalSOAmount: 10 }), // 7 days
    order({ SalesId: "SO-2", ShippingDateRequested: "2026-07-01", HAR_TotalSOAmount: 20, InventSiteId: "KK01" }), // 130 days
    order({ SalesId: "SO-3", SalesStatus: "Delivered", HAR_TotalSOAmount: 30, CreatedDateTime1: "2026-08-15T00:00:00Z" }),
  ];

  it("buckets overdue orders by age and lists the oldest first", () => {
    const { overdue, filtered } = buildInsights(orders, TODAY);
    expect(filtered).toEqual({ count: 3, value: 60 });
    expect(overdue.count).toBe(2);
    expect(overdue.buckets.map((b) => b.count)).toEqual([1, 0, 0, 1]);
    expect(overdue.oldest.map((o) => [o.SalesId, o.days])).toEqual([["SO-2", 130], ["SO-1", 7]]);
  });

  it("groups value by branch (largest first) and by month (chronological)", () => {
    const { byBranch, byMonth } = buildInsights(orders, TODAY);
    expect(byBranch).toEqual([
      { site: "B20", count: 2, value: 40 },
      { site: "KK01", count: 1, value: 20 },
    ]);
    expect(byMonth.map((m) => m.month)).toEqual(["2026-08", "2026-09"]);
  });

  it("lets each chart use its own (cross-filtered) set", () => {
    const onlyKK = orders.filter((o) => o.InventSiteId === "KK01");
    const { byBranch, filtered } = buildInsights(onlyKK, TODAY, { forBranches: orders });
    expect(filtered.count).toBe(1);
    expect(byBranch).toHaveLength(2);
  });
});

describe("CSV export", () => {
  it("quotes special characters and neutralises formula injection", () => {
    expect(csvCell('Acme, "Best" Sdn Bhd')).toBe('"Acme, ""Best"" Sdn Bhd"');
    expect(csvCell("=HYPERLINK(\"http://evil\")")).toBe("\"'=HYPERLINK(\"\"http://evil\"\")\"");
    expect(csvCell("+60123")).toBe("'+60123");
    expect(csvCell(-5)).toBe("-5"); // real numbers are left alone
  });

  it("writes a BOM, a header row and one CRLF row per order", () => {
    const csv = toCsv([order({})], TODAY);
    expect(csv.startsWith("﻿Order no.,Customer,")).toBe(true);
    const lines = csv.trim().split("\r\n");
    expect(lines).toHaveLength(2);
    expect(lines[1]).toContain("SO-1,Siti Mart Sdn Bhd,C10001,PO-1,B20,2026-09-30,2026-10-01,Open order,38,100.00");
  });
});
