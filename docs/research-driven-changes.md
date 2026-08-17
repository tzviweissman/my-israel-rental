# Research-driven changes — from studying live marketplaces

Source: live inspection of Plum Guide, Kindred, Thumbtack, Airtasker, and the Vesper build (Jason Lee). Full notes in the Obsidian vault: `Video Backlog Synthesis`, `Real Rental Sites Studied`, `Demand Board Patterns Airtasker And Thumbtack`, `Supply Side Pages Kindred And Others`, `Vesper Cabin Site And Its Prompt`.

**Nothing here changes the locked palette.** `#1E5F8C` / `#C9A227` / `#EFE9DC` / `#23201B`, functional-green-only, Playfair + Manrope, Frank Ruhl Libre + Assistant in RTL — all unchanged. These are weight, structure and copy changes.

Every item is independently shippable. Do them in the numbered order; stop and show a screenshot diff after each group.

> **Status (2026-08-16).** Groups A and B are **built**. C, D, E and F are **folded into the build documents** and are not tracked here any more — this file is the reasoning, those files are the plan:
>
> | | where it went | state |
> |---|---|---|
> | **A1** display weight | `design-tokens.css`, `App.css` | built — 600 small / 400 large, Hebrew one notch heavier at each |
> | **A2** gold button | `design-tokens.css` | built — ink on solid gold, chosen by Tzvi after the comparison |
> | **A3** one filled element | — | **audited, no change.** Both competing pairs are preview-specified; Tzvi ruled: leave them. Revisit in E3 |
> | **B1** trust line | `components/stays/TrustLine.jsx`, `/api/properties/stats/trust` | built — real counts, no invented figures |
> | **B2** price as headline | `/why-host`, `/join`, finale | built — and three invented figures deleted from the finale strip |
> | **C1–C6** requests board | `redesign-and-wanted-board-prompt.md` → Phase 3 | folded |
> | **D1–D2** services | same doc → **2c** | folded |
> | **E1–E3** supply side | same doc → new **2e** | folded |
> | **F1–F4** asset prompts | `hero-cinematic-spec.md` | folded |
>
> Two things found while building that were not in this brief, and matter more than most of what was:
>
> 1. **The finale shipped three invented numbers** — "1,200+ active rentals", "19 cities", "450+ verified pros", straight from the preview file's placeholders. Real: 196, Jerusalem only, three providers. Not deployed, but one push away from the front page.
> 2. **The entire finale had no Hebrew at all.** `home.finale.*` had no catalogue entries, so it rendered in English for Hebrew readers. Both fixed in the B2 commit.

---

## Group A — Type and buttons (global, small, highest ratio of effect to effort)

**A1. Lighten display headings.** Three independent premium sources set large display type at weight 300–400 (Plum Guide 64px/400, Kindred 55px/300, Vesper spec "oversized thin headlines"). Ours run 700–800.

- Add a display-weight rule in `brand/design-tokens.css`: headings at or above ~48px render at `font-weight: 400` (Playfair regular). Below that, current weights stand.
- Apply to: cinematic scene headlines, the finale headline, Stays/Services band headlines, `/join`.
- **Check RTL:** Frank Ruhl Libre must have the matching weight available; if 400 looks anaemic in Hebrew, allow a per-direction override rather than forcing parity. Verify with a computed-style check in both directions.

**A2. Test black text on gold accent buttons.** Plum Guide's primary CTA is `#FDBB30` with **black** text. Our `.btn-accent` uses white on frosted gold — a compromise we reached by elimination, not preference.

- Build a variant `.btn-accent--ink` (gold fill, `--ink` text) and screenshot it beside the current one on limestone and on dark.
- Report measured contrast ratios for both. Do not swap the default until Tzvi has seen them side by side.

**A3. One filled element per view.** Every site studied has exactly one filled button per screen region. Audit Stays, Services and the finale for competing filled buttons; demote extras to ghost/outline.

> **Status: audited, nothing demoted. Tzvi ruled: leave them.** Measured every filled
> control on all three pages at 1280 (backend and local Mongo up, so the pages
> had real data; an earlier pass against an empty Stays was measuring an error
> state).
>
> - **Stays — clean.** No filled buttons at all.
> - **Services category tiles (15) and the per-card "Message" buttons (4)** are
>   not violations. The tiles are a coloured navigation grid, and one filled
>   action per card is ordinary card anatomy, not competition within a region.
>   They matched only because the audit selector counts every `<button>`.
> - **Two genuine pairs**, both of which the preview files specify verbatim:
>   the finale's `b-blue` "Search rentals" + `b-gold` "Post a request" sit in
>   one `.ctas` container (`cinematic-preview.html:255`), and Services' gold
>   "Post a job" / blue "List for free" (`services-preview.html:171,175`) —
>   though those two are in separate cards and separate rows, which is a
>   weaker case for calling them competing at all.
>
> Demoting either would override the preview files, which the brief itself puts
> above this document, so it was escalated rather than applied — and the ruling
> was to leave both as the previews draw them. Closed. The finale pair remains
> in **E3**'s scope, where it can be reconsidered with the section's type and
> spacing in view rather than in isolation.

---

## Group B — Trust and proof (currently missing entirely)

**B1. Trust line under the search panel.** Thumbtack: "Trusted by 4.5M+ people • 4.9/5 ★ with over 300k reviews." Plum Guide runs a mid-page trust block with third-party badges.

