# Wix ↔ HubSpot Integration

A self-hosted Wix app that connects HubSpot accounts, syncs contacts bi-directionally with infinite loop prevention, captures form submissions with UTM attribution, and provides a configurable field mapping UI.

## Architecture

```
Wix Platform  ←──webhooks/API──→  Next.js App  ←──OAuth/API──→  HubSpot Platform
                                      ↕
                              Neon PostgreSQL (Prisma)
```

**Single Next.js deployment** serves three roles:
- **API Backend** — 16 route handlers for auth, sync, webhooks, forms, field mapping
- **Dashboard UI** — React pages embedded as iframes inside the Wix admin panel
- **Embeddable Forms** — Standalone lead capture pages with UTM tracking

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 14 (App Router) |
| Language | TypeScript |
| Database | Neon PostgreSQL via Prisma + `@prisma/adapter-neon` |
| Frontend | React, Tailwind CSS, Lucide icons |
| HubSpot SDK | `@hubspot/api-client` (official) |
| Wix API | Direct REST via axios (server-to-server) |
| Auth | OAuth 2.0 (HubSpot), Client Credentials (Wix) |
| Encryption | AES-256-GCM for tokens at rest |

## Features

### Feature #1 — Bi-Directional Contact Sync

- **Real-time sync** via webhooks (Wix `contact.created`/`contact.updated`, HubSpot `contact.creation`/`contact.propertyChange`)
- **Manual full sync** button in dashboard (Wix → HubSpot, HubSpot → Wix, or both)
- **User-configurable field mapping** — map any Wix field to any HubSpot property with per-field direction and transforms
- **Infinite loop prevention** using a 30-second dedupe window stored in the database (`SyncDedupeEntry` table)
- **Last-write-wins conflict resolution** using timestamps
- **Idempotency** — SHA-256 hash of mapped data skips sync when nothing actually changed
- **External ID mapping** — `ContactMapping` table links `wixContactId ↔ hubspotContactId`

**How loop prevention works:**
1. User edits contact in Wix → Wix webhook fires
2. App syncs change to HubSpot → marks `hubspot:{id}` in dedupe table (30s TTL)
3. HubSpot fires webhook for the change we just wrote
4. App checks dedupe → finds entry → **skips** (preventing the infinite loop)

### Feature #2 — Form & Lead Capture with UTM Attribution

- Embeddable lead capture form via iframe or `<script>` tag
- Captures: email, name, phone, company, custom fields
- **UTM attribution**: `utm_source`, `utm_medium`, `utm_campaign`, `utm_term`, `utm_content`
- **Page context**: page URL, referrer, timestamp
- UTM params read from URL query string AND from parent page via `postMessage` (works in iframes)
- Submissions create/update contacts in both Wix and HubSpot
- All submissions logged in `FormSubmission` table with sync status

### Security & Connection

- **OAuth 2.0** for HubSpot (authorization code flow with auto token refresh every 30 min)
- **Client credentials** for Wix (APP_ID + APP_SECRET + instanceId)
- **AES-256-GCM encryption** for all tokens stored in the database
- **Least privilege scopes**: `crm.objects.contacts.read`, `crm.objects.contacts.write`
- **Safe logging**: structured JSON logger auto-redacts any field containing "token", "secret", "password"
- **Webhook verification**: JWT for Wix, HMAC-SHA256 v3 for HubSpot
- Connect/disconnect HubSpot from the dashboard UI

### Field Mapping UI

- Table with columns: Wix Field, Direction, HubSpot Property, Transform, Active/Inactive, Delete
- Wix fields: static dropdown (13 known contact fields)
- HubSpot properties: dynamically fetched from HubSpot Properties API
- Direction options: Wix → HubSpot, HubSpot → Wix, Bi-directional
- Transforms: None, Lowercase, Uppercase, Trim
- Duplicate validation (same field pair cannot be mapped twice)
- 8 default mappings seeded automatically on first HubSpot connection

## API Plan

### Feature #1 — Bi-Directional Contact Sync
- **Wix**: Contacts REST API v4 (`/contacts/v4/contacts`) for CRUD + webhooks (`contact.created`, `contact.updated`)
- **HubSpot**: CRM Contacts API v3 (`/crm/v3/objects/contacts`) for CRUD + Properties API (`/crm/v3/properties/contacts`) for field discovery + Webhook subscriptions for `contact.creation` and `contact.propertyChange`

