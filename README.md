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
```powershell
$GIT_REF = git rev-parse --short HEAD
gcloud builds submit --project natural-yield-analytics --config deploy/production-cloudbuild.yaml --substitutions "_GIT_REF=$GIT_REF" .
gcloud run deploy woo-analytics-app --image "australia-southeast1-docker.pkg.dev/natural-yield-analytics/cloud-run-source-deploy/woo-analytics-app:$GIT_REF" --region australia-southeast1 --project natural-yield-analytics --quiet
```

Direct `gcloud run deploy --source .` frontend deployments are intentionally
unsupported because they cannot prove which Vite API URL was compiled into the
static bundle.

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

## 2026-08-15 23:17 UTC

1. TODOs completed:
   1. Added Copy to Clipboard controls to API Debug Panel entries for request/response payloads.
   2. Reset Stock Items, Stock Shortages, and Stocktake pagination to page 1 when shared filters change.
   3. Added `Last 12 Months` to the global Date Range dropdown.
   4. Added Stock Items controls for Avg Daily Usage, Days of Cover, and Projected Stockout range filtering.
2. Git build reference:
   1. App commit: `14a0ba2a5f08ce495ed9561291a59d7abe66910f`
3. New understandings/learnings:
   1. Stock Items forecast metric filters need to live in shared filter state so the existing data hooks refetch consistently.
4. Understood next steps (remaining TODOs):
   1. Deploy the app revision after the service revision and verify the debug copy action, new date range, page reset, and Stock Items filters in production.

## 2026-08-16 00:53 UTC

1. TODOs completed:
   1. Changed Stock Items range controls so typing in fields such as `Days Cover Min` no longer reloads the table on every keystroke.
   2. Added `Apply` and `Clear` actions for Avg Daily Usage, Days of Cover, and Projected Stockout filters.
   3. Added a bulk filter updater so applying those fields updates shared filters in one operation.
2. Git build reference:
   1. App commit: `923d1fe25cd4f7419f9ffc7c6a87acaa944a85b6`
3. New understandings/learnings:
   1. Stock Items range inputs need draft state because reload-on-change makes multi-character numeric edits difficult.
4. Understood next steps (remaining TODOs):
   1. Deploy the app revision and verify Stock Items only reloads when `Apply` or `Clear` is clicked.

## 2026-08-17 00:36 UTC

1. TODOs completed:
   1. Improved Stocktake mobile portrait layout by hiding `Category` on mobile.
   2. Combined SKU, product name, and parsed variant attributes into one mobile `Item` cell.
   3. Renamed `Qty To Be Packed` to `Unpacked`.
   4. Replaced Stocktake `Save` button text with a tick icon.
   5. Added approximate colour chips from variant attribute text.
2. Git build reference:
   1. App commit: `07209a0d77249dbf6ee4383172c3ea9f0af7bd31`
3. New understandings/learnings:
   1. Stocktake needs a purpose-built mobile row layout because the generic desktop table wastes portrait screen width.
4. Understood next steps (remaining TODOs):
   1. Deploy the app revision and verify Stocktake mobile portrait view uses the compact item column and tick save control.

## 2026-08-17 01:31 UTC

1. TODOs completed:
   1. Reworked mobile Stocktake rows into two sub-rows: full-width item details above and Qty/Unpacked/New Qty/save controls below.
   2. Used `variant_attributes` from the service for Product Variant Attribute values.
   3. Restored colour chip rendering from returned variant attributes.
   4. Made Stock page tabs scrollable on mobile portrait layouts.
2. Git build reference:
   1. App commit: `fc4654ed54e7d46c6b95da25fbd5c3e61b4eb094`
3. New understandings/learnings:
   1. Mobile Stocktake needs a custom list/card layout because table columns cannot make the product identity row span the full available width.
4. Understood next steps (remaining TODOs):
   1. Deploy the app revision after the service revision and verify the Stocktake tab is reachable and attributes/colour chips render on mobile.

## 2026-09-13 20:54 UTC

