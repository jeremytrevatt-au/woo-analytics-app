# Natural Yield Woo Analytics App

Frontend analytics UX for Natural Yield WooCommerce data.

## Product focus

1. Search and filtering for commerce entities.
2. Historical trends for orders, customers, and stock.
3. Forecast-oriented decision support.

## 🚀 Deployment & Infrastructure Mapping (IMMUTABLE)

This section documents the exact architecture mapping and deployment commands required to ensure the correct Cloud Run services are updated and served by the Load Balancer.

### Architecture Mapping
The infrastructure uses a Global HTTP Load Balancer with Identity-Aware Proxy (IAP) enabled.

1. **Frontend App**:
   - **Cloud Run Service Name**: `woo-analytics-app`
   - **Network Endpoint Group (NEG)**: `woo-analytics-app-neg`
   - **Compute Backend Service**: `woo-analytics-app-backend`
   - **URL Map Routing**: Default route (`/*`)

2. **Backend Service**:
   - **Cloud Run Service Name**: `woo-analytics-service`
   - **Network Endpoint Group (NEG)**: `woo-analytics-service-neg`
   - **Compute Backend Service**: `woo-analytics-service-backend`
   - **URL Map Routing**: `/api/*`

**CRITICAL WARNING**: Do NOT deploy the backend to a Cloud Run service named `woo-analytics-service-backend`. That is the name of the *Compute Engine Backend Service*, not the Cloud Run service. Deploying to a Cloud Run service with that name will result in an orphaned deployment that the Load Balancer will never serve.

### Deployment Commands

**1. Deploy Frontend (from `woo-analytics-app` directory)**:
```bash
gcloud run deploy woo-analytics-app --source . --region australia-southeast1 --project natural-yield-analytics --quiet
```

**2. Deploy Backend (from `woo-analytics-service` directory)**:
```bash
gcloud run deploy woo-analytics-service --source . --region australia-southeast1 --project natural-yield-analytics --quiet
```

**3. Invalidate CDN Cache (run after frontend/backend deployments)**:
```bash
gcloud compute url-maps invalidate-cdn-cache woo-analytics-url-map --path "/*" --project natural-yield-analytics --async
```

## Stack

1. Vite + React + TypeScript.
2. Material UI for dashboard components.
3. Recharts for chart visualizations.
4. Vitest + React Testing Library + Playwright for tests.

## UX structure

1. Global filter bar for date range, order status, and free text search.
2. Page routes:
   1. Overview
   2. Orders
   3. Customers
   4. Stock
   5. Forecast
3. Reusable panels:
   1. KPI cards
   2. Trend charts
   3. Data tables
   4. Forecast chart

## API integration

1. This app can call `woo-analytics-service` when `VITE_ANALYTICS_API_BASE_URL` is set.
2. Endpoints consumed:
   1. `/api/v1/orders/overview`
   2. `/api/v1/orders`
   2. `/api/v1/customers/overview`
   4. `/api/v1/customers`
   3. `/api/v1/stock/overview`
   6. `/api/v1/stock`
   7. `/api/v1/diagnostics/frontend-event`
3. The app fails fast when API configuration or responses are invalid; no seeded fallback data is used.

## Diagnostics

1. A toggleable API debug panel is available in the lower-right corner of the UI.
2. The panel shows request method, URL, status, timing, and error details.
3. Debug events are mirrored to backend diagnostics endpoint for Cloud Logging visibility.

## Local run

1. Install dependencies: `npm install`
2. Start dev server: `npm run dev`
3. Run unit/component tests: `npm test`
4. Run e2e tests: `npm run test:e2e`
5. Build: `npm run build`

## Deployment target

1. Recommended: Firebase Hosting.
2. Why:
   1. This frontend is an SPA and does not require server-side rendering.
   2. Firebase Hosting provides CDN delivery, simple routing rewrites, and low operational overhead.
3. Cloud Run remains suitable for the backend API service.

## Firebase deploy

1. Build: `npm run build`
2. Authenticate: `firebase login`
3. Deploy: `firebase deploy --only hosting`

