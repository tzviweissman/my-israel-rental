# Psychology mechanisms used in "Improvement of the night" (Part B)

One line per entry: `date - mechanism - surface`. Built 23 Sep 2026 by reading
every "## Improvement of the night" section in `docs/audits/*.md`, per the
nightly-audit instructions, since this file did not exist yet. Future runs
should read and extend this file rather than re-reading every report.

2026-09-01 - halo effect - goods marketplace category filter panel (`/marketplace`, `ItemFilters.jsx`)
2026-09-02 - peak-end rule - error toast duration on the signup failure path (`index.js` Toaster, `SignupJoin.jsx`/`Auth.js`)
2026-09-03 - loss aversion, restricted to a real loss - dashboard business completeness panel (`BusinessCompleteness.jsx`)
2026-09-04-2 - denominator neglect - dashboard Overview Leads/Visitors cards (`OverviewTab.jsx`)
2026-09-05 - endowed progress effect - FAQ editor (`CreateGig.jsx` description step, `EditListingModal.jsx`)
2026-09-06 - cognitive fluency - property photo gallery (`ImageGallery.jsx`)
2026-09-07 - ambiguity aversion - the external contract signing form (`/sign/:signToken`)
2026-09-08 - automation bias (commission error) - courier/order automation acceptance flow
2026-09-09 - implementation intentions - order confirmation "done" state (`OrderPage.jsx`)
2026-09-11 - banner blindness - the `/home-preview` hero (`HomePreview.jsx`, `SequenceHero.jsx`)
2026-09-14 - position bias (primacy in a list) - "Recently added" row on the home page (`HomePreview.jsx`, `home-v2.css`)
2026-09-15 - social proof, specific-and-countable form - business page attribution band (`BusinessPage.jsx`)

Note: the 23 Sep 2026 task brief that generated this file also listed
"choice overload" as already used as of 22 Sep 2026. No audit report
between 09-15 and 09-22 exists in this repo's git history (checked with
`git log --all -- docs/audits/*.md`), so its source file, date and surface
could not be verified or recorded here. Treated as spent and avoided
regardless, per the brief.

2026-09-23 - goal-gradient effect - the walk's progress indicator (`CoachMark.jsx:216-219`, `TourProvider.jsx:294`)
