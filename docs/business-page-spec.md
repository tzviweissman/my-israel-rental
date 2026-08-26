# Business page — making the storefront worth sending

Written against `frontend/src/pages/BusinessPage.jsx` (read 19 Aug 2026). **Recreated 26 Aug 2026** after the original was written but never committed and lost in a branch switch — commit this file.

This is the page a business owner sends to their own customers. It is their storefront and, for many visitors, their first impression of MyIsraelRental.

---

## B1 — There is no way to contact the business (build this first)

The page has **no Message button anywhere**. A stranger who arrives, likes what they see, and wants to hire them has nothing to click. Everything else here is cosmetic next to that.

- Primary **Message** button in the header, gold accent, always visible.
- Repeat it at the bottom of the page.
- On mobile, a sticky bottom bar.
- Chat-only: no phone, no email, in UI or API response.

## B2 — The link preview is what people actually see first

`PageMeta` is present (~line 71) with title and description but **no image**. When an owner pastes their link into WhatsApp — the most likely way this page is ever shared — the preview shows no picture. That preview *is* the storefront for most recipients.

- Pass an `image`: the business logo, else its first gig cover, else a branded fallback generated from the business name.
- Use their real description, not the `${biz.name} on MyIsraelRental.` fallback.
- Test by pasting a live business URL into WhatsApp and looking at the card.

## B3 — Lead with the business, not with what it lacks

The second line currently reads **"No reviews yet"** (~line 115). The first fact a visitor learns is an absence.

- When `rating_count === 0`, render **nothing**, or a neutral positive: **"New on MyIsraelRental"**.
- Keep the star row exactly as-is once reviews exist.

## B4 — Give the page a hero, and stop the emptiness

A 64px logo in a white bar on a wide `max-w-5xl` column makes a business with one service look abandoned.

- **Cover band**: the business's cover image, else a brand-tinted band derived from its name (reuse `CoverPlaceholder`'s deterministic tint), with the logo overlapping the band's lower edge.
- Name, category chips, area, verified badge, rating and the Message button sit in that header.
- **Narrow the column** to ~900px when the business has fewer than four listings.

## B5 — Add the facts that earn trust

- **About** — the description, given room (currently a small `text-sm` line).
- **Service areas** as chips (currently conditional — promote it).
- **Hours / availability**, **languages spoken**, **years in business**.
- **Response time**, computed from existing chat timestamps, shown only with enough data (≥3 replies).
- **Reviews section** rendered only when reviews exist.

## B6 — Prompt the owner to finish the page

In their dashboard, a completeness list on the business:

> **Your page is 40% complete** — add a logo, a description, your service areas, and one photo.

Each item links to the field. No invented statistics.

## B7 — Close the page properly

- A standard site footer — the page currently just stops.
- A quiet band under the listings: **"Are you a business? Add yours — free."** This page is seen by exactly the audience we want, which makes it the highest-intent placement on the site for that CTA.

## B8 — Copy and layout details

- **"What they offer"** (~line 133) is third-person and set as a small grey caption. Make it a real section heading — **"Services"**. Decide the voice and keep it consistent.
- Service cards here use the shared card surface and placeholder from `docs/service-card-visibility-spec.md`, not a second implementation.

---

## Order

1. **B1** Message button — the page is not functional without it
2. **B2** link preview image — biggest reach per hour of work
3. **B3** no-reviews line · **B8** heading and card reuse
4. **B4** cover band and column width
5. **B5** trust facts
6. **B6** completeness prompt · **B7** footer and "add yours free" band

## Constraints

- Chat-only contact; no phone or email exposed anywhere.
- Real data only — omit a fact rather than estimate it.
- Strings in both `en.js` and `he.js`; verify LTR and RTL at 1280/768/375, for a business with one service and no logo, and one with logo, description, several services and reviews.
