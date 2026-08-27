# Onboarding — teaching listers and business owners what the site can do

Goal: a lister or business owner should end their first week knowing what MyIsraelRental offers them, and having actually used the parts that matter.

Related: `docs/perks-and-features-spec.md` (Part 1, the feature library), `docs/business-page-spec.md` (B6, completeness), `docs/dashboard-ux-spec.md` (D7, empty states).

---

## The principle: teach in service of a first success

**A tour is not the goal. A complete page and a first message are.**

Guided tours that fire on first login are the obvious solution and the wrong one — people click "skip" reflexively and learn nothing, and the effort goes into a thing nobody watches. Every item below is judged by whether it moves the owner toward a real outcome, not by whether they saw an explanation.

So: no forced tour, no modal on first login, nothing that blocks the screen.

---

## T1 — The setup checklist (the backbone; build this first)

A short list in the dashboard, role-aware, each item a real outcome with a direct link to the field:

**Business owner**
- Add a photo or logo
- Write a line about what you do
- Add your first service and its price
- Set your service areas
- Set your hours

**Property lister**
- Add photos to your listing
- Set your availability
- Choose how people reach you
- Share your listing link

Rules:

- **Endowed progress.** Name, category and area come from signup and count toward the total, so nobody starts at zero — people finish what looks nearly finished.
- **Never a percentage without the next action beside it.**
- Ticks itself off from real data, never from "user saw this screen".
- Collapses to a single line once complete, and disappears entirely after ~60 days.
- **No invented statistics.** Not "listings with photos get 3× more views" unless measured. *"Visitors decide in about a second — give them something to look at"* is honest and does the same work.

## T2 — Contextual tips, one per feature, where the feature lives

A small dismissible tip beside a feature the first time an owner is in a position to use it. Not a tour — a caption.

Examples: on the share panel, *"Print this code on a flyer or your packaging — you'll see how many people scan it."* On the chat, *"Write in English; Hebrew speakers read it in Hebrew."* On availability, *"Block time here for holidays or jobs booked elsewhere."*

- One tip per surface, shown once, dismissed forever.
- **Never more than one visible at a time** anywhere on screen.
- Stored per user per tip id.

## T3 — The feature library

`/what-you-can-do` from `docs/perks-and-features-spec.md` Part 1 — role-filtered cards linking to `/features/{slug}` pages. This is the destination for "what else can this site do?", and the place a checklist item or tip can link to for the fuller explanation.

## T4 — An optional walkthrough, never forced

For owners who want to be shown: a **"Show me around"** entry point in the dashboard and in the help menu — a link, not a popup. Never auto-fires.

**Build this last, and only if T1 and T2 leave a real gap.**

### Mechanics (merged from a second proposal, 26 Aug 2026)

A separately-sourced tour prompt got four things right that this spec originally underspecified. Adopt them:

1. **`data-tour="step-name"` attributes on target elements.** Steps reference the attribute, never a CSS path or DOM position, so steps can be added, removed or reordered without touching the components they point at — and a refactor that moves an element doesn't silently break the tour.
2. **Persist completion server-side**, on the user record, via the API. `localStorage` alone re-fires the tour on every new device and browser, which is worse than not having one.
3. **A "Restart tour" entry point** in the help menu / account settings, permanently available.
4. **Track drop-off per step**, not just started/completed/skipped. Knowing *which* step loses people is the only version of this data that leads to a fix.

Also from that proposal, and correct: skippable at every step; steps reposition sensibly on small screens.

### Where that proposal was wrong for us, and why

Recorded so the same suggestions aren't re-adopted later:

- **It assumed Next.js.** This app is Create React App + craco.
- **It said to style from the Tailwind config.** The source of truth is `brand/design-tokens.css`.
- **It named `react-joyride` / `driver.js`.** Both position tooltips with physical left/right offsets and have weak RTL support. Half this audience reads Hebrew, so a tooltip library that mispositions under `dir="rtl"` would ship a tutorial that is broken for half the people it is meant to teach. **Write the coach-mark component in-house** — 5–7 anchored tooltips is a small component, and it is the only way to guarantee RTL.
- **It auto-fired on first login.** Rejected — see the principle at the top of this file.
- **Its example steps were generic SaaS furniture** ("dashboard nav, analytics panel, settings"). Ours should teach what is actually distinctive: bilingual chat, the QR and short link, contract signing, availability and iCal, the Requests board.

### If built

Coach-marks anchored to `data-tour` targets, 5–7 steps maximum, exit always visible, progress remembered so it can be resumed, and every string in `en.js` and `he.js`. **Verify tooltip placement under `dir="rtl"` before anything else** — that is the failure mode.

## T5 — A three-message follow-up sequence

The people who most need this have already closed the tab. Email (and WhatsApp where we have consent), using the existing Postmark setup:

- **Day 1** — "Your page is live. Here's the link, and here's the one thing that would improve it most." One action.
- **Day 3** — the single most valuable unused feature for their role, chosen from real data about what they haven't set up.
- **Day 7** — what happened: views, scans, messages. **Real numbers, or the email doesn't send.**

Rules: each message has exactly one action; a message is skipped if its action is already done; one-click unsubscribe; bilingual, matching the user's locale.

## T6 — Measure whether it works

Record checklist completion per item, tip dismissals, feature-page visits, and email opens/clicks. The question to answer at review: **do owners who complete the checklist get more messages than owners who don't?** If not, the checklist is teaching the wrong things and should change.

---

## Order

1. **T1** setup checklist — highest value, no new infrastructure
2. **T2** contextual tips
3. **T3** feature library (already specced in perks-and-features)
4. **T5** the email sequence
5. **T6** measurement
6. **T4** optional walkthrough — only if a gap remains

## Constraints

- Nothing blocks the screen. No modal on first login.
- Role-aware throughout: a property lister never sees business-only guidance, and vice versa.
- Strings in both `en.js` and `he.js`. **Verify tips and coach-marks in RTL** — anchored positioning is exactly what breaks.
- Real data only: checklist state from records, email numbers from queries, no estimates.
- Verify at 1280 / 768 / 375, both directions, per `docs/acceptance-checklist.md`.
