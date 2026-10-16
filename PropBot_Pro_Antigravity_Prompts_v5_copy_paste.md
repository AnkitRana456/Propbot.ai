# PropBot Pro - Antigravity build prompts v5

Copy each prompt block into Antigravity (Planning mode first). Never paste API keys into chat: use `pnpm setup:keys` or edit `.env` yourself.


## How to use v5 (read this first)

This document comes AFTER your v4 PDF. v4 told Antigravity what to build. v5 fixes what is not working, makes the chatbot genuinely intelligent (RAG + LangChain + a real LLM key), gives the product a new unique look inspired by the structure of the Kenyt real-estate page, adds more features, and finishes with a production go-live phase and a plain-language audit of the whole business logic.


### Run order

| Step | Prompt | Why this order |
|---|---|---|
| 1 | V5 Master Addendum | Paste once. Updates the rules: real keys, no fake answers, production definition of done. |
| 2 | Phase R0 Rescue and diagnose | Finds out exactly why the chatbot is not working. Produces RESCUE_REPORT.md. |
| 3 | Phase R3 Key handover and vault | Antigravity asks YOU for the keys (LLM, Meta, etc.) safely and tests them. |
| 4 | Phase R1 Real AI: RAG + LangChain | Needs the LLM and embedding keys from step 3. Makes the bot answer properly. |
| 5 | Phase R2 New UI/UX theme | Dashboard, widget, Shortlist Room and public site redesign. |
| 6 | Phase R4 Business logic audit | Plain-language audit of the full workflow, with fixes. |
| 7 | Phases 16 to 25 | More features, in order. One phase per run. Accept before moving on. |
| 8 | Phase 26 Production go-live | Security, reliability, compliance, monitoring, launch checklist. |
| 9 | Final audit v5 | Independent QA of everything. Run again after every big batch. |


### Three rules that make Antigravity behave

- Planning mode first, then execute. Commit to git after every accepted phase.
- If a prompt is too big: 'Do only sub-tasks X.1 to X.4 now, then stop and report.'
- Start every new session with: 'Read MASTER_CONTEXT.md, V5 addendum, PROGRESS.md and RESCUE_REPORT.md, then continue with Phase N.'

About your API keys. Antigravity will ask you for keys. Type them into your own terminal (the pnpm setup:keys wizard) or edit the .env file yourself. Do NOT paste keys into the chat box or into a prompt: chat history can be stored or synced. If a key was ever pasted into a chat, a screenshot or a Git commit, revoke it and create a new one. Production keys must be different from development keys.


## Keys and accounts checklist

Antigravity will build a wizard that asks for these one by one. Get the 'needed now' items ready first. Names below are the environment variable names the app will use.

| Item | Env variable(s) | Where to get it | When |
|---|---|---|---|
| LLM for answers (pick one or more) | ANTHROPIC_API_KEY, or OPENAI_API_KEY, or GOOGLE_API_KEY (Gemini) | console.anthropic.com, platform.openai.com, aistudio.google.com | Now (R1) |
| Embeddings (turns text into vectors for search) | EMBEDDING_PROVIDER, EMBEDDING_MODEL, plus OPENAI_API_KEY or GOOGLE_API_KEY or VOYAGE_API_KEY | OpenAI, Google AI Studio or voyageai.com. Anthropic does not sell its own embedding model. | Now (R1) |
| Database | DATABASE_URL (Postgres with pgvector) | Neon, Supabase or Render Postgres | Now |
| Redis | REDIS_URL | Render Key Value or Upstash | Now |
| App secrets | JWT_ACCESS_SECRET, JWT_REFRESH_SECRET, ENCRYPTION_KEY | Antigravity generates these itself | Now |
| WhatsApp (Meta Cloud API) | META_APP_ID, META_APP_SECRET, WHATSAPP_ACCESS_TOKEN, WHATSAPP_PHONE_NUMBER_ID, WHATSAPP_BUSINESS_ACCOUNT_ID, WHATSAPP_VERIFY_TOKEN, template names | developers.facebook.com and business.facebook.com (business verification takes days) | Phase 9 and R3 |
| Instagram, Messenger, Lead Ads | META_PAGE_ID, META_PAGE_ACCESS_TOKEN, INSTAGRAM_BUSINESS_ACCOUNT_ID | Meta developer app, same business | Phase 15B/21 |
| Google login and Calendar | GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET | console.cloud.google.com (OAuth) | Phase 8 |
| Email | SMTP_HOST/PORT/USER/PASS or SENDGRID_API_KEY | Your mail provider | Phase 1 and 6 |
| SMS and OTP | MSG91_AUTH_KEY or TWILIO_ACCOUNT_SID/AUTH_TOKEN | MSG91 or Twilio (DLT registration for India) | Phase 2/5 |
| File storage | R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET | Cloudflare R2 or AWS S3 | Phase 3 |
| Payments | RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET, RAZORPAY_WEBHOOK_SECRET, STRIPE_SECRET_KEY | Razorpay and Stripe dashboards (test mode first) | Phase 12, 15B, 18 |
| LLM tracing (optional) | LANGFUSE_PUBLIC_KEY, LANGFUSE_SECRET_KEY, LANGFUSE_HOST | cloud.langfuse.com or self-hosted | Phase 15A |
| Monitoring | SENTRY_DSN | sentry.io | Phase 26 |
| Voice and calling (later) | EXOTEL_*, VOICE_PROVIDER_KEY | Exotel and a managed voice-agent provider | Phase 15C |


## V5 Master Addendum (paste once, after your v4 master context)

#### V5 MASTER ADDENDUM

