# Business page customization

Written 26 Aug 2026, against the code as it stands. **The original brief for
this work existed only in a chat window and was never committed** — along
with four sibling specs (`business-page-spec`, `business-catalog-spec`,
`recommendations-spec`, `perks-and-features-spec`), two of which are cited by
name from inside the code. This file exists so the reasoning survives the
conversation.

The gate on all of it, stated by Tzvi before any control was designed:

> The business page must already look excellent with every customization
> field empty.

That has been met — `BusinessCoverBand` draws a designed band from the
business's own name, and `GoodToKnow` renders nothing at all rather than an
empty heading. Everything below is *additive*: a business that sets none of
it must look exactly as it does today.

---

## The bar, set by Tzvi

> I want their business page to be beautiful, so they don't feel they need a
> separate website — or even if they have one, they'd be happy to send our
> link to their page. Which spreads awareness.

That is a sharper target than "customization", and it decides several
arguments below. The question to ask of any change here is not *can the
owner adjust this?* but:

**Would this owner send this link to a customer instead of their own site?**

An owner only does that if the page passes three tests at a glance:

1. **It looks like theirs**, not like a row in a directory. Hence the accent
   and the cover.
2. **It answers the customer's question without a reply** — what they do,
   what it costs, when they are open, how to reach them, how to pay.
3. **It survives being pasted into WhatsApp.** The link preview *is* the
   page for the first two seconds; a broken or generic preview means the
   link never gets sent twice.

And the compounding reason to care: every owner who sends that link is
introducing a customer to this site. A page good enough to be shared is the
cheapest distribution there is.

## Choices, not freedom

The owners this serves — a baker, a mover, an electrician — already have an
identity, and the page should carry some of it. But a page that can be made
ugly will be, and an owner will not send a link to something that embarrasses
them.

So: **a closed set of options that cannot produce a bad page**, rather than a
colour picker. Every combination has to look deliberate.

---

## K1 — Four accent tints

One field, `accent`, holding one of four named values. Not a hex.

| Name | Token | Reading |
|---|---|---|
| `stone` | `--bg` limestone `#EFE9DC` | The default. Neutral, editorial |
| `sea` | `--brand-primary` `#1E5F8C` | Calm, professional |
| `deep` | `--brand-primary-deep` `#123B57` | Serious, premium |
| `gold` | `--gold` `#C9A227` | Warm, hospitality, food |

The first draft of this table said "clay — warm terracotta" and "olive —
muted green". **Both were inventions**, and the design system is locked:

- Terracotta is not in `brand/design-tokens.css`, and adding a colour to
  serve one feature is how a locked palette stops being one.
- **Green is functional on this site** — status, verified, available. An
  accent green would teach a visitor that green means "this business chose
  green" on one page and "available" on the next.

So all four are existing tokens. Four, not twelve: a long list makes the
choice feel consequential and invites the owner to hunt for their exact
brand colour, which is a promise this cannot keep.

The values live in ONE place on the frontend (`utils/businessAccent.js`).
The database stores the NAME only — never a hex — so a palette change is a
code change, and no business can end up holding a colour the system has
retired.

The accent drives the fallback cover band and the section rules. It does
**not** drive buttons — the CTA stays brand blue everywhere on the site, so
a visitor learns one colour means "act".

## K2 — Adaptive scrim

A business can upload a cover photo (`cover_url`). Their name and logo sit
over its lower edge.

A fixed dark overlay is the usual answer and it is wrong here: over a dark
photo it makes mud, and over a bright one it is not enough. The overlay must
be derived from the photo.

- Sample the cover's lower band and compute its perceived luminance.
- Choose a light-on-dark or dark-on-light treatment from that.
- The scrim is a gradient confined to the text's own area, never a wash over
  the whole picture — the owner uploaded a photo to be seen.
- **Fallback:** if the photo cannot be sampled (cross-origin, not yet
  loaded, decode failure), use the light-on-dark treatment. It is the safe
  default: white text with a scrim is readable over almost anything, and the
  failure mode of guessing wrong the other way is unreadable text.

Verified by measured contrast, not by eye — the same rule as
`scripts/check-tile-contrast.mjs`.

## K3 — Live preview

The editor shows the real page component, with the real business data, and
the pending edits applied — not a mock of it. Two renderers of one design
drift, and the one that drifts is the one the owner is looking at.

Changes apply on change, save is explicit, and leaving without saving
discards. An owner must never wonder whether what they are seeing is live.

## P1 — Owner-held payment links

Let a business put its own payment link on its page — Bit, PayBox, Stripe,
PayPal, Meshulam, and the Israeli bank apps.

**We do not process the money.** The link belongs to the owner, the payment
happens on the payment provider's own domain, and the site takes nothing.
That is consistent with the standing position: free to list, free to be
found, no commission.

### The allowlist is the whole feature

An arbitrary owner-supplied URL rendered as a button on a page we host is
an open redirect with our name on it. Somebody's "payment link" pointing at
a phishing page would be indistinguishable, to a visitor, from a real one.

So:

- **A closed allowlist of payment domains.** Anything else is refused at the
  API, with a message naming what is accepted.
- Match on the **registrable domain**, and match subdomains only as
  `*.domain` — never with `endswith`, which lets `evil-paybox.com` through.
- **HTTPS only.** A payment link over plain HTTP is not one.
- Refused at the model, so a second client cannot bypass the form.
- Capped in number. Six payment options is not a business, it is a warning.

### What the visitor sees

The link is labelled with the provider it goes to, so nobody clicks a
generic "Pay" and lands somewhere unexpected. It is not styled as the
primary CTA — messaging the business is still the main action, and a
payment button competing with it would push people to pay before they have
agreed what for.

---

## Order

1. **K1** accent tints — self-contained, visible immediately
2. **K2** adaptive scrim — needs `cover_url`, which K1's work adds
3. **P1** payment links — independent of the visual work
4. **K3** live preview — ties the controls together, so it comes last

## Constraints

- `brand/design-tokens.css` is law. No invented colours.
- Strings in both `en.js` and `he.js`; verify LTR and RTL.
- Every default must leave the page looking exactly as it does today.
- The allowlist needs a **test**, not a comment — including the
  `evil-paybox.com` case.
