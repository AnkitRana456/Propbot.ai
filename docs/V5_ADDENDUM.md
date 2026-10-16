# V5 Master Addendum (Rule File)

This addendum extends `/docs/MASTER_CONTEXT.md` and establishes non-negotiable operational, architectural, and quality standards for all development, rescue, and expansion phases.

---

## 1. Definition of Done (Production Level)
- A feature is **DONE** only when it works end to end with **REAL keys** and **REAL data**, has tests, handles errors and empty states gracefully, writes domain events/audit logs, is documented, and has **no stub, mock, or canned answer left on the live path**.
- Stubs are allowed strictly behind an explicit flag (`ALLOW_OFFLINE_MOCK=true` or `MOCK_PROVIDERS=true`) that is **OFF by default** and forbidden when `NODE_ENV=production`.
- If a required key is missing, the feature must report the condition explicitly (dashboard banner, API error code, `pnpm doctor` status). It must never fabricate or simulate a fake result.

## 2. Keys and Secrets Management
- When any API key or token is required, do not ask for keys in chat. Prompt the user with:
  > `"Run pnpm setup:keys"` or `"Add <KEY_NAME> to .env"`
- Never print, log, commit, or echo any secret. Mask secrets in logs, traces, and diagnostics output.
- Maintain `/docs/KEYS_NEEDED.md` with active provider requirements. Validate keys with live test calls and report `PASS` / `FAIL` status without revealing the underlying secrets.

## 3. AI Rules & Fact Grounding
- All customer-facing generations must route through the real LLM model router.
- Ground customer responses exclusively via RAG (LangChain.js inside `apps/api/src/modules/ai`) using the company's verified inventory and knowledge base chunks.
- Never invent property prices, inventory availability, possession dates, RERA registrations, or legal commitments.
- Before using any model identifier, confirm active provider support in official documentation. Do not hardcode deprecated or retired models; manage model identifiers via environment variables and configuration.

## 4. Plain Language Documentation
- Every phase must maintain `/docs/BUSINESS_FLOW.md` with clear, non-technical explanations of user and business workflows: what the phase achieves, who takes action, and failure modes.

## 5. Honesty & Presentation Integrity
- Never fabricate customer logos, fake testimonials, unverified statistics, or certifications.
- Visual previews and placeholder content must be visibly labelled `"Sample"`.
- At the conclusion of every phase, provide a transparent summary:
  1. What is verified and working.
  2. What is partial.
  3. What is blocked (and by which specific key or external account).
  4. What specific next step is required.