```text
This addendum is added to /docs/MASTER_CONTEXT.md. Save it as /docs/V5_ADDENDUM.md and treat it as a rule file.
1. DEFINITION OF DONE (PRODUCTION LEVEL)
- A feature is DONE only when it works end to end with REAL keys and REAL data, has tests, handles errors and empty states, writes events/audit logs, is documented, and has no stub, mock or canned answer left on the live path.
- Stubs are allowed only behind an explicit flag (MOCK_PROVIDERS=true) that is OFF by default and refused when NODE_ENV=production.
- If a required key is missing, the feature must say so clearly (banner, API error code, doctor output). It must never fake a result.
2. KEYS AND SECRETS
- When you need any API key or token, STOP and tell me: 'Run pnpm setup:keys' or 'Add X to .env'. Do not ask me to paste secrets in chat. Never print, log, commit or echo a secret. Mask secrets in logs and traces.
- Keep /docs/KEYS_NEEDED.md up to date. Validate keys with a live test call and report PASS/FAIL without showing the value.
3. AI RULES
- Use a real LLM through the model router. Use RAG (LangChain.js inside apps/api/src/modules/ai) so answers come only from the company's own data. Never invent price, availability, possession date, RERA data or legal claims.
- Before using any model name, check the provider's current documentation. Do not hardcode retired model names. Model names live in env/config only.
4. PLAIN LANGUAGE
- Every phase must also update /docs/BUSINESS_FLOW.md: a short, jargon-free description of what the phase does for the business, who does what, and what can go wrong. Write for a shop owner, not an engineer.
5. HONESTY
- Never invent customer logos, testimonials, statistics or certifications on any page. Placeholders must be visibly labelled 'Sample'.
- At the end of every phase print: what works, what is partial, what is blocked (and by which key or account), and what I must do next.
Confirm you understood in 5 lines. Then wait for 'Start Phase R0'.
```


## Phase R0: Rescue and diagnose (run first)

Goal: stop guessing. Find out exactly what is fake, broken or missing, and fix everything that does not need an external key.

#### PHASE R0 - RESCUE AND DIAGNOSE

```text
CONTEXT: The app was built from my v4 prompts but the chatbot is not working properly and does not behave like a real AI assistant. This is a REPAIR job, not a rebuild. Do not delete working code. Plan first, then execute.
R0.1 BOOT EVERYTHING
- Read MASTER_CONTEXT.md, V5_ADDENDUM.md and PROGRESS.md. Start the full stack (docker-compose, migrations, seed, api, worker, web). Record every error exactly.
R0.2 HUNT FOR FAKES
- Search the whole repo for: stub, mock, fake, placeholder, TODO, FIXME, 'console stub', lorem, hard-coded replies, setTimeout used to simulate typing or answers, any chat route that returns canned text, any provider that ignores its API key.
- List each finding with file path and line number.
R0.3 TRACE ONE REAL CONVERSATION END TO END
- widget -> POST /public/session -> POST /public/message (SSE) -> retrieval -> LLM call -> streamed reply -> message saved -> lead captured -> domain_event written -> shown in dashboard.
- Mark every hop PASS or FAIL with the real error message. Include CORS/allowed-domain, public key check, RLS on public routes, SSE buffering, worker running, Redis, pgvector extension, migrations drift, widget bundle URL.
R0.4 WRITE /DOCS/RESCUE_REPORT.MD
- Table: Feature | Status (Working / Fake / Broken / Missing) | Evidence | Fix plan | Needs a key from me? (which one).
- Cover at least: auth, chatbot wizard, training/ingestion, retrieval, answering, widget, lead capture, Buyer DNA, intent score, hot-lead alert, inventory, shortlist room, appointments, WhatsApp, webhooks, analytics, billing.
R0.5 FIX NOW (NO KEY NEEDED)
- Fix every Broken item that does not require an external key. Replace fake paths with real code or with a clear 'not connected' state.
R0.6 FAIL LOUDLY, NEVER FAKE
- Add Zod env validation at startup. If the LLM or embedding key is missing, AI features return a clear error code and the dashboard shows an 'AI not connected' banner linking to Settings > Integrations. The widget shows a polite fallback ('Share your number and an advisor will call you') and still captures the lead.
R0.7 TOOLS
- Add `pnpm doctor`: checks Postgres, pgvector, Redis, worker heartbeat, LLM key (1-token live call), embedding key (live call), Meta token, storage, SMTP. Prints a green/red table. Never prints secret values.
- Add `pnpm smoke:chat`: creates a bot, ingests sample text, asks 5 questions, asserts grounded answers and a captured lead. Exit code 1 on failure.
ACCEPTANCE CRITERIA
[ ] RESCUE_REPORT.md exists with evidence for every feature
[ ] No canned or simulated chat replies remain on the live path
[ ] pnpm doctor runs and clearly shows which keys are missing
[ ] Everything that does not need a key now works; typecheck, lint, tests green
Then tell me exactly which keys you need and say: 'Run pnpm setup:keys'. Do not continue to the next phase.
```


## Phase R3: Key handover, env and integrations vault

Goal: Antigravity asks you for every key it needs (AI and Meta included), stores them safely, tests them, and wires them in.

#### PHASE R3 - KEY HANDOVER AND INTEGRATIONS VAULT

