# PropBot Pro — Widget Installation & Integration Guide

The PropBot Pro chat widget is a lightweight, framework-agnostic embeddable script built with vanilla TypeScript. It encapsulates all styles inside a browser **Shadow DOM** to prevent CSS conflicts with hosting websites.

---

## 1. Quick Start: HTML Script Tag

Add the following snippet immediately before the closing `</body>` tag of your website:

```html
<script
  src="https://cdn.propbotpro.com/widget.js"
  data-bot-id="YOUR_CHATBOT_PUBLIC_KEY"
  data-api-host="https://api.propbotpro.com"
  async
></script>
```

Replace `YOUR_CHATBOT_PUBLIC_KEY` with the public key from your PropBot Pro dashboard under **Chatbots -> Settings -> Embed Code**.

---

## 2. Platform-Specific Integration

### A. React & Next.js

In Next.js (App Router or Pages Router), load the script using `next/script`:

```tsx
import Script from 'next/script';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        {children}
        <Script
          src="https://cdn.propbotpro.com/widget.js"
          strategy="lazyOnload"
          data-bot-id={process.env.NEXT_PUBLIC_PROPBOT_KEY}
          data-api-host="https://api.propbotpro.com"
        />
      </body>
    </html>
  );
}
```

For standard React applications:
```tsx
import { useEffect } from 'react';

export function ChatbotEmbed() {
  useEffect(() => {
    const script = document.createElement('script');
    script.src = 'https://cdn.propbotpro.com/widget.js';
    script.async = true;
    script.dataset.botId = 'YOUR_CHATBOT_PUBLIC_KEY';
    script.dataset.apiHost = 'https://api.propbotpro.com';
    document.body.appendChild(script);

    return () => {
      document.body.removeChild(script);
    };
  }, []);

  return null;
}
```

---

### B. WordPress & Elementor

1. In your WordPress admin dashboard, navigate to **Plugins -> Add New**.
2. Install and activate **WPCode (Insert Headers and Footers)** or your preferred header/footer plugin.
3. Go to **Code Snippets -> Header & Footer**.
4. In the **Footer** section, paste the standard `<script>` tag.
5. Click **Save Changes**.

*For Elementor users*: Navigate to **Elementor -> Custom Code -> Add New**, set location to `</body> - End`, paste the code, and set conditions to "Entire Site".

---

### C. Webflow

1. Open your project in the Webflow Designer.
2. Go to **Project Settings -> Custom Code**.
3. Under **Footer Code**, paste the snippet.
4. Click **Save Changes** and **Publish** to your custom domain.

---

## 3. Configuration Attributes

Customize the widget's behavior by passing `data-*` attributes on the script element:

| Attribute | Default | Description |
|---|---|---|
| `data-bot-id` | *(Required)* | The public identifier for your chatbot |
| `data-api-host` | `https://api.propbotpro.com` | API backend URL |
| `data-primary-color` | `#2563eb` | Theme hex color for header and user bubbles |
| `data-position` | `bottom-right` | Position on screen: `bottom-right` or `bottom-left` |
| `data-auto-open` | `false` | Automatically opens the chat window after delay |
| `data-auto-open-delay` | `5000` | Delay in milliseconds before auto-opening |
| `data-default-lang` | `en` | Initial UI language (`en`, `hi`, `mr`, `gu`, `ta`, `te`, `kn`, `bn`, `ml`, `es`) |

---

## 4. Client JavaScript SDK API

When initialized, the widget exposes a global object `window.PropBot`:

```javascript
// Programmatically open or close the chat drawer
window.PropBot.open();
window.PropBot.close();
window.PropBot.toggle();

// Inject dynamic property context into the active session
window.PropBot.setContext({
  projectId: "proj_9921",
  projectName: "Godrej Sky Greens",
  unitConfig: "3 BHK Luxury",
  pageUrl: window.location.href
});

// Listen for conversion events
window.PropBot.on('lead_captured', (lead) => {
  console.log('Lead captured by PropBot:', lead.id, lead.phone);
  // Trigger Google Analytics / Meta Pixel conversion events
  if (window.gtag) {
    gtag('event', 'generate_lead', { value: lead.intentScore });
  }
});
```

---

## 5. Security & Content Security Policy (CSP)

If your website enforces a strict Content Security Policy, whitelist the PropBot origins:

```http
Content-Security-Policy: 
  script-src 'self' https://cdn.propbotpro.com;
  connect-src 'self' https://api.propbotpro.com wss://api.propbotpro.com;
  img-src 'self' data: https://cdn.propbotpro.com https://*.amazonaws.com;
  style-src 'self' 'unsafe-inline';
```

**Domain Whitelisting**: Ensure your hosting domain (e.g. `https://myagency.com`) is added to the chatbot's **Allowed Domains** in the PropBot Pro Dashboard under **Chatbot Settings -> Security**.
