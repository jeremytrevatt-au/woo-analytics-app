# Natural Yield Woo Analytics App

Frontend analytics UX for Natural Yield WooCommerce data.

## Product focus

1. Search and filtering for commerce entities.
2. Historical trends for orders, customers, and stock.
3. Forecast-oriented decision support.

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
   2. `/api/v1/customers/overview`
   3. `/api/v1/stock/overview`
3. If the API URL is not set or endpoint is unavailable, the app falls back to seeded demo values for UX continuity.

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