```text
R3.1 KEY LIST
- Create /docs/KEYS_NEEDED.md: every env var with name, plain-English meaning, where to get it (exact website), required now or later, which phase uses it. Keep .env.example in sync (names only, no values).
R3.2 INTERACTIVE KEY WIZARD: PNPM SETUP:KEYS
- Terminal wizard that asks me for each key one at a time in plain words, e.g. 'Paste your Claude API key (from console.anthropic.com). Press Enter to skip.' Input is hidden. It resumes if interrupted.
- It first asks which LLM provider I want (Claude, OpenAI or Gemini) and which embedding provider, then asks only for the keys needed for those choices.
- It generates secrets itself: JWT_ACCESS_SECRET, JWT_REFRESH_SECRET, ENCRYPTION_KEY (32 bytes), WHATSAPP_VERIFY_TOKEN.
- After saving to .env it validates every key with a live test call and prints PASS / FAIL / SKIPPED with a one-line fix hint. It never prints the key.
- Meta questions, in order: Meta App ID, App Secret, System-user permanent access token, WhatsApp Phone Number ID, WhatsApp Business Account ID, business WhatsApp number, approved template names, optional Page ID and Instagram Business ID.
R3.3 SAFETY RULES
- .env is git-ignored. Add a secret-scanning pre-commit hook (gitleaks or similar) and a CI check. Mask secrets in logs, errors, Sentry and LLM traces.
- If you ever need a key mid-task, STOP and say 'Run pnpm setup:keys'. Never ask me to paste a key in chat.
R3.4 SETTINGS > INTEGRATIONS PAGE
- Two scopes: Platform keys (super_admin: LLM, embeddings, SMTP, storage) and Company keys (company_admin: WhatsApp, Google, Razorpay, CRM).
- Secrets stored encrypted at rest (AES-256-GCM, key from ENCRYPTION_KEY), shown masked (last 4 only), with: Test connection, Rotate, Last validated, Disconnect. Every change goes to the audit log.
- Optional 'Bring your own LLM key' per company, falling back to the platform key, with usage metering either way.
R3.5 META / WHATSAPP GUIDED SETUP
- In-app stepper plus /docs/META_SETUP.md in simple steps: create Meta developer app, add the WhatsApp product, create a system user and generate a permanent token, copy Phone Number ID and Business Account ID, set the Callback URL and Verify Token, subscribe to 'messages', create and submit message templates, test with the sandbox number.
- Buttons: 'Verify webhook' (checks the URL is reachable and the token matches), 'Send test message', 'Check template status'. Show plain-language errors (for example expired token, wrong phone number ID, number not registered).
R3.6 PRODUCTION SECRETS
- Document how to set env groups on Render and Vercel, a rotation schedule (every 90 days), and a rule that dev keys are never reused in production.
ACCEPTANCE CRITERIA
[ ] pnpm setup:keys works, hides input, resumes, validates, never leaks a value
[ ] Integrations page stores encrypted keys, masks them, tests them, audit-logs changes
[ ] pnpm doctor shows green for every key I supplied
[ ] Secret scan passes in CI; no secret appears in logs or traces (tested)
[ ] Meta webhook verify and test message work with my credentials
[ ] Tests green. Do not start the next phase.
```


## Phase R1: Real AI with RAG, LangChain and your LLM key

Goal: when a buyer asks a question, the bot gives a clear, friendly, correct answer taken from the agency's own data. LangChain.js is used for loaders, splitters, embeddings, vector store, chains and tools, but it stays behind our own provider classes in apps/api/src/modules/ai so it can be swapped.

#### PHASE R1 - REAL AI: RAG + LANGCHAIN + LLM

```text
R1.1 INSTALL AND STRUCTURE
- Add langchain, @langchain/core, @langchain/textsplitters, @langchain/community (loaders, PGVectorStore) and the provider packages I chose (@langchain/anthropic, @langchain/openai, @langchain/google-genai). Add pdf, docx, csv/xlsx and HTML loaders. Pin versions.
- Keep it inside apps/api/src/modules/ai behind LlmProvider, Embedder, Retriever and Chain classes. No LangChain imports outside that module.
R1.2 CONFIGURATION
- Env/config: LLM_PROVIDER, LLM_MODEL_STRONG (customer answers), LLM_MODEL_CHEAP (classify, extract, rewrite), EMBEDDING_PROVIDER, EMBEDDING_MODEL, EMBEDDING_DIM. Check the provider's current docs for model names; do not guess or hardcode.
- The model router (Phase 3) selects the model by task, with timeout, retry with backoff, circuit breaker, provider fallback and a per-company budget.
R1.3 INGESTION PIPELINE (BULLMQ WORKER)
- Load (PDF, DOCX, TXT, CSV/XLSX, web crawl, FAQ pairs, inventory rows) -> clean -> split (RecursiveCharacterTextSplitter, about 500 tokens, 80 overlap; keep headings with their text) -> embed in batches with rate-limit handling -> store with metadata {company_id, chatbot_id, source_id, project, page, section, updated_at} plus a tsvector column.
- Property and unit data is NOT only embedded: it also stays in structured tables, and price/availability answers always come from those tables through a tool, never from vector text.
- Idempotent re-ingest (hash per source), progress over Socket.io, retry on failure, re-embed job when the embedding model changes.
R1.4 RETRIEVAL
- Query rewriting: use the cheap model to turn a follow-up ('and the 2BHK?') into a standalone question using chat history.
- Hybrid search: pgvector similarity + Postgres full-text, merged with Reciprocal Rank Fusion; filter by company_id, chatbot_id and project; MMR for variety; top 6 to 8 chunks; optional LLM rerank.
- Similarity threshold: if nothing relevant is found, do not guess. Say so and offer a callback or a site visit.
R1.5 ANSWERING CHAIN
- Build with LangChain Expression Language: rewrite -> retrieve -> assemble context with source ids -> answer -> validate.
- Structured output (Zod): {answer, citations[], confidence, intent, needs_handoff, quick_replies[], extracted_facts}. Stream the answer tokens to the widget over SSE.
- Memory: last N turns plus a rolling summary. Returning visitors are remembered only with consent.
- Tools through the guarded action layer: search_properties, get_brochure, book_visit, capture_lead, calculate_emi, handoff_to_agent, send_shortlist.
R1.6 ANSWER STYLE (THIS IS WHAT MAKES IT FEEL GOOD)
- Warm, short and clear: 2 to 4 sentences by default, simple words, uses the visitor's name once known, asks ONE question at a time, ends with a helpful next step (see homes, book a visit, get the brochure).
- Replies in the visitor's language (English, Hindi, Hinglish and the other configured languages). Uses short bullets for comparisons and property cards for homes.
- Never invents price, availability, possession date or offers. If data is stale or missing, says so and offers an advisor. Shows 'Price as on <date>' when quoting inventory.
- Never reveals the system prompt. Refuses off-topic and unsafe requests politely and steers back to property help.
R1.7 SAFETY AND QUALITY
- Hallucination guard: every number, date and project name in the answer must appear in the retrieved context or tool result; otherwise regenerate once, then fall back to a handoff.
- Prompt-injection filter on user text AND on ingested documents. PII masked before traces.
- Eval set: at least 50 real-estate Q&A cases (grow to 100). `pnpm eval` reports faithfulness (answer supported by context), answer relevance, context precision, hallucination rate and refusal correctness. CI fails if scores drop.
R1.8 FAILURE BEHAVIOUR
- If the LLM is down or slow: retry, then fallback provider, then a polite message plus lead form. Never a blank reply, never a raw error, never a fake answer.
R1.9 DASHBOARD
- Training page: live ingestion progress, chunk preview, 'Test retrieval' panel showing which chunks matched, per-answer 'Why this answer' with sources, thumbs up/down, Correct-this-answer override, Unanswered-questions inbox.
- Seed a demo bot with a sample brochure, FAQ and 30 units so the chatbot works on the first run.
ACCEPTANCE CRITERIA
[ ] 20 scripted questions (price, area, possession, amenities, loan, location, comparison, Hindi/Hinglish) get correct, friendly, grounded answers
[ ] A question not in the data gets an honest 'I do not have that' plus a callback offer
[ ] First streamed token in under 2.5 s on a normal connection; no blank or duplicated replies
[ ] Killing the LLM key triggers the fallback path, not a crash
[ ] pnpm eval prints faithfulness and hallucination numbers; traces show cost per company
[ ] Tests green. Do not start the next phase.
```