## 2026-06-20 06:35 UTC
1. Updated PackingPage to show product_name (with attributes) instead of category.
2. Updated PackingPage to show 'Packed by: [username]' using IAP email.
3. Hidden FilterBar on PackingPage.
4. Made order cards clickable to expand/collapse and removed Show/Hide details buttons.
- Git build reference: fb70665b9008118b85cc29805c9fb5ca6cbbe79d

## 2026-06-20 09:05 UTC
1. Updated DashboardLayout to use a hamburger menu and drawer for better mobile responsiveness.
- Git build reference: d80da5823ffa8237b9eaf705841f2bf44f759917

## 2026-06-20 09:45 UTC
1. Updated PackingPage to support 3 states (unpacked, packing, packed) with appropriate buttons and labels.
- Git build reference: 3ef883941949b36d6181a54c0c214a009edc418e

## 2026-06-20 11:05 UTC
1. Fixed 422 error on packing by setting correct Content-Type header in fetchJson.
2. Displayed Subtotal, Shipping, and Total on PackingPage.
- Git build reference: ba8b4ace61505b9b2c874efb2c7cd240882e07db

## 2026-06-23 01:20 UTC
1. Added support for YITH Product Bundles (visual grouping and indentation).
2. Added First Time Customer indicator (1st Order badge).
3. Moved Pre Orders section to the bottom of the layout.
- Git build reference: 17bfb124c449d46ec290266b37d8bc5f68f169ed

### 2026-06-25 07:45 UTC
**TODOs Completed**:
1. Added ability to reorder line items in PO modal.
2. Added Google Drive Link to Purchase Orders (DB schema, API payload, UI).
3. Fixed PO modal width, table overflow, and multiline controls for Product Name and SKU.
4. Enhanced PO line items with variation attributes dynamically and in search.
**Git Build Reference**: ba1cad5

## 2026-08-06 11:20 UTC

1. TODOs completed:
   1. Added a `/preorders` overview page for allocation/reservation diagnostics and maintenance.
   2. Added preorder API client and hook coverage for diagnostics, allocations, reservations, PO allocation summaries, and bulk allocation.
   3. Surfaced preorder allocation directly in Purchase Orders, including full-PO bulk allocation and individual line allocation/status controls.
   4. Added Preorders navigation while keeping Purchase Orders as the primary allocation workflow.
2. Git build reference:
   1. App commit: `4a6edda0bd91fc0d1f27f9544ca48109588ecb99`
   2. Deployed Cloud Run revision: `woo-analytics-app-00100-w4q`
3. New understandings/learnings:
   1. Preorder allocation should be initiated from Purchase Orders rather than managed as a separate data-entry workflow.
   2. The Preorders page should act as an overview/maintenance surface for allocations and reservations.
4. Understood next steps (remaining TODOs):
   1. Validate a real PO bulk allocation and individual line allocation from the live app.
   2. Add richer PO line allocation controls if partial line quantities are needed later.

## 2026-08-07 10:03 UTC

1. TODOs completed:
   1. Added Preorders page allocation editing and manual Hold Qty maintenance.
   2. Changed Hold Qty from additive reservations to a manual hold total setter that can reduce to zero.
   3. Added Purchase Order bulk allocation progress feedback and fixed PO line ID matching for allocation display.
2. Git build reference:
   1. App commits: `e21d7ca6b6e8938c6b9d0127883555322fb48195`, `8de4e8b7b86b5e4b05f155297c1c979607c84a12`, `f824645ec083f16400ff9654c1ced13d7b158a4c`
   2. Latest deployed Cloud Run revision: `woo-analytics-app-00104-h26`
3. New understandings/learnings:
   1. Manual preorder holds need setter behaviour rather than additive reservation behaviour.
   2. Reservation totals need to stay auditable while still being easy to maintain from the Preorders page.
4. Understood next steps (remaining TODOs):
   1. Add reconciliation diagnostics/repair UI if backend repair endpoints become operationally necessary.
   2. Keep Purchase Orders as the primary allocation workflow and Preorders as the maintenance surface.

## 2026-08-07 23:26 UTC