1. TODOs completed:
   1. Updated the Packing dimensions dialog to load an existing Shippit order before showing parcel edit actions.
   2. Added save support for editable Shippit order parcel dimensions.
   3. Added the no-Shippit-order notice: `Shippit Order doesn't exist - check Australia Post.`
   4. Deployed frontend revision `woo-analytics-app-00147-85q` and invalidated the CDN cache.
2. Git build reference:
   1. App commit: `6ec71aef1903bf3e64e696f91060e88bb17eebcd`.
3. New understandings/learnings:
   1. The default packing flow should edit Shippit's existing order when it exists, rather than creating a new quote-first workflow.
4. Understood next steps (remaining TODOs):
   1. Test a Shippit order and an Australia Post order from the Packing page to confirm the two user paths are clearly separated.

## 2026-09-17 04:16 UTC

1. TODOs completed:
   1. Seeded Packing Dimensions parcel rows from WooCommerce product dimensions when no existing Shippit order is available.
   2. Kept manual parcel entry available when WooCommerce product dimensions are missing.
   3. Avoided duplicate parcel rows for bundle child lines when the bundle parent has usable dimensions.
   4. Deployed frontend revision `woo-analytics-app-00165-h9q` and invalidated the CDN cache.
2. Git build reference:
   1. App commit: `18104eee0d5cde2713b7a82a80ed18936808e748`.
3. New understandings/learnings:
   1. Non-Shippit packing orders still need quote-ready seed dimensions, otherwise the dialog opens with blank parcel rows and cannot request Shippit quotes.
4. Understood next steps (remaining TODOs):
   1. Test an Australia Post order on the Packing page to confirm seeded dimensions are accurate before requesting Shippit quotes.

## 2026-09-17 08:32 UTC

1. TODOs completed:
   1. Defined a separate staging app deployment using the staging analytics API base URL.
   2. Added an explicit Docker staging build so Vite embeds the staging service URL.
   3. Deployed and verified the staging app, API debug panel, request/response capture, CORS, and Cloud Logging mirroring.
2. Git build reference:
   1. Deployed app commit: `99e421c56e11a4aa084bc8715c888e72718b416b`.
3. New understandings/learnings:
   1. The frontend selects its analytics backend at build time; the WordPress plugin environment assertion does not route frontend requests.
4. Understood next steps (remaining TODOs):
   1. No remaining Staging Analytics Isolation app TODOs.

## 2026-09-18 02:10 UTC

1. TODOs completed:
   1. Made the saved return case the required source for Shippit return creation.
   2. Replaced side-effecting label polling with a read-only status refresh.
   3. Added an explicit confirmation dialog for approving a return and generating its label.
   4. Added focused UI coverage for case-first creation, read-only refresh, and confirmed label generation.
2. Git build reference:
   1. Returns UI commit: `c1832d940844be52e1ed2309b54a1af3b5637e73`.
   2. Deployed staging revision: `woo-analytics-app-staging-00007-tnw`.
3. New understandings/learnings:
   1. Shippit label generation is a business action, not a polling operation, and requires explicit operator intent.
   2. Quantity inputs must be frozen after saving the authoritative case so the shipment cannot diverge from the recorded return.
4. Understood next steps (remaining TODOs):
   1. Complete Product Owner acceptance testing in the staging Returns page.
   2. Keep production unchanged until acceptance is complete.

## 2026-09-20 00:42 UTC — Chat customer identity labels

1. TODOs completed:
   1. Replaced numeric-only chat labels with verified customer names where available.
   2. Added safe fallback to the WordPress display name.
   3. Added guest email, claimed order and new-sales context to the authorized Inbox.
   4. Added guest email as a CRM lookup identity while keeping order claims unverified.
   5. Redacted names and order references from API diagnostics.
2. New understandings/learnings:
   1. Conversation identity snapshots avoid an N+1 CRM lookup for every Inbox refresh.
   2. Guest-submitted order numbers must remain visibly unverified until associated by an operator.
