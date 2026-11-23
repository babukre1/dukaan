# DukaanFlow

DukaanFlow is a multi-tenant SaaS foundation for small shops. Platform administrators use the React portal in `admin/`; shop owners use the Expo application in `mobile/`; both share the Express API in `server/`.

Phases 1-5 implement the project foundation, authentication, shop administration, subscriptions, customer debt management, and inventory management. Sales remain deferred to Phase 6.

## Architecture

- React + TypeScript admin portal
- Expo SDK 58 + React Native owner app
- Node.js + Express + strict TypeScript modular monolith
- PostgreSQL with a Prisma schema and SQL migrations
- Shared-schema multi-tenancy: every shop-owned record is scoped by the authenticated membership
- Short-lived JWT access tokens and rotating opaque refresh tokens
- Argon2id password hashing; existing bcrypt hashes remain verifiable for migration compatibility
- Zod validation, Pino request logging, Helmet, CORS, and centralized errors

```text
Commercial-App/
├── admin/                  React admin portal
├── mobile/                 Expo owner application
├── server/
│   ├── prisma/             schema, migrations, and seed
│   └── src/
│       ├── config/         environment and PostgreSQL pool
│       ├── middleware/     auth, authorization, validation, errors
│       ├── modules/        auth, shops, subscriptions
│       └── shared/         reusable domain utilities
├── docker-compose.yml      optional local PostgreSQL
└── package.json            workspace commands
```

## Initial setup

Install dependencies from the repository root:

```bash
npm install
```

Copy `server/.env.example` to `server/.env`. For Neon, use the pooled URL as `DATABASE_URL` and the non-pooler URL as `DIRECT_URL`. Both URLs should include TLS, normally `sslmode=require`. Never commit `.env`.

Required production settings:

- `DATABASE_URL`
- `DIRECT_URL` for migrations
- `ACCESS_TOKEN_SECRET` with at least 32 random characters
- `CORS_ORIGIN`, as a comma-separated allowlist
- `COOKIE_SECURE=true` when served over HTTPS

The mobile app reads `EXPO_PUBLIC_API_URL`. Example:

```powershell
$env:EXPO_PUBLIC_API_URL="http://192.168.1.10:4000/api/v1"
npm run dev:mobile
```

Use the development machine's LAN address rather than `localhost` when testing on a physical phone.

## Database

For local PostgreSQL:

```bash
npm run db:up
```

For local development, set both database URLs to:

```text
postgresql://dukaanflow:dukaanflow_dev@localhost:5432/dukaanflow
```

Apply migrations and seed the four plans:

```bash
npm run db:generate
npm run db:migrate
npm run db:seed
```

Seeded plans are Weekly Trial (7 days), Monthly Trial (one calendar month), Monthly, and Yearly. Paid prices are deliberately `0` placeholders until an administrator configures real prices.

### First administrator

Before seeding, set these only in `server/.env`:

```text
BOOTSTRAP_ADMIN_NAME=Platform Admin
BOOTSTRAP_ADMIN_PHONE=+252610000000
BOOTSTRAP_ADMIN_PASSWORD=A-strong-temporary-password1
```

`npm run db:seed` is safe to repeat and will not duplicate the administrator. The initial administrator must change the temporary password on first login. Remove the bootstrap password from the environment afterward.

## Development

Run each application in a separate terminal:

```bash
npm run dev:server
npm run dev:admin
npm run dev:mobile
```

The API health check is `GET http://localhost:4000/api/v1/health`; it reports success only after PostgreSQL responds.

## Local and production environments

Local development uses these defaults:

- Admin: `http://localhost:5173`
- API: `http://localhost:4000/api/v1`
- Expo web: `http://localhost:8081`
- Cookies are not marked `Secure`

Production uses:

- Admin: `https://dukaanadmin.abubakr.so`
- API: `https://dukaanapi.abubakr.so/api/v1`
- Cookies are marked `Secure`
- CORS allows `https://dukaanadmin.abubakr.so`

Create two Vercel projects from the same repository:

1. Backend project: set **Root Directory** to `server`, use the **Express** framework preset, and attach `dukaanapi.abubakr.so`.
2. Admin project: set **Root Directory** to `admin`, use the **Vite** framework preset, and attach `dukaanadmin.abubakr.so`.

Set these variables on the backend Vercel project for the Production environment:

```text
NODE_ENV=production
DATABASE_URL=<pooled production PostgreSQL URL>
DIRECT_URL=<direct production PostgreSQL URL>
ACCESS_TOKEN_SECRET=<at least 32 cryptographically random characters>
CORS_ORIGIN=https://dukaanadmin.abubakr.so
COOKIE_SECURE=true
```

The backend's `vercel.json` explicitly installs development dependencies during the build, so TypeScript and `@types/node` remain available even when `NODE_ENV=production`. Do not configure an Output Directory for the Express project.

The admin production API URL defaults to `https://dukaanapi.abubakr.so/api/v1`. You can override it by setting this variable on the admin Vercel project:

```text
VITE_API_URL=https://dukaanapi.abubakr.so/api/v1
```

Vercel runs the checked-in SQL migrations through the checksum-verified deployment runner and then executes the idempotent plan seed before compiling the server. Production must provide `DIRECT_URL` so migrations use Neon's direct connection rather than its transaction pooler. Local developers can continue using Prisma's `migrate deploy` command.

## Authentication and tenant isolation

- Login identities use globally unique normalized international phone numbers.
- No email, SMS, OTP, Twilio, or external identity provider is used.
- The API derives an owner's shop from the active membership in the access token context; owner requests never select an arbitrary `shopId`.
- Refresh tokens are stored only as SHA-256 hashes, rotate on every refresh, and are revoked as a family when reuse is detected.
- Admin browser refresh tokens use HttpOnly, SameSite cookies. Mobile refresh tokens use Expo SecureStore.
- Suspended and inactive shops are blocked regardless of subscription.
- An expired subscription gives read-only access. Pending or cancelled subscriptions restrict business writes.

