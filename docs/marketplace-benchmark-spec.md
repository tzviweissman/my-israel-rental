# Marketplace benchmark — what to take from the big marketplaces, and what not to

Written 27 Aug 2026. Research pass over Facebook Marketplace, Yad2, Janglo,
Thumbtack, Angi, Bark, Airbnb and Nextdoor, checked line by line against what
this codebase actually does today.

Every "we don't have this" below was verified in the repo, not assumed. Where a
claim has a file and line, it was read. Where something was searched for and not
found, that is stated as such.

---

## What we are, which decides what applies

Three properties rule out most of what these platforms do:

1. **We take no commission and process no money.** Contact is the conversion
   event, not checkout. So Amazon/eBay/Etsy mechanics built around a cart, a
   transaction fee or a payment hold are irrelevant.
2. **We are free to list and free to be found**, by standing position. That
   rules out the entire Thumbtack / Angi / Bark business model, which is selling
   the customer's contact details to providers.
3. **We are bilingual and WhatsApp-native.** Israel's default contact channel is
   WhatsApp, and our own default is `booking_mode = "whatsapp"`
   (`backend/routes/marketplace/shared.py:422`). Several standard marketplace
   patterns assume on-platform messaging is the only channel; ours has to work
   with the conversation leaving the site.

The comparable that matters most is **Facebook Marketplace**, because it is
where our supply and demand currently are — Israeli Anglo community groups — and
because it is free, contact-based, and has no transaction. **Janglo** is the
direct competitor for the same audience. Yad2 is the scale incumbent.

---

# Tier 1 — Broken promises. Fix these before adding anything.

A marketplace that offers something and doesn't deliver it is worse than one
that never offered. All four of these are live today.

## L1 — "Message on MyIsraelRental" dead-ends for most listings

`messageOnSite` opens the booking form unconditionally
(`frontend/src/components/.../GigDetail.jsx:535-543`), but the endpoint rejects
anything that isn't in-platform:

```python
if gig.get("booking_mode") != "in_platform":
    raise HTTPException(status_code=400, detail="This gig only accepts WhatsApp bookings")
```
`backend/routes/marketplace/gigs.py:842-843`

Store gigs are rejected earlier still (`gigs.py:840-841`). And `in_platform` is
**always offered as a channel**, unconditionally (`shared.py:698`).

So: the channel documented in `ContactChannels.jsx:17-20` as the one that
"cannot silently fail" returns a 400 toast for every WhatsApp-mode gig and every
store gig — which, given the WhatsApp default, is most of them.

**Fix:** either accept in-platform messages for every gig regardless of booking
mode (preferred — a message is not a booking), or stop offering the channel
where it cannot work. Do not leave a button that 400s.

## L2 — The jobs digest is promised and never sent

`JobsBoard.jsx:62` tells a provider "You'll get a daily digest of new matches."
`JobRequestsTab.jsx:55` labels saved searches "daily digest."

`POST /marketplace/job-searches/send-digest` exists (`jobs.py:598-611`) and is
admin-only. **No scheduler calls it** — the only references in the whole backend
are its own decorator and definition. `server.py` starts the requests digest
(`server.py:240`) and the request-expiry loop (`:236`), but nothing for jobs.

**Fix:** wire the loop, or change the copy. A provider who saves a search and
waits is being told the marketplace is dead when it isn't.

## L3 — The response-time badge can almost never appear

`avg_response_hours` only updates when an **in-platform booking** first leaves
`pending` (`gigs.py:912-918`), and the badge needs three of them
(`shared.py:320-322`). In a marketplace that defaults to WhatsApp, most
providers will never reach three.

This matters more than it looks. Airbnb's own data is that response badges are
among the strongest conversion signals a listing carries, and its algorithm
weights responsiveness directly. Ours is built, displayed in three places
(`ServiceCard.jsx:104-115`, `BusinessPage.jsx:435-445`, and as a filter) — and
structurally unreachable for the majority.