## Phase R2: New UI/UX theme (inspired by Kenyt, original in look)


### What I saw on the Kenyt real-estate page (patterns to learn from)

- A hero that states the outcome in one line, a one-line explanation, and two buttons: a primary 'try for free' and a secondary 'try the live demo'.
- A trust strip right under the hero: customer logos plus review-site badges (Google, G2, Capterra).
- Four big headline numbers (conversion, engagement, cost savings, lower support cost) as a proof band.
- A use-case section built from icon cards (for example personalised visitor navigation).
- A mega-menu that groups the product by channels, AI agents, experiences and workspace, then an integrations strip and pricing choices.
- Strong calls to action repeated through the page and a live demo that opens straight into a working bot.

Important. Learn the structure, not the assets. Do not copy their text, logos, images, colours or brand. Do not show customer logos, review badges or statistics you do not own. Only show real numbers from your own data, or clearly labelled 'Sample' placeholders.

#### PHASE R2 - UNIQUE UI/UX THEME 'AURORA ESTATE'

```text
R2.1 DESIGN SYSTEM (APPS/WEB + PACKAGES/WIDGET SHARE TOKENS FROM PACKAGES/SHARED/DESIGN-TOKENS)
- Name: Aurora Estate. Mood: calm, premium, trustworthy, built for Indian real estate.
- Colours: Midnight Navy #0B1B3A (text, dark surfaces), Electric Blue #2563EB (primary), Mint #14B8A6 (success, 'verified'), Warm Sand #F6F1E7 (soft backgrounds), Gold #F5B942 (hot lead and highlights), Rose #E11D48 (alerts). Full dark mode. WCAG AA contrast.
- Type: Inter for UI, a friendly display face (Plus Jakarta Sans or Sora) for headings. Scale 12/14/16/20/28/40. Radius 12 and 20. Soft layered shadows, subtle glass cards, thin borders, gradient accents used sparingly.
- Motion: 150 to 250 ms ease-out, count-up numbers, skeleton shimmer, animated typing dots. Respect prefers-reduced-motion.
- Build tokens, then components (button, input, card, badge, drawer, table, tabs, toast, empty state, stat tile, gauge, timeline, command palette) before restyling screens. Document in /docs/DESIGN_SYSTEM.md and add a /design page that shows every component.
R2.2 CHAT WIDGET REDESIGN (THE MOST IMPORTANT SCREEN)
- Launcher: round avatar, green online dot, short proactive bubble ('Looking for a home? Ask me anything'), gentle pulse once.
- Header: bot avatar, project or company name, 'Replies instantly', language switcher, minimise, menu.
- Welcome screen: warm greeting plus 4 action cards: Find my home, Book a site visit, Get brochure, Talk to an advisor. Then the normal chat.
- Messages: streamed text, animated typing dots, quick-reply chips, property carousel cards (photo, price, BHK, area, 'Shortlist' and 'Book visit'), mini EMI slider, calendar slot picker, brochure card, voice-note button (where enabled).
- Trust row: RERA number, 'Replies are generated from official project data', privacy link, 'Powered by' badge removable on paid plans.
- Mobile: full-screen sheet with safe-area padding, large tap targets, no layout jump when the keyboard opens. Bundle stays under 60 KB gzipped.
R2.3 DASHBOARD REDESIGN
- Sidebar grouped as ENGAGE (Chatbots, WhatsApp, Inbox), SELL (Leads, Pipeline, Appointments, Properties), GROW (Campaigns, Workflows, Analytics), ADMIN (Approvals, Users, Subscription, Settings). Collapsible, with badges for approvals and unread.
- Command palette (Ctrl/Cmd+K): jump to any lead, bot, page or action. Global search.
- Home = 'Today' view: hot leads waiting for a call with SLA timers, today's site visits, pending AI approvals, new unanswered questions, bot health (AI connected, last training, cost today), and a setup checklist for new accounts (Connect AI -> Train bot -> Embed -> First lead).
- Lead drawer: header with name, score gauge and next best action; tabs for Overview, Chat, Buyer DNA (radar-style card with confidence), Timeline, Notes, Tasks, Visits, Documents. One-tap Call / WhatsApp / Send shortlist.
- Every list has skeletons, a friendly illustrated empty state with one clear action, and readable error states.
R2.4 SHORTLIST ROOM REDESIGN
- Premium, mobile-first: hero with the buyer's first name, swipeable property cards, compare table, map, EMI slider, 'Ask AI about this home' mini chat, sticky 'Book a visit' and 'Call me back' buttons. Expiry notice. Every interaction tracked.
R2.5 PUBLIC WEBSITE (APPS/WEB PUBLIC ROUTES, SEO READY)
- Pages: Home, Real Estate AI Agent, How it works, Features, Pricing, Live Demo, Integrations, Book a demo, Privacy, Terms.
- Home structure: outcome headline + sub + two buttons (Start free, Try live demo) -> product visual (real screenshot or live widget) -> trust strip -> proof band with REAL numbers or labelled samples -> how it works in 3 steps -> use-case cards (24/7 enquiry handling, lead qualification, site-visit booking, WhatsApp follow-up, shortlist rooms, multilingual) -> feature grid -> integrations strip -> pricing -> FAQ -> final call to action.
- Live demo page loads a real bot on sample data with rate limits and a cost cap.
- Technical: responsive, dark mode, Lighthouse 90+ for performance, accessibility and SEO, meta tags, sitemap, alt text.
ACCEPTANCE CRITERIA
[ ] /design page shows all components in light and dark
[ ] Widget, dashboard Today view, lead drawer, Shortlist Room and public site match the described structure on mobile and desktop
[ ] No fake logos, reviews or statistics anywhere; placeholders are labelled 'Sample'
[ ] Lighthouse 90+ on public pages; axe accessibility checks pass on key screens
[ ] Playwright screenshots saved for review; tests green. Do not start the next phase.
```


