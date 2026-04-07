> **Warning**
> This project is under active development and not yet ready for production use.

# Ledger

Ledger is a billing and payment service for the ConvStack platform. It provides a unified payment abstraction layer supporting multiple providers (Stripe, manual bank transfer/cash), with invoicing, subscriptions, products, and GDPR-compliant data retention.

## What it does

- **Payment providers** — Stripe (checkout, subscriptions, refunds, proration) and Manual (IBAN, cash, custom instructions)
- **Invoices** — Sequential numbering (INV-2026-0001), line items, tax calculation, email notifications
- **Products** — One-time and recurring products with per-product proration toggle
- **Subscriptions** — Create, cancel, upgrade/downgrade with proration support (Stripe)
- **Webhook subscribers** — Fan-out event delivery to multiple external services
- **Service-to-service API** — Other ConvStack services create invoices via ServiceKey auth
- **GDPR compliance** — Configurable data retention with automatic anonymization
- **Dynamic manifest** — UI adapts based on active provider capabilities

## Architecture

Ledger is a backend-only REST API — the Dashboard renders all UI from its JSON manifest. Ledger registers with Lanyard's service catalog on boot.

```
Browser → Dashboard (UI) → API Proxy → Ledger (REST API + PostgreSQL)
                                     → Lanyard (Auth + Service Catalog)

External services → Ledger API (ServiceKey auth)
Stripe → Ledger webhooks (signature-verified)
Ledger → Webhook subscribers (fan-out)
```

## Tech Stack

- **Runtime:** Bun
- **Framework:** TanStack React Start (for API route handling)
- **Database:** PostgreSQL via Drizzle ORM
- **Payments:** Stripe SDK
- **Email:** Nodemailer (SMTP)
- **Encryption:** AES-256-GCM for provider settings at rest
- **Linting:** Biome

## Getting Started

### Prerequisites

- Bun installed
- PostgreSQL database
- Lanyard running (for authentication and service registration)
- Dashboard running (for the UI)

### 1. Install dependencies

```bash
bun install
```

### 2. Set up environment

```bash
cp .env.example .env
```

Edit `.env`:

```env
DATABASE_URL=postgres://ledger:ledger@localhost:5432/ledger
LANYARD_URL=http://localhost:3000
LANYARD_SERVICE_KEY=sk_svc_your_key_here
ENCRYPTION_KEY=<64-char hex string>
DASHBOARD_URL=http://localhost:4000
PORT=5002
```

Generate an encryption key:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### 3. Run migrations

```bash
bun run db:migrate
```

### 4. Register with Lanyard

1. Sign in to Dashboard as an admin
2. Go to **Lanyard Admin → Services → Register Service**
3. Fill in:
   - **Name:** Ledger
   - **Slug:** `ledger`
   - **Type:** Service
   - **Base URL:** `http://localhost:5002`
   - **Health Check Path:** `/api/health`
4. Click **Register Service**
5. **Copy the API key** (`sk_svc_...`) and set it in `.env` as `LANYARD_SERVICE_KEY`

### 5. Start the dev server

```bash
bun run dev
```

Ledger will:

- Start on port 5002
- Create default billing settings
- Send a heartbeat to Lanyard with its dynamic UI manifest
- Appear in the Dashboard sidebar as "Ledger"

### 6. Configure a payment provider

1. In the Dashboard, navigate to **Ledger → Providers**
2. Click **Add Provider** and choose Stripe or Manual
3. Open the provider and configure its settings (API keys, IBAN details, etc.)
4. Click **Activate** to make it the active provider

## API Documentation

Ledger serves its OpenAPI specification at:

```
GET /api/openapi
```

This is also aggregated into Lanyard's centralized Swagger UI at:

```
http://localhost:3000/docs
```

## Scripts

| Script | Description |
|---|---|
| `bun run dev` | Start dev server (port 5002) |
| `bun run build` | Production build |
| `bun run start` | Start production server |
| `bun run db:generate` | Generate migration files |
| `bun run db:migrate` | Run migrations |
| `bun run db:push` | Push schema to DB (dev) |
| `bun run typecheck` | TypeScript type checking |
| `bun run lint` | Biome linting |
| `bun run openapi:generate` | Regenerate OpenAPI spec |

## Service-to-Service API

Other ConvStack services can create invoices for users:

```bash
curl -X POST http://localhost:5002/api/invoices \
  -H "Authorization: ServiceKey sk_svc_..." \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "user-id",
    "items": [
      {
        "description": "Convention Ticket",
        "unitPrice": 5000,
        "quantity": 1,
        "productId": "optional-product-id"
      }
    ],
    "currency": "EUR",
    "notes": "VIP package upgrade",
    "dueDate": "2026-05-01T00:00:00Z",
    "skipTax": false
  }'
```

| Field | Type | Required | Description |
|---|---|---|---|
| `userId` | string | Yes | The user to bill |
| `items` | array | Yes | At least one line item |
| `items[].description` | string | Yes | Line item description |
| `items[].unitPrice` | integer | Yes | Price in cents (e.g. 5000 = €50.00) |
| `items[].quantity` | integer | No | Defaults to 1 |
| `items[].productId` | string | No | Link to a Ledger product |
| `currency` | string | No | Defaults to the configured default (EUR) |
| `notes` | string | No | Internal notes on the invoice |
| `dueDate` | string | No | ISO 8601 due date |
| `skipTax` | boolean | No | Skip automatic tax calculation |

Response:

```json
{
  "success": true,
  "id": "invoice-id",
  "invoiceNumber": "INV-2026-0001",
  "status": "pending",
  "subtotal": 5000,
  "tax": 950,
  "total": 5950
}
```

### Available service endpoints

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/invoices` | Create invoice for a user |
| `POST` | `/api/invoices/:id/mark-paid` | Mark invoice as paid |
| `GET` | `/api/invoices/:id/status` | Check invoice status |

## Webhook Events

Register webhook subscribers in **Ledger → Webhooks** to receive events:

| Event | Description |
|---|---|
| `subscription.paid` | Invoice paid via Stripe |
| `subscription.payment_failed` | Payment attempt failed |
| `subscription.updated` | Subscription status changed |
| `subscription.cancelled` | Subscription cancelled |

Payloads are delivered as POST requests with `X-Webhook-Secret` and `X-Webhook-Event` headers.

## Stripe Webhooks

Configure these events in the Stripe Dashboard under **Developers → Webhooks**:

| Event | Purpose |
|---|---|
| `checkout.session.completed` | Marks invoice as paid |
| `payment_intent.payment_failed` | Marks invoice as failed |
| `customer.subscription.updated` | Updates subscription period/status |
| `customer.subscription.deleted` | Cancels subscription |
| `invoice.payment_succeeded` | Handles recurring invoice payments |

Webhook URL: `https://your-ledger-url/api/webhooks/stripe`

---

Made and maintained with 🧡 by [Headpat](https://headpat.space)