**Fix:** feed it from **first reply in site chat** as well as bookings. A
provider who answers messages fast should earn the badge whether or not anyone
has booked.

**Do not** feed it from WhatsApp clicks — we can log the click
(`gigs.py:1565-1630` writes a `whatsapp_click` lead event) but we cannot see the
reply, and a badge derived from a number we can't observe is a lie.

## L4 — Legacy category links return 400

`_normalize_category` (`shared.py:247-250`) was written so old slugs resolve at
read time, and the comment at `shared.py:229-231` claims a bookmarked
`/services?category=photography` still works. **It is called from nowhere.**
`list_gigs` calls `_validate_category` (`gigs.py:137`), which raises 400
(`shared.py:513-515`).

So every shared or bookmarked legacy link is a hard error. **Fix:** call the
normaliser before validating, and add the test that would have caught it.

---

# Tier 2 — The search gap. This is the biggest single opportunity.

## L5 — There is no search box on `/services`

The backend has a real free-text search: tokenised, with number-word and synonym
expansion, matching Hebrew and English title and description fields
(`shared.py:786-825`). `Services.jsx:63` reads `q` from the URL and forwards it
(`:208`).

**No UI control anywhere sets it.** Searched `frontend/src` for `patchUrl({ q`,
`set('q'`, `/services?q=`, and every component in `components/search/`; the only
`q` input in the app is on the Requests board (`RequestsBoard.jsx:358`).

Facebook Marketplace is search-first — the search field is the primary object on
the screen, and category browse is secondary. Ours is the reverse and then some:
a category dropdown, and a working search engine with no door into it.

**Build:** a free-text field as the first segment of `ServicesHeroSearch`,
setting `q`. Everything server-side already works.

**Also:** `CategoryCarousel.jsx` exists and is imported by nothing (verified —
only self-references and two prose comments). Either delete it or use it. Dead
components rot.

## L6 — Zero results is a dead end

With no `q` and post-filters applied in Python after the fetch
(`gigs.py:176-274`), it is easy to land on an empty grid. The standard practice
across every search-driven marketplace is **relaxation, not an empty page**:
drop the least critical constraint and say so.

**Build**, in this order of relaxation:

1. Same query, filters dropped one at a time, **named**: *"No results with
   'Under ₪100'. Showing 12 without that filter."*
2. Same category, nearby areas: *"Nothing in Ramat Eshkol — 8 in Jerusalem."*
3. Last resort, and the most valuable one for us: **"Nobody offers this yet.
   Post what you're looking for →"** into the Requests board.

That third case is the flywheel. A zero-result search is a demand signal we
currently throw away, and we already have the board to catch it.

## L7 — No pagination

Server default caps at 60 (`gigs.py:131`) and the client never sends `limit`
(`Services.jsx:201-226`). Fine at today's volume, a wall later. Note it; don't
build it yet.

---

# Tier 3 — Trust, which is what we sell instead of a transaction

Because no money moves through us, the only thing a visitor can rely on is what
the page tells them about the provider. Facebook has been moving hard in this
direction — a seller's profile summary now shows tenure, listing history and
activity above their Marketplace page. Nextdoor's own reporting puts neighbour
recommendations above every other directory for local services.

## L8 — Reviews are unverified and never requested

- **Anyone signed in can review any gig** except their own (`gigs.py:1683-1684`).
  No booking id, no contact check, no verified-purchase concept.
- **Nothing ever asks for a review.** `book_gig` (`gigs.py:834-892`) and
  `update_booking` (`:896-924`) fire nothing; `_notify` is only used for hold
  expiry (`:1327-1362`). A booking can reach `completed` (`shared.py:500`) and
  that transition triggers nothing at all.
- The business page shows the aggregate but **lists no individual reviews**
  (`BusinessPage.jsx:412-417`).

So the single strongest asset a local marketplace can have — real accounts of
real jobs — is left entirely to chance.

**Build, in order:**

1. **Ask.** When a booking hits `completed`, or 48h after a WhatsApp lead the
   provider marked as won, email the customer once. One link, one action.
