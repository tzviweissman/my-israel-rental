# The assistant — an AI concierge inside our own chat

Written 27 Aug 2026. Origin: `Booking Agent On WhatsApp` (Obsidian), which
describes building this on WhatsApp Business — and names, in passing, the reason
we shouldn't.

Related: `docs/marketplace-benchmark-spec.md` (L1 contact channel, L3 response
badge, L13 booking notifications, L14 one-tap openers), `docs/bilingual-and-contact-spec.md`,
`docs/business-page-spec.md`.

---

## Why this belongs in our chat, not on WhatsApp

The WhatsApp version requires the owner to have a WhatsApp Business number, a
Facebook profile, **and** a Facebook Business account, then connect an
integration across all three. For a landlord in Katamon or a handyman using his
personal number, that is an onboarding wall we would lose most people at. It is
the reason the flyer says *"AI assistant — coming soon"* rather than shipping it.

We own the message system. There is no wall. **This is the version of the idea
that is actually available to us**, and it is available to every owner on the
site the moment they switch it on.

## The premise, which is worth stating plainly

From the source note, describing a business converting 55% of leads:

> *"The moment a lead comes in, you stop, you stop cooking, you stop loving your
> child, and you immediately call the lead."*

Speed of first response is the product. The failure this prevents is silence
after an enquiry — *"exactly when they decide to go to the competitor."*

And the positioning rule: **nobody wants an AI. They want fewer customers going
elsewhere.** Every string in this feature should sound like the second thing.
Never sell "AI-powered". Sell "answers while you're on a ladder."

---

## What the owner controls (Tzvi's rulings, 27 Aug 2026)

**Off by default. Always.** Nobody gets a machine speaking for them without
deciding to. An owner blindsided by something their assistant said will never
trust it again, and word travels in this market.

Two settings, per business (and per listing where they differ):

### 1. Assistant: off / on

**Off** — today's behaviour exactly. The WhatsApp button and the "Message owner"
button appear, the customer reaches a human, nothing changes.

**On** — the customer talks to the assistant first. **The escalation buttons are
still present at all times** (see A4). Turning the assistant on never removes the
customer's ability to reach a person.

### 2. When on — booking authority: assistant books / owner confirms

**Assistant books** — for an appointment gig with real availability, or a store
order, it can complete the booking and notify the owner. Faster; suits a
business with fixed slots and fixed prices.

**Owner confirms** — it gathers everything and tells the customer the owner will
confirm. Nothing is committed. This is the safer default and should be
pre-selected.

An owner may switch between them at any time without losing their assistant's
accumulated knowledge.

---

## A1 — What the assistant may say. This rule is the whole feature.

**It may only state facts that exist as data or as owner-approved answers.** It
never infers, estimates, rounds, or reasons its way to a price, a date, a
capability or a term.

Permitted sources, in priority order:

1. **Structured listing and business data** — tiers and prices (`PricingTier`,
   `shared.py:331-347`), products and stock (`ProductItem`, `:350-371`), weekly
   availability (`:374-379`), areas, hours, languages, `founded_year`,
   `delivery_note`, `lead_time`, `payment_note`, `kosher_certification`
   (`businesses.py:78-106`).
2. **Owner-authored FAQs** — the `faqs` field already exists on gigs
   (`shared.py:439`) and is currently underused. This becomes its main purpose.
3. **Owner-approved learned answers** — A6.

Nothing else. No web access. No general knowledge about plumbing or kashrut or
Israeli tenancy law. If a plumber's assistant starts explaining pipework, it is
speaking for a licensed tradesman about their trade, and the owner carries that.

**When it doesn't know, it says so and stops:**

> *"I don't have that one — I've asked {owner} and they'll reply here."*

Then it flags the question to the owner (A6). A confident wrong answer about a
price or a date costs the owner a customer and costs us the owner.

**Never negotiable, regardless of what the customer asks:** discounts, price
changes, contract or lease terms, complaints, refunds, anything medical, legal
or safety-related. All of these escalate immediately (A4).

## A2 — Conversation design

Two mechanics from the source note, both good UX rather than prompt trickery:

**Acknowledge, then ask.** Respond to the specific thing the person said before
asking anything. The failure it prevents, quoted directly:

> *"You could give it your whole life story and it could just say 'happy to help
> with that — where do you want to go now?'"*

Someone who writes *"our boiler died and we have three kids"* gets the boiler
acknowledged before anything else. This one rule is most of the difference
between an assistant that feels like help and one that feels like a form.

**A flow, not open chat.** Three questions that move toward a decision, derived
from the gig type:

- **Appointment** — what they need · when · where
- **Store** — which item · quantity · delivery or collection
- **Deliverable** — what they need · where · by when

**Opening:** short greeting, one question. Never a paragraph.

**Length:** two or three sentences per turn. An owner's customer is on a phone.