## Phase R4: Business logic audit in simple language

Goal: a document anyone can read that says, journey by journey, what should happen, what really happens today, and where the business can lose leads or money. Antigravity must test each journey for real, not just read the code.

#### PHASE R4 - BUSINESS WORKFLOW AUDIT (SIMPLE LANGUAGE)

```text
Act as a business analyst plus QA lead. Run every journey below on the live app with real data, then write /docs/BUSINESS_WORKFLOW_AUDIT.md.
WRITING RULES
- Plain English. Short sentences. No jargon. Write so a real-estate shop owner can understand. Explain any technical word in brackets the first time.
- For each journey use exactly this template: (1) What should happen, in 3 to 6 simple steps drawn as a tiny flow like Visitor -> Chat -> Lead -> Alert -> Call. (2) What actually happens today (tested). (3) Verdict: Works / Partly works / Broken / Missing. (4) Business risk if it stays this way (lost lead, wasted money, legal risk, bad reputation). (5) Fix, with the phase or file that handles it.
JOURNEYS TO TEST
- 1 Agency signs up, is approved and sets up the company.  2 Agency creates a chatbot and trains it with a brochure, website and FAQs.  3 A visitor chats on the website (price, area, possession, loan questions, Hindi/Hinglish).
- 4 The chat becomes a lead: details captured, duplicate handled, Buyer DNA filled, intent score shown with reasons.  5 A hot lead alerts the right salesperson within seconds, with a brief and next best action.
- 6 Salesperson works the lead: call, WhatsApp, notes, tasks, status change, reassign.  7 Site visit: booked in chat, reminders sent, no double booking, reschedule, no-show, post-visit survey.
- 8 Brochure request and Shortlist Room link, and the buyer's clicks raising the score.  9 WhatsApp conversation: AI reply, human handoff, 24-hour window, opt-out.  10 Lead delivery to a client company (agency/reseller mode), credits, client portal.
- 11 Billing and plan limits.  12 Privacy: consent, export, delete, retention.  13 Money and promises: the AI must never promise price, discount, payment terms or possession; those go to human approval.
- 14 Failure days: AI key missing, AI provider down, no inventory data, angry visitor, after-hours visitor, spam or abusive visitor, duplicate webhook, Meta token expired, queue stuck.
EXTRA SECTIONS TO INCLUDE
- 'Who does what' table: Visitor, AI bot, Salesperson, Sales manager, Company admin, Platform owner.
- 'Business rules in one page': when a lead is Hot, SLA time, reassign rules, visit slot rules, lead credit rules, who can approve what, how long data is kept.
- 'Where leads or money can leak': list every place a lead can be dropped, delayed, duplicated or shown to the wrong company, and every place AI cost can run away.
- 'Top 10 risks' ranked by damage to the business, then 'Fix first' (top 5 actions).
- Plain-language flow diagrams as simple text or Mermaid for the 5 most important journeys.
THEN
- Fix every Broken item that is quick, list the rest in /docs/GAP_REPORT.md with a priority, update BUSINESS_FLOW.md, re-run the journeys and print a one-page scorecard (journey, before, after).
ACCEPTANCE CRITERIA
[ ] All 14 journeys tested live with evidence (screenshots or logs)
[ ] BUSINESS_WORKFLOW_AUDIT.md readable by a non-technical owner
[ ] 'Where leads or money can leak' and 'Top 10 risks' sections present
[ ] Quick fixes done, rest prioritised; tests green. Do not start the next phase.
```


## Phase 16: Onboarding, public demo and self-serve signup

#### PHASE 16 - ONBOARDING AND GROWTH ENGINE

```text
16.1 Self-serve onboarding wizard after signup (5 steps): company profile -> connect AI (uses the platform key by default) -> add first project (upload brochure or paste website URL) -> customise bot look and welcome message -> copy embed code and test chat. Progress bar, resume, and a 'time to first lead' metric.
16.2 Interactive product tour, setup checklist on the Today view, help centre with searchable markdown articles and short how-to videos links, in-app changelog.
16.3 Book-a-demo and contact forms feed OUR OWN CRM (we use the product ourselves). Auto WhatsApp or email acknowledgement.
16.4 Free trial rules: limited conversations and AI tokens, no credit card, trial expiry emails, upgrade prompts at limits, abuse protection (rate limits, CAPTCHA such as Cloudflare Turnstile on signup and public demo).
16.5 Templates at signup: bot templates for Apartments, Villas, Plots, Commercial, Rentals and Broker (each with sample FAQs, qualification questions and tone).
ACCEPTANCE CRITERIA
[ ] A new user reaches a working embedded bot in under 10 minutes
[ ] Trial limits enforced; demo requests land in our CRM; tests green
```


## Phase 17: Channel partners, brokers and commissions

