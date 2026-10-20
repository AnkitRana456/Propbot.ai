# Angoor AI benchmark & PropBot Pro roadmap

Prepared 2026-10-21. Sources: every public page of angoor.ai (home, 6 product pages, pricing, e-commerce solution, case studies, blogs, engineering blog, careers) and the public documentation at angoor-ai.gitbook.io (about 60 pages, including the 90-action reference). I did **not** sign in to their dashboard (dashboard.angoor.ai), so everything about the in-app UI comes from their docs and screenshots, not from using it. Where marketing and docs disagree, the docs are treated as the more reliable source and the disagreement is noted.

---

## 1. What Angoor is

**One line:** an "agentic AI-native customer interaction platform" for B2C brands: one workspace for inbox, CRM, knowledge, AI agents and automation across WhatsApp, Instagram, Messenger, web widget, email, Slack and voice calls.

**Their thesis** (docs home page): *"Never onboard any other platform for a singular feature that you can build on Angoor."* They do not sell a chatbot; they sell a **toolkit for building flows and agents** (a Zapier/Intercom/HubSpot hybrid) and then implement customer-specific automation for each client (the Student Tenant case study was a one-week implementation).

**Who it is for:** horizontal B2C. Showcased customers: Student Tenant (UK student housing), Fit Property, Sanfe, InstaAstro, AppsForBharat, Sumangali Jewellers, Vasa Indica, Atog, Gud Gum, The Noise Culture. Verticals with dedicated pages: **E-commerce** and **Logistics** (the logistics page is linked but not built yet).

**Business model:** priced by **MAEU (Monthly Active Engaged User)** plus pay-as-you-go for LLM tokens, calls and channel fees (WhatsApp). Only two public tiers: **Trial (free)** and **Enterprise (talk to us)**. No self-serve paid plan, no list prices. Sales-led ("Book a demo", Calendly).

**Team / maturity signals:** small team (about 10 names plus 2 alumni), no open roles, Angoor AI Private Limited (India), blog and engineering blog actively posting through July 2026, docs updated 12 days before this review. The docs also say several things are "coming soon" (see section 6), so the product is younger than the marketing suggests.

---

## 2. Site map (every page I visited)

| Page | What it is |
|---|---|
| `/` | Home: positioning, customer logos, product video, "Ingest → Explain → Execute" story, LLM-ops strip |
| `/products/voice` | AI voice agents, inbound and outbound |
| `/products/ai-studio` | "Gen AI Studio": flow builder, tools, monitoring |
| `/products/whatsapp` | WhatsApp CRM and marketing |
| `/products/instagram` | Instagram CRM / brand management |
| `/products/knowledge-base` | Knowledge management |
| `/products/integrations` | 10 integration tiles |
| `/e-commerce-solutions` | Vertical page with claimed uplifts |
| `/pricing` | MAEU-based, Trial vs Enterprise |
| `/case-studies` (3) | Student Tenant (83% ticket automation), Globridge (healthcare recruitment lead management), BrainWaves (report generation via flow builder) |
| `/blogs` (10 posts), `/engineering` (1 deep post, "Six knowledge types, one query") | Content marketing; thought leadership on agentic CRM |
| `/careers` | No open roles |
| `/coming-soon` | Linked placeholder (Logistics / Changelog) |
| `angoor-ai.gitbook.io/angoor-ai` | Docs: Getting Started, Basics (Configuration, Interactions, Account Management, Data), Integrations, Tutorials, Support, Glossary, Changelog (empty page) |
| `/terms`, `/privacy`, cookie banner | Legal; cookie consent via Privado |

---

## 3. Feature inventory

### 3.1 Platform structure (docs: "5 overarching arms")
1. **Overview**: central hub, dashboards, reminders and suggestions.
2. **Configuration**: Agents, Flows, Forms/Attributes, Tools (GPT tools + API tools), Channels, Widget, Integrations.
3. **Interactions**: Conversational Inbox, Task Boards, Instagram, Facebook/Messenger, WhatsApp (Templates, Template Guidelines, Campaigns).
4. **Account Management**: Profile, Notifications, Members, Teams, API Keys, Policies, Access Logs, Credits Management, Billing.
5. **Data**: Knowledge Base, Knowledge Base References, Flow Executions, Dashboards, Products, Product Groups, All Users, User Groups, Tag Manager.