1. TODOs completed:
   1. Added Purchase Order `Received` stock receipt preview controls.
   2. Added `Book Received Stock` action for received POs.
   3. Added a receipt preview table showing received qty, Manual Hold Qty, stock before, stock delta, expected stock after, and eligible/blocked PreOrder counts.
2. Git build reference:
   1. App commit: `548c69f2e5043ec99964698d7669b86e923f80d8`
3. New understandings/learnings:
   1. PO stock receipt needs an operator-visible dry-run preview before writing WooCommerce stock.
4. Understood next steps (remaining TODOs):
   1. Deploy the app revision after the service facade is deployed.

## 2026-08-13 02:10 UTC

1. TODOs completed:
   1. Removed the aggregate Stock Trend panel from the Stock Items view.
   2. Added Stock Items drill-down actions that show item-level stock history and forecast usage history.
   3. Defaulted Stock Items loading to most-active stock movement sorting when no manual table sort is selected.
2. Git build reference:
   1. App commit: `e37d319`
3. New understandings/learnings:
   1. The existing Stock ledger chart modal was mounted inside an inactive tab block, preventing Stock Items actions from opening it.
4. Understood next steps (remaining TODOs):
   1. Deploy the app revision after the service revision is deployed.

## 2026-08-13 05:15 UTC

1. TODOs completed:
   1. Added row-click Stock Items expansion with inline stock history and forecast charts.
   2. Removed the Stock Alerts widget from the Stock page.
   3. Added sticky Stock Items headers and a Stocktake tab with editable New Qty controls.
2. Git build reference:
   1. App commit: `53ffecc`
3. New understandings/learnings:
   1. Stock history needs to be visible directly from a Stock Items row, not only via a small action button.
   2. Stocktake should reuse the same stock update backend used by packing stock adjustments.
4. Understood next steps (remaining TODOs):
   1. Deploy the app revision after the service revision is deployed.

## 2026-08-14 02:22 UTC

1. TODOs completed:
   1. Added stock target type and WSVI group visibility to the received stock preview table.
2. Git build reference:
   1. App commit: `4e70c50`
3. New understandings/learnings:
   1. Operators need to see whether a PO receipt will write to a simple product, variation, or WSVI group before booking stock.
4. Understood next steps (remaining TODOs):
   1. Deploy the app revision after building and deploying the fixed plugin package.

## 2026-08-14 21:11 UTC

1. TODOs completed:
   1. Replaced inline Stock Items row expansion with an `Analyze` action that opens the stock analysis popup.
   2. Added popup summary cards for live ledger coverage and order-derived forecast coverage.
   3. Added full detail tables for live stock ledger points and historical order-derived forecast rows.
2. Git build reference:
   1. App commit: `82f55cb`
3. New understandings/learnings:
   1. Stock Items needs a larger analysis surface for precision because inline row charts hide too much context.
4. Understood next steps (remaining TODOs):
   1. Deploy the app revision after the service revision is deployed.

## 2026-08-14 23:43 UTC

1. TODOs completed:
   1. Passed Stock page `startDate` and `endDate` filters into the Stock analysis popup.
   2. Added 7-day, 14-day, and dynamic forecast average window options.
   3. Added a toggleable rolling-average line alongside actual order-derived usage.
   4. Made the main app container and Home page chart panels full width with wrapping header controls.
2. Git build reference:
   1. App commit: `7b09101`
3. New understandings/learnings:
   1. The Stock page analysis popup needs a separate averaging window from the data date range so historical rows are not accidentally hidden.
   2. Dashboard chart headers should wrap controls rather than constraining chart width.
4. Understood next steps (remaining TODOs):
   1. Deploy the app revision after the service revision is deployed.

## 2026-08-15 00:15 UTC

1. TODOs completed:
   1. Fixed Home page chart cards that were still shrink-wrapping instead of using full page width.
   2. Replaced old Home page MUI Grid item wrappers with full-width responsive CSS grid wrappers.
   3. Added visible Daily, Weekly, and Monthly aggregation controls beside the Home charts.
2. Git build reference:
   1. App commit: `dd2c33c`