3. Understood next steps (remaining TODOs):
   1. Deploy and validate the customer labels against staging conversations.
   2. Add the audited guest-to-customer/order association workflow.

## 2026-09-20 01:01 UTC — Customer identity staging deployment

1. TODOs completed:
   1. Deployed guarded image `f365e2a` as revision `woo-analytics-app-staging-00026-mzp`.
   2. Verified the active Customer 1978 conversation contains a customer display name.
   3. Verified guest identity claims and new-sales status reach the operator Inbox API.
2. New understandings/learnings:
   1. Names can be displayed without additional per-row CRM requests because they are conversation snapshots.
   2. Claimed guest orders remain explicitly unverified in the operator UI.
3. Understood next steps (remaining TODOs):
   1. Complete Product Owner visual acceptance.
   2. Build audited guest association controls.

## 2026-09-20 02:26 UTC — Current customer page hyperlink

1. TODOs completed:
   1. Added an operator hyperlink from the reported page title/path to the configured WordPress storefront.
   2. Opened customer pages in a separate tab with `noopener`/`noreferrer`.
   3. Restricted destinations to relative storefront paths and removed query strings/fragments.
2. New understandings/learnings:
   1. The environment-controlled storefront origin prevents conversation data from selecting an arbitrary host.
3. Understood next steps (remaining TODOs):
   1. Deploy and visually confirm the hyperlink in staging.

## 2026-09-20 02:30 UTC — Current-page hyperlink deployed

1. TODOs completed:
   1. Deployed guarded image `e8922b4` as revision `woo-analytics-app-staging-00027-hm8`.
   2. Verified TypeScript, Inbox component behavior and safe storefront URL construction.
2. New understandings/learnings:
   1. Existing privacy-safe page paths require no backend migration.
3. Understood next steps (remaining TODOs):
   1. Complete Product Owner visual acceptance.

## 2026-09-18 09:57 UTC

1. TODOs completed since the previous main push:
   1. Added an isolated staging application build bound to the staging analytics service and verified API diagnostics and Cloud Logging mirroring.
   2. Added Partial Fulfillment and Combine Orders packing workflows with authoritative action guards and parcel quote dialogs.
   3. Added Shipped and Delivered order-status filters for the Shippit lifecycle workflow.
   4. Expanded Returns with authoritative case-first processing, shipment and packing details, quote selection, live-booking confirmation, read-only refresh, and label retrieval.
   5. Added the Reshipments page with source-order item selection, product search, inventory-effect controls, destination editing, parcel dimensions, quote failures, and live-shipment confirmation.
   6. Fixed the Returns workflow to require Save Return Case before quoting and to submit the validated return-case identifier.
2. Git build reference:
   1. Main push range: `38bdd01..f3f97d0`.
   2. Latest app build: `f3f97d0550c3cb586e02f0f5a43518e4f4c367c1`.
   3. Deployed staging revision: `woo-analytics-app-staging-00012-69x`.
3. New understandings/learnings:
   1. The Returns UI must freeze saved line quantities and quote that authoritative case rather than reconstructing mutable request lines.
   2. Shippit return creation is a live booking action and must be clearly separated from read-only status and label retrieval.
   3. Sanitised staging addresses must be visibly rejected and replaced with validated test destinations before requesting carrier quotes.
4. Understood next steps (remaining TODOs):
   1. Continue Product Owner acceptance testing for Returns and Reshipments on staging.
   2. Keep production unchanged until staging acceptance is complete.

## 2026-09-19 06:58 UTC — NY Chat CRM Inbox

1. TODOs completed:
   1. Added Open, Assigned, Waiting and Closed NY Chat queues.
   2. Added conversation history, idempotent replies, assignment and workflow actions.
   3. Embedded linked WooCommerce customer CRM details.
   4. Redacted chat content and operator email addresses from the existing API debug mirror.