### 3.2 Agents
- Create multiple agents; dashboard shows name, owner, variable count, linked KBs, description, tags.
- Prompt template sections: Job Description, Character, Information to Collect, Tone and Personality, Style and Language.
- **Dynamic variables** (`{{ }}`) usable in prompts and populated anywhere in a flow.
- **Knowledge reference** inside prompts (pick specific KB sections).
- **Conditional prompts** (Field-Operator-Value, stackable).
- Model selection (GPT-4.1, 3.5, custom; 8K to 100K context; standard vs fast), response parameters.
- Agent-step flags: sync with user group, plugin events, split long answers into several messages, auto-replies, **one question per message** restriction.
- Marketing claims agents have memory, self-reasoning, self-improving; the docs describe these as general agent properties, not specific controls.

### 3.3 Flow builder (the core product)
- Hierarchy: **Flow → Entry Point (trigger) → Path → Step**, wired with handles and connectors on a drag-and-drop canvas.
- Triggers: user message, new session, scheduled event, API/webhook channel, system events; a flow can have several entry points.
- **Six step categories:**
  - **Content:** Text, Nudge (web widget), Comment (Instagram/Facebook reply), Image, Video, Document, Audio (planned), WhatsApp Template, Email, Email Template; send timing = now / end of path / end of flow.
  - **Routing:** Quick Replies (TEXT / PHONE / URL buttons), Wait Time (hours/minutes/seconds, dynamic), **Logic Routing (an LLM classifier picks the branch from your branch prompts, 3 retries)**, Decision Routing (variable comparisons: equals, not equals, greater, less, contains, ...), Loop Routing.
  - **Agent** (run an AI agent with a form), **Tool** (GPT tool or API tool), **Flow** (call a sub-flow: Main / On Setup / On Error / On Control / Pre Flow / Post Flow).
  - **Actions: 90 backend actions in 20 categories** (full list in section 3.4).
- Variable scopes: flow, execution, session. Templated message bodies. Reusable sub-flows. Per-step input/output binding.
- **Versioning and comparison** of prompts, agents and flows; **Prompt IDE** (create, version, test); **LLM Ops** (advanced logs, per-step form and LLM output, token usage per call); individual execution tracing. *(The docs state "we don't support prompt engineering infrastructure" and "fine-tuning: coming soon", so the homepage claim is stronger than the shipped product.)*

### 3.4 The 90 actions (by category)
- **Data and variables (11):** Add Tag, Add To Array, Add To Variable Array, Create Prompt Variable, Delete Entity Data (placeholder), Formula (safe arithmetic engine), Generate Random Number, Load Entity Data (upsert by primary key), Parse JSON, Search List For Key Value, Set Variable.
- **Text and regex (5):** Document To Text (GPT-4o Vision, up to 10 pages), Format JSON, Match/Transform With Regex, Transliterate Text.
- **Date and time (3):** Format Date, Time Delta, Time Difference.
- **Session control (8):** Add Assistant Event, Close Session(s), Control Session, Conversation Expansion, First Member Response Time, Session Context Setup, Set Session Name.
- **Flow control (7):** Add Plugin Event, Add System Prompt, **Agent Analyser**, Block Flow, Block If Session Closed, Loop Routing, Trigger Flow.
- **User and identity (6):** Add Data/Identifier To User, Attach Identifier To Session, Check User By Data, Create User, Get User From Identifier.
- **User groups (3):** Add To / Check In / Remove From Group.
- **Tickets/support (6):** Create, Get, Get All, Select, Update Ticket; Close Task.
- **Scheduling (4):** Create/Delete/Get User Schedules, Get Team Availability.
- **Shopify (9):** orders, products, checkout status, cancel/update/tag orders, order to checkout, order to catalogue.
- **Integrations (6):** Add To Catalog, Apply Metabase Filter, Delete FB/IG Comment, Product Selection, **Run WhatsApp Campaign**.
- **CRM (LeadSquared) (3), Airtable (2).**
- **Voice/call (6):** End Call, Switch Call To Agent, Update STT/TTS Attributes, Voice, Whisper.
- **Media and files (3):** Add Media To Session, Audio Analysis, Get File Upload From URL.
- **Notifications (2):** Check Template Delivery, Send Notification.
- **Geo (2):** Geocoding, Distance Between Coordinates. **Knowledge (1):** Process Knowledge Base. **Routing (1):** Create Round Robin. **Payments (1):** Generate Payment Link.

