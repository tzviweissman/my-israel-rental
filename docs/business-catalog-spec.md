# Business catalog — staying clean with many services

Extends `docs/business-page-spec.md`. That spec fixes the near-empty page; this one fixes the opposite — a business with twenty services that becomes an endless grid.

**Recreated 26 Aug 2026** after the original was written but never committed and lost in a branch switch — commit this file.

Reference studied: a WhatsApp Business catalog for a Jerusalem bakery (~20 items — Shabbos Deluxe ₪879, Shabbos package for 2 ₪309, 6 Sourdough Bagels ₪79, Spelt Sourdough Loaf ₪79, GRAINHAUS Bread Package ₪149).

---

## What WhatsApp gets right — copy this

1. **Owner-defined collections.** The catalog is split into named sections, each showing a few items with a **"See all"** link. Only the owner knows that "Shabbos packages" is a meaningful group.
2. **Compact list rows, not big cards.** ~72px thumbnail, title, one truncated description line, price. Six to eight items per phone screen; a card grid shows two.
3. **One row anatomy, repeated.** Identical rhythm throughout, so nothing feels arbitrary.
4. **Price always same place, same format**, so the eye can ladder down the column.

## What it gets wrong — do not copy

- **Non-product entries mixed into product lists.** The kosher certificate ("Under the strict Hashgacha…") and "Delivery" sit in the same stream as bread. It reads as clutter and buries the certification, which is one of the most persuasive things on the page.
- **Thumbnails too small to sell food** — 72px of sourdough is a brown blob.
- **No search or filter**, so item 19 is only reachable by scrolling.

---

## C1 — Collections, owner-defined

- Name (EN/HE), optional one-line description, ordered services. A service may appear in more than one.
- Public rendering: heading, up to **6 items**, **"See all 14"** when there are more.
- Services in no collection fall into **"More from this business"**. Never orphan an item.
- No collections and more than ~8 services → **auto-group by category** as a labelled fallback, and prompt the owner to organise it properly.

## C2 — Layout adapts to volume

| Services | Layout |
|---|---|
| 1–6 | Card grid (per `business-page-spec.md` B4) |
| 7–15 | Collections as **compact row lists** |
| 16+ | Collections + sticky chip nav + in-page search |

List-row thumbnails at **96px**, not 72. Plus a **Grid / List toggle** remembered per business — the automatic default is a starting point, not a cage.

## C3 — Sticky collection nav

Above ~16 services: a horizontal chip row of collection names, sticky under the header, scroll-jumping to a section and highlighting the current one. Reuse the Services category-chip component family.

## C4 — Search within the business

Above ~16 services: an in-page filter, *"Search this business"*, filtering titles and descriptions live in both languages via the bilingual fields from `docs/bilingual-and-contact-spec.md`. No results → offer the Message button rather than a dead end.

## C5 — Up to three pinned items

The owner pins up to three services under **"Most popular"**. Their judgment about what sells beats any ordering we invent. Cap at three — a page where everything is featured features nothing.

## C6 — Facts get their own band, not the product list

Certification, delivery and terms belong in an **About / Good to know** band, never interleaved with items:

- **Kosher certification** — certifying body, logo if supplied. For a food business in Israel this is often the single most decisive fact on the page.
- Delivery areas and lead time
- Hours, languages, payment notes

Add optional `kosher_certification` (body name, optional logo, optional certificate image) to the business model, shown only for relevant categories.

## C7 — Price display

- One format everywhere: `₪79` — drop trailing `.00`.
- Tiered services show **`from ₪79`**. (This is not a price range and survives any range-removal audit.)
- No price → **"Ask for a quote"**, never a blank.

## C8 — Loading many items

Render the first collection fully; lazy-load images below the fold. **"Show more"** rather than infinite scroll, so the footer stays reachable and the page stays crawlable.

---

## Order

1. **C2** layout thresholds + list-row variant (no schema change needed)
2. **C7** price formatting · **C8** lazy loading
3. **C1** collections — schema, owner editor, public rendering
4. **C6** the facts band, including kosher certification
5. **C3** sticky chip nav · **C4** in-page search
6. **C5** pinned items

## Constraints

- Reuse the shared card surface and `CoverPlaceholder` from `docs/service-card-visibility-spec.md`. The list row is a **variant** of one component, not a second component.
- Strings in both `en.js` and `he.js`; collection names go through the bilingual pipeline.
- Verify LTR and RTL at 1280/768/375 with businesses of **3, 10 and 25 services** — thresholds only prove out at the boundaries.
