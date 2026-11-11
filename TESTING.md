# Landing page test checklist

Playwright is not installed in this repo, so this is the manual checklist. Run `pnpm --filter @propbot/web dev`
and open the site. Unit tests: `pnpm --filter @propbot/web test` (includes `roi.test.ts`).

Result column: P = passed on 2026-11-10, N = not run yet.

| # | Check | Result |
|---|---|---|
| 1 | Page loads with no console errors (site code; ignore browser-extension messages) | P |
| 2 | 375 px: headline, both CTAs and part of the tower in the first screen; widget is a small bubble | P |
| 3 | 375 px: no sideways scroll; journey is a plain list; comparison is a table | P (DOM) |
| 4 | 768 and 1024 px: scroll top to bottom, no overlap or clipped text | N |
| 5 | 1440+ px: hero, journey pin (5 steps, Skip works), dashboard, compare, scenes, ROI, pricing, FAQ, demo | P (Skip not clicked) |
| 6 | Wheel over the hero tower scrolls the page; drag turns the tower | P (wheel), N (drag) |
| 7 | Header menus open on click, close on Escape and outside click | P (Escape), N (outside, touch) |
| 8 | Theme toggle: light and dark both readable | P |
| 9 | Dashboard Pipeline tab: drag a card to another column; arrow keys move a focused card | P |
| 10 | Before/after: drag the divider; keyboard arrows on the divider | P (drag), N (keys) |
| 11 | Tap a property scene: SOLD stamp, sign flips, confetti icons (no emoji) | P |
| 12 | ROI sliders: numbers roll, bars grow and shrink, maths unchanged (`roi.test.ts`) | P (test), N (sliders by hand) |
| 13 | Pricing toggle: 2,999 / 7,999 / 19,999 monthly; 2,499 / 6,666 / 16,666 yearly | P |
| 14 | FAQ: one open at a time, aria-expanded correct, opens smoothly | P |
| 15 | Demo form empty submit: four inline errors, focus on first field | P |
| 16 | Demo form valid submit, invalid email, double submit | N |
| 17 | Sold sign: flips to brass SOLD and focuses the name field | P |
| 18 | Keyboard-only walk of the whole page, focus order and visible rings | N |
| 19 | prefers-reduced-motion: no pin, no smooth scroll, no cursor ring, text visible | N |
| 20 | Slow CPU / network emulation; memory after 2 minutes of scrolling | N |
| 21 | Production build + preview; Lighthouse desktop | P: 95 / 100 / 100 / 100, CLS 0.071 (target 0.05 missed) |