2. **Mark provenance.** A review tied to a booking or a marked-won lead gets a
   quiet **"Verified job"** line. Do not block unverified reviews — a neighbour
   who hired them off a flyer is still telling the truth — just distinguish.
3. **Show them on the business page**, not only the count.

## L9 — We know things about providers and don't say them

`member_since` is computed (`businesses.py:612`) and used only to decide whether
to print "New on MyIsraelRental" (`BusinessPage.jsx:264, 417-428`). There is **no
completed-jobs count anywhere** — searched for `completed_jobs`, `jobs_done`;
the enum value exists, no counter does.

**Build:** a small facts row on the card and the business page — *"On
MyIsraelRental since 2024 · Replies within an hour · Serves Jerusalem, Beit
Shemesh"*. Only facts we can compute. If a fact is unavailable, omit the line
rather than estimate it.

## L10 — There is no way to save a service

Properties have favourites (`hooks/useFavorites.js`, `POST /properties/{id}/like`).
**Services have none** — no like endpoint, no UI, verified by grep across
`backend/routes/marketplace/`.

Saves do two jobs on Facebook Marketplace: they let a buyer shortlist, and they
give the seller a demand signal that is not a message. Both matter here, and the
second matters more — a provider with no messages yet has no evidence anyone
saw them.

**Build:** save on gigs and businesses; a "Saved" tab; and **show the provider
the count** ("14 people saved this"). Real number or nothing.

---

# Tier 4 — Liquidity: making the two sides meet

## L11 — A provider cannot filter the Requests board to their trade

The backend supports `?category=` (`requests.py:419-421`). The board's UI never
sets it — the only `category` reference in `RequestsBoard.jsx` is the label on a
card (`:119`). `area` is read from the URL (`:339`) but no control sets it either.

A plumber looking for work can filter to "services" and type words. That's it.

**Build:** category and area filters on the board. This is a small change to a
page that is otherwise the best thing we have.

**Note, corrected:** the **requests** digest *is* wired and running daily at
09:00 UTC (`requests.py:1117-1129`, started at `server.py:240`). An earlier note
claiming otherwise was wrong. It matches service requests **category-wide,
ignoring area** (`requests.py:941-945`) — worth narrowing, since a Haifa
electrician does not want Eilat jobs.

## L12 — Nothing ages, and nothing can be paused

No expiry, no bump, no last-active timestamp, no freshness signal in ranking —
`sort=match` uses `created_at` only as a tiebreaker (`gigs.py:278-283`).
`GigPatch.status` accepts `"paused"` (`shared.py:462`) and **no frontend ever
sets it** (verified by grep) — a provider going on reserve duty or closing for a
month can only delete.

Requests already have the full lifecycle to copy: open → expired → renew
(`requests.py:634-671`, `_expire_due_requests:808`, loop at `:820`).

**Build:**

1. **Pause/unpause in `MyGigsTab`.** Trivial, the model already supports it.
2. **A quarterly "still offering this?" email.** One click confirms; no reply
   after two nudges drops the listing down the ranking, never deletes it. A
   dead listing that answers nobody costs us a customer permanently.
3. **A gentle freshness term in `sort=match`**, on last-confirmed rather than
   created. Not a Yad2-style paid bump — see rejections below.

## L13 — Booking a service notifies nobody

`book_gig` inserts and returns; the only side effect is a log line
(`gigs.py:890-892`). The provider finds out when the hold is halfway expired
(`gigs.py:1364-1398`). There is no bookings tab in the provider dashboard
reading `marketplace_bookings` at all.

**Fix:** notify on creation, and give providers somewhere to see them.

## L14 — On-site messages start from a blank box

WhatsApp openers are templated (`GigDetail.jsx:501, 513, 523`). The on-site
message box is empty with a placeholder (`:177, :218`), and site chat has no
prefill, template or quick reply (grepped `Chat.js` and `components/chat/`).