### 3.5 Forms/Attributes and Tools
- **Forms** = reusable structured data templates; they define what an agent collects, shape task cards, feed user attributes, and are attached to channels to parse incoming API payloads.
- **GPT Tools:** prompt-driven utilities (model, mode Creative/Balanced/Precise/Custom, temperature, top-p, penalties, max tokens, cache, conversation-history use, session blocking).
- **API Tools:** HTTP calls to external or internal systems, with form-defined inputs. Marketed as "50+ tools".

### 3.6 Channels and widget
- Channels: WhatsApp, Instagram DM and comments, Messenger, Slack, email (Gmail), web widget, voice numbers (Plivo), and **custom API channels** (webhook with generated API key and URL, sample cURL, trigger type On Trigger or Scheduled, attached form, flow hierarchy).
- **Meta onboarding via "Continue with Facebook"** (embedded signup style: choose business account and number).
- **Web widget builder:** brand colour, floating button (compact/extended, 24x24 logo), spacing, light/dark/system theme, **Home section** (welcome and quick actions), plus Conversations, Tickets and Knowledge (self-service help centre) sections marked *coming soon*; domain-bound deployment.

### 3.6b Voice
Build the agent (voice, accent, language, speed, pitch, tone) → **Listen** (live transcription, sentiment, keyword tracking, intent) → **Route** (AI↔human switch mid-call on intent/sentiment/complexity) → **Call** (inbound and outbound at scale, campaigns) → **Analyse** (campaign and agent reports). Stack: Plivo telephony, pluggable STT and TTS providers. Demo calls: user interview (fintech), product delivery (D2C), room booking (hotels), service booking (dry cleaners).

### 3.7 Interactions
- **Conversational inbox:** 4-pane layout (conversation list, chat window, chat controls, user info panel with contact, tags, past tickets, form data). New chat on any channel; WhatsApp respects the 24-hour window and requires approved templates outside it. **"Take Control"** from the AI (AI stops until status returns to Open). Assign and reassign from the chat or the list; statuses; filters; tags; priority.
- **Task boards:** Kanban boards bound to a form (submissions become cards), drag and drop, assignee/date filters, task chat and timeline, team ownership.
- **WhatsApp templates and campaigns:** template guidelines; 5-step campaign wizard (name, users/groups, template, dispatch mode instant or scheduled, review); metrics Sent/Delivered/Read/Replied/Failed/Queued/Processed with sync.
- **Instagram:** post management, comment-to-DM conversation continuation, AI replies on comments 24x7, comment intent/category analysis, sentiment and engagement analytics.

### 3.8 Data layer
- **Knowledge bases** with 6 data types: Documents, Table (CSV/DB), **Proxy** (live data from APIs/internal DB, not stored), Media Catalogue, JSON, Links. Access hierarchy, test utilisation and **match rating**, natural-language "ask your KB", versioning. **Knowledge Base References** = curated, reusable subsets of KBs.
- The engineering post claims a unified `query()` over six knowledge types via four abstractions.
- **Users and user groups:** All Users (CSV import), **static and dynamic groups** (manual or filter-based), group detail views, per-channel identity (WhatsApp, Instagram, email), 360-degree profile built from flows, notes and external APIs, automatic personas.
- **Products and Product Groups** (catalogues generated on the fly by agents; filters).
- **Tag Manager. Dashboards** builder (line, bar, donut, single metric, funnel; rows; share permissions). **Flow Executions** log. Auto-summarisation and labelling, intent identification, sentiment (positive/neutral/negative), AI report generation.

