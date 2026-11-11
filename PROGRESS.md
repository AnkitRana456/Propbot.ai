# PropBot Pro landing redesign: progress

Rules agreed with the owner for this run:
- **No git commits.** Everything stays uncommitted until the owner says all phases are finished.
- **TypeScript**, to match the codebase (the brief said plain JS; the repo is TS).
- Dev server is `http://localhost:5173` (launch config `web`), not 5174.
- Backend, routes, form submit logic and the meaning of the copy are not touched.

## Phase 0: audit (done)

Checked at 375, 768 and 1440 px in the running app.

### What the brief assumed that is not true here
- The hero tower is **plain CSS 3D, not a canvas / three.js**. There is no WebGL anywhere on the page.
- There is **no English/Hindi switch** on the public site. "English and Hindi" is only a claim in the copy.
- **Problem 5 (wheel blocked over the tower) does not reproduce.** A wheel event over the tower scrolls the
  page 500 px; nothing calls `preventDefault`, and the scene has `touch-action: pan-y`. Kept as a regression check.

### Findings, by severity
High
1. Mobile 375: the ElevenLabs voice widget ("Need help? Start a call") is a wide expanded card that covers the
   tower hint, the tower top and part of the hero copy. (Brief problem 3: confirmed.)
2. Mobile 375: the tower starts at y=723 of 812, so only a sliver is in the first screen. (Confirmed.)
3. Emoji used as icons: key, pin, star and shopping bags float over the four property scenes, and every click
   burst throws emoji (dancers, party poppers). (Brief problem 4: confirmed, and wider than described.)
4. Content wrapped in `Reveal` stays invisible until an IntersectionObserver fires. In a background tab it never
   fires, so whole sections are blank after a jump-scroll.

Medium
5. One look everywhere: dark teal, the same `glass` card, the same 3-column icon grid for use cases and
   features. Pricing, FAQ and "Built for" are stock layouts. (Brief problem 1: confirmed.)
6. No through-line: the tower metaphor ends after the hero. (Brief problem 2: confirmed.)
7. Tower window colours are blue / purple / teal / green status colours from the CRM, so "booked" does not read
   as the warm, special moment.
8. 37 links and buttons are under 32 px tall at 375 px (footer links, tower controls, feature links).
9. Comparison table needs sideways scrolling at 375 px (min-width 640 px).

Low
10. Headings use the UI sans (Inter); no display face, no mono labels in section furniture.
11. The dashboard "tour" is four static SVG pictures; nothing in it can be touched.
12. `PlatformPage` and all its 3D are in the main bundle (not code-split).

## Phase log
(updated after every phase)

### Phase 1: bug fixes (done)
- Voice widget set to `variant="tiny"`: a small bubble bottom-right, no longer over hero copy or the tower hint.
- Mobile hero tightened: tower now starts at y=532 of 812 (was 723). Headline and both CTAs are in the first screen.
- Emoji removed: own SVG glyph set (`marketing/icons.tsx`) for scene markers and for click confetti (teal and brass).
- Wheel over the tower: checked again, page scrolls. No change needed.

### Owner change request (done)
- **Fonts stay as they were (Inter).** The serif display face was removed again. Only brand-new small labels
  (FIG. numbers, F-01, Q.01, Step 01) use the existing mono font. Saved as a standing rule.

### Phase 2: identity (done, except light-theme review)
- `marketing/config.ts`: colours per theme, stage colours, speeds, scroll lengths, quality level, floors list.
- `marketing/motion.ts`: easings, durations, distances.
- Tower windows: grey > dim teal > teal > **brass for booked**. Brass is used only for booked / sold / hot lead.
- Three surfaces: `s-plain`, `s-crop` (crop marks), `s-product` (elevated). Film grain, dimension ticks, FIG labels.
- Redesigned (layout only, copy unchanged): proof band, use cases (floors list with sticky headline), features
  (one spec sheet), built-for (directory), pricing (one price sheet, lifted popular plan, rolling prices),
  FAQ (two columns, smooth accordion with correct aria-expanded).

