# MicroBiz MVP (Web POS)

MicroBiz is a Next.js + Prisma MVP web POS app for Philippine micro retail stores, with offline queue/sync support.

## Stack
- Frontend: Next.js App Router + TypeScript
- Backend: Next.js API Routes
- DB: PostgreSQL + Prisma
- Auth: NextAuth Credentials (JWT session cookie)
- Offline: PWA + IndexedDB (Dexie) + sync endpoints
- Tests: Vitest + Playwright smoke tests

## Features Implemented
- Sales/POS: search/SKU/barcode lookup, cart, item/order discounts, payments (CASH/QR/SPLIT), receipt panel, void/refund
- Inventory: product CRUD, stock-in, stock adjustment, repack transactions, low-stock list, CSV import endpoint
- Customers: CRUD (basic), attach customer to sale, sales history
- Reports: daily/weekly/monthly summary, top items, inventory report, payment breakdown, owner-only profit estimate
- Users/Roles: OWNER/MANAGER/CASHIER with API permission enforcement
- Offline mode: pending sale/adjust/repack queue in IndexedDB; push/pull sync with idempotent opId and retry state
- Audit logs: void, refund, adjustment, price edit

## Setup
1. Copy env file:
```bash
cp .env.example .env
```
2. Start Postgres:
```bash
docker compose up -d
```
3. Install dependencies:
```bash
npm install
```
4. Generate Prisma client + migrate + seed:
```bash
npm run prisma:generate
npm run prisma:migrate
npm run prisma:seed
```
5. Run app:
```bash
npm run dev
```

## Demo Users
- OWNER: `owner@microbiz.local` / `Owner123!`
- MANAGER: `manager@microbiz.local` / `Manager123!`
- CASHIER: `cashier@microbiz.local` / `Cashier123!`

## API Summary
| Method | Endpoint | Purpose |
|---|---|---|
| GET | `/api/products` | list/search products |
| POST | `/api/products` | create product |
| PUT | `/api/products/:id` | update product |
| DELETE | `/api/products/:id` | delete product |
| POST | `/api/products/import-csv` | import rows (JSON `rows`) |
| GET | `/api/products/low-stock` | low stock list |
| GET/POST | `/api/customers` | list/create customers |
| PUT | `/api/customers/:id` | update customer |
| GET | `/api/customers/:id/history` | customer sales history |
| POST | `/api/pos/transaction` | create POS sale |
| POST | `/api/pos/void` | void transaction (OWNER/MANAGER) |
| POST | `/api/pos/refund` | refund transaction (OWNER/MANAGER) |
| GET | `/api/pos/transactions` | recent transactions |
| POST | `/api/inventory/stock-in` | stock in |
| POST | `/api/inventory/adjust` | stock adjustment |
| POST | `/api/inventory/repack` | repack |
| GET | `/api/inventory/movements` | stock movement list |
| GET | `/api/reports/summary?preset=daily\|weekly\|monthly` | report summary |
| GET | `/api/reports/top-items` | top selling items |
| GET | `/api/reports/payment-breakdown` | payment totals |
| GET | `/api/reports/inventory` | inventory stock report |
| GET/POST | `/api/users` | list/create users (OWNER) |
| PUT | `/api/users/:id` | update user role (OWNER) |
| GET/PUT | `/api/settings` | app settings (`allowNegativeStock`) |
| POST | `/api/sync/push` | push pending ops batch |
| GET | `/api/sync/pull?since=ISO_DATE` | pull updated products |

## CSV Import
- Template: `docs/products-template.csv`
- Send parsed rows to `POST /api/products/import-csv`.

## Offline Notes
- IndexedDB stores:
  - `cachedProducts`
  - `pendingOps`
  - `meta.lastSyncAt`
- When offline:
  - POS sale and inventory adjust/repack queue locally (`Pending Sync`)
- When online:
  - App pushes pending ops in order to `/api/sync/push`
  - Pulls changed products from `/api/sync/pull`
  - Failed ops are preserved with error/retry count

## Tests
- Unit:
```bash
npm test
```
- E2E smoke:
```bash
npm run test:e2e
```

## Demo Script
1. Login as CASHIER, open POS, add item by SKU/barcode, complete sale.
2. Turn network offline, create another sale, confirm it shows pending sync.
3. Turn network online, observe sync banner progress to Synced.
4. Login as MANAGER, refund/void a completed transaction.
5. Login as OWNER, open Reports and verify profit estimate visible only for OWNER.
