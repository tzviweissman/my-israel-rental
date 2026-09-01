# Service card visibility spec — NOT IN THIS REPO

**This document was never committed.** Four places cite it by name, two of
them as the authority for how a shared component behaves, so a reader
following the reference lands here rather than on a 404. It is a
placeholder, not a spec: nothing below is a ruling.

See `docs/admin-dashboard-spec.md` for the same situation, and
`docs/failure-patterns.md` for the four earlier specs this has already
happened to.

## Who cites it, and what they say it contained

- `docs/categories-expansion-spec.md:274` — *"S5 ruled that photoless
  businesses stay fully listed."* Numbered sections, and S5 decided that
  a business with no product photos is not demoted or hidden.
- `docs/business-catalog-spec.md:88` — *"Reuse the shared card surface and
  `CoverPlaceholder`… The list row is a **variant** of one component, not
  a second component."*
- `docs/business-page-spec.md:65` — *"Service cards here use the shared
  card surface and placeholder… not a second implementation."*
- `docs/categories-expansion-spec.md:10` — listed under Related as *"the
  shared card"*.

So: one card component with variants, a `CoverPlaceholder` derived from
the business name, and photoless businesses stay fully listed. The
reasoning behind each is gone.

## Where the behaviour actually lives now

The code is the only remaining source of truth:
`frontend/src/components/marketplace/ServiceCard.jsx` for the card, and
`frontend/src/components/common/CoverPlaceholder.jsx` for the placeholder
(used through `SafeImage`). If the two disagree, believe the code — but note that
this means the S5 ruling is enforced by nothing except the fact that
nobody has changed it.

## What to do about it

Write the spec and replace this file, or edit the four citing lines to
stop pointing at a document that does not exist.