#### PHASE 17 - CHANNEL PARTNER PORTAL AND COMMISSIONS

```text
17.1 New role 'partner' with a restricted portal: register a lead, see status of own leads only, download brochures and collateral, see commission statement.
17.2 Lead protection: duplicate check on registration, configurable lock period (for example 60 or 90 days), conflict workflow when two partners claim the same buyer, manager decision with audit trail.
17.3 Commission rules per project: percentage or flat, slab tiers, trigger stage (booking, agreement, registration), clawback on cancellation. Accrual happens automatically from domain events; manager approval; payout export (CSV) with TDS fields.
17.4 Partner referral links and QR codes, partner leaderboard, monthly statement PDF.
17.5 Events: partner_lead_registered, commission_accrued, commission_approved. All partner views run under RLS.
ACCEPTANCE CRITERIA
[ ] A partner sees only their own leads; duplicate registration is blocked or flagged
[ ] Commission accrues on stage change and survives a cancellation correctly (tested); tests green
```


## Phase 18: Booking, unit hold, payment plans and document vault

#### PHASE 18 - BOOKING, PAYMENTS AND DOCUMENTS

```text
18.1 Unit lifecycle: available -> held -> booked -> sold. Time-limited hold (default 24 h, configurable) that releases automatically; concurrency-safe (two buyers cannot hold the same unit; test it).
18.2 Cost sheet generator: base price, floor rise, preferred location charge, parking, GST, stamp duty, registration, maintenance deposit, from admin-maintained tables. Output as PDF. Marked 'estimate'. Sending a cost sheet is a T2 action needing human approval.
18.3 Payment plans (construction-linked and time-linked), demand schedule, reminders, manual entry for bank transfers, Razorpay/Stripe links, receipts. Refunds are admin-only and manual.
18.4 Document vault: PAN, ID, address proof and agreement uploads. Encrypted storage, signed URLs, minimum data collected, masked display, explicit consent, retention rules, access audit. Optional e-sign provider behind an interface.
18.5 Booking checklist per unit with status (documents, token, agreement, registration) and events: unit_held, unit_released, booking_confirmed, payment_received, document_uploaded.
ACCEPTANCE CRITERIA
[ ] Concurrent hold test passes; expired holds release; the stage becomes Booked only after confirmed payment or admin action
[ ] Documents are encrypted, access is audited and visible only to permitted roles; tests green
```


## Phase 19: Money tools and NRI mode

#### PHASE 19 - HOME-BUYER MONEY TOOLS AND NRI MODE

```text
19.1 Calculators available in chat, Shortlist Room and the public site: EMI, affordability from income and obligations, indicative loan eligibility, stamp duty and registration by state (admin-maintained rates), GST on under-construction homes, total cost of ownership. All labelled as estimates with the date of the rate table.
19.2 Loan partner handoff: with explicit consent, send a qualified lead to a loan partner (webhook or email), track status (applied, sanctioned, rejected) on the lead.
19.3 NRI mode: show amounts in a chosen currency with a clearly dated rate (admin table or provider), NRI FAQs from agency data, time-zone aware visit slots, virtual site visit via video link, WhatsApp-first follow-up in the NRI's time zone.
19.4 Never state guaranteed returns or investment advice. The bot gives facts and calculators only.
ACCEPTANCE CRITERIA
[ ] Calculator results match a reference spreadsheet in tests; every result shows its date and 'estimate' label
[ ] Loan handoff happens only after consent; NRI slots show the correct time zone; tests green
```


## Phase 20: Agent mobile app (PWA), push alerts and call logging

#### PHASE 20 - SALES AGENT MOBILE EXPERIENCE

```text
20.1 Installable PWA tuned for phones: 'My day' first (hot leads, follow-ups, visits), big tap targets, offline-lite (cached lists, queued notes).
20.2 Push notifications (Web Push or FCM) for hot leads, SLA warnings, visit reminders and approvals. Quiet hours respected.
20.3 One-tap Call and WhatsApp with prefilled message from the brief; after a call, a 10-second outcome form (connected, no answer, call later, not interested, visit booked) that creates the next follow-up automatically.
20.4 Voice-note to text for notes, site-visit check-in with location (consent), share Shortlist Room, quick status change.
20.5 Optional click-to-call through the telephony provider and missed-call capture that creates a lead.
ACCEPTANCE CRITERIA
[ ] A hot-lead push arrives on a phone within 10 seconds; call outcome creates a follow-up task
[ ] PWA installs and works on a slow connection; tests green
```


## Phase 21: Marketing engine (QR, click-to-WhatsApp, landing pages)

#### PHASE 21 - MARKETING ENGINE

```text
21.1 Campaign link builder with UTM presets and short links. QR codes for hoardings, brochures and standees that open the WhatsApp bot with project and campaign context.
21.2 Click-to-WhatsApp ads: capture the ad referral data so the lead keeps its campaign. Meta Lead Ads and Google Ads lead-form webhooks into the same lead pipeline with an instant welcome message.
21.3 Landing page builder: simple blocks (hero, gallery, price table, amenities, map, form, chatbot) per project or campaign, published on a clean URL, with tracking and consent banner. Forms create leads.
21.4 Referral programme for existing customers: unique codes, tracked referrals, reward approval workflow.
21.5 Spend tracking and metrics per channel: cost per lead, cost per qualified lead, cost per visit, cost per booking.
ACCEPTANCE CRITERIA
[ ] A QR scan lands in WhatsApp with the campaign attached to the new lead
[ ] A landing-page form creates a lead with the correct source; cost metrics match manual calculation; tests green
```


## Phase 22: AI Copilot 2.0, quality scoring and experiments

#### PHASE 22 - AI COPILOT 2.0

