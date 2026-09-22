# Business network — spec

The build brief is `docs/business-network-implementation-prompt.md`. This file is that brief adapted to what the code actually is, phase by phase, and it is the one to trust where the two differ.

Status: **Phases 0, 1 and 2 done**; the vocabulary grew on 21 Sep 2026 (appointment, lead and schedule triggers; notify-me and message-the-customer actions; starter cards), which covers Phase 3's `schedule` and item H. `request.posted_matching` and Phases 4 to 9 not started.

---

## Phase 0: what the code says

The brief asked for these to be found, not assumed.

| Question | Answer from the code |
|---|---|
| The "user owns this business" helper | `_owned()` in `routes/marketplace/businesses.py:287`. `orders.py` keeps an identical local copy, `_owned_business()`, deliberately, so one router does not import another's private helper. `connections.py` follows that precedent with its own three-line copy. Consolidating all three into `utils/businesses.py` is a separate tidy. |
| Where order status changes converge | `_transition()` in `routes/marketplace/orders.py`. The owner (`PATCH /orders/{id}/status`), the staff board and the courier all call it, and since 16 Sep it writes with a compare-and-swap. **This is the Phase 2 hook point: one line after the write succeeds.** |
| Do standing orders execute on a loop? | **No.** `generate_standing_orders()` (`orders.py`) makes the next week's occurrences whenever the order board is read, or a standing order is saved. There is no scheduler. Phase 3 therefore adds the first real one, and should fold standing orders into it rather than run beside it. |
| Is `response_time_bucket` computed? | Yes: `_response_bucket(provider)` in `gigs.py`, from the provider's rolling reply average. Phase 4 reuses it. |
| What request matching keys on | The daily digest (`_send_matching_digest`, `requests.py`) matches a request to someone who has a published gig **in that category**, or a property **in that area**. Area uses `area_id` from `utils/area_filter.resolve_area_id`. Phase 3's `request.posted_matching` should reuse this verbatim. |
| WhatsApp: send, or build a link? | Both exist. `utils/whatsapp_link.py` builds `wa.me` links. `utils/whatsapp.py` sends through Twilio. Orders today use neither for customers: they send email through `orders._email()` and in-app bells through `orders._notify()`. Phase 6 (J) decides which. |
| The staff-link token in production | Not checked. Reading production needs Tzvi's approval each time. Matters only for Phase 8 (G). |

### A finding that changes the brief

**Couriers are people, not businesses.** `businesses.couriers[]` holds a `user_id` and an email for each courier: a person. A connection is between two businesses. So an existing courier can only become a connection if that person runs a business of their own.

Local dry run of the migration, 18 Sep:

```
active_couriers    3
created            0
no_business        3
```

None of the three runs a business. If production looks the same, the "shop to courier" story in Phase 2 needs couriers to add a business first, or needs automations that can target a courier who is a person. **That is a product decision for Tzvi before Phase 2.**

---

## Phase 1: connections (built)

### Data

`business_connections`, one document per pair of businesses:

```
{ _id, a_id, b_id,              // the two business ids, sorted; unique together
  requested_by,                 // which of the two asked
  status,                       // pending | accepted | declined | disconnected
  note, relationship,           // relationship: supplier | customer | courier | partner
  created_at, responded_at, updated_at,
  migrated_from? }              // "couriers" on rows the migration made
```

The unique index on `(a_id, b_id)` is what makes "two businesses have one relationship" true, rather than a check-then-insert that two taps could race.

### Endpoints (all under `/api/marketplace`)

| | |
|---|---|
| `GET /businesses/{id}/connections?status=` | Accepted and pending both ways by default, each with the other business's public card, plus counts. |
| `POST /businesses/{id}/connections` `{target_business_id, note?, relationship?}` | Ask. Resending is idempotent. **A request that crosses one already sent the other way is an accept**: two businesses that both pressed Connect agree. A declined or disconnected pair reopens as a fresh request. Rate limited, 30 an hour per business. |
| `POST /connections/{id}/accept`, `/decline` | Only the business that was asked. |
| `POST /connections/{id}/disconnect` | Either side ends an accepted connection; the asker withdraws a pending one. Pauses every automation on the pair. |
| `PATCH /connections/{id}` `{relationship}` | Either side edits the label. |
| `GET /businesses/{id}/connections/{other_id}` | What the Connect button should say. |