2. New understandings/learnings:
   1. The staging CRM app and API require direct Cloud Run IAP before an operator Inbox can be exposed safely.
   2. Browser requests must include IAP credentials while all NY Chat internal credentials remain server-side.
   3. The existing toggleable API debug panel can diagnose Inbox traffic without retaining transcript content.
3. Understood next steps (remaining TODOs):
   1. Validate domain-restricted IAP login and the Inbox on staging.
   2. Add realtime replies and reconnect/replay handling.
   3. Add audited manual association for guest conversations.

## 2026-09-19 07:39 UTC — NY Chat Inbox staging deployment

1. TODOs completed:
   1. Built and deployed Git build `4a63bf0` as `woo-analytics-app-staging-4a63bf0`.
   2. Restricted staging access to the `naturalyield.com.au` domain through direct Cloud Run IAP.
   3. Passed TypeScript compilation and the focused Inbox queue/reply component test.
   4. Verified unauthenticated `/chat` access is redirected to Google login.
2. New understandings/learnings:
   1. The repository's complete frontend suite has pre-existing failures in `App.test.tsx`, `ReturnsPage.test.tsx` and Playwright test discovery; the new Inbox test passes independently.
   2. Credentialed browser API requests and unauthenticated IAP `OPTIONS` handling are both required for the separate staging app and API origins.
3. Understood next steps (remaining TODOs):
   1. Complete Product Owner browser acceptance of `/chat`.
   2. Add realtime updates and audited guest association.
   3. Keep production unchanged until staging acceptance is complete.

## 2026-09-19 08:09 UTC — Staging same-origin correction

1. TODOs addressed:
   1. Diagnosed browser API failures caused by separate app and API IAP sessions.
   2. Changed the staging build to use `https://analytics-staging.naturalyield.com.au` for API requests.
   3. Provisioned same-origin load-balancer routing for the app and `/api/*`.
2. New understandings/learnings:
   1. A browser fetch cannot complete an interactive IAP redirect for a separately authenticated API origin.
   2. Staging must mirror production's single hostname and path routing to preserve one operator session.
3. Understood next steps (remaining TODOs):
   1. Deploy the corrected staging build after the managed certificate becomes active.
   2. Validate dashboard and NY Chat API traffic through the shared hostname.

## 2026-09-19 08:24 UTC — Same-origin staging deployment

1. TODOs completed:
   1. Deployed Git build `969e51f` as `woo-analytics-app-staging-969e51f`.
   2. Activated `https://analytics-staging.naturalyield.com.au` with managed TLS and domain-restricted IAP.
   3. Restricted direct Cloud Run ingress and enabled complete load-balancer diagnostics.
2. New understandings/learnings:
   1. Both the app and `/api/*` now use the same Google-managed IAP client and hostname.
3. Understood next steps (remaining TODOs):
   1. Complete Product Owner browser validation at the new staging URL.

## 2026-09-19 09:12 UTC — Guarded return cancellation interface

1. TODOs completed since the previous main push:
   1. Added a dedicated Cancel Return action for eligible requested and approved returns.
   2. Added a confirmation dialog showing the authoritative Shippit state and exact recorded stock quantity that will be restored.
   3. Removed generic cancellation as a selectable status transition.
   4. Reused the same operation identifier across retries and added focused cancellation regression coverage.
   5. Passed the focused Returns tests and production TypeScript build, then deployed the staging interface.
2. Git build reference:
   1. Feature commit: `e8b75c7f8167ac547015986348db9a66ed8d591d`.
   2. Staging revision: `woo-analytics-app-staging-e8b75c7`.
3. New understandings/learnings:
   1. Operators must see both carrier and inventory consequences before confirming cancellation.
   2. Cancellation errors must keep the original operation identifier available for an idempotent retry.
4. Understood next steps (remaining TODOs):
   1. Complete Product Owner acceptance testing through the staging Returns page.
   2. Keep production unchanged until staging acceptance is complete.

## 2026-09-19 20:30 UTC — Production Returns interface deployment

