import { expect, test } from "@playwright/test";

const rows = (page: import("@playwright/test").Page, isMobile: boolean) =>
  isMobile ? page.locator("ul.md\\:hidden > li") : page.locator("tbody tr");

test("first page is server-rendered with dashboard figures and orders", async ({ page, isMobile }) => {
  const listRequests: string[] = [];
  page.on("request", (r) => r.url().includes("/api/orders?") && listRequests.push(r.url()));

  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Sales Order Monitor" })).toBeVisible();
  await expect(page.getByText("1,200").first()).toBeVisible();
  await expect(rows(page, isMobile).first()).toContainText("SO-MOCK-00001");
  // Data arrived in the HTML: the client did not need to fetch the list itself.
  expect(listRequests).toEqual([]);
});

test("search and filters narrow results and are kept in the URL", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("searchbox").fill("Siti");
  await page.getByRole("combobox", { name: /^Status/ }).selectOption("Open order");
  await page.getByRole("combobox", { name: /^Branch/ }).selectOption("B20");

  await expect(page.getByText("6 of 1,200 match")).toBeVisible();
  await expect(page).toHaveURL(/q=Siti/);
  await expect(page).toHaveURL(/status=Open\+order/);
  await expect(page).toHaveURL(/site=B20/);
});

test("empty state offers to clear filters", async ({ page, isMobile }) => {
  await page.goto("/?q=zzzz-no-match");
  await expect(page.getByRole("heading", { name: "No orders found" })).toBeVisible();
  await page.getByRole("button", { name: "Clear filters" }).last().click();
  await expect(rows(page, isMobile).first()).toBeVisible();
  await expect(page).toHaveURL(/\/$/);
});

test("order detail panel opens and closes", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "SO-MOCK-00001" }).first().click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toContainText("Siti Mart Sdn Bhd");
  await expect(dialog).toContainText("Order total");
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
});

test("overdue follow-up and chart cross-filtering", async ({ page, isMobile }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Show in table" }).click();
  await expect(page).toHaveURL(/overdue=1/);
  await expect(rows(page, isMobile).first()).toContainText("overdue");

  await page.getByRole("button", { name: /^July 2026:/ }).click();
  await expect(page).toHaveURL(/from=2026-07-01&to=2026-07-31/);
  // Cross-filtering: the selected month is highlighted while other months stay clickable.
  await expect(page.getByRole("button", { name: /^August 2026:/ })).toBeVisible();
  await expect(page.getByLabel("From")).toHaveValue("2026-07-01");
});

test("API errors show a retry that recovers", async ({ page, isMobile }) => {
  await page.goto("/");
  await page.route("**/api/orders?**", (route) =>
    route.fulfill({ status: 502, json: { error: "Could not reach the sales order service." } }),
  );
  await page.getByRole("combobox", { name: /^Status/ }).selectOption("Cancelled");
  await expect(page.getByText("Couldn’t load sales orders")).toBeVisible();
  await expect(page.getByText("Could not reach the sales order service.")).toBeVisible();
  // No stale counts from the previous (unfiltered) result while the current one failed
  await expect(page.getByText(/of 1,200 match/)).toBeHidden();
  await expect(page.getByRole("link", { name: /Export CSV \(/ })).toBeHidden();

  await page.unroute("**/api/orders?**");
  await page.getByRole("button", { name: "Try again" }).click();
  await expect(rows(page, isMobile).first()).toContainText("Cancelled");
  await expect(page.getByText("120 of 1,200 match")).toBeVisible();
  await expect(page.getByRole("link", { name: "Export CSV (120)" })).toBeVisible();
});

test("phones get a sort menu", async ({ page, isMobile }) => {
  test.skip(!isMobile, "column headers handle sorting on desktop");
  await page.goto("/");
  await page.getByLabel("Sort by").selectOption("HAR_TotalSOAmount:desc");
  await expect(page).toHaveURL(/sort=HAR_TotalSOAmount&order=desc/);
  await expect(rows(page, isMobile).first()).toContainText("RM 1,635.60");
});
