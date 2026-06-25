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