```text
22.1 Conversation QA: automatically score every chat for helpfulness, groundedness, tone and compliance; flag low scores into a review queue; reviewer feedback improves the eval set.
22.2 Weekly AI insights digest per company: top questions, top objections, content gaps, reasons for lost deals, best performing hours. Delivered by email and WhatsApp.
22.3 Content studio: RERA-safe ad copy, WhatsApp template drafts, project descriptions, FAQ generation from brochures, translations. Every output needs human review; RERA number inserted; guaranteed-return wording blocked.
22.4 Bot A/B tests: welcome message, quick replies, order of qualification questions. Statistical significance and a safe auto-stop for a clearly worse variant.
22.5 Multimodal: understand floor-plan and brochure images to answer layout questions, always citing the source page.
22.6 Sales coach for agents: response-time nudges, suggested replies, call-script from Buyer DNA, objection playbooks.
ACCEPTANCE CRITERIA
[ ] Low-quality chats appear in the review queue; digest is generated from real data
[ ] A/B test shows variant results with significance; copy generator always includes RERA and blocks banned claims; tests green
```


## Phase 23: Post-sales customer portal and support

#### PHASE 23 - POST-SALES EXPERIENCE

```text
23.1 Customer portal (magic link or OTP login): booking details, payment schedule and receipts, documents, construction progress updates with photos by stage, possession timeline, referral link, feedback score.
23.2 Construction-update broadcasts through approved WhatsApp templates to opted-in buyers only.
23.3 Support tickets: categories, SLA timers, assignment, internal notes, AI first reply from the knowledge base. Any commitment (possession date, compensation, discount) is a T2 action needing human approval.
23.4 NPS or CSAT after key milestones feeding analytics.
ACCEPTANCE CRITERIA
[ ] A customer sees only their own booking data; update broadcasts respect opt-out
[ ] A ticket with a date commitment lands in the approval queue; tests green
```


## Phase 24: Analytics 2.0 for owners

#### PHASE 24 - OWNER ANALYTICS

```text
24.1 Owner dashboard: pipeline value (units x price by stage), probability-weighted forecast clearly labelled 'estimate', lead ageing, speed-to-lead heatmap, drop-off by stage, project-wise absorption.
24.2 Agent scorecards: response time, visit conversion, follow-up discipline, lost reasons. Team comparison.
24.3 Campaign ROI: cost per lead, per visit and per booking by channel, campaign and project.
24.4 Scheduled PDF reports by email or WhatsApp; embeddable in the client portal.
24.5 Data export: CSV/Sheets and a read-only BI connection (per-tenant views under RLS) for Looker Studio or Metabase.
24.6 Data quality panel: missing phones, duplicates, stale leads, unreachable numbers.
ACCEPTANCE CRITERIA
[ ] Every number reconciles with raw SQL counts in tests; dashboards load under 1.5 s on 100k conversations
[ ] BI connection cannot see another tenant's data; tests green
```


## Phase 25: Platform, API and ecosystem

#### PHASE 25 - PLATFORM AND ECOSYSTEM

```text
25.1 Public REST API v1 with OpenAPI, scoped API keys, rate limits, a TypeScript SDK, and webhook signature docs.
25.2 Connectors: Google Sheets, one CRM (HubSpot or Zoho) first, LeadSquared, Zapier/Make app, portal lead ingestion (99acres, MagicBricks, Housing) via email-parse or webhook.
25.3 Template marketplace: bot templates by segment (luxury, affordable, plots, commercial, rentals), workflow templates, prompt packs. Import and export bot config as validated JSON.
25.4 White-label: custom domain for dashboard, widget and Shortlist Room, branded emails, removable 'Powered by'.
25.5 Usage-based billing meters (conversations, AI tokens, WhatsApp messages), GST-compliant invoices for India, payment retries and dunning emails.
25.6 Public status page, dashboard translations (English and Hindi first), extra property types (plots, rentals, commercial, resale).
ACCEPTANCE CRITERIA
[ ] A third party creates a lead through the API with a scoped key and cannot read other tenants
[ ] Bot config export and import round-trips; custom domain serves the widget; invoices match usage; tests green
```


## Phase 26: Production go-live (security, reliability, compliance, launch)

#### PHASE 26 - PRODUCTION READINESS AND LAUNCH

```text
26.1 ENVIRONMENTS AND RELEASES
- dev, staging and production with separate databases and keys. Infrastructure as code (render.yaml, optional Terraform). Feature flags with per-feature kill switches. Zero-downtime migrations with rollback plan. Canary or blue/green deploys. Containers for api and worker.
26.2 RELIABILITY
- Targets: chat uptime 99.9%, p95 first token under 2.5 s, outbox lag under 10 s. Dead-letter queues, idempotency keys, circuit breakers, graceful degradation when the LLM is down (lead form plus human handoff).
- Postgres backups with point-in-time recovery, a written restore drill with RPO/RTO, and a disaster recovery runbook. Synthetic chat probe every 5 minutes that alerts the team.
26.3 SECURITY
- OWASP ASVS level 2 checklist, dependency, SAST and secret scans in CI, strict CSP, Cloudflare WAF and bot protection on public endpoints, per-tenant rate limits and AI cost caps, encrypted tokens, key rotation procedure, 2FA for admins, audit log export. Commission an external penetration test before big customers.
- Re-run attack tests: cross-tenant access, signature bypass, prompt injection (including through uploaded documents), AI-action-layer bypass, PII in traces, SSRF in the web crawler.
26.4 COMPLIANCE (CONFIRM DETAILS WITH A LAWYER)
- Consent log and notice, data rights flows (access, correction, delete, export), retention jobs, breach-response runbook, India DPDP Act awareness, India region hosting where possible, DPA template.
- WhatsApp opt-in and template policy, SMS DLT registration and calling-hour/DND rules, RERA-compliant marketing copy, no guaranteed-return claims.
26.5 OBSERVABILITY AND COST CONTROL
- Sentry, structured logs to a log drain, metrics dashboard, alerts to Slack or WhatsApp for outbox lag, queue depth, error rate, webhook failures, LLM errors and cost spikes.
- Per-company LLM budgets with soft and hard limits, cached embeddings, a guarded semantic cache for repeated FAQs, cheap-model routing, daily cost report.
26.6 PERFORMANCE
- Load test 500 concurrent chats and report; DB indexes verified with EXPLAIN ANALYZE; connection pooling; widget under 60 KB gzipped; CDN with versioned files.
26.7 LAUNCH CHECKLIST (PRODUCE /DOCS/LAUNCH_CHECKLIST.MD)
- Legal pages (privacy, terms), support process and contact, billing end-to-end in test then live mode, pilot customer sign-off, monitoring on-call plan, rollback plan, status page, announcement plan.
ACCEPTANCE CRITERIA
[ ] Staging and production deploy from CI with one command; migrations are reversible
[ ] Restore drill completed and timed; load test report attached; attack tests pass
[ ] Alerts fire in a test; kill switches work; LAUNCH_CHECKLIST.md fully ticked or each gap explained
[ ] Tests green. Report final status in plain language.
```