- Add a single line beneath the Stays search panel using **real numbers pulled from the database** — active listings, cities covered, verified pros. No invented figures, no rounding up.
- If a number isn't available yet, omit that clause rather than estimating.

**B2. State the price position as a headline, not body copy.** Kindred makes "No membership fee" its second-largest text. Ours is stronger — free to search, free to list, no booking fees, no commission — and it currently sits in a paragraph.

- Promote it to a headline on `/why-host`, on the join page's Host and Service Provider cards, and in the finale.

---

## Group C — Requests board (Phase 3 spec amendments)

Based on Airtasker, which is this exact product already shipped.

**C1. Show the response count in the status row.** Currently `Open · expires in N days`; add the number of people who have responded (`Open · 2 responses · expires in 12 days`). We have this data via the chat threads keyed to the request. This is the strongest signal a two-sided board can display — a board that looks alive attracts more supply.

**C2. Make posting a wizard, not a single form.** Airtasker: **Title & date → Location → Details → Budget**, one question per screen, steps listed in a left rail, plain-language prompts with real example placeholders ("In a few words, what do you need done?" / *e.g. Help move my sofa*). Short questions also translate cleanly to Hebrew; long forms don't.

**C3. "I'm flexible" as a first-class date option**, alongside "On date" and "Before date" — offered as pills, not a dropdown. For rentals this is the common case.

**C4. Let people start the form before signing in.** Current spec gates posting behind sign-in. Airtasker collects the task first and asks for an account at submit. Preserve the draft through the sign-in redirect so nothing is lost. (Posting still requires an account — only the *timing* of the wall changes.)

**C5. Map view for Requests**, reusing the Stays List/Map toggle component. Demand plotted geographically is directly useful to an owner working one neighbourhood.

**C6. Card anatomy** (from Airtasker, restyled to our system): title max two lines; type badge; structured chips; status row; poster display name + Verified. Their card is `border-radius: 12px`, `padding: 16px`, **no shadow** — flat and calm. Ours should use our 18px radius and soft shadow, but note that a shadowless card reads as more serious.

---

## Group D — Services page

**D1. Free-text intake as the primary control.** Thumbtack leads with "Describe your project or problem — be as detailed as you'd like!" rather than a category grid. Add a free-text field as the first control on Services, with categories below it as a secondary path: *"Describe what you need — a mover next week, AC repair in Ramat Eshkol."*

**D2. Sticky search bar** on scroll, as Thumbtack does — the search control stays available the whole way down.

---

## Group E — Supply-side pages (`/why-host`, `/join`)

**E1. Rewrite the supply CTA as a question.** Kindred's button reads **"Is my home a fit?"** rather than "List your property." A question invites self-qualification; a command demands commitment from someone who hasn't decided.

- Host: "Would my place work here?" (or Tzvi's preferred phrasing)
- Service provider: "Would my trade get work here?"
- Keep the direct action available for people who've already decided.

**E2. Name the first-timer's anxiety.** Kindred: "Full service support, tailored to **first-time hosts**." Our audience is largely owners who have never listed anywhere and suspect it's complicated. Build a `/why-host` section around that, with the real reassurances: free to list, no booking fees, contract signing built in, EN↔HE auto-translated chat, iCal sync, the Requests board as inbound demand.

**E3. The finale deserves hero-level care** (peak-end rule — people remember the peak and the ending). Review the cinematic finale as if it were a second hero: type scale, spacing, and the two CTAs.

---

## Group F — Asset generation (when regenerating any cinematic media)

From the Vesper prompt, which produced markedly more coherent output than ours:

**F1. Add an ART DIRECTION block with bans** to every asset prompt: exact hex palette, named typefaces, then *"No decorative gradients, no emoji, no stock clichés."* The bans are what stop the drift into AI-slop.

**F2. "Keep the SAME [building/room] across every shot"** — the instruction ours never had, which is why the exterior and interior never read as one property.

**F3. Loop spec for hero video:** "locked exposure so lights never flicker" and a **1.2-second opacity crossfade at the loop point**. Better than our current fix of removing `loop` entirely because clips visibly rewound.

**F4. Self-host before production** — already logged as a Phase 4 blocker; restating because it now has a second reason. Nothing hotlinks a third-party CDN in production, and generating via our own API keys (kie.ai / fal.ai) avoids the content-rights question entirely.

---

## Out of scope / deliberately rejected

- **Mobbin MCP as a design source during Phase 2** — a second source of design truth would conflict with the HOME PAGE RULING. Revisit only for screens with no preview.
- **Scroll hijacking** (Hedwig-style) — breaks keyboard, RTL and our own tooling.
- **Bids, escrow, money-back guarantees** (Airtasker/Thumbtack) — they assume a payment rail we deliberately don't have.
- **Corner-parked navigation** — award-bait, hostile on mobile and in RTL.

## Verification

Per `docs/acceptance-checklist.md`: screenshots at 1280 / 768 / 375, both LTR and RTL, no console errors, Lighthouse a11y ≥ 90. For A1 specifically, verify computed `font-weight` and `font-family` in both directions — the RTL font swap is the known trap.

Every source studied skipped mobile, accessibility, RTL, and second-attempt cost. We don't get to.