### 3.9 Account management
Members, Teams, **API keys** (policy-scoped, expiry), **Policies** (module-level View/Add/Change/Delete with **conditional logic**, e.g. rights only in business hours or by territory, plus policy change logs), **Access Logs**, notifications, **Credits management** (balance, refresh date, daily consumption chart, per-channel split, per-feature consumption table, one-time or recurring top-ups with discount), billing.

### 3.10 Integrations (10 on the site, more in docs)
Instagram, WhatsApp, Shopify, HubSpot, Website widget, Slack, Zoho CRM, Freshdesk, Gmail, Google Sheets, Google Docs; docs also cover Google Drive, ClickPost (logistics), Unicommerce, Plivo, Metabase, LeadSquared, Airtable, Razorpay (payment links). Each tile is tagged Platform, AI Agents and/or Knowledge Source.

### 3.11 E-commerce vertical (claims)
Catalogue management by agents, abandoned-cart nudges with coupons, unified inbox, order placement and payment collection in-chat, FAQ, shipping/delivery updates and returns/RMS, **CSAT/NPS auto-collection with estimated score if the user drops off**, 360 view, segmentation, personalised campaigns, and shared task management for AI and human agents. Claimed uplifts: +70% repeat purchase, +35% conversion, 2x leads, +40% AOV (unverified marketing numbers).

### 3.12 Proof points
Student Tenant: 83% of tickets automated (32% fully), zero first-response time, 67% more lead engagement, 95% lead-classification accuracy, 500+ daily interactions in peak, **one-week implementation**, Intercom Fin replaced.

---

## 4. Where PropBot Pro already stands (from this repo)

Strong or comparable today: multi-tenant CRM with Kanban pipeline, lead scoring, buyer DNA, AI copilot; website chat widget (shadow DOM, UTM capture, conversion pixels, OTP, brochure gating); RAG knowledge base (PDF/DOCX/CSV/JSON/text/URL crawl, Q&A overrides); WhatsApp Cloud API inbox with handoff, templates/campaigns (basic), opt-out handling; webhook engine with retries and logs; HubSpot/Salesforce/Mailchimp sync; e-mail alerts; appointments and calendar; property inventory, shortlist rooms, RERA copy; objection playbooks; approval queue for risky AI actions (T2); MCP server; voice callback scaffolding; workflows (trigger, condition, action, delay) and segments/campaigns; analytics; RBAC, audit logs, SSO/2FA scaffolding; billing with plan limits.

**PropBot's real advantage over Angoor:** deep **real-estate vertical** (inventory, units, brochures, site visits, shortlist rooms, RERA, buyer DNA, intent scoring). Angoor is horizontal and implements each customer by hand. Do not copy Angoor's horizontality; copy its **platform primitives** and aim them at real estate.

---

## 5. Gap analysis

Relevance is for an Indian real-estate developer/broker audience. Effort: S under 1 week, M 1-3 weeks, L 3-6 weeks, XL 6+ weeks (one engineer).

