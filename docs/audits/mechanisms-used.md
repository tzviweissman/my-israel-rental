# Mechanisms used, Part B

Running index, one line per improvement proposed by the nightly UI audit. Built
2026-09-25 by reading every "## Improvement of the night" section in
`docs/audits/*.md` (2026-09-01 through 2026-09-15; no `-ui-audit.md` report
exists for 09-16 through 09-22 in this checkout). Append one line here each
night Part B produces a real improvement.

2026-09-01 - halo effect - category filter chips at /marketplace (ItemFilters.jsx)
2026-09-02 - peak-end rule - toast duration cutting off error messages (index.js)
2026-09-03 - loss aversion - dashboard business-completeness panel (BusinessCompleteness.jsx)
2026-09-04 - denominator neglect - dashboard Overview Leads/Visitors cards (OverviewTab.jsx)
2026-09-05 - endowed progress - the FAQ editor on the create wizard and edit modal (FaqEditor.jsx)
2026-09-06 - cognitive fluency - property photo gallery letterboxing (ImageGallery.jsx)
2026-09-07 - ambiguity aversion - the contract signing form at /sign/:signToken (SignContract.js)
2026-09-08 - automation bias - paste-to-fill order form (order form WhatsApp paste)
2026-09-09 - implementation intentions - order confirmation done state (OrderPage.jsx)
2026-09-11 - banner blindness - the /home-preview hero (HomePreview.jsx, SequenceHero.jsx)
2026-09-14 - position bias - "Recently added" row on the home page (HomePreview.jsx)
2026-09-15 - social proof (specific and countable) - attribution band on the business page (BusinessPage.jsx)

Note: the task brief's "mechanisms already used as of 22 Sep 2026" list also
names **choice overload**, but no source file for it exists in this checkout
(`docs/audits/` jumps from 2026-09-15-ui-audit.md to 2026-09-23-clarity-report.md,
which is a different report type). Flagged as documentation drift, same as the
missing `docs/goods-marketplace-psychology.md`. Treat choice overload as
already spent per the task brief even though its entry could not be sourced here.

2026-09-25 - picture superiority effect - the size ladder's desktop size list (SizeLadderBlock.jsx)
