# PropBot Pro — Aurora Estate Design System

## 1. Overview & Philosophy
The **Aurora Estate** design system is designed specifically for high-conversion Indian real estate digital platforms. It balances institutional trustworthiness, calm luxury, and high-velocity clarity across buyer and agent touchpoints.

### Core Pillars
- **Trust & Compliance:** RERA certification cues, verified data indicators (Mint), and transparent pricing disclosures.
- **Clarity over Clutter:** Clear visual hierarchy, generous touch targets (>= 44px on mobile), and accessible contrast (WCAG AA compliant).
- **Subtle Modernism:** Midnight Navy canvas with Electric Blue active states, Warm Sand background cards, and Gold highlights for high-intent VIP leads.

---

## 2. Color Palette & Semantics

| Token | Hex | Role | Usage |
|---|---|---|---|
| `navy-900` | `#0B1B3A` | Midnight Navy | Dark canvas headers, cards, primary typography |
| `navy-950` | `#060E1F` | Deepest Midnight | Dark mode app canvas and background body |
| `blue-600` | `#2563EB` | Electric Blue | Primary actions, CTAs, focus indicators, links |
| `mint-500` | `#14B8A6` | Mint Emerald | Success badges, RERA verified pills, confirmed visits |
| `sand-100` | `#F6F1E7` | Warm Sand | Soft backgrounds, neutral light containers |
| `gold-500` | `#F5B942` | Imperial Gold | Hot leads (Score >= 70), high-intent tags, VIP highlights |
| `rose-600` | `#E11D48` | Crimson Rose | SLA warning timers, critical alerts, AI kill switch |

---

## 3. Typography Scale

- **Display Face:** `Plus Jakarta Sans`, `Sora` (Headings, metric numbers, hero statements)
- **UI & Body Face:** `Inter`, System Sans (Forms, tables, chat messages, labels)
- **Code / Token Face:** `SFMono-Regular`, `Consolas`, monospace (API keys, IDs)

| Token | Size | Line Height | Weight | Typical Element |
|---|---|---|---|---|
| `scale.xs` | `0.75rem` (12px) | 1rem (16px) | 500/600 | Badges, timestamps, sub-labels |
| `scale.sm` | `0.875rem` (14px) | 1.25rem (20px) | 400/500 | Table cells, form inputs, nav links |
| `scale.base` | `1.0rem` (16px) | 1.5rem (24px) | 400/500 | Chat body text, descriptions |
| `scale.lg` | `1.25rem` (20px) | 1.75rem (28px) | 600/700 | Card titles, section headers |
| `scale.xl` | `1.75rem` (28px) | 2.25rem (36px) | 700/800 | Page titles, KPI numbers |
| `scale.2xl` | `2.5rem` (40px) | 3rem (48px) | 800 | Hero headlines, value statements |

---

## 4. Radii & Surface Layers

- **Subtle Radius:** `6px` (`rounded-md`) — Buttons, input fields, pill tags.
- **Card Radius:** `12px` (`rounded-xl`) — Standard content cards, data tables, chat message bubbles.
- **Feature Radius:** `20px` (`rounded-2xl`) — Hero containers, modal dialogs, lead drawer panels.
- **Pill Radius:** `9999px` (`rounded-full`) — Status indicators, online dots, avatar rings.

---

## 5. UI Component Hierarchy
1. **Interactive Elements:**
   - Primary: Electric Blue (`bg-blue-600 hover:bg-blue-700 text-white`) with subtle glow.
   - Secondary: Slate/Navy border with transparent or subtle backdrop.
   - Ghost: Transparent with hover background elevation.
2. **Intent Score Gauge:**
   - 0–39: Cold Lead (`bg-slate-500/20 text-slate-400`)
   - 40–69: Warm Lead (`bg-blue-500/20 text-blue-400`)
   - 70–100: Hot Lead (`bg-amber-500/20 text-amber-400` with Imperial Gold highlight)
3. **Empty States:**
   - Illustrated empty states with one primary action button and clear explanatory copy.
4. **Skeletons:**
   - Linear pulse shimmer on 12px rounded placeholders for smooth asynchronous loading.

---

## 6. Accessibility & Motion Rules
- Contrast ratio strictly exceeds **4.5:1** for standard body text and **3.0:1** for large headings (WCAG AA).
- All transitions respect `prefers-reduced-motion`.
- Focus outlines use high-contrast Electric Blue rings (`focus:ring-2 focus:ring-blue-500 focus:outline-none`).
- Standard transitions: 150ms to 250ms with `cubic-bezier(0.16, 1, 0.3, 1)`.