## A3 — Bilingual, which is the part no competitor has

The customer writes Hebrew; the owner reads English. Or the reverse. Today that
gap is bridged badly or not at all.

- The assistant replies **in the language the customer wrote in**, per message —
  not per conversation. People switch mid-thread here.
- The owner's transcript view shows **both**: the original and a translation,
  clearly labelled which is which.
- When it hands off, the owner receives the summary **in their own language**
  regardless of what the customer spoke.

Reuse the existing translation path rather than adding a second one.

## A4 — Escalation. Always one tap away.

**"Talk to {owner name}" is visible in every turn, from the first.** Not in a
menu, not after three failed attempts.

The assistant escalates itself, immediately and without being asked, on:

- Anything about money beyond the listed price — discounts, negotiation, refunds
- Complaints, or any expression of dissatisfaction
- Contracts, leases, legal or safety questions
- Two consecutive turns where it could not answer
- Any request to speak to a person, however phrased, in either language

On escalation it says what it is doing, hands the full thread to the owner, and
**stops talking**. It does not resume unless the owner turns it back on for that
thread.

## A5 — The handoff

**Owner-confirms mode:** it produces a structured summary — what they want, when,
where, budget if given, contact — and tells the customer honestly: *"{Owner} will
confirm this with you here."* The note is right that this is enough to make
someone feel handled, and right that it is only honest if the reply actually
comes. So:

**This depends on fixing L13.** Today `book_gig` notifies nobody
(`gigs.py:890-892`); the provider learns halfway through the hold window
(`gigs.py:1364-1398`). An assistant that promises the owner will reply, on top
of a system that never tells the owner anything, is worse than no assistant.
**Fix the notification first.**

**Assistant-books mode:** it creates the real booking against real availability,
confirms to the customer, notifies the owner. Never double-books — check
availability at the moment of writing, not at the moment of asking.

## A6 — How it gets better, without learning things nobody approved

The naive version — feed every past transcript back in — is wrong twice. It
learns from one-off exceptions the owner made for one customer, and it moves
personal information between conversations.

**The assistant proposes; the owner approves. Nothing enters its knowledge
without a human saying yes.**

The loop:

1. It hits a question it can't answer. It says so, and escalates.
2. The owner answers the customer in their own words.
3. The assistant drafts a reusable version of that answer and shows it to the
   owner: *"Add this to what I know? — 'We don't work Fridays after 1pm.'"*
   Approve, edit, or dismiss.
4. Approved answers join the knowledge base. Dismissed ones are never asked
   about again.

**Repeat questions surface as a to-do**, which is the visible value to the owner:

> *"Customers asked 4 times whether you work on Fridays. Want to answer it once?"*

That is a better pitch for the whole feature than anything about AI.

**Hard rule: nothing from one customer's conversation is ever repeated to
another** unless it went through owner approval as a general fact. Personal
details never propagate.

## A7 — The owner's view

A tab in the dashboard: every conversation the assistant had, most recent first.

- Full transcript, both languages where relevant.
- Clear marking of which turns were the assistant and which were the owner.
- **"The assistant couldn't answer this"** flagged prominently — those are the
  lost customers, and they are the reason to open this tab.
- Take over mid-conversation, one tap, from inside the transcript.
- Outcome per conversation where known: booked, escalated, abandoned.

## A8 — Disclosure. Not negotiable.

**The customer must know they are not talking to the owner, from the first
message.** Labelled on every assistant turn — not once at the top of a thread
someone scrolled past.

- Customer-facing name: **"{Business} assistant"** / **"העוזר של {Business}"**.
- It never claims to be a person, never uses "I" in a way that implies it is the
  owner, and if asked directly whether it is a person, it says no plainly.
- Owner-facing name: **"Your assistant."**

Beyond the ethics: when it gets something wrong, the customer needs to know it
was a machine and not the person they're about to hire.

## A9 — Assistant replies do not count toward the response badge

`avg_response_hours` and the "Replies within an hour" badge
(`shared.py:620-650`, `ServiceCard.jsx:104-115`) must be fed **only by human
replies.**

`docs/marketplace-benchmark-spec.md` rejects Meta's auto-reply feature on exactly
this ground: a fast reply written by us is not evidence the provider is
reachable. Letting the assistant earn the badge would manufacture the one signal
the marketplace asks visitors to trust, and it would do it invisibly.

If anything, the assistant makes L3 easier to fix honestly — it creates far more
chat threads, and human first-replies within them are a real, observable signal.

## A10 — Cost, which is a business decision not an engineering one

The source note reports about 4 cents per conversation. **Costed properly against
Anthropic's August 2026 pricing (Haiku 4.5, $1/$5 per million tokens) with prompt
caching on the fact sheet, it is ~0.8 cents** for a typical six-turn exchange;
~3 cents for a long twelve-turn conversation against a large catalog.