## Final audit v5 (run after Phase 26, and after each big batch)

#### FINAL AUDIT V5

```text
Act as an independent QA lead and security reviewer. Read MASTER_CONTEXT.md, V5_ADDENDUM.md, PROGRESS.md, RESCUE_REPORT.md and the whole codebase.
1. Table of every promised feature in v4 and v5 phases: Implemented / Partial / Missing with file path evidence.
2. Run lint, typecheck, unit and integration tests, pnpm eval, pnpm doctor, pnpm smoke:chat and the Playwright golden path. Report failures.
3. Prove the chatbot is real: ask 30 varied questions (price, possession, loan, amenities, comparison, Hindi, Hinglish, off-topic, abusive, injection attempts) and score each answer for correctness, friendliness and groundedness. Show the retrieved sources for 10 of them.
4. Attack tests: tenant isolation, webhook signatures, rate limits, prompt injection, AI action bypass, T2 action without approval, ask-your-pipeline tenant leak, PII in traces, secrets in logs or repo.
5. Business workflow audit refresh: re-run all 14 journeys and update BUSINESS_WORKFLOW_AUDIT.md in plain language, including 'Where leads or money can leak'.
6. UI/UX check against the Aurora Estate design: spacing, contrast, mobile, empty and error states, performance.
7. Produce /docs/GAP_REPORT.md with a prioritised list, fix every Missing and Partial item, re-run everything, and print a final scorecard. Then write a 1-page plain-language summary: what works, what is risky, what I must do next.
```


## How the whole business works, in simple words

Keep this page. It is the story the audit checks against.

| Step | What happens | Who does it | What can go wrong (and must be checked) |
|---|---|---|---|
| 1 | Agency signs up and gets approved. | Agency admin, platform owner | Fake signups, wrong approvals |
| 2 | Agency uploads brochures, price lists, FAQs and website link. The bot reads and remembers them. | Agency admin, AI | Old prices, missing data, failed upload |
| 3 | One line of code goes on the website, or WhatsApp is connected. | Agency admin | Wrong domain, expired Meta token |
| 4 | A visitor asks a question. The bot finds the answer in the agency's own data and replies in friendly words. | Visitor, AI | Made-up answers, slow replies, wrong language |
| 5 | While chatting, the bot notes budget, area, timeline (Buyer DNA) and scores how serious the buyer is (0 to 100). | AI | Wrong score, stale score |
| 6 | Visitor shares a phone number: a lead is created. Score 70 or more means Hot. Duplicates are merged. | AI, system | Duplicate or lost leads |
| 7 | Hot lead: salesperson gets an instant alert with a short brief and the best next action. | System, salesperson | Alert late or to the wrong person |
| 8 | Salesperson calls or WhatsApps. A site visit is booked and reminders go out. | Salesperson, AI | Double booking, no reminder, no-show |
| 9 | Buyer gets a private Shortlist Room with matched homes and an EMI calculator. Their clicks raise the score. | AI, buyer | Wrong matches, expired link |
| 10 | After the visit: survey, negotiation, booking, payment, documents. | Salesperson, manager | Unapproved discounts, unpaid bookings |
| 11 | After booking: customer portal, payment schedule, construction updates, support tickets. | Customer, support | Wrong promises, missed updates |
| 12 | Owner sees leads, visits, bookings, cost per lead and which ads work. | Owner, manager | Numbers that do not match reality |


### Money and safety rules

- The agency pays a subscription (and optionally per delivered lead). We pay for AI and WhatsApp usage, so every company has budgets and limits.
- The AI may read and take small reversible actions. Anything about price, discount, payment, possession or legal claims needs a human to approve. A kill switch stops all AI actions instantly.
- Privacy by default: tracking is opt-in, consent is logged, and people can ask for their data to be exported or deleted.


## Feature coverage matrix (v5)

| Request or feature | Phase |
|---|---|
| Chatbot not working: diagnose, fix fakes, doctor and smoke tools | R0 |
| Antigravity asks for AI and Meta keys safely, vault, validation | R3 |
| Real AI: RAG, LangChain, LLM key, hybrid retrieval, evals, fallbacks, nice answers | R1 |
| New unique UI/UX theme inspired by Kenyt structure (widget, dashboard, public site) | R2 |
| Plain-language audit of full business workflow | R4, Final audit |
| Self-serve onboarding, templates, trial, demo | 16 |
| Channel partners, broker portal, commissions | 17 |
| Unit hold, cost sheet, payment plans, document vault | 18 |
| EMI, affordability, stamp duty, loan partner, NRI mode | 19 |
| Agent mobile PWA, push alerts, call logging | 20 |
| QR codes, click-to-WhatsApp, landing pages, referrals, campaign ROI | 21 |
| Conversation QA, AI insights, content studio, A/B tests, multimodal | 22 |
| Customer portal, update broadcasts, tickets | 23 |
| Owner analytics, agent scorecards, BI export | 24 |
| Public API, connectors, marketplace, white-label, GST invoices, status page | 25 |
| Security, reliability, compliance, observability, launch checklist (production level) | 26 |

Reminder: voice calling, MCP server and enterprise SSO remain in Phase 15C of v4. Start them only when customers ask.