### Feature #2 — Form & Lead Capture
- **Approach**: Custom embeddable forms (iframe + script), submissions routed through our API to both platforms
- **Attribution**: UTM params captured from parent page URL via `postMessage`, mapped to HubSpot contact properties (`utm_source`, `utm_medium`, `utm_campaign`, `utm_term`, `utm_content`)

### Security
- **HubSpot**: OAuth 2.0 authorization code flow → `https://api.hubapi.com/oauth/v1/token`
- **Wix**: Client credentials → `https://www.wixapis.com/oauth2/token`
- **Scopes**: `crm.objects.contacts.read`, `crm.objects.contacts.write` (least privilege)

## Database Schema

7 tables in Neon PostgreSQL:

| Table | Purpose |
|-------|---------|
| `WixConnection` | Stores Wix site installation (instanceId, encrypted access token) |
| `HubSpotConnection` | Stores HubSpot OAuth tokens (encrypted access + refresh, portal ID, expiry) |
| `ContactMapping` | Links wixContactId ↔ hubspotContactId with sync metadata |
| `FieldMapping` | User-configurable field mapping rules (direction, transform, active) |
| `SyncLog` | Audit trail for every sync operation |
| `SyncDedupeEntry` | 30-second TTL entries for loop prevention |
| `FormSubmission` | Form captures with UTM attribution and sync status |

## Project Structure

```
src/
├── app/
│   ├── api/
│   │   ├── auth/          # Wix auth, HubSpot OAuth, status, disconnect
│   │   ├── webhooks/      # Wix + HubSpot webhook handlers
│   │   ├── sync/          # Manual sync trigger, status, logs
│   │   ├── field-mapping/ # CRUD for field mappings
│   │   ├── fields/        # Wix fields (static) + HubSpot properties (dynamic)
│   │   └── forms/         # Form submission handler
│   ├── dashboard/         # 4 dashboard pages (overview, field-mapping, sync-log, settings)
│   └── embed/             # Embeddable form page
├── lib/
│   ├── wix/               # Wix auth, contacts client, webhook verification
│   ├── hubspot/           # HubSpot auth, contacts client, properties, webhook verification
│   ├── sync/              # Sync engine, field mapper, conflict resolver, loop prevention, hash
│   ├── db.ts              # Prisma client singleton with Neon adapter
│   ├── encryption.ts      # AES-256-GCM encrypt/decrypt
│   └── logger.ts          # Structured JSON logger with token redaction
├── components/            # React UI components (dashboard, forms, ui primitives)
├── hooks/                 # WixInstanceProvider context
└── types/                 # TypeScript interfaces
```

## Setup

```bash
# 1. Clone the repository
git clone <repo-url>
cd wix-hubspot

# 2. Install dependencies
npm install

# 3. Configure environment
cp .env.example .env.local
# Edit .env.local with your credentials

# 4. Generate Prisma client
npx prisma generate

# 5. Create database tables (first time only)
# Tables are auto-created via the migration script in prisma/init.sql
# Or push schema: npx prisma db push

# 6. Start development server
npm run dev
```

Open **http://localhost:3000** to see the app.

## Testing

See [TESTING.md](./TESTING.md) for comprehensive local and production testing instructions with expected behaviors.

## Routes

| Route | Method | Purpose |
|-------|--------|---------|
| `/` | GET | Landing page with API plan |
| `/dashboard` | GET | Overview: connection status, sync stats, manual sync |
| `/dashboard/field-mapping` | GET | Configurable field mapping table |
| `/dashboard/sync-log` | GET | Paginated sync audit trail |
| `/dashboard/settings` | GET | HubSpot connect/disconnect, webhook URLs |
| `/embed/form` | GET | Embeddable lead capture form |
| `/api/auth/wix` | POST | Exchange Wix instance token |
| `/api/auth/hubspot` | GET | Initiate HubSpot OAuth |
| `/api/auth/hubspot/callback` | GET | HubSpot OAuth callback |
| `/api/auth/hubspot/disconnect` | POST | Remove HubSpot connection |
| `/api/auth/hubspot-status` | GET | Check connection status |
| `/api/field-mapping` | GET/POST/PUT/DELETE | Field mapping CRUD |
| `/api/fields/wix` | GET | Static Wix contact fields |
| `/api/fields/hubspot` | GET | Dynamic HubSpot properties |
| `/api/forms/submit` | POST | Form submission with UTM |
| `/api/sync/trigger` | POST | Manual full sync |
| `/api/sync/status` | GET | Sync statistics |
| `/api/sync/logs` | GET | Paginated sync logs |
| `/api/webhooks/wix` | POST | Wix webhook handler |
| `/api/webhooks/hubspot` | POST | HubSpot webhook handler |