| # | Angoor capability | PropBot today | Relevance | Effort |
|---|---|---|---|---|
| 1 | Visual flow builder with entry points, paths, 6 step categories, sub-flows, variable scopes | Basic linear builder (trigger/condition/action/delay) | **Very high** (this is their core) | XL |
| 2 | LLM "Logic Routing" and Decision Routing, Quick-reply branches, Wait, Loop | Conditions only | **High** | L (part of 1) |
| 3 | Multiple named **Agents** (prompt template, variables, KB refs, model, flags) | One bot persona per chatbot | **High** | L |
| 4 | **Tools**: GPT tools and API tools with typed inputs | Not present (fixed integrations) | **High** | L |
| 5 | **Forms/Attributes** (custom data schema bound to agents, tasks, channels) | Fixed lead fields + `customFields` JSON | **High** | M |
| 6 | Flow Executions log, per-step trace, token and cost per call, prompt versioning and A/B compare ("LLM Ops") | Basic AI router logging only | **High** | L |
| 7 | **Instagram** DM and comment automation, post management, comment intent | None | **High** (leads from reels/ads comments) | XL |
| 8 | **Messenger**, **Slack**, **Gmail inbound/outbound email channel** | E-mail alert only (no email channel) | Medium | L each |
| 9 | **Voice agents** end to end (Plivo/Exotel, STT, TTS, mid-call human switch, live sentiment, campaigns) | Scaffolding / mock providers | **Very high** (outbound lead calling is core in Indian real estate) | XL |
| 10 | Unified inbox across all channels with Take Control, assign, status, tags | WhatsApp inbox only | **High** | L |
| 11 | WhatsApp template manager with Meta approval flow, 24-hour window enforcement, campaign metrics (sent/delivered/read/replied) | Campaigns + basic templates | **High** | M |
| 12 | Knowledge types: Table, **Proxy (live API data)**, Media Catalogue, JSON, Links; KB References; KB test with match rating; "ask my KB" | Documents/CSV/JSON/URL, Q&A overrides | Medium-high (live unit availability via Proxy is a killer feature) | L |
| 13 | Google Docs / Sheets / Drive as knowledge sources | Sheets adapter is a mock | Medium | M |
| 14 | **User groups**: static and dynamic, CSV import, filters; 360 profile; Tag Manager | Segments (basic) | **High** | M |
| 15 | **Task boards** bound to forms (generic Kanban) | Lead Kanban + tasks | Medium | M |
| 16 | **Dashboard builder** (line/bar/donut/KPI/funnel widgets, share) | Fixed dashboards | Medium | L |
| 17 | Auto-summarisation, labelling, intent identification, sentiment dashboard | Intent scoring + summary partially | Medium | M |
| 18 | **CSAT / NPS** auto-collection with inferred score | Appointment survey only | Medium | M |
| 19 | **ABAC policies** with conditional logic, access logs, policy-scoped API keys with expiry | Static RBAC, audit log, API key table | Medium (enterprise sales) | L |
| 20 | **Credits metering** (per-feature/channel consumption, top-ups, recurring) and MAEU pricing | Plan limits only | **High** (needed to resell WhatsApp/voice/LLM costs) | L |
| 21 | Widget builder: Home section, nudges, conversations, tickets, help-centre tabs, domain binding, themes | Widget with fixed layout; appearance config | Medium | L |
| 22 | Custom API channel (generated key/URL, scheduled or triggered, form-mapped payload) | Inbound lead webhook only | Medium-high (portals: 99acres, MagicBricks, Housing, Meta/Google lead ads) | M |
| 23 | Meta "Continue with Facebook" embedded onboarding | Manual token entry | **High** (removes onboarding friction) | M |
| 24 | Payment links in chat (Razorpay), abandoned-cart style re-engagement | Booking payments service (partial), re-engagement | Medium (token-amount payments for bookings) | M |
| 25 | Integrations: HubSpot, Zoho, Freshdesk, Slack, LeadSquared, Airtable, Metabase | HubSpot/Salesforce/Mailchimp real; Zoho/generic mock | **LeadSquared and Zoho are high** for Indian real estate | M each |
| 26 | Geo actions (geocoding, distance) | Map embed only | Medium (distance to metro/school as chat answer) | S |
| 27 | Document To Text via vision (read scanned documents/cheques/IDs) | Text-only parsing | Medium (KYC, booking forms) | M |
| 28 | Round-robin / team availability scheduling actions | Round-robin assignment exists | Low | S |
| 29 | Public docs site, changelog, case studies, engineering blog | In-app help only | Medium (sales enablement) | M |
| 30 | Logistics / e-commerce vertical packs (Shopify, ClickPost, Unicommerce) | n/a | **Not relevant** | skip |

