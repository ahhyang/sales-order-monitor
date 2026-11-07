# Sales Order Monitor

[![CI](https://github.com/ahhyang/sales-order-monitor/actions/workflows/ci.yml/badge.svg)](https://github.com/ahhyang/sales-order-monitor/actions/workflows/ci.yml)

A small web app for a sales team to monitor sales orders across branches, built for the Harrisons Sabah Sdn Bhd IT Executive technical assessment. All data comes live from the provided **fictional** mock REST API.

**Live app:** https://sales-order-monitor-lovat.vercel.app
**Source:** https://github.com/ahhyang/sales-order-monitor

## Features

- **Dashboard** – total orders, open/pending, completed (invoiced + delivered, with breakdown), cancelled, and total order value (RM). Status cards are clickable shortcuts that filter the table.
- **Order listing** – order no. (SalesId), customer (name + account), branch/site, order date (shown in Sabah time), status badge, and amount. Server-side pagination (10/25/50/100 rows) and sortable columns (a "Sort by" menu on phones, where column headers are hidden).
- **Search & filters** – debounced free-text search (order no., customer, account, PO ref, sales taker) plus status and branch/site filters. Filter options and counts come from the API's `/meta` endpoint, not a hard-coded list.
- **Order detail panel** – click any row to load that order from `GET /sales-orders/{id}` (amounts, invoiced/balance, dates, district, sales taker).
- **Shareable views** – filters, sort and page live in the URL (e.g. `/?status=Open+order&site=B20&q=Siti`).
- **UX states** – skeletons on first load; on refetch the old rows stay visible but dimmed with a progress bar (no flicker); empty state with "Clear filters"; error state with "Try again"; out-of-range page handling. Responsive: table on tablet/desktop, stacked cards on phones.

## Tech stack

Next.js 16 (App Router) · React 19 · TypeScript · Tailwind CSS 4 · Vitest · deployed on Vercel.

## Run locally

Requires Node.js 20.9+.

```bash
npm install
cp .env.example .env.local     # contains SALES_API_KEY
npm run dev                    # http://localhost:3000
```

Other scripts:

```bash
npm run build && npm start     # production build
npm test                       # unit tests (Vitest)
npm run lint                   # ESLint
npm run typecheck              # tsc --noEmit
```

### Environment variables

| Name | Required | Purpose |
| --- | --- | --- |
| `SALES_API_KEY` | yes | Assessment API key, sent as `x-assessment-key` from the server only |
| `SALES_API_BASE_URL` | no | Override the upstream base URL (defaults to `https://hiring.harrisons.my/api/mock/sales-orders`) |

## Architecture & API integration notes

```
Browser (React client component)
   │  fetch /api/orders?…, /api/orders/:id, /api/meta       (same origin, no key)
   ▼
Next.js route handlers  (app/api/**)  — thin backend-for-frontend proxy
   │  validates & allow-lists params, adds x-assessment-key, 10 s timeout,
   │  maps upstream failures to clean JSON errors, short CDN cache
   ▼
HSSB mock API  https://hiring.harrisons.my/api/mock/sales-orders   (read-only)
```

- **Why a proxy instead of calling the API from the browser?** The API does allow CORS, but calling it directly would ship the access key in the JS bundle. Keeping the key in a server env var mirrors how a real ERP credential should be handled, gives one place to validate input, and lets errors be normalised. I verified the built client bundle contains no copy of the key.
- **Input validation** (`lib/query.ts`, unit-tested): only `page`, `pageSize`, `status`, `site`, `q`, `sort`, `order` are forwarded; numbers are clamped (`pageSize` ≤ 100), text is trimmed and capped at 100 chars, `sort` must be one of the API's documented fields, and order IDs must match `^[A-Za-z0-9-]{1,40}$` so they cannot alter the upstream path.
- **Error mapping** (`lib/upstream.ts`): network failure → 502, timeout → 504, upstream 401/403 → 502 ("rejected our credentials", without exposing details), 404 → 404, malformed JSON → 502. Any unexpected exception becomes a generic 500 and is logged server-side only. Error responses are `no-store`, so a transient failure is never cached at the CDN. The UI shows the message with a retry button, and `app/error.tsx` catches render bugs so the user never sees a blank page.
- **Own response contract**: the proxy returns only the fields the UI uses and drops upstream extras like `links`, which would reveal the backend URL.
- **Security headers** (`next.config.ts`): Content-Security-Policy (`connect-src 'self'`, since the browser only talks to its own origin; `frame-ancestors 'none'`), `X-Frame-Options: DENY`, `nosniff`, `Referrer-Policy` and `Permissions-Policy`. The `X-Powered-By` header is removed. HTTPS/HSTS comes from Vercel.
- **Data fetching** (`lib/useApi.ts`): a small hook keyed by URL. Each new request aborts the previous one (`AbortController`), so a slow response can never overwrite newer results while typing. The last good result is kept so the table dims rather than blanking on refetch.
- **State in the URL**: filters/sort/page are read from `useSearchParams` and written with `history.replaceState`, which Next.js syncs with its router. Writing synchronously (rather than from a captured params snapshot) fixed a bug found in testing where two quick filter changes overwrote each other.
- **Caching**: route handlers send `s-maxage=30, stale-while-revalidate=60` (meta: 5 min), so repeat queries are served from Vercel's CDN (measured ≈0.14 s on a HIT vs ≈0.46 s on a MISS) and the upstream is spared. This is fixture data, so a short cache is safe. A live ERP feed would need a shorter cache or none, and the Refresh button would then need to bypass it.
- **Hosting region**: `vercel.json` pins the server functions to `sin1` (Singapore), the same region that serves the mock API, instead of Vercel's US-East default. That avoids a trans-Pacific round trip on every request and is also closer to users in Sabah.
- **No full dataset in the UI**: all filtering, searching, sorting and pagination happen server-side in the API; the client only ever holds one page.

### Decisions & assumptions

- **Status mapping:** "Open / pending" = `Open order`; "Completed" = `Invoiced` + `Delivered`; "Cancelled" = `Cancelled`.
- **Order date** = `CreatedDateTime1` (UTC), displayed in `Asia/Kuching` (Sabah) time. **Amount** = `HAR_TotalSOAmount`, shown in MYR.
- **Branch** = `InventSiteId` code. The API gives no branch names, so I don't invent any mapping.

### Known limitations

- The API's `summary` block is dataset-wide (only `filtered_orders` reflects filters), so the overview cards always show all branches; the table header shows "N of 1,200 match" for the filtered count. Per-filter order value would need either an API change or fetching every page client-side, which I avoided.
- No authentication on the app itself — anyone with the URL can view the (fictional) data. A real deployment would sit behind company SSO (e.g. Microsoft Entra ID).
- No rate limiting on the proxy routes. The CDN cache absorbs repeated identical queries, but a production version would add per-IP limits (e.g. Vercel Firewall or Upstash) so the proxy can't be used to hammer the ERP.
- Data loads after the page shell renders (client-side fetch). Server-rendering the first page of results would improve first paint; I chose the simpler client-side model for the time box.
- No date-range filter, CSV export or auto-refresh (out of scope for the time box).
- Unit tests cover validation and the upstream client; UI behaviour was tested manually (see below). With more time I'd add Playwright end-to-end tests.

## Testing performed

- **Automated:** `npm test` runs 16 Vitest cases:
  - Query validation: defaults, clamping, trimming, length caps, sort allow-list, unknown-param stripping, SalesId validation.
  - Upstream client, with `fetch` mocked: key sent server-side, missing-key guard, 404/401/500 mapping, network/timeout mapping, non-JSON bodies, error responses that don't leak internal details.
  - Plus `npm run lint`, `npm run typecheck` and `npm run build`.
  - GitHub Actions runs all four on every push and pull request.
- **API checks with curl** before building: list, `/meta`, single order, 404 for unknown ID, 401 without key, CORS preflight, `pageSize` capping, and that `summary` is not filtered.
- **Manual browser testing** against the production build:
  - Dashboard numbers match the API (1,200 / 420 / 660 / 120 / RM 998,244.30).
  - Search "Siti" + status "Open order" + branch B20 → 6 results, the same as calling the API directly.
  - Sorting by amount (desc), order detail panel (open, Esc to close), pagination, rows per page.
  - Empty state (`?q=zzzz`), error state (server started with a wrong API key → friendly message + retry), invalid ID → 400, unknown ID → 404.
  - Mobile (375 px) and desktop layouts, including the mobile sort menu; no console errors or CSP violations.
- **Security:** `npm audit` clean for production deps (the create-next-app template pinned Next 15.5.4, which has known advisories, so I upgraded to Next 16.4.3); confirmed the API key is not in `.next/static`.

## AI-use disclosure

I used **Claude Code (Anthropic, model Claude Opus 5.5)** as a pair-programmer for this assessment. It probed the API with curl, scaffolded the Next.js project, and drafted the components, proxy routes, unit tests and this README; it also drove a browser to test the app.

What I reviewed, verified or changed:

- Read through all source files and made sure I can explain each design decision above (proxy pattern, validation, abort handling, URL state).
- Verified the dashboard figures and a filtered query against raw API responses.
- Caught and fixed a real bug during browser testing (rapid successive filter changes lost the first filter due to a stale params snapshot).
- Upgraded Next.js after `npm audit` flagged the template's version.
- Checked that the API key never reaches the browser bundle.

## Project structure

```
app/
  page.tsx                  # renders the dashboard
  error.tsx                 # error boundary (recoverable screen instead of a blank page)
  api/orders/route.ts       # GET list + summary (proxy)
  api/orders/[id]/route.ts  # GET single order (proxy)
  api/meta/route.ts         # GET status/site facets (proxy)
components/                 # OrdersDashboard, KpiCards, Filters, OrdersTable, Pagination, OrderDrawer, StatusBadge
lib/
  upstream.ts               # server-only API client (key, timeout, error mapping)
  query.ts                  # param allow-listing/validation (unit-tested)
  useApi.ts                 # client fetch hook with abort + stale data
  format.ts                 # MYR currency and Sabah-time date formatting
  types.ts                  # API response types
tests/                      # query.test.ts, upstream.test.ts
next.config.ts              # security headers
vercel.json                 # pins functions to sin1 (Singapore)
.github/workflows/ci.yml    # lint, typecheck, test, build on every push
```
