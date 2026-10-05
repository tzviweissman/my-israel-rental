# Goods marketplace: buyer and seller psychology

Status: spec, not built. Written 2026-08-30.

Scope: the person-to-person goods marketplace for English-speaking residents, olim
and visitors in Israel. Fixed price with "or best offer". No auctions. **The site
never handles money**, takes no commission, and offers no escrow or buyer
protection. Sellers may attach their own payment link from the existing allowlist
(`backend/utils/payment_links.py`). Contact is on-site chat only.

This document specifies psychology and the UI that follows from it. It does not
respec the data model. Read these first, because most of the plumbing exists:

- `docs/categories-expansion-spec.md` §N4 and §N6: the ruling that items ship as
  `request_type: "item"` on the Requests board, not as a third product.
- `backend/routes/marketplace/requests.py` covers lifecycle, TTL, sold state, rate
  limits, report/auto-hide, privacy model.
- `frontend/src/pages/PostRequest.jsx` is the five-step wizard items already use.
- `docs/marketplace-benchmark-spec.md`, L11: the category filter the UI never sets.

## How to read the evidence in this document

Every empirical claim is either linked to a primary source I read, or explicitly
flagged. Three of the claims in the brief that produced this document did **not**
survive checking, and are marked. Section 10 lists everything I could not verify
in one place so it does not get lost.

---

## 0. The one-paragraph thesis

The scarce act is **listing**, not buying. A goods board dies from an empty
supply side and from stale supply, never from a shortage of people who want a
cheap fridge. Every design decision below is ranked by whether it gets one more
real item posted, keeps that item honestly priced, and gets the two people to
actually meet. The site's structural advantage is not a rating system it does not
have. It is that the same human being appears here as a landlord, a cleaner, a
Requests-board poster and a seller, and that recurrence is worth more than stars
(section 5).

---

## 1. The seller's real barrier

### 1.1 What actually stops someone listing a sofa

Four separate blockers, which need four different UI answers. They are usually
lumped together as "friction", which is why generic "make the form shorter"
advice under-delivers.

