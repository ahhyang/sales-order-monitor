# Sales Order Monitor

[![CI](https://github.com/ahhyang/sales-order-monitor/actions/workflows/ci.yml/badge.svg)](https://github.com/ahhyang/sales-order-monitor/actions/workflows/ci.yml)

A web app for a sales team to monitor sales orders across branches, built for the Harrisons Sabah Sdn Bhd IT Executive technical assessment. All data comes live from the provided **fictional** mock REST API.

**Live app:** https://sales-order-monitor-lovat.vercel.app
**Source:** https://github.com/ahhyang/sales-order-monitor

## Features

**Core requirements**
- **Dashboard** – total orders, open/pending, completed (invoiced + delivered, with breakdown), cancelled, and total order value (RM). Status cards are clickable filters.
- **Order listing** – order no. (SalesId), customer, branch/site, order date (Sabah time), status and amount. Server-side pagination (10/25/50/100), sortable columns, and a "Sort by" menu on phones.
- **Search & filters** – debounced search (order no., customer, account, PO ref, sales taker), status and branch filters. Options and counts come from the API's `/meta`.
- **UX states** – the first page is server-rendered (no loading flash); skeletons for insights; dimmed rows plus a progress bar while refetching; empty state with "Clear filters"; error state with "Try again"; an app-level error boundary; responsive table on desktop and cards on phones.

**Operational features**
- **Overdue follow-up** – an open order whose requested ship date has passed is flagged "Nd overdue" in the table. An insights panel shows the overdue count and value, an aging breakdown (1–30 / 31–60 / 61–90 / 90+ days), and the five longest-waiting orders (click to open). "Overdue only" filters the table.
- **Insights charts** – order value by branch and monthly order value. Clicking a bar filters by that branch or month. The charts cross-filter: each ignores its own filter, so the selection stays highlighted among its peers.
- **Order-date range filter** – presets (last 30/90 days, this year), a custom from/to range, or a click on a month bar.
- **CSV export** – downloads every order matching the current filters and sort (not just the visible page). The file opens cleanly in Excel (UTF-8 BOM) and is protected against CSV formula injection.
- **Auto-refresh** – "Auto-refresh" (`?live=1`) reloads data every 60 s while the tab is visible, for office wall displays.
- **Order detail panel** – loaded from `GET /sales-orders/{id}`.
- **Shareable views** – every filter, sort, page and the live mode live in the URL.

## Run locally

Requires Node.js 20.9+.

```bash
npm install
cp .env.example .env.local     # contains SALES_API_KEY
npm run dev                    # http://localhost:3000
```

| Script | What it does |
| --- | --- |
| `npm run build && npm start` | production build |
| `npm test` | 36 unit tests (Vitest) |
| `npm run test:e2e` | 17 Playwright end-to-end tests, desktop and mobile (run `npx playwright install chromium` and `npm run build` first) |
| `npm run lint` / `npm run typecheck` | ESLint / `tsc --noEmit` |

### Environment variables

| Name | Required | Purpose |
| --- | --- | --- |
| `SALES_API_KEY` | yes | Assessment API key, sent as `x-assessment-key` from the server only |
| `SALES_API_BASE_URL` | no | Override the upstream base URL |
| `ALERT_WEBHOOK_URL` | no | Slack/Teams/Discord-compatible webhook for server-error alerts |
| `RATE_LIMIT_PER_MIN` / `EXPORT_LIMIT_PER_MIN` | no | Per-IP limits (defaults 120 and 10) |

## Architecture & API integration

```
Browser (React)
   │  first page: HTML already contains the data (server-rendered)
   │  afterwards: fetch /api/orders · /api/orders/:id · /api/insights · /api/orders/export · /api/meta
   ▼
proxy.ts — per-IP rate limit (429 + Retry-After)
   ▼
Next.js route handlers → lib/service.ts
   │  A) pass-through: q / status / site / sort / page go straight to the API
   │  B) dataset mode: date range, overdue, charts and export need data the API can't filter,
   │     so the server reads every page (12 × 100, in parallel, cached 30 s) and filters itself
   │  validates input, adds x-assessment-key, 10 s timeout, maps errors, logs + alerts
   ▼
HSSB mock API  https://hiring.harrisons.my/api/mock/sales-orders   (read-only)
```

- **Why a server proxy rather than calling the API from the browser?** The API allows CORS, but a browser call would ship the access key to every user. The key lives in a server env var. The proxy also gives one place to validate input, normalise errors, cache and rate-limit. I verified that neither the HTML nor the JS bundle contains the key.
- **Pass-through vs dataset mode.** The API only filters by `q`, `status` and `site`, so whenever possible the request is passed straight through and the API does the work. Date ranges, overdue, the charts and full exports need fields the API can't filter on. For those, the server reads all pages through the same API, with each page cached for 30 s, and filters in `lib/orders.ts`. That logic mirrors the API's own search rules (case-insensitive substring over the five documented fields; exact, case-insensitive status and site). A **contract test** checks that both paths return the same orders in the same order. *For a real ERP I would not read the whole table per request; I'd ask for date filters and aggregate endpoints on the API side. With 1,200 fixture rows this is cheap and keeps the UI honest.*
- **Server-rendered first page.** `app/page.tsx` loads the first page and filter options on the server, so the initial HTML already contains the data. The client builds byte-identical API URLs (`lib/view.ts`) and reuses that data instead of refetching; an E2E test checks that no list request is made on first load. Insights load client-side so a slow aggregation never delays the first paint.
- **Input validation** (`lib/query.ts`): only known params are forwarded. Numbers are clamped (`pageSize` ≤ 100), text is trimmed and capped at 100 chars, `sort` is allow-listed, dates must be real `YYYY-MM-DD` (a reversed range is swapped), and order IDs must match `^[A-Za-z0-9-]{1,40}$`.
- **Errors**: network → 502, timeout → 504, upstream 401/403 → 502 (no credential details), 404 → 404, malformed JSON → 502, anything unexpected → generic 500. Error responses are `no-store`, so the CDN never caches a failure.
- **Client data fetching** (`lib/useApi.ts`): each new request aborts the previous one, so stale responses can't overwrite newer ones, and the last good data stays visible while refetching. URL state is written with `history.replaceState`, which is synchronous, so two quick filter changes can't clobber each other (a bug found and fixed during testing).
- **Caching & region**: the CDN serves `s-maxage=30, stale-while-revalidate=60` (≈0.14 s on a cache hit vs ≈0.46 s on a miss), and functions run in `sin1` (Singapore), next to the API.
- **Security headers** (`next.config.ts`): CSP with `connect-src 'self'` and `frame-ancestors 'none'`, `X-Frame-Options: DENY`, `nosniff`, Referrer-Policy and Permissions-Policy, with `X-Powered-By` removed. HTTPS/HSTS comes from Vercel.

### Operations: rate limiting, monitoring, alerting

- **Rate limiting** (`proxy.ts`, `lib/rateLimit.ts`): 120 API requests per minute per IP, 10 exports per minute; excess requests get 429 with `Retry-After`. The counter is in-memory, so each serverless instance counts separately. In production I'd enforce the same rule at the edge (Vercel WAF) or in Redis.
- **Health check**: `GET /api/health` makes a live (uncached) upstream call and returns status, upstream latency, region and commit, with 200 when healthy and 503 when not.
- **Uptime monitoring**: `.github/workflows/uptime.yml` polls the health endpoint every 30 minutes; a failed run makes GitHub notify the repo owner.
- **Alerting & logs**: server errors are logged as structured JSON (searchable in Vercel logs). If `ALERT_WEBHOOK_URL` is set, they also post to a chat channel after the response is sent (via `after()`), throttled to one alert per 5 minutes so an outage doesn't spam.

### Decisions & assumptions

- **Status mapping:** "Open / pending" = `Open order`; "Completed" = `Invoiced` + `Delivered`.
- **Overdue** = `Open order` whose `ShippingDateRequested` is before today in Sabah time. The fixture data ends on 1 Oct 2026, so as of today every open order is overdue. The aging breakdown is what makes that figure useful.
- **Order date** = `CreatedDateTime1` (UTC) shown and filtered in `Asia/Kuching` time. **Amount** = `HAR_TotalSOAmount` (MYR). **Branch** = `InventSiteId`; the API gives no branch names, so I don't invent any.
- **Overview cards** always show the whole dataset (that is what the API's `summary` provides). The insights header shows the filtered order count and value.

### Known limitations / next steps

- No login. A real deployment would sit behind company SSO (e.g. Microsoft Entra ID), with branch managers restricted to their own branch.
- Dataset mode reads the whole table through the API. That works for 1,200 rows; a production ERP needs server-side date filters and aggregates.
- The rate limiter is per instance (see above). Alerts need a webhook URL configured.
- E2E tests run against the live mock API, so an API outage fails CI. That is intentional for the contract test, but a production suite would also have a mocked run.
- The time box was 2–3 hours for the core requirements. The operational features above were added in a later improvement pass.

## Testing

- **Unit (Vitest, 36 tests)**: query validation; the upstream client with `fetch` mocked (key handling, error mapping, timeouts, non-JSON); order logic (overdue days, the API-mirroring search, Sabah-time date boundaries, sorting, summary, aging buckets, cross-filter context); CSV quoting and formula-injection guard; rate limiter; alert throttling; date presets; and server/client URL parity.
- **End-to-end (Playwright, 17 tests on desktop Chrome and a Pixel 7 profile)**: the server-rendered first load makes no client list request; search + status + branch gives 6 results; empty state and clear; detail panel open/close; overdue filter and chart cross-filtering; mocked API failure shows the error, then "Try again" recovers; mobile sort; **contract test** (dataset mode == API pass-through across 5 queries); CSV export headers and row count; 400/404/health; security headers; the key is absent from the HTML.
- **CI** (GitHub Actions): lint → typecheck → unit → build, then Playwright E2E, on every push and pull request.
- **Manual**: dashboard figures checked against raw API responses with curl; the layout checked at 375 px and desktop; no console errors or CSP violations; the rate limit returned 429 on the 11th export in a minute.

## AI-use disclosure

I used **Claude Code (Anthropic, model Claude Opus 5.5)** as a pair-programmer. It probed the API with curl, scaffolded the project, drafted the components, routes and tests, ran browser and E2E tests, and deployed to Vercel.

What I verified or changed:

- **Security:** upgraded the template's Next.js 15.5.4 after `npm audit` flagged advisories (including a critical RCE); confirmed the API key never reaches the browser; stripped the upstream `links` field that exposed the backend URL.
- **Bugs caught in testing:**
  - Rapid filter changes lost the first filter (stale params snapshot).
  - The alert throttle only worked by accident (its initial timestamp was 0); a unit test exposed it.
  - Chart filters made the other bars disappear, so the charts were redesigned to cross-filter.
- **Deployment:** `sales-order-monitor.vercel.app` turned out to be someone else's project, so I identified and submitted my real production alias. I also moved functions from US-East to Singapore, which roughly halved API latency.
- **Verified the data logic**: the server-side search matches the API exactly (checked on 10 queries by hand, then automated as a contract test).

## Project structure

```
app/
  page.tsx                  # server-renders the first page, then hands over to the client
  error.tsx                 # error boundary
  api/orders/route.ts       # list + summary (pass-through or dataset mode)
  api/orders/[id]/route.ts  # single order
  api/orders/export/route.ts# CSV download
  api/insights/route.ts     # overdue aging, value by branch, monthly trend
  api/meta/route.ts         # status/site facets
  api/health/route.ts       # health check for uptime monitoring
components/                 # OrdersDashboard, KpiCards, Insights, Filters, OrdersTable, Pagination, OrderDrawer, StatusBadge
lib/
  upstream.ts               # server-only API client (key, timeout, error mapping, logging/alerts)
  service.ts                # business logic: pass-through vs dataset mode, insights, export
  orders.ts                 # pure order logic: filters, overdue, insights, CSV
  query.ts / view.ts        # input validation; URL view state shared by server and client
  useApi.ts                 # client fetch hook (abort, stale data, server seed)
  rateLimit.ts / alert.ts   # rate limiter; throttled webhook alerts
proxy.ts                    # rate limiting for /api/*
tests/                      # Vitest unit tests
e2e/                        # Playwright end-to-end + API contract tests
.github/workflows/          # ci.yml (checks + E2E), uptime.yml (health every 30 min)
next.config.ts · vercel.json# security headers · Singapore region
```