3. New understandings/learnings:
   1. The current MUI version does not apply the old `Grid item xs={...}` layout props as expected, so Home chart wrappers need explicit CSS grid sizing.
   2. Home chart aggregation can reuse the existing global `granularity` filter and backend trend aggregation.
4. Understood next steps (remaining TODOs):
   1. Deploy the app revision and verify Home charts fill the available page width.

## 2026-08-15 03:35 UTC

1. TODOs completed:
   1. Added Stock analysis popup controls for Daily, Weekly, and Monthly aggregation.
   2. Added Forecast Average controls directly inside the Stock analysis popup.
   3. Replaced the separate usage-average chart with a projected stock-level line overlaid on the Stock Level chart.
   4. Renamed forecast-history wording to `Historical Usage Inputs`.
2. Git build reference:
   1. App commit: `da793e1`
3. New understandings/learnings:
   1. Stock forecasting should be presented as future projected stock level based on historical usage, not as a forecast of history.
   2. Chart layout controls need to live in the popup where the user is analysing the stock item.
4. Understood next steps (remaining TODOs):
   1. Deploy the app revision after the service revision and verify the Stock analysis popup behaviour in production.

## 2026-08-15 04:16 UTC

1. TODOs completed:
   1. Added historical usage bars to the Stock analysis popup chart.
   2. Kept actual stock level and projected stock level on the same chart timeline.
   3. Ensured old SKU usage history can extend the chart date axis even when stock-level ledger data only exists from later dates.
2. Git build reference:
   1. App commit: `a27b334`
3. New understandings/learnings:
   1. Historical order-derived usage can predate available stock-level ledger points, so the chart needs to display both data types on a shared date axis.
4. Understood next steps (remaining TODOs):
   1. Deploy the app revision and verify `BSF-TRA-1020-SH-NH-BK-01-OLD` shows 2023 historical usage in the popup chart.

## 2026-08-15 04:45 UTC

1. TODOs completed:
   1. Added Stock analysis popup toggles for `Historical Usage`, `Excluded Usage`, `Actual Stock Level`, and `Projected Stock Level`.
   2. Added a popup `Movement Reason` selector with `Order Placed`, `Manual Edit`, `Order Restocked`, `Order Refunded`, and `All Movements`.
   3. Defaulted the Stock page movement reason to `Order Placed` and passed it into the popup while allowing popup-level changes.
2. Git build reference:
   1. App commit: `f8b75e6`
3. New understandings/learnings:
   1. The analysis popup needs independent series controls because historical usage, exclusions, actual stock, and projected stock answer different operational questions.
4. Understood next steps (remaining TODOs):
   1. Deploy the app revision and verify the popup controls work against the production chart endpoint.

## 2026-08-15 07:08 UTC

1. TODOs completed:
   1. Added the new `Drill Down` dashboard route and navigation item.
   2. Added category and SKU selection modes with caps of 5 categories or 10 SKUs.
   3. Added actual, rolling average, and forecast series toggles with 7, 14, 30, 60, 90, and dynamic rolling windows.
   4. Added line/bar chart mode switching for commerce metrics.
2. Git build reference:
   1. App commit: `62f7cd5`
3. New understandings/learnings:
   1. Rolling-average forecasting should be represented as its own series rather than a projection drawn over the actual series.
4. Understood next steps (remaining TODOs):
   1. Deploy the app revision and verify the new Drill Down dashboard works against the deployed service endpoint.

## 2026-08-15 09:29 UTC

1. TODOs completed:
   1. Added `Customer Segment` as a Drill Down dimension with `New Customer` and `Returning Customer` selections.
   2. Changed the default Drill Down page to show no chart data until a dimension value is selected.
   3. Kept actual values as bars in bar mode while rendering average and forecast series as lines.
   4. Disabled average and forecast series unless exactly one category, SKU, or customer segment is selected.
2. Git build reference:
   1. App commit: `5fbea53`
3. New understandings/learnings:
   1. Multi-series average plots become too noisy for this dashboard, so rolling averages should be constrained to single-series analysis.
4. Understood next steps (remaining TODOs):
   1. Deploy the app revision and verify Drill Down chart controls behave correctly in production.
