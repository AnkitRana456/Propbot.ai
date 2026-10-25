# Phase Completion Summary — feat/business-logic-completion

## What was done

### Production hardening (applied in previous session)
- Removed hardcoded auto-login (admin@prestige.com) from AuthContext
- Signed OAuth state for Google Calendar (HMAC + 15 min expiry)
- WhatsApp access token and app secret sealed at rest with `sealSecret`/`openSecret`
- Real Meta template submission when `META_LIVE_DISPATCH=true`, with `syncTemplate` from live API
- Email adapter sends through real SMTP; honest failure in production without it
- Razorpay, Exotel, Google Sheets, Zoho return clear "not available yet" errors in production
- `productionProblems()` blocks startup on misconfiguration (weak keys, wildcard CORS, mock switches)

### Fake/hardcoded data replaced (this session)
| File | Was | Now |
|---|---|---|
| `AuthContext.tsx` | Hardcoded admin auto-login | No token → signed out |
| `LeadDetailDrawer.tsx` | Fake Prestige/Sobha matched inventory | Placeholder message; real timeline via `/api/crm/leads/:id/timeline` |
| `KanbanLeadCard.tsx` | `'Prestige Lakeside'` fallback | `null` (row hidden when no locality) |
| `UsersTable.tsx` | `'Prestige Realty'` fallback | `'—'` |
| `CampaignsPage.tsx` | `'Prestige Falcon City'` default state | Empty string |
| `LiveWidgetPreview.tsx` | `'Prestige Lakeside Habitat'` default | `undefined` |
| `TodaySlaQueue.tsx` | Hardcoded Prestige/Sobha leads | Empty default array |
| `dashboard.service.ts` | Fake branded notification fallback | `{ unreadCount: 0, items: [] }` |
| `integrations.service.ts` | `'Prestige Palms'` dummy lead | `'Demo Project'` |
| `WhatsAppSetupWizard` placeholders | Real brand names | Generic placeholders |
| `CreateProjectModal` placeholders | `Prestige Sanctuary / Prestige Group` | `Skyline Residences / Aurora Developers` |
| `SimulateInboundModal` test text | Named real project | Generic |

### New features
1. **Cost sheet generator** — `computeCostSheet()` pure function (floor rise, PLC, parking, GST, stamp duty, registration); stored in `cost_sheets` table; routes on `GET/PUT /api/properties/projects/:id/cost-sheet-config` and `POST/GET /api/properties/projects/:id/cost-sheets`; public shareable link at `/quote/:token` (web) and `GET /api/public/quote/:token` (API); React hooks in `inventory.service.ts`.
2. **Walk-in kiosk** — `POST /api/public/walk-in/:token` accepts a visitor; `GET` returns kiosk info; kiosk web page at `/walk-in/:token`; `POST /api/lead-sources/:id/kiosk-token` generates the token; `generateKioskToken` exported from lead-sources service.
3. **WhatsApp businessAccountId UI** — new field in `WhatsAppConfigTab` wired to save/load; required for Meta template submission.
4. **Template sync button** — `useSyncTemplate` hook; "Sync status" button shown on pending templates in `ChannelsPage`.
5. **Lead timeline hook** — `useLeadTimeline` hook in `leads.service.ts` calling the real `/api/crm/leads/:id/timeline`.

### Tests & checks
- API: 707/709 pass (2 pre-existing flaky failures in `outbox-fanout-resilience.test.ts`, unrelated to this work)
- Web: 97/97 pass
- API typecheck: clean
- Web typecheck: clean

## What remains (honest list)
- **Meta Pixel / Google Ads** conversion tracking is still mock (`conversion-tracking.service`)
- **Twilio** SMS/voice: intentionally deferred by user ("we will set up later")
- **Razorpay**: stubbed 501 in production — full billing flow not yet wired
- **Google Sheets**: returns "not available yet" in production — adapter exists but not fully wired
- **Zoho CRM**: same as above
- **Seed data** uses "Prestige" and "Sobha" — dev-only, acceptable
- **AnalyticsDashboard** routes (`/analytics-dashboard`, `/cue-analytics`) still reference the synthetic component — to be replaced once real analytics API grows
- **Walk-in kiosk**: no "Generate kiosk link" button shown on Lead Sources page yet (the API route exists)

All work is uncommitted as per project memory rule.