Someone on neither side gets **404, not 403**, so a stranger cannot learn that two businesses are connected. The asked side gets a bell when a request arrives; the asker gets one when it is accepted. A decline is silent, as it is everywhere this pattern exists. `GET /dashboard/summary` gains `network_requests_in`, the badge on the Network tab.

### Screens

- **Network tab** on the dashboard, shown to anyone who runs a business. Partners, Requests (waiting on you, and ones you sent) and Find partners. Find partners sends people to the existing business directory rather than building a second one. A person with several businesses picks which one they are acting as.
- **Connect button** in the header of every business page. It is not shown to people signed out, to someone who runs no business, or to the owner on their own page. States: Connect (with an optional note), Requested with Withdraw, Accept request, Connected with Disconnect.

Checked in a real browser, as two different people: request with a note, accept, both sides see each other as partners. English and Hebrew, 1280, 768 and 375. Tests: `backend/tests/test_business_connections.py`, 13 passing.

### Migration

`backend/scripts/migrate_couriers_to_connections.py`. It only reports unless given `--apply`, and refuses a non-local database without `--production` as well. Only couriers who run exactly one business become connections (accepted, relationship "courier", asked by the shop). It never invents a business and never removes anything: every courier endpoint keeps reading `businesses.couriers[]`. **Not run against production.**

---

## Phase 2: automations (built)

The engine is in `backend/routes/marketplace/automations.py`, hooked into
`orders._transition()`. The screens, 20 Sep 2026:

- **Network → Automations** (`components/dashboard/AutomationsPanel.jsx`).
  One screen for the three things that are one idea: the rules, the
  auto-accept list, and the run log. A rule reads WHEN → order for whom,
  with an On switch, Delete, and Send now on a saved reorder. The form
  validates what the API validates, in the same words, so Save never
  walks into a 400.
- **Auto-accept** sits on the same screen because only the RECEIVING
  business can grant it, and this is that business's screen. Per partner,
  with an amount cap and a per-day cap; empty means no limit. Saved
  through `PUT .../orders/auto-accept`, never through the order settings
  endpoint, which replaces the whole settings object.
- **"from <business>" on the order card** (`OrderCard.jsx`). An owner who
  finds an order they did not take can read why it is there; the title
  says when it was accepted automatically.
- **Courier nudge** (`DeliveriesTab.jsx`). A courier is a person and a
  connection is between two businesses, so a courier who runs no business
  can never be the target of an automation — Tzvi's ruling (option 1, 19
  Sep) is that they add one. `GET /marketplace/courier/me` gained
  `has_business`; the tab shows the nudge only to a courier already
  delivering for someone.

Checked in a real browser: a rule created through the form, an order
driven to `ready`, the delivery appearing on the partner's board with the
chip, auto-accept ticked and the next order landing already accepted, and
the run log showing all of it. English and Hebrew, 1280, 768 and 375, no
console errors and no sideways scroll. Tests: `test_business_automations.py`
12 passing, `test_business_connections.py` 13, `test_store_orders_couriers.py`
12 (which now also holds `has_business`).

## The vocabulary (21 Sep 2026)

Tzvi's ruling: never pre-write automations for every kind of business;
grow two lists and let every word multiply with the others. A rule is
one sentence, WHEN → DO, and the screen stays one sentence long.

| When | Do |
|---|---|
| one of my orders reaches a status | an order appears at a partner (needs an accepted connection) |
| I tap Send | notify me: a bell and an email |
| an appointment is booked / cancelled | message the customer: my words, by email where there is an address and a bell where there is an account |
| a customer taps to message me (a lead) | |
| every week on given days at a time (Asia/Jerusalem) | |

What cannot be said, and why, in the validator's own words: a lead has no
customer to message; a schedule has none either; only an order can be
"sent on as it is". Appointments and leads are matched to a business by
the gig's `business_id`, or every business the provider owns when a gig
predates that field.

**The schedule loop** (`automations.schedule_loop`, started in
`server.py`) is the first real scheduler on the site: once a minute, every
schedule whose `next_run_at` has passed. The next time is written with a
compare-and-swap on the old one before the rule runs, so two replicas
waking together cannot both send Sunday's order. Switching a schedule back
on fires at its next time, not once for every time it slept through.
Standing orders still generate on read; folding them in is a separate
change.

**Starter cards.** Six filled-in forms above the builder, per item H, as
prefills only: the owner edits every word. Two need a partner and say so
until there is one.

Tests: `test_business_automations.py` 18 passing, including next-run
maths across the March clock change and a due schedule firing exactly
once.

## Phases 3 to 9

As in the brief, with the Phase 0 answers above applied.