| Businesses opted in | Conversations/mo | Typical | All long |
|---|---|---|---|
| 30 | 240 | $2 | $8 |
| 100 | 1,200 | $10 | $38 |
| 300 | 6,000 | $49 | $192 |
| 1,000 | 25,000 | $204 | $801 |

**Ruling (Tzvi, 27 Aug 2026): owners never pay.** The site absorbs it. At the
scale that matters for the next year this is a rounding error, and it stays that
way until roughly a thousand active businesses.

**The real risk is not volume, it is abuse** — one scraper hammering the endpoint
costs more than a thousand real customers. Size the caps against that, not
against the table above. Review the decision at $100/month, with data.

This is still the first per-use marginal cost on a platform whose entire promise
is free — so the caps are not an optimisation. They are what lets the promise
hold.

### The governing rule

**Every cap ends the same way: the conversation goes to the owner.** Never an
error, never "limit reached", never a cheaper degraded answer. From the
customer's side it reads as *"let me get {owner} for you"* — which is what a good
human assistant does anyway when a conversation outgrows them.

**The customer never sees the word *limit* and never learns a cap exists.**

### The five caps

**1. Turn cap — 10 assistant turns per conversation.** The one that matters most,
and good UX independently of cost: an assistant still going at turn twelve should
have handed over five turns ago. This bounds spend hard — **one conversation can
never exceed ~2.6 cents**, even against a large catalog:

| Assistant turns | Typical (2k facts) | Heavy (5k facts) |
|---|---|---|
| 6 | 0.8c | 1.6c |
| 10 | 1.4c | 2.6c |
| 15 | 2.5c | 4.3c |

**2. Per visitor, per business — 3 conversations a day.** A real customer does not
need a fourth fresh conversation with the same bakery in one day.

**3. Per visitor, site-wide — 10 conversations a day.** Stops one person touring
every business on the site.

**4. Signed-out visitors — 4 turns, then sign in or hand off.** The cheapest
anti-scraper measure available, and it costs a genuine customer almost nothing:
someone four turns into a real enquiry will sign in.

**5. Per business, per month — soft ceiling, default 150 conversations.** On hit,
that business's assistant goes quiet for the rest of the month and escalation
takes over. **Tell the owner immediately, as good news:** *"Your assistant handled
150 conversations this month — messages are coming straight to you for now."*
Admin-raisable per business.

Plus a hard **rate limit per session and per IP** — a few messages a minute. That
is the actual abuse surface; caps 1–5 bound honest use.

### Why 150

Worst case, if every business maxed its monthly cap *and* every conversation ran
long:

| Cap / business / month | 100 businesses | 300 | 1,000 |
|---|---|---|---|
| 50 | $130 | $389 | $1,297 |
| **150** | $389 | $1,168 | $3,892 |
| 300 | $778 | $2,335 | $7,785 |

Nobody will max it — real usage is roughly a tenth of that — but the cap makes the
number knowable in advance instead of discovered in an invoice.

**Above all of it: a global monthly budget with a kill switch.** Per-business caps
bound the typical case; only a global ceiling bounds the catastrophe. Alert the
admin at 90%; at 100% every assistant goes quiet and the site falls back to
today's behaviour, which works perfectly well.

### Also

- Cheapest adequate model — retrieval and short replies, not reasoning.
- **Prompt-cache the fact sheet.** It is most of the input and does not change
  between turns; this is roughly half the bill.
- **Retrieve the relevant subset of a catalog, never ship the whole thing.** A
  business with 200 products is the difference between the two columns above.
- Cost visible in the admin, per business, from day one.

**Ruling (Tzvi, 27 Aug 2026): owners pay nothing, ever. The caps exist so that
stays true** — not so the feature can be sold later.

---

## Order

1. **Fix L13** (booking notifies the owner) — everything here rests on it
2. **A1** the knowledge layer: structured data + FAQs, retrieval only, "I don't know"
3. **A8** disclosure · **A4** escalation — before it ever talks to a real customer
4. **A2** conversation design · **A3** bilingual
5. **A5** handoff, owner-confirms mode only
6. **A7** the owner's transcript view
7. **A6** the approval-gated learning loop
8. **A5** assistant-books mode
9. **A10** caps and cost reporting — but the caps ship with step 2

## Constraints

- **Off by default. Opt-in only.** No exceptions, no "on with notice."
- It states facts or says it doesn't know. It never estimates a price or a date.
- Escalation visible in every turn.
- Bot replies never feed the response badge.
- Every string in `en.js` and `he.js`; the assistant answers in the customer's
  language per message. Verify RTL at 1280 / 768 / 375.
- `brand/design-tokens.css` is law. Assistant turns must be visually
  distinguishable from human turns without relying on colour alone.