**Blocker A: the valuation problem (endowment effect).**
[Kahneman, Knetsch and Thaler (1990)](https://www.journals.uchicago.edu/doi/abs/10.1086/261737)
randomly gave half of a group a mug worth about $6. Median selling price was
$5.25; median buying price was $2.25 to $2.75. A willingness-to-accept over
willingness-to-pay ratio of roughly 2:1, and far fewer trades than the Coase
theorem predicts, on objects assigned minutes earlier by coin flip. A sofa that
someone chose, paid for, carried up three flights and lived on for four years is
the mug problem with the volume turned up.

The consequence for a board is not "sellers are greedy". It is that a seller who
prices from their own reference point produces a listing that will never sell, sits
for 30 days, expires, and teaches the seller that the site does not work. Stale
supply is the endowment effect made visible.

**Blocker B: the decision is not "list or not", it is "keep or lose".**
Framing the act as disposal invokes loss. The decluttering literature (weaker
evidence than the lab work above, see §10) is consistent that redistribution and
donation framings outperform discard framings for exactly this reason, because
they reframe the item as continuing to have a use rather than being lost. The
implication is a copy decision, not a feature.

**Blocker C: effort justification runs the wrong way.**
The IKEA-effect intuition, that effort makes people value a thing more, is a
liability here rather than an asset. Every additional field the seller fills in
raises their sense of what the listing is worth and therefore their reservation
price, while also raising the chance they abandon. A twelve-field form does not
produce a better listing; it produces a higher ask and a lower completion rate.

**Blocker D: "I'll do it later".**
Listing has no deadline. It is a small, dull, unbounded task with a diffuse
payoff, which is the exact profile of a task that never happens. The one moment
when it *does* have a deadline is when the seller is moving out, and the site
already knows when that is.

### 1.2 UI decisions

**D1. Photo-first creation. The first screen of the item flow is a camera/upload
target and nothing else.**
Reuse `frontend/src/utils/fastUpload.js` and `useFormDraft.js` as they are. The
seller uploads one to eight photos and nothing else is asked on that screen. This
directly counters Blocker C: minimum committed effort before the draft exists,
and once a draft with photos exists, the Zeigarnik pull is on the *site's* side.

**D2. AI-drafted title, description and category from the photos plus one line of
free text.**
`backend/routes/bulk_upload.py` already has the extraction pattern
(`_EXTRACT_SYSTEM_PROMPT`) and `backend/utils/llm.py` the client. The seller types
"ikea sofa katamon" and gets back a filled title, description, category,
subcategory and a condition guess, all editable. Every field is pre-filled and
visibly editable, never locked.

Why editable matters and is not just politeness:
[Dietvorst, Simmons and Massey (2018)](https://pubsonline.informs.org/doi/10.1287/mnsc.2016.2643)
found people will use an imperfect algorithm if they can even slightly modify its
output, where they will abandon the same algorithm outright if they cannot. This
is the single most load-bearing finding in this document and it recurs in §2.

**D3. Kill the wizard for items. One scrolling page, four blocks, autosave.**
`PostRequest.jsx` is a five-step wizard, which is correct for a rental request
where the fields are genuinely conditional. For an item it adds five commit points
where there should be one. Blocks: Photos, What is it, Price, Where and when. All
visible, all scrollable, draft saved on every blur via the existing
`useFormDraft` hook (localStorage, 7-day max age, already restores silently).

**D4. Progress copy that names the remaining effort in seconds, not steps.**
Under the sticky Post button: *"Almost there. About 20 seconds left."* Not "Step
4 of 5". Naming a small absolute cost is the counter to Blocker D. Real number
only: measure it, do not invent it.

**D5. The "Keep it in the neighbourhood" frame, replacing every disposal word.**
Copy rules, both languages:
- Never: "get rid of", "declutter", "offload", "dump", "clear out".
- Always: "pass it on", "find it a new home", "someone three streets away needs
  this".
- The success state after posting reads *"Your sofa is now visible to people
  looking in Katamon."* Not *"Listing published."* The first is continuation, the
  second is disposal.

**D6. A "Free" price option, given equal visual weight to a price.**
For a meaningful slice of items the endowment effect is not the binding
constraint, the pricing decision is. Removing the decision removes the block.
Free items also seed the board's density in week one, which is the only week that
matters. UI: the price block offers three buttons of equal size, `₪ ___`,
`Free`, `Swap / offers only`. Free items get the standard card with a `Free` chip
in `--brand-primary`, not a special colour and not a badge that implies urgency.

**D7. The move-out trigger. This is the highest-value item in the document.**
The site holds lease end dates. A renter whose lease ends in five weeks is the
single most listable human in Israel, and the site knows their name, their area
and their date. Build:
- An in-app card on the dashboard at lease-end minus 35 days: *"Moving on 15
  September? Things you are not taking can find a new home nearby. Post one in
  under a minute."* One button, straight into the photo-first flow.
- One email at minus 21 days, reusing the existing Requests reminder mailer, with
  the same JWT opt-out token pattern already in `requests.py`.
- Never more than two touches per move. This is a real deadline the user already
  has; it does not need dramatising.

**D8. Bulk mode: "Post 5 things in 5 minutes".**
Explicit entry point on the dashboard. Upload up to N photo sets in one go, the
LLM drafts each, the seller reviews a compact list and posts them all. This
converts the highest-intent moment (a person standing in a half-packed flat) into
five listings instead of one. `BulkPhotosModal.jsx` and the bulk-extract endpoint
are most of the machinery.

**D9. Never show a seller how many items they have not posted.**
No "you have 3 drafts" nag counters, no completion percentage on their profile.
That is a shame mechanic and it produces account abandonment, not listings. A
single dashboard card offering to finish the most recent draft is the limit.

---

## 2. Pricing psychology where nothing is bought on impulse

### 2.1 The problem with a price hint

The brief states that Vinted sellers widely distrust its price hint because it
appears to surface the lowest comparable. **I could not verify this as research.**
What I found is consistent anecdote at the level of seller forums and guides: a
seller reporting that Vinted suggested £5 to £8 on items they listed at £33 and
sold for £20 to £30 ([Mumsnet thread](https://www.mumsnet.com/talk/style_and_beauty/4983136-can-anyone-share-their-vinted-strategies)),
and third-party guides advising sellers to research comparables rather than use
the suggestion ([VintyLook](https://vintylook.com/en/articles/set-the-right-price-on-vinted-stop-undervaluing)).
Treat the specific Vinted claim as an unsourced industry belief. The *design
conclusion* still holds, because it rests on evidence that does check out:

[Dietvorst, Simmons and Massey (2015)](https://marketing.wharton.upenn.edu/wp-content/uploads/2016/10/Dietvorst-Simmons-Massey-2014.pdf)
showed people lose confidence in an algorithmic forecaster faster than in a human
one after seeing the same error, and then avoid it even when it is measurably
better. A price suggestion is a forecast. A seller who sees one suggestion that
feels low concludes the tool is against them and stops looking at it, permanently.
The [2018 follow-up](https://pubsonline.informs.org/doi/10.1287/mnsc.2016.2643)
gives the fix: let them adjust it.

### 2.2 What an honest price suggestion looks like

**P1. Show a range built from real comparables, never a single number.**
A point estimate is a claim. A range is a description. UI: a horizontal band with
the seller's current price as a draggable marker on it.

```
Similar sofas on this site sold for

  ₪250 ────────●──────── ₪600
        You: ₪400

Based on 7 sofas sold in Jerusalem in the last 90 days.
```

**P2. Name the sample, always, including when it is embarrassing.**
"Based on 7 sofas sold in Jerusalem in the last 90 days." If it is 2 items,
say 2. If it is 0, show no suggestion at all and say *"Not enough sold sofas yet
to suggest a range. You are early."* An honest small-n disclosure is the entire
trust mechanism; hiding n is how a suggestion becomes an instruction and then
becomes resented.

**P3. Suggest from *sold* prices, never from *asking* prices.**
Asking prices on a board are inflated by the endowment effect (§1.1) and by
padding (§3). A range built from asks is a range built from the sellers who were
wrong. `item_status: sold` already exists via `POST /requests/{id}/sold`, which is
what makes this possible. Until there is sold data, P2 applies: show nothing.

**P4. Never pre-fill the price field.**
Pre-filling makes the site the first-mover anchor and makes any subsequent
disappointment the site's fault. The field starts empty; the range appears
underneath as soon as a category and condition are set. The seller anchors
themselves. This is the difference between a tool and a verdict.

**P5. Show the consequence, not the judgement.**
When the seller's number sits well above the band, do not say "this is too high".
Say: *"Items priced above ₪600 in this category took about 6 weeks to sell.
Items in the range sold in about 9 days."* Real medians or nothing (see §7). If
those numbers do not exist yet, this element does not ship yet.

**P6. Reference-price copy for buyers, not sellers.**
On the item page for used goods, one line under the price where the data supports
it: *"New, this model is around ₪1,400."* Sourced only where the site can
actually establish it (a matching product in a `gig_type: "store"` listing, or a
seller-entered original price the seller opted to show). No scraped or invented
retail prices. The buyer needs a reference point to feel the discount; the honest
version of that is a real one or none.

**P7. Charm pricing is not worth building for.**
₪399 versus ₪400 is a rounding artefact in a market where the next move is a
negotiation. Do not build price-ending nudges. Do round the *suggestion band* to
readable numbers (₪250 to ₪600, not ₪247 to ₪612) because a precise band implies
a precision the sample does not have.

---

## 3. "Or best offer" negotiation psychology

### 3.1 What the field data actually says

[Backus, Blake, Larsen and Tadelis (2020, QJE)](https://academic.oup.com/qje/article-abstract/135/3/1319/5721265)
analysed over 88 million eBay Best Offer listings with back-and-forth bargaining
in over 25 million of them. I read the [full working text](https://faculty.haas.berkeley.edu/stadelis/qjaa003.pdf).
The numbers that matter here:

| Finding | Value |
| --- | --- |
| Listings that never receive any offer | ~80% |
| Sale price as share of list price, given bargaining occurred | 73% |
| Buyer's first offer as share of list price (by category) | 0.575 to 0.660 |
| Offers per bargaining thread (mean) | 1.66 |
| Threads reaching agreement | 45.4% |
| Buyer's first offer accepted immediately by seller | 32% |
| Seller declines the first offer outright | 40% |
| After a seller decline, the buyer walks away | 62% |
| Listings that are used goods | 54.8% |

Two things follow directly. First, the brief's claim checks out arithmetically:
buyers open around 60% of list and the deal lands at 73%, where the midpoint would
be 80%. **The final price sits closer to the buyer's opening than to the middle.**
A seller who lists at their true floor gets ground below it, learns the lesson,
and pads next time. That padding is rational, and a UI that fights it will lose.

Second, and less obvious: **the dominant failure of a negotiation feature is not
a bad price, it is a dead thread.** 80% of listings get no offer at all, 40% of
first offers are killed by a flat decline, and 62% of the buyers who receive that
decline never come back. Design for thread survival before you design for price.

Backus et al. also found that offers splitting the difference between the two most
recent positions are accepted at a *higher* rate than some offers that are better
in pure money terms for the accepting party, and that concessions are gradual and
reciprocal: stubbornness is met with stubbornness, movement with movement.
[Galinsky and Mussweiler (2001, JPSP)](https://business.columbia.edu/sites/default/files-efs/pubfiles/11691/first_offers.pdf)
add that first offers strongly predict settlements, and that the first-mover
advantage is neutralised when the receiving party is prompted to focus on their
own target rather than on the offer in front of them.

### 3.2 UI decisions

**N1. The seller sets a private floor at listing time, in the same block as the
price.**
Label: *"Lowest you would accept (only you see this)"*. This is
[Galinsky and Mussweiler's](https://business.columbia.edu/sites/default/files-efs/pubfiles/11691/first_offers.pdf)
counter-anchoring, moved before the negotiation instead of during it. A seller who
has written down ₪300 before any buyer appears evaluates a ₪280 offer against
₪300. A seller who has not, evaluates it against the ₪400 ask and against four
years of ownership, and feels robbed.

Copy under the field, because sellers will otherwise enter their ask again:
*"Most items sell for less than the asking price. Pick a number you would still be
happy with."* Do not say "pad it by 15%". Telling people to inflate is a bad norm
to teach and it is not the site's place.

**N2. Offers are structured objects in chat, not free text.**
A "Make an offer" button on the item page opens a small composer: amount, an
optional one-line note, and a pickup-time picker (§6). The offer renders in the
existing chat thread as a card with Accept / Counter / Decline. This is a change
to `backend/routes/chat.py` message types, not a new surface. Everything else in
chat (read receipts, translation, unread badges, nudge emails) then works on
offers for free.

**N3. The counter composer defaults to the split.**
When the seller taps Counter, the amount field is pre-filled with the midpoint of
the ask and the offer, rounded. This is the one place where pre-filling is right,
because Backus et al. show split-the-difference offers close at above-rational
rates and because it converts the modal "flat decline" into a counter. Fully
editable, obviously.

**N4. Remove the naked Decline button. Replace it with three named exits.**
40% of first offers are declined outright and 62% of those buyers vanish. A bare
Decline is a thread-killer with no information in it. Offer instead:
- **Counter** (opens N3)
- **"Too low for me"** sends a real message: *"Thanks for the offer. I could not
  go below ₪X."* with X the seller's private floor, revealed only at this moment
  and only if the seller taps this button. Turns a dead end into a stated BATNA.
- **"Not selling to you"** is the actual decline, quiet, no message, available for
  when someone is being unpleasant.

**N5. Lowball handling: absorb the sting, do not amplify it.**
A ₪50 offer on a ₪400 sofa is not primarily a pricing event, it is an insult event
on a personal object. Rules:
- Never surface the number in a push notification or email subject. The email says
  *"You have an offer on your sofa"*, never *"Someone offered ₪50"*. The seller
  should meet the number in a calm context, not on a bus.
- No auto-decline threshold. It looks efficient and it silently kills the 
  occasional buyer who opens low and moves fast.
- Below a configurable share of ask (start at 40%, tune from data), the buyer's
  composer shows a soft, non-blocking line before sending: *"That is well below
  the asking price. Adding a reason makes a reply much more likely."* Nudge the
  buyer to attach a sentence. It is the sentence, not the number, that keeps the
  thread alive.
- Never label a person "lowballer" anywhere in the product.

**N6. Offers expire, and the expiry is stated to both sides.**
48 hours, matching eBay's convention. The item page and the offer card both show
*"Offer expires Tuesday 14:00"*. This is a real constraint the site is actually
enforcing, so it is inside the §7 rule. It also converts the most common ghosting
mode (seller reads offer, does nothing forever) into a defined outcome.

**N7. "Or best offer" is a per-listing toggle, default on, with honest copy.**
Label: *"Accept offers"*, with the helper *"Most items on this board sell after an
offer."* Only ship that sentence once it is true of this board's own data.

---

## 4. Buyer psychology for used goods from strangers

### 4.1 Perceived risk and contamination

Two different aversions get confused, and they need different fixes.

**Transactional risk** is "will this person waste my time, will the thing be
broken, will I be scammed". Answered by photography, specificity and the trust
mechanics of §5.

**Contamination** is a disgust response to prior human contact, not a belief about
quality.
[Argo, Dahl and Morales (2006, Journal of Marketing)](https://journals.sagepub.com/doi/abs/10.1509/jmkg.70.2.081)
showed consumers evaluate products less favourably when cues make it salient that
other shoppers touched them, with disgust as the mediating mechanism, in a retail
setting where the goods were new. Second-hand raises this sharply, and
[Roux (2004)](https://www.academia.edu/2989325/Roux_2004_Buying_Second_Hand_Clothes_An_Exploratory_Approach_Using_Differences_in_Consumers_Disgust_Sensitivity)
found the rejection of second-hand clothing tracks individual disgust sensitivity:
high-sensitivity buyers reject based on an imagined previous wearer, low-sensitivity
buyers assess the garment on its merits.

Contamination is category-specific, and roughly tracks proximity to the body and
porousness. My ordering, reasoned from the sources above rather than measured on
this population, is:

| Tier | Categories | Design response |
| --- | --- | --- |
| High | Mattresses, bedding, upholstered sofas and armchairs, clothing, shoes, baby textiles, towels, hairdressing and grooming items | Contamination-specific copy and photo requirements (below) |
| Medium | Rugs, curtains, dining chairs with fabric seats, car seats, strollers, kitchen textiles | Cleaning history field, optional |
| Low | Fridges, washing machines, ovens, air conditioners, tools, bicycles, desks, shelving, bookcases, lamps, tables | No contamination treatment. Functional risk only. |
| None | Books, board games, plants, dishes, glassware, electronics, sealed goods | Nothing beyond normal photos |

Note the asymmetry that matters commercially: the olim furnishing wave is heaviest
in the Low tier (white goods, a table, a bed frame, an AC unit). The contamination
problem is real but it is not the main constraint on the main volume. Do not spend
the first build on it.

### 4.2 UI decisions

**B1. Photo conventions, enforced by prompt not by validation.**
In the photo step, four labelled slots with example silhouettes: *Whole thing*,
*Close-up of the worst part*, *In the room it is in*, *Any label or model number*.
The seller can skip any of them. The "worst part" slot is the important one and
should be labelled exactly that, not "condition detail". A visible flaw photo is
the highest-value trust signal a stranger listing can carry, because it is costly
to fake and it proves the seller is not hiding anything else.

**B2. A "Flaws" field, positioned as a selling point.**
Free text, optional, on the item form, above the description. Placeholder: *"Small
tear on the left arm, does not spread. Everything else is fine."* Helper copy:
*"Listings that name a flaw get more replies. Buyers trust them."* Ship that
helper only once the board's own data supports it; until then the placeholder
alone does the work.

**B3. High-tier categories get one extra field and one extra photo slot.**
Field: *"Cleaning"* with three chips, `Professionally cleaned` / `Washed at home` /
`As-is`. Photo slot: *"Clean and empty"* for mattresses and upholstery. That is
the whole intervention. Do not build a hygiene certification. `As-is` must be a
first-class, unpenalised option, because forcing a claim produces a false claim.

**B4. Mattresses are their own decision, taken deliberately.**
They are the highest-contamination, highest-logistics, lowest-value item on any
furnishing board, and they are also exactly what an oleh needs in week two. Ship
them, but with the cleaning field mandatory and a `Beds and mattresses` subcategory
so buyers who will not touch a used one can filter the entire tier out in one tap.
A filter that lets the disgust-sensitive buyer *not see* the category is worth more
than any reassurance copy aimed at them.

**B5. "What makes someone message a stranger about a fridge."**
The message itself is the barrier, not the fridge. The buyer's fear is a
mid-length awkward exchange with a stranger in a language they may not share. So:
- Three tap-to-send openers under every item, pre-written and translated:
  *"Is this still available?"*, *"Could I see it this week?"*, *"Would you take
  ₪___?"* The third opens the offer composer from N2. Chat has no canned replies
  today; this is net-new and it is the cheapest conversion win in the document.
- Show the seller's typical reply speed **only when it is real and fast**
  (§6, G1). `avg_response_hours` exists on providers today but not on users.
- Show the language the seller writes in: a small `Replies in English` /
  `עונה בעברית` chip on the item card. For an oleh with no Hebrew this is the
  single most decision-relevant fact on the page and the site already has
  `preferred_language` on the user.

**B6. Every item page carries the standing safety line, in both languages.**
Already ruled in `categories-expansion-spec.md` §N6: *"Meet in a public place.
Never transfer money before you have the item."* Rendered in
`--brand-muted` at body size, not in a warning-coloured box. A red alert box on
every listing makes the whole board feel dangerous, which suppresses the buying
it was meant to protect.

---

## 5. Trust without a transaction

### 5.1 The finding this section is built on

I read the [working paper text](http://ccs.mit.edu/dell/reputation/BKOMSsub.pdf)
of [Bolton, Katok and Ockenfels (2004), *Management Science* 50(11)](https://pubsonline.informs.org/doi/10.1287/mnsc.1030.0199).
Buyers chose whether to buy; sellers then chose whether to ship or keep the money.
Three market conditions. Mean results across sessions (their Table 1):

| Market | Efficiency | Buy rate (trust) | Ship rate (trustworthiness) |
| --- | --- | --- | --- |
| Strangers, no feedback | 14.3% | 37.1% | 35.7% |
| Reputation, full feedback history | 40.7% | 55.6% | 72.8% |
| Partners, same two people repeatedly | 73.9% | 83.3% | 88.5% |

Their own summary: *"reputation yields 2.8 times the efficiency of strangers, and
partners yields 1.8 times the efficiency of reputation."* The brief's 1.8x figure
is exact and correctly attributed. And the identity point holds: this was an
anonymous laboratory market where no participant's identity was verified in any
condition. The gain came purely from the *structure of recurrence*, not from
knowing who anyone was.

Their explanation is that a reputation system has a public-goods problem. Leaving
feedback benefits the whole community, so it is undersupplied, and the benefits of
being trustworthy are not fully internalised by the seller. In a repeated pairing
they are.

### 5.2 What this means for a site with no reviews for one-off sellers

`docs/categories-expansion-spec.md` §N4 already concedes that a person selling one
sofa has "no meaningful review". Correct, and the finding above says that is much
less of a problem than it looks, *provided the site converts one-off sellers into
recurring counterparties*. This site can, because the same person is already a
landlord, a service provider, a Requests poster and now a seller. The current
build wastes this: reviews attach to gigs (`db.marketplace_reviews`, keyed by
`gig_id`), and `poster_verified` is bound to `google_linked` only.

**T1. A single cross-role person card, rendered identically everywhere.**
One component, used on the item page, the gig page, the property page and the
Requests board. It shows, in this order:

```
Sarah L.                              Replies in English
On MyIsraelRental since 2024
Also here as: a landlord in Katamon · a Hebrew tutor
14 conversations with 11 different people
```

Every line is a fact the database already holds or can cheaply derive. No stars,
no score, no percentage. The second and third lines are the recurrence signal that
the 1.8x result says is worth more than a rating, made visible.

**T2. "You have dealt with this person before" is the highest-priority badge in
the product.**
When a viewer has any prior thread with the seller, the item card and the item
page both show it, above everything else:
*"You rented from Sarah in 2025."* / *"You have spoken with Sarah before."*
This is literally the partners condition. It should outrank price, photo and
recency in the visual hierarchy of the card, and it should be the top sort option
in a `From people you know` filter on the board.

**T3. Second-degree recurrence, stated carefully.**
*"3 people who have posted in Katamon have dealt with Sarah."* No names, no
graph, no "mutual connections" social feature. One derived count, shown only at
n≥3 so it cannot deanonymise anyone. This is the indirect-reciprocity channel and
it is cheap: it is a distinct-counterparty count over existing chat threads.

**T4. Move reviews from gigs to people, additively.**
Keep `gig_id` reviews working. Add a person-level aggregate that rolls up every
review a user has received in any role, displayed on T1 as *"Reviewed 6 times as a
service provider"*. A cleaner with six good reviews selling a fridge is carrying
real, earned trust across the boundary, and today the product throws it away at
the boundary.

**T5. Be truthful about what "verified" means, or drop the word.**
`poster_verified` currently means "signed in with Google" (`requests.py:315-322`),
deliberately not `email_verified` since that was rolled back and is meaningless.
A badge reading "Verified" over a Google login is an overclaim that will get the
site blamed for the first bad meetup. Replace the label with the fact:
`Google account` as a small neutral chip. Reserve `Verified` for the admin-set
business flag, which is a real human check, and label that one
`Verified business` so the two are never confused.

**T6. What NOT to build.**
- No escrow, no "buyer protection", no "secure payment" language anywhere. The
  site cannot honour it, and a false safety claim converts a bad meetup into the
  site's liability. Already ruled in §N6; restated here because it is the single
  most tempting thing to add.
- No 5-star rating on one-off item sellers. With n=1 it is noise, and the
  public-goods problem above says it will be undersupplied anyway.
- No ID or document upload. The Bolton result says it is not where the gain is,
  and it would be a serious data-protection liability on a site that presently
  stores nothing of the kind.

---

## 6. The no-show and the ghost

### 6.1 What I can and cannot claim

**The widely circulated "70% of Facebook Marketplace buyers ghost confirmed
pickups" number does not survive checking.** It traces to
[showdup.com](https://www.showdup.com/blog/facebook-marketplace-no-show-statistics),
a commercial vendor selling a no-show reduction product, citing its own internal
appointment data. It is marketing collateral, not research, and the same page
carries a second incompatible figure (66%). Do not use it in any internal or
external material. I found no peer-reviewed measurement of P2P meetup no-show
rates.

What I can use is field data on the *silent* failure modes, from
[Backus et al. (2020)](https://faculty.haas.berkeley.edu/stadelis/qjaa003.pdf):
~80% of Best Offer listings never receive an offer at all, and 62% of buyers who
get a flat decline never respond again. Silence, not fraud, is the load-bearing
failure. That is the brief's premise and it is well supported.

On reminders, the evidence base is medical rather than commercial but it is
genuinely randomised. Two SMS or phone reminders beat one, particularly for people
at high risk of missing
([AJMC randomized trial](https://www.ajmc.com/view/optimizing-number-and-timing-of-appointment-reminders-a-randomized-trial));
SMS is non-inferior to a phone call and cheaper
([Geneva RCT, n=6,450, 11.7% vs 10.2% missed, p=0.07](https://pubmed.ncbi.nlm.nih.gov/23557331/)).
Transferring health-appointment findings to sofa collection is an inference, not a
measurement, and I am flagging it as such.

### 6.2 UI decisions

**G1. Show response behaviour only when it is good, and only when it is real.**
Add a per-user `avg_first_reply_minutes` (users currently have nothing; only
providers have `avg_response_hours`). Display rules:
- Fast (under ~2h median, n≥5 threads): show *"Usually replies within an hour."*
- Everything else: show nothing.
Never show "slow to reply" or a response-rate percentage. A negative badge is a
punishment that drives the user off the site rather than making them faster, and
it also punishes a person who was on a plane. Asymmetric disclosure is the honest
design here: the positive claim is verified, the absence of it claims nothing.

**G2. Every accepted offer creates a meetup with a time and a place, in chat.**
The moment an offer is accepted, the thread renders a card:
```
Pickup                                       [Confirm]  [Suggest another time]
Thursday 4 September, 18:00
Rehov Emek Refaim 12, Katamon (approximate)
```
Both parties tap Confirm. This is a commitment device: the failure it prevents is
the drift from "sure, sometime this week" into nothing. The address is shown at
street-level approximation until both have confirmed, then exactly.

**G3. Reminders: two, both sides, both channels the user already has.**
- T minus 24h: in-app + the existing throttled chat email.
- T minus 2h: in-app + push.
Content names the counterparty, the item, the time and the place, and carries one
button: *"Still coming?"* with `Yes` / `I need to reschedule` / `I cannot make
it`. The third option is deliberately as easy to tap as the first. **Making
cancellation frictionless is the anti-ghosting mechanism**, because ghosting is
what happens when backing out feels socially worse than disappearing.

**G4. Name the real, specific cost of not showing up. Once.**
In the confirmation card, one line: *"Sarah is holding this for you and has turned
down 2 other people."* Only rendered when both facts are true and countable. This
is honest loss framing (§7): a stated consequence to a named human, not invented
urgency. If the seller turned nobody down, the line does not render.

**G5. A one-tap "Did you meet?" the morning after, for both sides.**
Three options: `Yes, done` / `No, they did not show` / `We rescheduled`. `Yes,
done` sets `item_status: sold` in one tap, which is the mechanism §2's sold-price
data depends on, and which `POST /requests/{id}/sold` already implements. This is
the highest-leverage single control in the whole feature: it feeds pricing,
freshness and trust simultaneously.

**G6. No-show consequences: private, gradual, never a public scarlet letter.**
- First reported no-show: nothing visible, logged.
- Pattern (3+ confirmed no-shows reported by 3+ distinct counterparties): the
  user stops appearing in the `From people you know` sort, and their offers stop
  auto-notifying by email. No badge, no public flag, no ban.
- Nothing derived from a single report, ever, because a single report is a
  weapon in a dispute.

**G7. Auto-bump the stale thread, once.**
If a thread has an unanswered message from a buyer after 48h, send the seller one
nudge and then stop. `run_auto_owner_nudge_pass` already does exactly this for
property inquiries on a 30-minute sweep; extend it to item threads rather than
building a second nudge system.

**G8. Expire and ask, do not just expire.**
The 30-day TTL and the pre-expiry reminder exist. Change the reminder's content
for items from renew/expire to three buttons: `Still available, renew` /
`Sold elsewhere` / `Changed my mind, remove`. `Sold elsewhere` is the important
one: it removes stale supply *and* contributes a sale price to §2's data, and it
is currently a thing the seller has no way to say.

---

## 7. Loss aversion, applied honestly

The standing rule is real numbers or nothing: no invented scarcity, no countdown
timers, no "3 left" pressure styling. That rule rules out the entire conventional
loss-aversion toolkit, which is fine, because in a market with genuine one-of-one
supply the honest version is stronger than the fake one.

**Legitimate, because the constraint is real and physical:**

**L1. One-of-one supply, stated as fact.**
On the item page: *"One available."* Not styled as urgency, no colour, no icon.
It is simply true of a used sofa and it is the strongest scarcity claim in
commerce. It needs no help.

**L2. Real interest counts, at a threshold, with no styling.**
*"4 people are talking to the seller about this."* Rendered only at n≥3 (below
that it is noise and it deanonymises), in `--brand-muted` body text, never in
`--gold`, never with a flame or a lightning bolt. `contact_count` already exists
on requests.

**L3. Real state changes, announced factually.**
*"This sofa is now marked sold."* on a page a buyer previously viewed. The loss is
real and already happened; reporting it is honest and it is the most effective
teacher that this board moves. This is the legitimate version of FOMO: it is
retrospective, so it cannot be manufactured.

**L4. The seller's own real deadline.**
*"You are moving on 15 September. 3 things are still listed."* The deadline is the
user's own, taken from their lease, not one the site invented. This is the same
mechanism as D7 and it is the strongest honest loss frame available.

**L5. Expiry warnings, because the expiry is enforced.**
*"Your listing expires in 3 days."* True, enforced by `REQUEST_TTL_DAYS`, and
actionable. Fine.

**L6. Sunk-cost-of-effort framing on an abandoned draft, once.**
*"Your sofa listing is 80% done."* Accurate, non-recurring, and it names a real
partially-completed thing. See D9: one card, not a nag counter.

**Ruled out, explicitly, so nobody reintroduces them:**
- Countdown timers on anything except a real 48h offer expiry (N6).
- "Popular", "Trending", "Hot" chips derived from view counts.
- View-count inflation, "X people viewed in the last hour".
- Red or gold pressure styling on any availability element. Green stays
  functional-only per the design system.
- "Price drop" badges the seller did not choose to publish.
- Any "last chance" language on a 30-day TTL, which is not a last chance.

---

## 8. The olim arrival moment

### 8.1 The person

North American aliyah ran 4,150 in 2025, up more than 12% on 3,706 in 2024
([Jerusalem Post](https://www.jpost.com/israel-news/culture/article-881784)), with
roughly 2,700 arrived by the end of August 2026, over 1,100 in August 2026 alone,
and 4,000+ projected for the year
([Jerusalem Post](http://www.jpost.com/aliyah/article-906840)). Applications opened
rose from 8,943 in 2022 to 13,389 in 2025, about a 50% cumulative increase. These
are North America only and Nefesh B'Nefesh-facilitated only, so they understate
the total English-speaking arrival wave, which also includes the UK, South Africa,
Australia and France-with-English. The 2025 cohort skews young (average age 31)
and includes 297 families and 1,476 singles.

Three weeks after landing, this person has: an empty or near-empty apartment, a
signed lease, a deadline they did not choose, little or no Hebrew, no car, no
Israeli credit history, an Israeli bank account that may not be fully working
yet, and no idea what a used fridge should cost in shekels. They are operating
with high time pressure and near-zero market knowledge, which is the exact
combination that produces both fast decisions and total paralysis, depending
entirely on how the first screen is organised.

They are also, critically, **the highest-value buyer this board will ever have**,
because they need fifteen things at once and they need them this month.

### 8.2 What that person needs to see first

**A1. A furnishing-intent entry point that is not the general board.**
`/moving-in` (or a first-run dashboard card for any user with a lease starting in
the next 60 days). It is a checklist, not a search box, because a person who does
not know the market cannot form a query.

```
Furnishing your place

Sleep      Bed frame · Mattress · Bedding
Kitchen    Fridge · Oven · Microwave · Kettle · Dishes
Living     Sofa · Table · Chairs · Lamp
Climate    Air conditioner · Fan · Heater
```
Each chip is a saved search scoped to their area with a saved alert. Tapping five
chips in ten seconds creates five standing alerts, which is five future return
visits.

**A2. Answer the three questions they cannot ask.**
Every category page in the moving-in flow carries a plain line of real, sourced
market context:
- *"Used fridges in Jerusalem usually go for ₪400 to ₪900."* From the site's own
  sold data, with the sample stated (§2 P2). If there is no data, no line.
- *"Delivery is not included. Most sellers expect you to collect."* This is a norm
  an oleh genuinely does not know and will otherwise discover badly.
- *"Ask whether it works before you go. Ask to see it switched on when you
  arrive."* Practical, not scary.

**A3. Solve the no-car problem inside the product, not around it.**
This is the single biggest practical blocker on the buyer side and the site
already has the supply. Every item over a size threshold (or in furniture and
appliance categories) shows, under the price:
*"Need help moving it? See movers in Jerusalem."* deep-linking into the existing
services marketplace, filtered to movers in the pickup area. This is the strongest
argument for building goods on this site rather than anywhere else: the
complementary service is already there and monetised by presence, not commission.

**A4. A `Delivery possible` chip, seller-set, filterable.**
One boolean on the item form. For a carless buyer it is the difference between a
viable listing and a dead one, and it is a two-minute build. It must be a
filter on the board, not just a display chip.

**A5. Distance and reachability, not just an area name.**
"Katamon" means nothing to someone who landed three weeks ago. Show
*"Katamon, about 20 minutes from you"* where an area is known, and let them filter
by *"Walking distance"* / *"Short bus ride"* / *"Anywhere in Jerusalem"* rather
than by neighbourhood names they cannot yet rank.

**A6. Language legibility everywhere, per B5.**
The `Replies in English` chip is not a nicety for this user, it is a
go/no-go signal. It belongs on the card, not just the detail page.

**A7. The reciprocal moment, six to twelve months later.**
The oleh who furnished an apartment in September is the seller who upgrades or
leaves. `/moving-in` should have a quiet counterpart triggered off the same lease
data (D7). The furnishing wave is a circulating stock, not a one-way flow, and
treating it that way is what makes the board self-sustaining instead of demand-only.

---

## 9. Cultural specifics for Israel

I am flagging the evidence quality here plainly, because it is the weakest section
in the document and it would be easy to launder anecdote into fact.

**C1. WhatsApp is the default channel and the product must acknowledge it.**
[Jerusalem Post, reporting a 2025 usage survey](https://www.jpost.com/business-and-innovation/article-871715),
puts WhatsApp at 99% usage in Israel with 99% of those using it daily, ahead of
YouTube (97%) and Facebook (93%). I could not reach the underlying survey
methodology, so treat 99% as "effectively universal" rather than as a precise
figure.

Design consequence, and it is a genuine tension: the standing rule is **chat only,
contact never public**, and that rule is right (it is what prevents scraping and
off-site scams). But telling an Israeli user they cannot use WhatsApp is telling
them to use a worse tool. The resolution already exists in `requests.py`: an
**opt-in `whatsapp` flag with a tracked redirect**, revealed only from inside an
active thread and only when the poster chose it. Reuse that exactly for items:
- Default off.
- Never in search results, never on the card, never in any list endpoint.
- Surfaced in the thread only after the first exchange.
- The site's own chat remains the record of the conversation, which is what makes
  the report button meaningful.

**C2. Haggling is expected, but the norms are narrower than outsiders think, and
my evidence is weak.**
What I found is travel-guide and forum material, not research: haggling is
expected in the shuk and in tourist markets, not in chain stores or supermarkets
([ProHebrew](https://www.prohebrew.com/post/haggling-in-israel),
[Tripadvisor Israel forum](https://www.tripadvisor.com/ShowTopic-g293977-i1733-k10203586-Negotiating_Prices-Israel.html));
directness is expected and rudeness is not; an offer too low reads as
disrespectful rather than as an opening move; and there is a strong norm that **if
you name a price and it is accepted, you buy**. I could not find peer-reviewed
work on Israeli haggling norms in P2P classifieds. **Treat all of this as
plausible cultural reporting, not as evidence.**

Two design consequences follow if it is right, and both are harmless if it is
wrong:
- The "if you name it, you buy it" norm is a strong argument for **N2's structured
  offers**: a formal Accept turns an implicit cultural obligation into an explicit,
  mutual, recorded one, which protects the Anglo buyer who does not know the norm
  and satisfies the Israeli seller who assumes it.
- The "too low is disrespectful" norm supports **N5's soft prompt** on very low
  offers, which asks for a reason rather than blocking the offer. It converts a
  potential cultural insult into an explained position.

**C3. The Hebrew/Anglo behavioural gap: I have no data, only structural
reasoning, and I am labelling it as such.**
No source I found measures a difference in buying behaviour between Hebrew-speaking
and Anglo users on Israeli classifieds. What is structurally true rather than
measured:
- Yad2 and the large Hebrew Facebook groups are the incumbents, and they are in
  Hebrew, which is a hard wall for a three-week oleh.
- The Anglo community has run on English-language classifieds for 25 years:
  [Janglo](https://www.janglo.net/about) has operated since June 2001 and
  self-reports a 50,000+ address newsletter and 400,000+ monthly page views. That
  is an existence proof of the demand and a competitor, and those are self-reported
  numbers.
- The Anglo advantage this site can claim is not better inventory. It is
  **English, one identity across rental and services, and a chat that translates**
  (`backend/utils/chat_translate.py` already does per-message translation on
  demand).

**C4. Ship the board genuinely bilingual, not English-with-Hebrew-bolted-on.**
The machinery exists and should simply be used: `backend/utils/translate.py`
writes `title_he`/`description_he` at save time via a background task (Hebrew
detection is a 0.30 character-ratio test, so it handles mixed-language posts
correctly), and `chat_translate.py` handles messages. Items must run through
`_translate_bg` the same way requests already do. A Hebrew-speaking seller posting
in Hebrew and an Anglo buyer reading in English, each in their own language, in the
same thread, is the product's actual differentiator and it is already built.

**C5. RTL is a correctness requirement, not a nicety.**
Every element specced here (the price band in P1, the offer card in N2, the meetup
card in G2, the checklist in A1) must mirror. Per `CLAUDE.md`: headings read
`fontFamily: 'var(--font-head)'`, never the literal `'Playfair Display'`, which has
no Hebrew glyphs. Verify a heading's computed `fontFamily` under `[dir="rtl"]`
before calling any of this done.

---

## 10. Everything I could not verify

Collected here so it does not get quietly promoted to fact by a later reader.

| Claim | Status |
| --- | --- |
| Vinted sellers widely distrust its price hint because it surfaces the lowest comparable | **Unverified as research.** Consistent seller anecdote only. The design conclusion is supported independently by Dietvorst et al. |
| "70% of Facebook Marketplace buyers ghost confirmed pickups" | **Do not use.** Vendor marketing (showdup.com) citing its own data, and the same page gives an incompatible 66%. No academic measurement found. |
| "Responding within 1 hour raises conversion 25%" (Airbnb) | **Unverified.** Vendor blog. The related peer-reviewed work ([Does the Seller's Response Time Affect the Buyer's Concession?](https://papers.ssrn.com/sol3/papers.cfm?abstract_id=4172386)) finds an inverted-U effect on eBay Best Offer, which is a different and more interesting claim than "faster is better". |
| Israeli haggling norms | **Weak.** Travel guides and forums, no research. Flagged inline at C2. |
| Hebrew vs Anglo buying behaviour gap | **No data found.** Section C3 is structural reasoning, explicitly labelled. |
| WhatsApp 99% usage in Israel | **Single-source.** JPost reporting a survey whose methodology I could not reach. Safe as "effectively universal", not as a precise number. |
| Janglo's 50k newsletter / 400k monthly page views | **Self-reported** by Janglo's own advertising page. |
| Contamination category tiering (§4.1 table) | **My reasoning**, extrapolated from Argo et al. and Roux. Not measured on this population. Worth an actual test once there is traffic. |
| fMRI evidence that discarding activates pain regions in hoarders | **Not read.** I saw it only in secondary summaries and did not locate the primary study, so I have not relied on it anywhere in this spec. |
| Transfer of medical appointment-reminder RCT findings to P2P pickups | **An inference.** The RCTs are real and randomised; the transfer to sofa collection is not tested. |

Verified and safe to quote, with the primary source read directly:
Bolton/Katok/Ockenfels 2004 (the full 1.8x and the session-level table),
Backus/Blake/Larsen/Tadelis 2020 (all figures in the §3.1 table),
Kahneman/Knetsch/Thaler 1990, Galinsky/Mussweiler 2001, Dietvorst et al. 2015 and
2018, Argo/Dahl/Morales 2006, the Nefesh B'Nefesh aliyah figures.

---

## 11. Build order

### Build first (weeks 1 to 2). Nothing here is speculative.

1. **G5, the "Did you meet?" prompt and one-tap sold.** Feeds pricing data,
   freshness and trust at once. `POST /requests/{id}/sold` already exists.
2. **D1 to D3: photo-first, AI-drafted, single-page item creation.** The listing
   act is the whole business. All three components exist
   (`fastUpload.js`, `useFormDraft.js`, `bulk_upload.py`).
3. **B5's three tap-to-send openers, plus the `Replies in English` chip.** Cheapest
   conversion win in the document, and chat has no canned replies today.
4. **D7, the move-out trigger off lease end dates.** Highest-value item overall.
   No one else can build this; the site owns the trigger data.
5. **T2, "you have dealt with this person before".** Directly implements the 1.8x
   finding using data the chat collection already holds.
6. **T5, replacing the "Verified" label with `Google account`.** A one-line fix to
   an active overclaim. Do it before launch, not after the first bad meetup.
7. **A4, the `Delivery possible` boolean and filter.** Two-minute build, large
   effect on the carless buyer who is the core customer.
8. **C4, running items through `_translate_bg`.** Existing code path, must not be
   forgotten.
9. **The board's category filter (benchmark spec L11).** Already noted as broken.

### Build second (weeks 3 to 6). Depends on week-1 data existing.

10. **N1 to N4: private floor, structured offers in chat, split-the-difference
    default counter, and the three named exits replacing Decline.** This is the
    largest single build and it is the one that decides whether threads survive.
11. **G2 and G3: the meetup card with two reminders and a frictionless "I cannot
    make it".**
12. **P1 to P5, the price range.** Blocked on §1 sold data from G5. Do not ship a
    suggestion built on asking prices.
13. **A1 to A3, the `/moving-in` checklist with saved alerts and the movers
    deep-link.**
14. **T1, the cross-role person card.**
15. **B1 and B2, the labelled photo slots and the Flaws field.**
16. **G8, the three-button expiry email including `Sold elsewhere`.**

### Build third, or when the data justifies it

17. T3, second-degree recurrence counts. Needs volume before n≥3 is common.
18. T4, person-level review rollup across roles.
19. B3 and B4, contamination fields and the mattress subcategory. Real, but not
    where the volume is.
20. L2, real interest counts. Needs the board to be busy enough for n≥3.
21. G6, the private no-show pattern threshold. Meaningless until G5 has run for
    months.
22. G1, response-speed display. Needs n≥5 threads per user.

### Do not build

- **Escrow, buyer protection, or any "secure payment" language.** The site cannot
  honour it and claiming it converts a bad meetup into the site's liability.
- **Star ratings on one-off item sellers.** n=1 is noise, and the public-goods
  problem means it will be undersupplied anyway. Recurrence (T1 to T3) is the
  substitute and the evidence says it is a better one.
- **ID or document verification.** Not where the gain is, and a serious
  data-protection liability on a site that stores nothing comparable today.
- **Auto-decline thresholds on offers.** Kills the fast-moving buyer who opened low.
- **Any invented scarcity: countdowns, "hot"/"trending" chips, view-count
  inflation, "only 1 left" styling.** Ruled out by standing policy and by §7.
- **Public negative signals of any kind:** slow-reply badges, no-show flags,
  "lowballer" labels, response-rate percentages. All of them drive the punished
  user off the site rather than changing their behaviour.
- **A separate goods product with its own nav, page and data model.** Ruled in
  `categories-expansion-spec.md` §N4 and it is the right ruling. Items are
  `request_type: "item"` on the Requests board.
- **A price suggestion built from asking prices.** Worse than no suggestion,
  because it is confidently wrong in the direction that keeps items unsold.
- **Charm-pricing nudges.** Irrelevant ahead of a negotiation.