---

## 6. Things to be careful about when benchmarking

- **Marketing vs reality:** homepage lists Prompt IDE, LLM Ops, fine-tuning-style features; the docs say prompt-engineering infrastructure is *not supported* and parameter tuning is "coming soon". Widget Conversations/Tickets/Knowledge tabs are "coming soon". "Delete Entity Data" is a placeholder; audio content step is only planned.
- Pricing is opaque; only a free trial and "talk to us". Their margin model is usage resale plus services.
- The changelog page is empty and no roles are open; the team is very small. Moving fast on breadth means shallow edges (they publish the gaps in their own docs, which is a useful checklist).
- I cannot verify their reliability, latency or accuracy claims (83% automation, 95% classification) beyond the case study text.

---

## 7. Roadmap (recommended order)

Principle: build **platform primitives once**, then expose real-estate templates on top. Each phase ends with a demoable outcome. Estimates assume one full-time engineer and are rough.

### Phase R0, finish what is already in flight (1-2 weeks)
Media wiring (migration 0018), Phase 8 smoke tests and final verification, remove hardcoded dev secrets, decide plan/pricing table, Stripe real Checkout. *Without this, nothing below is safe to put in front of paying customers.*

### Phase R1, Agents, Forms and Tools (6-8 weeks)
Gap items 3, 4, 5, 6 (partial). Multiple named agents per company; prompt template sections; variables; KB references; model and temperature settings; agent versioning; custom Forms/Attributes that drive both agents and CRM fields; GPT tools and API tools (HTTP with typed inputs, secrets in the vault, SSRF guard already exists). Add execution logging with token cost per call.
*Outcome:* a sales team can build "Site-visit booking agent" and "Loan-eligibility agent" without code.

### Phase R2, Flow builder v2 (8-10 weeks)
Gap items 1, 2, 17. Replace the linear workflow editor with a canvas: entry points, paths, steps; Content / Routing / Agent / Tool / Action / Flow step types; Quick replies, LLM logic routing, decision routing, wait, loop, sub-flows; flow/execution/session variables; flow versions with publish; execution viewer with per-step trace (this is also the LLM-ops view); ship ~25 real-estate actions first (create lead, update stage, book visit, assign round-robin, send WhatsApp template, fetch inventory, generate payment link, create task, geocode/distance, add tag, call webhook), then widen.
*Outcome:* template flows (lead qualification, site-visit reminder, re-engagement, post-visit feedback) editable by customers.

### Phase R3, Omnichannel inbox and channels (8-12 weeks)
Gap items 10, 23, 8, 7, 11, 22. Generalise the WhatsApp inbox to all channels (Take Control, assign, status, tags, priority, user info panel); Meta embedded signup; Instagram DM and comment automation; Messenger; Gmail/IMAP email channel; template manager with approval status and 24-hour window rules; campaign metrics funnel; **custom API channel** to ingest leads from 99acres/MagicBricks/Housing.com/Google & Meta lead ads.
*Outcome:* every inbound enquiry lands in one inbox with one AI behaviour.

### Phase R4, Voice (8-10 weeks)
Gap item 9. Telephony provider (Plivo or Exotel), streaming STT, TTS with Indic voices, barge-in, call recording and transcripts, live sentiment/intent, mid-call transfer to a human, outbound campaigns with calling windows and DND/TRAI compliance, call analytics. Existing voice scaffolding becomes the Flow "Voice" steps.
*Outcome:* AI calls new leads within a minute, qualifies them and books site visits.

### Phase R5, Data platform (6-8 weeks)
Gaps 12, 13, 14, 15, 16, 18, 27. KB types (Table, **Proxy for live unit availability and pricing**, Media catalogue, Links), KB references and match-rating tester; Google Docs/Sheets/Drive import; dynamic user groups and Tag Manager; 360 customer view; generic task boards bound to Forms; dashboard builder; CSAT/NPS; vision-based document reading for KYC/booking forms.

