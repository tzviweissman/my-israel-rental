# Provider lead tracking

## Why

Provider subscriptions are the paid side of the marketplace. Until now a
WhatsApp inquiry left no trace: the deep link went straight from the
visitor's browser to `wa.me`, so nothing could tell a provider — or us — how
many customers a gig actually produced. That makes the subscription
impossible to justify with numbers, and it blocks the provider analytics
dashboard entirely.

## How it works

`GET /marketplace/gigs/{gig_id}/contact?text=<prefilled message>`

1. Looks up the gig (404 if it doesn't exist).
2. Resolves the number with the same precedence as the gig detail payload:
   per-gig `whatsapp` → provider record `whatsapp` → account-level number via
   `utils.user_contact.user_whatsapp`.
3. Inserts a `lead_events` document.
4. `302` to the `wa.me` link.

The frontend CTA (`openWhatsApp` in `pages/GigDetail.jsx`) opens this URL
instead of `wa.me`.

### `lead_events` shape

```
_id            uuid4 string
type           "whatsapp_click"     — the only type today; more will follow
gig_id         gig this lead is attributed to
provider_id    gig.provider_user_id, denormalised so per-provider rollups
               don't need a join back to gigs
created_at     ISO 8601 UTC string  — matches the rest of the codebase
referrer_host  hostname only, or ""
```

Indexed on `(gig_id, created_at desc)` and `(provider_id, created_at desc)`
in `server.py`, which is the shape the dashboard will query.

## Decisions worth knowing

**A redirect, not a POST-then-open.** Opening a window after an `await` gets
killed by popup blockers, and a fire-and-forget beacon loses the lead
whenever it fails. A redirect makes the click and the measurement the same
navigation.

**Logging never blocks the lead.** The insert is wrapped; any failure still
redirects. A broken analytics write must not cost a provider a customer.

**The destination is built server-side.** The endpoint takes a *message*, not
a URL. Accepting a caller-supplied destination would make this an open
redirect that anything could use to bounce traffic through our domain.

**Only the referrer host is stored.** Our own URLs carry filter state in the
query string — and on the rentals side sometimes a searched address — so the
full referrer isn't kept. No IP, no user-agent, no new PII.

**No dialable number → back to the gig page**, not an API error. The visitor
lands where the in-platform inquiry flow is. In practice the button doesn't
render at all in that case; this covers a number removed between page load
and click.

## Gotcha found while building this

`utils/whatsapp.py`'s `_to_whatsapp_address` (the Twilio send path) stripped
non-digits and prepended `+`. A number stored in Israeli national format —
`050-123-4567`, which is how essentially every local user types it — became
`whatsapp:+0501234567`: valid-looking and undeliverable. The trunk `0` has to
be *replaced* by the country code, not kept alongside it. It now delegates to
`utils/whatsapp_link.py`.

That module is a deliberate twin of `frontend/src/utils/whatsappLink.js`
(the frontend decides whether to render the button; the backend builds the
redirect target). `tests/test_whatsapp_link.py` pins the shared cases and
asserts the constants still agree across both files, because two
implementations of one rule is exactly how the `phone` /`whatsapp_number`
mismatch went unnoticed.

## Not done yet

- No read endpoint. The dashboard that consumes this is separate work.
- Only `whatsapp_click`. In-platform inquiries and profile views should
  become additional `type` values in the same collection rather than new
  collections.
- No dedupe. One person clicking three times logs three events; whether that
  is three leads is a question for whoever builds the dashboard.