### Phase 3: scroll and 3D (built, NOT yet visually verified)
- Lenis + GSAP ScrollTrigger on one clock (`marketing/scroll.ts`); off with reduced motion.
- Progress tower on the right edge (thin bar on mobile); click a floor to go to the section.
- Hero: cursor parallax, tower sinks as hero scrolls away, headline slides back into its mask. No pinning.
- New pinned "One enquiry, one journey" section (`Journey.tsx`), 3 screens, with Skip; plain list on mobile.
- Dashboard: scroll tilt; Pipeline tab is a real draggable board (`PipelineBoard.tsx`, framer-motion, lazy chunk).
- Before/after: draggable divider on desktop; plain table on phones and for screen readers.
- Property scenes: brass SOLD stamp. ROI: rolling numbers and three bar "buildings". Sold sign focuses the form.
- Cursor ring with labels (system cursor kept visible on purpose). Lite tower on phones / low-power devices.

Checked so far: typecheck clean, 102 web tests pass, build passes, no console errors on load,
journey pins and steps 01 to 05 advance (measured in the DOM).
Main bundle 216 KB gzip; PipelineBoard chunk 50 KB gzip.

**Blocker:** the Browser pane is hidden, so screenshots of scrolled content come back blank. Visual checks of
phase 3 at 375 / 1440, light theme, and everything in phases 4 to 6 are still to do.

Simplified / skipped so far:
- 3i city fly-through: skipped (optional).
- Shared-element tab transitions: a fade between tabs instead.
- Font preload / serif display face: dropped with the font request.

### Visual check in Chrome at 1498 px, light theme (done)
- Found and fixed: first hero headline line was hidden (GSAP captured the intro animation mid-flight).
- Verified by eye: hero, pinned journey (steps, chat bubbles, pipeline drop, counts), dashboard, proof band,
  before/after divider, property scenes, use cases, ROI, pricing, closing form. No console errors.
- Mobile 375 (Browser pane, first screen + DOM): no sideways overflow, tower at y=534, journey is a plain list
  (not pinned), comparison is the plain table, progress tower hidden, lite tower (5 boxes).
- ROI bars made taller (cube-root scale).

### Phase 5: Lighthouse on the production build, desktop preset
- Performance 95, Accessibility 100 (before the last label fix: one item), Best Practices 100, SEO 100.
- Fixed for this: 24 px targets on the progress tower, contrast on the closing band, sold-sign label.
- **CLS is 0.071, target was 0.05. Not fixed.** The shift is on the hero headline; likely the late font swap
  (fonts load with the media=print trick). Fonts were not to be touched, so this is left for a decision.
- Bundles: main 216 KB gzip, CSS 33 KB gzip, PipelineBoard (framer-motion) 50 KB gzip, lazy.

### Still not done
- Phase 4: header dropdown keyboard/touch pass, form states review (logic untouched), skeleton review.
- Phase 6: 768 / 1024 widths, dark theme pass of the new sections, full interaction pass (pipeline drag,
  divider drag, sold stamp, FAQ, form valid/invalid/double submit), keyboard-only walk, reduced-motion and
  slow-CPU emulation, memory after 2 minutes of scrolling, Playwright smoke tests or TESTING.md.
- Mobile below the first screen was checked by DOM only, not by eye.

### Interaction pass in Chrome, dark theme (done)
Passed: theme toggle, Product menu + Escape, FAQ accordion, pricing toggle, pipeline drag and arrow keys,
divider drag, scene tap with SOLD stamp, empty form submit (4 inline errors, focus on first field), sold sign
focuses the form. Fixed: sold sign flipped over the checklist; phone and floating cards covered the pipeline board.
Checklist with what is still not run: TESTING.md.
