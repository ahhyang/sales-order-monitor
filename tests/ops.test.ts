import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { notifyOps, resetAlertThrottle } from "../lib/alert";
import { cleanDate, needsDataset, parseExtraFilters } from "../lib/query";
import { createRateLimiter } from "../lib/rateLimit";
import { datePresets, exportUrl, listUrl, monthRange, readView } from "../lib/view";

describe("rate limiter", () => {
  it("allows up to the limit per window, then blocks with a retry hint", () => {
    const check = createRateLimiter({ limit: 2, windowMs: 60_000 });
    expect(check("1.1.1.1", 0).ok).toBe(true);
    expect(check("1.1.1.1", 1).ok).toBe(true);
    const blocked = check("1.1.1.1", 2);
    expect(blocked.ok).toBe(false);
    expect(blocked.retryAfterSec).toBe(60);
    expect(check("2.2.2.2", 3).ok).toBe(true); // other clients unaffected
    expect(check("1.1.1.1", 60_001).ok).toBe(true); // new window
  });
});

describe("ops alerts", () => {
  const fetchMock = vi.fn();
  beforeEach(() => {
    resetAlertThrottle();
    vi.stubGlobal("fetch", fetchMock);
    fetchMock.mockResolvedValue(new Response(null, { status: 200 }));
  });
  afterEach(() => {
    fetchMock.mockReset();
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it("does nothing unless a webhook is configured", async () => {
    vi.stubEnv("ALERT_WEBHOOK_URL", "");
    expect(await notifyOps("x")).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("posts once, then throttles repeats for 5 minutes", async () => {
    vi.stubEnv("ALERT_WEBHOOK_URL", "https://hooks.test/abc");
    expect(await notifyOps("down", 1_000)).toBe(true);
    expect(await notifyOps("still down", 2_000)).toBe(false);
    expect(await notifyOps("down again", 1_000 + 5 * 60_000)).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({ text: "down" });
  });

  it("never throws if the webhook itself fails", async () => {
    vi.stubEnv("ALERT_WEBHOOK_URL", "https://hooks.test/abc");
    fetchMock.mockRejectedValue(new Error("network"));
    await expect(notifyOps("x")).resolves.toBe(false);
  });
});

describe("date filters", () => {
  it("accepts only real calendar dates", () => {
    expect(cleanDate("2026-07-31")).toBe("2026-07-31");
    expect(cleanDate("2026-02-30")).toBeUndefined();
    expect(cleanDate("31/07/2026")).toBeUndefined();
    expect(cleanDate(null)).toBeUndefined();
  });

  it("swaps a reversed range and decides when the full dataset is needed", () => {
    expect(parseExtraFilters(new URLSearchParams("from=2026-07-31&to=2026-07-01"))).toEqual({
      from: "2026-07-01",
      to: "2026-07-31",
      overdue: false,
    });
    expect(needsDataset(new URLSearchParams("q=Siti&site=B20"))).toBe(false);
    expect(needsDataset(new URLSearchParams("overdue=1"))).toBe(true);
    expect(needsDataset(new URLSearchParams("from=bogus"))).toBe(false);
  });

  it("builds presets and month ranges", () => {
    expect(datePresets("2026-11-08").map((p) => [p.id, p.from])).toEqual([
      ["30d", "2026-10-10"],
      ["90d", "2026-08-11"],
      ["ytd", "2026-01-01"],
    ]);
    expect(monthRange("2026-02")).toEqual({ from: "2026-02-01", to: "2026-02-28" });
  });
});

describe("view state", () => {
  it("builds identical API URLs from the same URL params (server seed == client fetch)", () => {
    const p = new URLSearchParams("site=B20&q=Siti&sort=HAR_TotalSOAmount&order=desc&page=2&overdue=1&junk=1");
    const v = readView((k) => p.get(k));
    expect(listUrl(v)).toBe("/api/orders?q=Siti&site=B20&overdue=1&sort=HAR_TotalSOAmount&order=desc&page=2&pageSize=25");
    expect(exportUrl(v)).toBe("/api/orders/export?q=Siti&site=B20&overdue=1&sort=HAR_TotalSOAmount&order=desc");
  });
});
