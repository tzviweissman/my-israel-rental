# Recommendations — related businesses, without poaching

**Recreated 26 Aug 2026** after the original was written but never committed and lost in a branch switch — commit this file.

Goal: when someone views an apartment or a business, show them other things worth seeing — without ever taking a customer from the business that brought them.

---

## The governing rule

**Amazon shows substitutes because it is paid either way. We are not.**

A business that prints our QR on its packaging is doing our marketing. If a visitor scans a bakery's code and finds three rival bakeries at the bottom of the page, we have taken that bakery's customer and charged them nothing. In a market where local owners talk to each other, that is the fastest way to lose supply.

> **What we may recommend depends on how the visitor arrived.**

| Arrival | May show |
|---|---|
| **Organic** — home, search, category browse, our own marketing | Substitutes **and** complements |
| **Referred** — the business's own link, QR, or any `?src=qr` / `/p/{slug}` entry | **Complements only.** Never a competitor, for the whole session |

The mechanism exists: `/p/{slug}` appends `?src=qr` (`docs/qr-and-short-links-spec.md` Q2). Extend it to carry the referring business id and persist it for the session.

## R1 — The category relationship table

Hand-authored, not learned. ~15 categories, two lists each:

```
category: bakery / desserts
  competes_with: [bakery, desserts, catering]
  complements:   [florist, photographer, event_rental, cleaning]
```

- **`competes_with`** always includes the category itself plus genuinely overlapping ones. A caterer competes with a dessert business for the same order even though the labels differ — that judgement is why this is hand-authored.
- **`complements`** are things bought for the same occasion or need.
- Editable in the admin (Tools).

Rentals → services a guest needs: cleaning, moving, locksmith, AC repair, handyman, tour guide, grocery delivery.

## R2 — What appears where

**Apartment page** — organic: *"Similar stays in {area}"* + *"Services guests here often need"*. Referred by that owner: services only, **no other apartments**.

**Business page** — organic: *"Other businesses in {area}"* (excluding `competes_with`) + *"Often needed with {category}"*. Referred: complements only.

**One rail per page.** Never two.

## R3 — Owner-nominated partners rank first

A business nominates up to five **partner businesses** it actually works with. Nominated partners rank above algorithmic picks — better than any scoring function, free to compute, and it makes the rail feel like it works *for* owners. One-directional; reciprocity not required or implied.

## R4 — Ranking for everything else

Eligible = not in `competes_with`, active, has at least one photo, in or near the same area. Then: same area (exact > neighbouring > same city) → complement score → verified → real cover photo → rating where enough reviews → recency. **Rotate** among eligible so the same three businesses don't take every impression.

## R5 — Hide the rail rather than show a thin one

**Fewer than three eligible items → render nothing.** One lonely card looks broken and advertises how small the marketplace is. This will be the common case at first; that is fine.

## R6 — How it looks

- One horizontal rail on a **limestone band**, visually separate from the business's own content.
- **Below the primary Message CTA, never above it.**
- 4–6 cards, horizontal scroll on mobile, using the shared card component from `docs/service-card-visibility-spec.md`.
- **Show the business's product photo, not its logo.** A photo of the thing sells; a logo is a trademark.
- Heading names the relationship: *"Often needed with a stay in Ramat Eshkol"*. Never "You may also like".
- Small label: **"More on MyIsraelRental"**.

## R7 — Efficiency

Precompute per (page, locale) nightly into a `recommendations` collection; serve from cache. Invalidate on business create/deactivate/category or area change. Lazy-load below the fold.

## R8 — Measure it

Impressions and clicks per rail, per source page, reported in the admin beside the QR scan counts. Without that it is decoration.

---

## Order

1. **R1** category table + admin editor
2. **R2 + R6** business-page rail, organic case only
3. Referral gating: persist the referring business, enable the referred case
4. **R5** thresholds · **R7** precompute + cache
5. **R2** apartment pages
6. **R3** owner-nominated partners
7. **R8** impression and click counts

## Constraints

- **Never show a `competes_with` business to a referred visitor.** Cover this with a test, not a comment.
- One rail per page, below the primary CTA.
- Real photos only; a business with no photo does not appear in a rail (it still appears everywhere else — `docs/service-card-visibility-spec.md` S5).
- Strings in both `en.js` and `he.js`; verify the referred case by actually following a `/p/{slug}` link.