Facebook's prefilled "Hi, is this still available?" is the single most-copied
opener in marketplaces — and the single most-complained-about, because it says
nothing. **Copy the mechanic, not the message.** One-tap openers, generated from
the listing, that a provider can actually answer:

- Store: *"Do you have {product} in stock?"*
- Appointment: *"Are you free on {the date they were viewing}?"*
- Deliverable: *"What would this cost for {their area}?"*
- Always: *"I'd rather write my own →"*

Chips, prefilling an editable box — never sending on tap.

---

# What we should not copy

**The lead-sale model (Thumbtack, Angi, Bark).** Angi sells one customer's
details to 3–8 contractors who race to call; Bark sells credits that are spent
on leads that never reply. Both are structurally hostile to the provider, and
both contradict "free to list, free to be found, no commission." It is also the
loudest complaint in every contractor forum about all three platforms.

**Paid placement (Yad2, Janglo).** Janglo sells premium slots that alternate
through the homepage and category tops; Yad2 charges brokers and dealers. This
is the obvious revenue model for what we're building and it is worth Tzvi's
explicit decision rather than a silent default — but it directly contradicts the
standing "free to be found" promise, and the moment ranking is purchasable,
every trust signal above becomes less believable. **Not recommended now.** If it
is ever adopted, label paid slots unmistakably.

**Meta AI auto-replies.** Facebook now drafts replies on the seller's behalf
from the listing. For us this would manufacture the exact signal — responsiveness
— that we are asking visitors to trust. A fast reply written by us is not
evidence the provider is reachable.

**Engagement-weighted ranking as Facebook does it.** Ranking by clicks and
messages compounds early winners and buries new listings, which is fatal at our
size. Use it later, if ever, with a new-listing allowance.

**Aggressive re-listing.** The Facebook renew cycle exists because listings
decay by design. Ours don't need to. A quarterly confirmation is enough.

---

## Suggested order

1. **L1, L2, L4** — broken promises, all small
2. **L5** — the search box; largest gain per hour of work in this document
3. **L11** — category and area filters on the Requests board
4. **L3** — response badge fed from chat replies
5. **L14** — one-tap openers · **L13** — booking notification
6. **L6** — zero-result relaxation, ending at "post what you're looking for"
7. **L8** — ask for reviews, mark verified ones, show them
8. **L10** — saves, with the count shown to the provider
9. **L12** — pause, and the quarterly confirmation
10. **L9** — the facts row

## Constraints

- `brand/design-tokens.css` is law; green stays functional-only.
- Every string in `en.js` and `he.js`; verify RTL at 1280 / 768 / 375.
- **Real numbers only.** Saves, scans, reviews, response times — computed or
  omitted, never estimated.
- Nothing here introduces a fee, a commission, or paid ranking.

## Sources

Facebook Marketplace seller-profile transparency and AI reply tooling:
[TechCrunch](https://techcrunch.com/2026/03/12/facebook-marketplace-now-lets-meta-ai-respond-to-buyers-messages/),
[Meta newsroom](https://about.fb.com/news/2026/07/introducing-seller-app-facebook-marketplace/).
Lead models: [Thumbtack vs Angi](https://www.toplinepro.com/blog/thumbtack-vs-angi),
[contractor comparison](https://adaptdigitalsolutions.com/articles/homeadvisor-vs-angieslist-vs-houzz-vs-porch-vs-thumbtack-vs-yelp-vs-bark/).
Response-rate as a trust and ranking signal:
[Airbnb ranking analysis](https://www.aeve.ai/blog/airbnb-vrbo-response-time-listing-ranking-2026).
Neighbour recommendations: [Nextdoor insights](https://business.nextdoor.com/en-us/blog/nextdoor-insights-neighbors-value-recommendations).
Zero-result handling: [Baymard](https://baymard.com/blog/no-results-page),
[Algolia](https://www.algolia.com/doc/guides/managing-results/optimize-search-results/empty-or-insufficient-results).
Israeli comparables: [Janglo advertising](https://wwv.janglo.net/advertise-on-janglo).