## Subscription lifecycle

Administrators can activate, renew, extend, and cancel manually. Mutations lock the shop row, write the subscription and event in one transaction, and accept idempotency keys. The effective status is computed at request time using the exclusive boundary `startsAt <= now < expiresAt`.

Calendar policy: days add UTC calendar days; months and years preserve the day when possible and clamp to the destination month's last day. Early renewal starts from the existing expiration so remaining paid time is preserved. Expired renewal starts now.

Each shop receives one introductory trial by default. A repeated trial requires an explicit override and reason, which is stored in event history.

## Main API endpoints

Authentication:

- `POST /api/v1/auth/login`
- `POST /api/v1/auth/refresh`
- `POST /api/v1/auth/logout`
- `GET /api/v1/auth/me`
- `POST /api/v1/auth/change-password`

Admin shops and owners:

- `GET /api/v1/admin/dashboard`
- `GET|POST /api/v1/admin/shops`
- `GET|PATCH /api/v1/admin/shops/:id`
- `POST /api/v1/admin/shops/:id/status`
- `GET /api/v1/admin/owners`
- `POST /api/v1/admin/owners/:id/status`
- `POST /api/v1/admin/owners/:id/reset-password`

Subscriptions:

- `GET|POST /api/v1/admin/subscription-plans`
- `PATCH /api/v1/admin/subscription-plans/:id`
- `GET /api/v1/admin/subscriptions`
- `GET /api/v1/admin/subscriptions/expiring`
- `GET /api/v1/admin/shops/:shopId/subscription`
- `POST /api/v1/admin/shops/:shopId/subscription/{activate|renew|extend|cancel}`
- `GET /api/v1/admin/shops/:shopId/subscription/history`
- `GET /api/v1/shop/subscription`

Customers and debt:

- `GET|POST /api/v1/customers`
- `GET|PATCH|DELETE /api/v1/customers/:id`
- `POST /api/v1/customers/:id/debts/opening`
- `POST|GET /api/v1/customers/:id/debts`
- `GET /api/v1/customers/:id/statement`
- `POST /api/v1/customers/:id/payments`
- `POST /api/v1/debts/:id/reverse`
- `POST /api/v1/payments/:id/reverse`
- `GET /api/v1/debts/summary`

Products and inventory:

- `GET|POST /api/v1/categories`
- `PATCH|DELETE /api/v1/categories/:id`
- `GET|POST /api/v1/products`
- `GET|PATCH|DELETE /api/v1/products/:id`
- `GET /api/v1/products/:id/stock`
- `POST /api/v1/products/:id/stock/receive`
- `POST /api/v1/products/:id/stock/adjust`
- `GET /api/v1/products/:id/stock/movements`
- `GET /api/v1/inventory/summary`
- `GET /api/v1/inventory/low-stock`

Sales, receipts, and returns:

- `POST|GET /api/v1/sales`
- `GET /api/v1/sales/summary`
- `GET /api/v1/sales/:id`
- `GET /api/v1/sales/:id/receipt`
- `POST /api/v1/sales/:id/void`
- `POST|GET /api/v1/sales/:id/returns`

Creating a sale is one PostgreSQL transaction: the API locks a shop-scoped idempotency key, allocates the next sale number, calculates totals from stored product prices, conditionally deducts stock, appends stock movements, records an immediate payment, and creates the unpaid customer debt when applicable. Duplicate product lines are merged before validation and inventory rows are processed in a consistent order.

Sale item names, units, prices, and costs are snapshots, so later product edits do not change old receipts. Fully paid walk-in sales do not require a customer. Credit and partial-payment sales require a shop customer and append a `CREDIT_SALE` debt entry. Immediate sale payments are linked to the sale but are deliberately not treated as old-debt repayments.

Voids and returns preserve the original sale and use compensating stock and debt records. A paid void requires explicit confirmation that money was refunded. Returns allocate sale-level discounts deterministically, cap cumulative returned quantities and values, and require the owner to explicitly split the outcome between customer-debt reduction and an issued refund. Damaged or expired returned items can be recorded without restocking them.

Financial and stock mutations require an `Idempotency-Key` header. Debt and stock ledgers are append-only; cached balances are updated in the same PostgreSQL transaction. Repayments use a conditional update to prevent overpayment. Physical stock adjustments require the quantity originally shown to the user so concurrent changes return a conflict rather than being overwritten.

## Verification

```bash
npm run verify
```

Or run checks independently:

```bash
npm run build
npm run typecheck
npm run lint
npm run test:server
```

Critical database and concurrency behavior should also be tested against a dedicated PostgreSQL test database in CI. Unit tests cover phone normalization and UTC calendar/status behavior.

## Phase 6 and known limitations

Phase 6 provides paid, credit, and partial sales; inventory and debt integration; sale history; text receipts with native device sharing; voids; partial/full returns; and sales summaries. Receipts are intentionally text-based rather than PDF/printer documents. Refunds are owner-confirmed records and are not connected to cash drawers, mobile-money providers, or bank APIs. Debt remains an account-level balance, so ambiguous returns require an explicit debt-reduction/refund decision instead of automatic invoice allocation.

Suppliers, purchase orders, expenses, taxes, barcode scanning, unit conversion, multiple branches/warehouses, complex accounting, and payment-provider integrations remain out of scope. Daily summaries use the date boundaries supplied by the client; a persisted per-shop reporting timezone is a later enhancement.
