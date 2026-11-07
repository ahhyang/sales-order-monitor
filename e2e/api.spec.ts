import { expect, test } from "@playwright/test";

// API-level checks; browser-independent, so run once.
test.beforeEach(({}, testInfo) => test.skip(testInfo.project.name !== "desktop", "API tests run once"));

test("contract: server-side filtering matches the mock API's own filtering", async ({ request }) => {
  // Adding an all-time date range forces the full-dataset path; results must equal the pass-through path.
  for (const qs of ["q=Siti", "q=aisha&site=KK01", "status=open%20order&site=b20", "q=PO-2026001", "q=Mart%20Siti"]) {
    const direct = await (await request.get(`/api/orders?${qs}&pageSize=100`)).json();
    const local = await (await request.get(`/api/orders?${qs}&from=2000-01-01&pageSize=100`)).json();
    expect(local.total, qs).toBe(direct.total);
    expect(local.data.map((o: { SalesId: string }) => o.SalesId), qs).toEqual(
      direct.data.map((o: { SalesId: string }) => o.SalesId),
    );
  }
});

test("CSV export returns every matching row as a download", async ({ request }) => {
  const res = await request.get("/api/orders/export?site=B20&overdue=1");
  expect(res.status()).toBe(200);
  expect(res.headers()["content-type"]).toContain("text/csv");
  expect(res.headers()["content-disposition"]).toMatch(/attachment; filename="sales-orders-\d{4}-\d{2}-\d{2}\.csv"/);
  const lines = (await res.text()).trim().split("\r\n");
  expect(lines[0]).toContain("Order no.,Customer");
  expect(lines.length - 1).toBe(Number(res.headers()["x-row-count"]));
  expect(lines.slice(1).every((l) => l.includes(",B20,") && l.includes(",Open order,"))).toBe(true);
});

test("validation, not-found and health endpoints", async ({ request }) => {
  expect((await request.get("/api/orders/..%2Fmeta")).status()).toBe(400);
  expect((await request.get("/api/orders/SO-NOPE-1")).status()).toBe(404);
  const health = await request.get("/api/health");
  expect(health.status()).toBe(200);
  expect((await health.json()).upstream.ok).toBe(true);
});

test("security headers are set and the API key never reaches the browser", async ({ request }) => {
  const res = await request.get("/");
  const h = res.headers();
  expect(h["content-security-policy"]).toContain("frame-ancestors 'none'");
  expect(h["x-frame-options"]).toBe("DENY");
  expect(h["x-content-type-options"]).toBe("nosniff");
  expect(h["x-powered-by"]).toBeUndefined();
  expect(await res.text()).not.toContain("hssb-assessment");
  const list = await (await request.get("/api/orders?pageSize=1")).json();
  expect(list).not.toHaveProperty("links");
});
