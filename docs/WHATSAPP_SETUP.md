# PropBot Pro — WhatsApp Cloud API Setup Guide

PropBot Pro connects directly to Meta's official **WhatsApp Cloud API** to enable automated lead capture, instant RAG-based property queries, automated site visit confirmations, and real-time sales agent handoffs.

---

## 1. Prerequisites

1. A verified **Meta Business Manager** account.
2. An active **Meta for Developers** account.
3. A clean phone number that is **not currently registered** on personal WhatsApp or WhatsApp Business mobile apps.

---

## 2. Meta Developer Portal Setup

### Step 1: Create a Meta App
1. Navigate to the [Meta for Developers Portal](https://developers.facebook.com/).
2. Click **Create App** and select **Other** -> **Business**.
3. Provide an App Name (e.g. `PropBot Cloud API`) and attach your Meta Business Account.

### Step 2: Add WhatsApp Product
1. Under **Add products to your app**, locate **WhatsApp** and click **Set up**.
2. Navigate to **WhatsApp -> API Setup** on the left menu.
3. Note your **Phone Number ID** and **WhatsApp Business Account ID (WABA ID)**.

### Step 3: Generate Permanent System User Access Token
1. Go to **Meta Business Settings -> Users -> System Users**.
2. Click **Add**, name the user `PropBotServiceUser`, and assign the **Admin** role.
3. Click **Generate New Token**, select your app, and grant the following permissions:
   - `whatsapp_business_messaging`
   - `whatsapp_business_management`
4. Copy the resulting token (`EAAG...`). Store this token securely.

---

## 3. Configuring Webhooks

PropBot Pro receives inbound messages, button interactions, and delivery receipts through webhook subscriptions.

1. In the Meta App Dashboard, navigate to **WhatsApp -> Configuration**.
2. Under **Webhook**, click **Edit**:
   - **Callback URL**: `https://api.propbotpro.com/api/whatsapp/webhook`
   - **Verify Token**: Enter your custom secret (matching `WHATSAPP_VERIFY_TOKEN` in your API environment).
3. Click **Verify and Save**.
4. Under **Webhook fields**, click **Manage** and subscribe to:
   - `messages`
   - `message_deliveries`
   - `message_reads`

---

## 4. Connecting to PropBot Pro

1. Log in to the PropBot Pro Dashboard as a **Company Admin**.
2. In the left navigation, select **WhatsApp Bot -> Connection Settings**.
3. Enter your Meta credentials:
   - **WhatsApp Business Phone Number**: Full international format (e.g. `+919876543210`)
   - **Phone Number ID**: From Meta API Setup
   - **WABA ID**: From Meta API Setup
   - **Permanent Access Token**: The system user token generated in Step 3
4. Select the target **AI Chatbot** to route conversations to.
5. Click **Test Connection & Save**.

---

## 5. Pre-Approved Message Templates (HSMs)

Meta requires pre-approved templates for initiating conversations outside the 24-hour customer service window. PropBot Pro supports the following standard templates:

### Template 1: Site Visit Confirmation (`visit_confirmed_v1`)
- **Category**: Utility
- **Body**: 
  > *Hi {{1}}, your site visit for {{2}} is confirmed for {{3}} at {{4}}. Our sales representative {{5}} will meet you at the site office. Location: {{6}}*
- **Buttons**:
  - Quick Reply: *Reschedule Visit*
  - Quick Reply: *Get Directions*

### Template 2: Hot Lead Agent Notification (`agent_lead_alert_v1`)
- **Category**: Utility
- **Body**:
  > *🚨 New Hot Lead Alert! {{1}} (Score: {{2}}/100) is interested in {{3}} with budget {{4}}. Tap below to view full Buyer DNA and call.*
- **Buttons**:
  - URL: `https://app.propbotpro.com/crm/leads/{{5}}`

---

## 6. Real Estate Buyer Workflow over WhatsApp

```
Buyer WhatsApp Message ("Looking for 3BHK in Whitefield under 1.5 Cr")
                           |
                           v
              Meta Cloud API Webhook
                           |
                           v
      PropBot API (api/whatsapp/webhook)
                           |
                           +---> Inbound Message Parsed & Verified
                           +---> RAG Knowledge Base Retrieval (pgvector)
                           +---> Buyer DNA Extracted (Budget: 1.5Cr, Config: 3BHK, Loc: Whitefield)
                           +---> Live Intent Score Updated (e.g., Score: 85)
                           |
                           v
   Stream AI Response with Verified Property Cards & Shortlist Room Link
                           |
                           v
   Hot Lead Threshold Reached -> Outbox Event Published
                           |
                           +---> WhatsApp Notification Dispatched to Sales Agent
                           +---> Agent Copilot Brief Generated
```

---

## 7. Troubleshooting & Verification

- **Token Expiry**: If outbound messages fail with HTTP 401, verify that a Permanent System User token was generated, not a temporary 24-hour developer token.
- **Webhook Handshake Failures**: Check API logs for `/api/whatsapp/webhook` with `hub.challenge`. Ensure `WHATSAPP_VERIFY_TOKEN` in `.env` matches Meta exactly.
- **RERA Compliance**: In India, project marketing messages generated by AI automatically append the developer's registered RERA number.