1. TODOs completed:
   1. Deployed the alternate return-sender address controls and guarded cancellation interface to production.
   2. Routed 100 percent of production frontend traffic to revision `woo-analytics-app-d30f49b`.
   3. Invalidated the production CDN cache and verified no error-severity logs for the deployed revision.
2. Git build reference:
   1. Deployed app build: `d30f49b8f1199338a361cbd0ebf796edefe051db`.
3. New understandings/learnings:
   1. The previous production frontend contained the Reshipment retry repair but predated the alternate return-sender controls.
4. Understood next steps (remaining TODOs):
   1. Confirm the alternate sender control after refreshing the production Returns page and loading an order's returnable items.

## 2026-09-19 22:03 UTC — Environment-bound frontend build guard

1. TODOs addressed:
   1. Diagnosed staging revision `woo-analytics-app-staging-a0dae14` as a source deployment compiled with the production API default.
   2. Removed the Dockerfile's silent production API default.
   3. Added staging and production image builds that verify the expected compiled API hostname and reject the opposite environment.
   4. Added immutable Git revision metadata to frontend images.
2. New understandings/learnings:
   1. A Cloud Run source deployment can silently rebuild Vite assets with Dockerfile defaults and replace a correctly environment-bound image.
   2. Frontend environment isolation must be verified against compiled assets, not inferred from Cloud Run runtime variables.
3. Understood next steps (remaining TODOs):
   1. Build the latest app commit through the guarded staging pipeline.
   2. Deploy that exact image and validate that API events remain on the staging hostname.

## 2026-09-19 22:07 UTC — Guarded staging bundle deployed

1. TODOs completed:
   1. Built Git revision `5fda01f` through the environment-bound staging pipeline.
   2. Verified the compiled bundle contains the staging API hostname and excludes the production hostname.
   3. Deployed `woo-analytics-app-staging-5fda01f` with 100 percent traffic while preserving the latest Returns changes.
   4. Verified the deployed revision has no error-severity Cloud Logging entries.
2. New understandings/learnings:
   1. Cloud Run service build annotations can remain from older source deployments; the serving image reference and compiled-bundle guard are the authoritative deployment evidence.
3. Understood next steps (remaining TODOs):
   1. Refresh the staging browser and confirm API diagnostics use `analytics-staging.naturalyield.com.au`.

## 2026-09-19 22:34 UTC — Chat notifications and realtime Inbox

1. TODOs completed:
   1. Added a top-right NY Chat mailbox icon with a 60-second unread refresh and conversation badge.
   2. Added per-conversation unread indicators and automatic read receipts.
   3. Added realtime active-conversation updates with reconnect and deduplication.
   4. Added current customer page and last-seen context.
   5. Added authenticated image upload and display.
2. New understandings/learnings:
   1. The notification badge counts conversations with unread customer messages rather than raw message volume.
   2. The active conversation remains current through SSE while the 60-second refresh covers background queues.
3. Understood next steps (remaining TODOs):
   1. Deploy the guarded staging build and complete browser acceptance.
   2. Keep production unchanged until acceptance is complete.

## 2026-09-20 23:55 UTC — CRM customer email history

1. TODOs completed:
   1. Added a modular Email History section to the shared customer CRM panel.
   2. Added inbound/outbound direction, message date, subject, preview and authenticated Gmail search links.
   3. Added explicit connector states for unconfigured, unavailable and stale synchronization.
   4. Redacted customer email query values, subjects, snippets and message-address fields from the API debug panel and mirrored Cloud Logging events.
2. New understandings/learnings:
   1. The shared customer panel makes email history available from Customers, Packing and NY Chat without duplicating integration logic.
   2. Gmail original-message links are search links because the Gmail API does not provide durable browser permalinks.
   3. The UI must expose connector health honestly and must not display seeded or fallback message history.
3. Understood next steps (remaining TODOs):
   1. Deploy the backend and frontend to staging with the connector disabled until an isolated staging mailbox exists.
   2. Complete the Workspace read-only authorization and initial bounded sync.
   3. Validate customer matching, Gmail links and privacy-safe diagnostics before production access.
