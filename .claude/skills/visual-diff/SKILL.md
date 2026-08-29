---
name: visual-diff
description: Verify UI work by looking at it, not by reasoning about the code. Use before claiming any frontend phase or page complete in this repo — captures the app and the matching preview file at the same widths (and the same scroll positions, for scroll-driven pages), in both LTR and RTL, and compares the pairs. Encodes the capture problems already solved here — video frames rendering black, renderer crashes, sticky pins defeating full-page capture, and per-document scroll geometry.
---

# visual-diff

Every real defect on this project's cinematic page — the collapsed hero, the notification cards jammed under the nav, the missing pill strip, the invisible finale button, the wrong clip used three times — was found by **looking at the page**. None was found by reading the code. Boris Cherny's rule applies: give the agent a tool to see its own output, and quality goes up 2–3×.

Extraction of computed styles is a good floor and a bad ceiling: it catches wrong values, and misses layout, wrapping, stacking, overflow and anything that only exists once rendered. Do both.

---

## 1. Static pages

`scripts/screenshot.mjs` (headless Playwright) at **1280, 768, 375**.

- **768 is mandatory.** It is where two-column layouts collapse and the width nobody checks.
- Capture **both directions**: run each width again with `dir="rtl"` set on `<html>`.
- Capture the matching preview file too — they're static HTML, so `file://…/stays-preview.html` works — at the same widths, and compare the pairs. Value-matching alone has repeatedly passed while the rendered page was wrong.

## 2. Scroll-driven pages (the cinematic home)

Full-page capture is **meaningless** here: the scenes are `position: sticky` pins whose opacity is driven by scroll progress, so `fullPage` returns one blended smear, and at `scrollTop: 0` the first caption is correctly invisible.

Capture **viewport** screenshots at fixed progress points instead:

1. For each scene, compute `scrollTop` for progress 0 / .25 / .5 / .75 / 1 from **that document's own geometry** — the app's scene may be 340vh where the preview's is 320vh, so an absolute pixel offset is a different moment in each. Always derive from progress, never hard-code pixels.
2. `window.scrollTo(0, y)`, then wait **two `requestAnimationFrame`s** so the scroll handler has applied before the shot.
3. Run the identical sweep against the preview file and diff the pairs. Both are deterministic by design (that's why the interior reveal is a still image), so the same progress must produce the same frame.

Also run one sweep with `page.emulateMedia({ reducedMotion: 'reduce' })` — that verifies the posters-instead-of-video path, which nothing else tests.

## 3. Capture problems already solved here

- **`networkidle` never fires** with several streaming MP4s — it hangs for the full timeout. Use `domcontentloaded` plus an explicit settle.
- **Decoding several videos crashes the renderer** ("Target crashed"). Setting `currentTime` and pausing does not help; the decoders die first.
- **Fix both by blocking the video entirely**: `page.route('**/*.mp4', r => r.abort())` at setup. The videos never fetch, the decoders never start, and a `<video>` with no frames paints its `poster` attribute natively — which is what you want in a still anyway. Detaching `<source>` and calling `load()` does **not** preserve the poster.
- **Run the preview sweep as its own invocation.** When both halves shared a timeout, the app half consumed it and the preview half never ran — so no pair was ever compared.
- Browser-extension screenshots return the video area **black** and freeze the tab during playback; they are fine for normal pages. Desktop screenshots capture video correctly.

## 4. Reading the result

- Report a per-scene or per-width number, not one aggregate. **The signal is one scene several points above its neighbours**, not the absolute value.
- Know the floor before calling anything a regression: `docs/visual-diff-baseline.md` records what the residual difference is made of per page (chat/accessibility widgets the previews don't have). Do not remove real UI to make the number look better.
- Some differences are correct: at progress .5 in scene 0 both captions are near-invisible because one is fading out and the next hasn't started. Check the preview before "fixing" it.

## 5. What this cannot judge

Easing, the feel of a zoom, whether scrolling is smooth, whether a scene lands emotionally. Those need a human scrolling the real page — fast and slow, up and down. Automate the diff; augment the judgment. When a page is scroll-driven or animated, say plainly that a human pass is still required.

## 6. Definition of done

Paired screenshots posted at 1280/768/375, both directions, app vs preview, plus the reduced-motion sweep for animated pages. No console errors. Lighthouse a11y ≥ 90. Then, and only then, report the phase complete — per `docs/acceptance-checklist.md`.
