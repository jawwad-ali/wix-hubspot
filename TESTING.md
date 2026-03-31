# Testing Guide

## Local Testing (localhost:3000)

### Setup
- `npm install && npx prisma generate && npm run dev`
- Open http://localhost:3000

### Landing Page
- http://localhost:3000 → loads with API Plan, feature cards, "Open Dashboard" and "Preview Form" buttons

### Dashboard (Demo Mode)
- http://localhost:3000/dashboard → sidebar with 4 nav items, Wix badge green, HubSpot badge red with "Connect" button
- Sync stats show all zeros, recent activity empty

### HubSpot OAuth
- Click "Connect" → new tab opens HubSpot authorization page
- Grant access → redirected back to dashboard with green HubSpot badge showing portal ID
- 8 default field mappings auto-seeded (firstname, lastname, email, phone, company, jobtitle, city, country)

### Field Mapping UI
- http://localhost:3000/dashboard/field-mapping → table shows 8 pre-seeded mappings after HubSpot connect
- Change direction dropdown on any row → toast "Mapping updated"
- Change transform to "Lowercase" → toast confirms
- Click Active badge → toggles to Inactive (gray)
- Click "Add Mapping" → dialog with Wix field dropdown (13 fields) and HubSpot property dropdown (live from API)
- Add new mapping → new row appears
- Click trash icon → row deleted
- Add duplicate mapping → error toast

### Form Submission
- http://localhost:3000/embed/form?instanceId=demo&utm_source=google&utm_medium=cpc&utm_campaign=spring_sale → form with 6 fields
- Submit with email → green checkmark "Thank you!" message
- With HubSpot connected: contact created in HubSpot with UTM properties, contact created in Wix, sync log entry with source "form"
- Without HubSpot connected: submission saved to DB, sync log entry created, no HubSpot contact

### Embed Script
- Add `<script src="http://localhost:3000/embed.js" data-instance-id="demo"></script>` to any HTML → iframe form appears
- UTM params from parent page URL passed to form via postMessage

### Manual Sync
- Dashboard → select direction → click "Manual Sync" → spinner shows "Syncing..."
- With HubSpot connected: toast "Sync completed!", stats update, sync log entries for each contact
- Without HubSpot: error toast "Both Wix and HubSpot must be connected"

### Sync Log
- http://localhost:3000/dashboard/sync-log → paginated table with timestamp, direction arrows, action badges, contact IDs
- Click row → expands to show error/details JSON
- Pagination controls at bottom

### Settings
- http://localhost:3000/dashboard/settings → HubSpot connection card, webhook URLs with copy buttons, setup instructions
- Click "Disconnect" → confirm → badge changes to "Not connected"
- Click "Reconnect" → re-initiates OAuth flow

### Webhook Real-Time Sync (requires ngrok)
- `ngrok http 3000` → get HTTPS URL → configure in Wix/HubSpot webhook settings
- Create contact in Wix → appears in HubSpot within seconds, sync log shows "Wix → HS, create, webhook"
- Edit contact in HubSpot → updates in Wix within seconds, sync log shows "HS → Wix, update, webhook"
- Loop prevention: edit triggers one real sync + one "skip" (dedupe_hit), no ping-pong

### API Endpoints (curl)
- `GET /api/fields/wix` → 13 Wix contact fields
- `GET /api/fields/hubspot?instanceId=demo` → HubSpot properties (requires connected HubSpot)
- `GET /api/auth/hubspot-status?instanceId=demo` → `{connected: false, reason: "hubspot_not_connected"}`
- `GET /api/auth/hubspot?instanceId=demo` → `{authUrl: "https://app.hubspot.com/oauth/authorize?..."}`
- `GET /api/field-mapping?instanceId=demo` → array of field mappings
- `GET /api/sync/status?instanceId=demo` → stats (totalContactsSynced, lastSyncTime, 24h counts)
- `GET /api/sync/logs?instanceId=demo&page=1&limit=20` → paginated sync logs
- `POST /api/forms/submit` with JSON body → `{submissionId, hubspotContactId, wixContactId}`
- `POST /api/sync/trigger` with `{instanceId, direction}` → sync stats
- `POST /api/auth/hubspot/disconnect` with `{instanceId}` → `{success: true}`

---

## Vercel Deployment

### Deploy
- `vercel` → set all env vars in Vercel dashboard → `vercel --prod`
- Update `NEXT_PUBLIC_APP_URL` to Vercel URL

### Update OAuth URLs
- HubSpot app → Auth → add redirect URL `https://your-app.vercel.app/api/auth/hubspot/callback`
- Wix app → OAuth → set App URL to `https://your-app.vercel.app/dashboard`

### Configure Webhooks
- Wix: Contact Created + Contact Updated → `https://your-app.vercel.app/api/webhooks/wix`
- HubSpot: contact.creation + contact.propertyChange → `https://your-app.vercel.app/api/webhooks/hubspot`

### Production Checklist
- Dashboard loads inside Wix iframe after app installation
- HubSpot OAuth works from within Wix dashboard
- Field mappings persist across page reloads
- Wix → HubSpot: create contact in Wix → appears in HubSpot within seconds
- HubSpot → Wix: edit contact in HubSpot → change reflects in Wix within seconds
- No infinite loop: sync log shows one sync + one skip, not an endless chain
- Form with UTM: submit → contact in HubSpot with utm_source/utm_medium/utm_campaign populated
- Token refresh: API calls work after 30+ minutes (auto-refreshes expired HubSpot tokens)
- Disconnect/reconnect: tokens replaced, sync resumes
- Sync log: every operation logged with correct direction, action, contact IDs

### Troubleshooting
- "Failed to connect to Wix" → normal in local mode (not inside Wix iframe)
- HubSpot fields dropdown empty → connect HubSpot first
- Webhooks not working → need public HTTPS URL (ngrok locally, Vercel in production)
- "Invalid encrypted string format" → test data has dummy tokens, real OAuth flow fixes this
- Neon timeout → remove `channel_binding=require` from DATABASE_URL