### Phase R6, Platform and enterprise (6-8 weeks)
Gaps 19, 20, 21, 24, 25, 29. Policies with conditional logic and access logs; policy-scoped API keys with expiry; **credits metering and top-ups** (resell WhatsApp/voice/LLM at margin); widget builder v2 (home, nudges, conversations, help centre); LeadSquared, Zoho, Slack, Freshdesk, Airtable connectors; public docs site and changelog.

### Continuous: keep the real-estate moat
Inventory-aware answers, shortlist rooms, RERA-safe copy, buyer DNA, site-visit logistics, broker/agency portal and channel-partner attribution (utm_agencypartner). These are what Angoor does not have.

**Suggested sequencing if you must trim:** R0 → R1 → R2 → R3 (WhatsApp+Instagram+email only) → R4. R5/R6 can be pulled forward per customer demand.

---

## 8. What I need from you (manual setup, accounts and keys)

I will not store these in the repo; they go in `.env` / the secret vault. Tell me which phases you are green-lighting and I will list only the relevant ones again at that time.

| Needed for | What you must create / provide |
|---|---|
| **LLM** (all phases) | Gemini API key **with billing enabled** (the current key is out of quota). Optional: OpenAI/Anthropic keys if you want model choice per agent. |
| **WhatsApp / Instagram / Messenger** (R3) | Meta Business Manager verified business; a Meta app with WhatsApp, Instagram and Messenger products; **App Review** for `instagram_manage_messages`, `instagram_manage_comments`, `pages_messaging`; Business Verification and (for embedded signup) Tech Provider status; app ID, app secret, webhook verify token; a production phone number; approved message templates. This takes calendar weeks, so start now. |
| **Voice** (R4) | Plivo or Exotel account and numbers; **India DLT registration / TRAI compliance** for outbound; STT key (Deepgram, Google, or Sarvam for Indian languages); TTS key (ElevenLabs, Azure, Google or Sarvam). |
| **Email channel** (R3) | Google Cloud project with OAuth consent screen (Gmail scopes are *restricted* and need Google verification) or an IMAP/SMTP mailbox; SMTP credentials for alerts (`SMTP_HOST/USER/PASSWORD/FROM`). |
| **Google Docs / Sheets / Drive** (R5) | Same Google Cloud OAuth project; Drive/Docs scopes need verification. |
| **Payments** (R0, R6) | Stripe **or** Razorpay live account, API keys, **webhook secrets** (`STRIPE_WEBHOOK_SECRET`, `RAZORPAY_WEBHOOK_SECRET`); tell me which one you will actually use in India. |
| **CRMs** (R6) | HubSpot private-app token, Zoho OAuth client, Salesforce connected app, **LeadSquared access/secret keys**, Slack app, Freshdesk key, Airtable token (only those you want). |
| **Lead portals** (R3) | 99acres, MagicBricks, Housing.com lead-push details; Meta Lead Ads and Google Ads lead-form webhook access. |
| **Infrastructure** | A production PostgreSQL (and a separate test DB), Redis (shared rate limits and queues), object storage (S3/R2) for media and call recordings, a domain with DNS + TLS, `CRON_SECRET`, a real `JWT` secret, error monitoring (e.g. Sentry), a transactional email provider. |
| **Compliance** | Privacy policy / terms, DPDP Act consent wording, call-recording consent script, WhatsApp opt-in wording. |

## 9. Decisions I need from you

1. Do we copy Angoor's **horizontal** flow/agent platform, or keep the product **vertical** (real estate only) and expose a simplified builder? (Recommendation: build the primitives, ship only real-estate templates and actions at first.)
2. Which channels first: Instagram, email, voice? (Recommendation: Instagram + voice first; they carry the most real-estate lead volume.)
3. Pricing model: keep plan tiers, or move to **usage/credits (MAEU-like)** so channel and LLM costs are passed through?
4. Who is the first design-partner customer, so each phase has a real workflow to validate against (their equivalent of Student Tenant)?
5. Self-serve signup vs sales-led onboarding (Angoor is sales-led with one-week implementations)?
