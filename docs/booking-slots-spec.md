# Booking slots — holds, expiry, and telling the truth about availability

Written against the code as read 20 Aug 2026: `backend/routes/marketplace/gigs.py`
(create/patch booking), `backend/routes/marketplace/shared.py` (`BookingIn`,
`BookingPatch`, `TierItem`), and `frontend/src/pages/GigDetail.jsx`
(`buildAppointmentSlots`, ~line 884).

Two separate things live here. **S0 is a bug** and is not waiting for any of
the design below. Everything after it is a decision that has been made and
now needs building.

---

## S0 — A pending booking must remove the slot (bug)

Today nothing removes a booked time from the picker. `buildAppointmentSlots`
generates every slot from `weekly_availability` and subtracts nothing, so two
customers can request the same time and both succeed. Neither is told.

- A booking in a **held** state removes its span from availability.
- Held = `pending` or `accepted`. `declined`, `cancelled` and `expired` do not
  hold. `completed` is in the past and irrelevant to future availability.
- Enforced **server-side at create time**, not only by hiding the slot. Hiding
  is a courtesy; the guarantee has to survive two people posting at once.

---

## The decisions

### S1 — Picking a slot holds it, exclusively

A pending booking *is* the hold. First requester gets it; nobody else can
request that slot while it is held. No "both can ask and the owner picks" —
that produces a loser who waited a day to be told no.

### S2 — Holds expire

- **24 hours by default**, configurable **per business**: 12 / 24 / 48.
- 24 because these owners live on WhatsApp and reply fast. Longer just lets
  slots rot. If real data shows replies landing in two hours, shorten it.
- **On expiry**: release the slot and tell both sides plainly — *"No reply, so
  the time is free again — you can request another."* Not "your booking has
  expired", which reads as the customer's fault.
- **Halfway reminder to the owner** (12h on a 24h hold). This single nudge will
  do more for response rate than anything else in this document.
- **Decline frees the slot instantly.** So does cancel.

### S3 — WhatsApp bookings, in this order

**(a) "Block time" in the dashboard — build first.** An owner needs this
whatever else happens: holidays, dentist appointments, walk-ins, jobs taken by
phone. Without it the calendar can never be true, and no amount of clever
WhatsApp handling fixes a calendar that lies. A date, a time range, an optional
note. Blocked time removes slots exactly as a held booking does.

**(b) Ask after the handoff.** The WhatsApp lead is already recorded (see
`/gigs/{id}/contact`). The next day, in the dashboard: *"You sent a WhatsApp
lead for Tuesday 3pm — did it get booked?"* **Yes** creates a confirmed booking
and blocks the slot. **No** does nothing. One tap, no typing. Never ask twice
about the same lead.

**(c) Be honest in the UI.** For WhatsApp-mode listings the site does not know
what was agreed, so it must not present availability as authoritative:

> Times shown are this business's opening hours — confirm with them directly.

A quiet line beats implying a guarantee we cannot keep.

### S4 — iCal, once (a)–(c) land

The structural answer, and it reuses infrastructure this project already owns
(properties have iCal sync):

- **Export**: a business subscribes its MyIsraelRental calendar into Google
  Calendar.
- **Import** — the more valuable direction: pull their existing calendar as
  busy time. An owner who books on WhatsApp already writes it in their own
  calendar. Importing closes the loop with no double entry.

### S5 — Do not force on-site booking

WhatsApp is how this market works. Make on-site booking *better* — instant
confirmation, automatic reminders, no phone number exposed — and let owners
choose it because it is easier. Not by removing the alternative.

---

## What in the current model makes this awkward

Flagged before writing code, because each one changes the shape of the work.

**1. Availability is computed only in the browser.** `buildAppointmentSlots`
lives in `GigDetail.jsx`. The backend has no idea what slots exist for a gig,
so it cannot currently filter or defend one. Two pieces are needed: a
server-side notion of "taken", and an endpoint the picker can read. This is the
single biggest item; S0 is not a two-line fix because of it.

**2. Time is stored as two naive strings.** `preferred_date` is `YYYY-MM-DD`
and `time_slot` is `HH:MM`, with no timezone and **no end time**. Israel
observes DST, so a bare local time is ambiguous twice a year — and one of those
transitions falls inside any 90-day booking window. Holds need a canonical
instant (store UTC alongside the local strings; keep the strings for display).

**3. A booking does not know how long it lasts.** The span comes from
`tier.duration_minutes || gig.slot_duration_minutes`, resolved from the tier
**by name, at read time**. Rename a tier or change its duration and the length
of every past booking silently changes with it. Freeze `starts_at`/`ends_at`
onto the booking at creation; a hold cannot be computed from a moving target.

**4. Nothing prevents a double insert.** There is no unique index on
`marketplace_bookings`, so check-then-insert is racy — exactly the concurrency
S1 promises to prevent. Needs a **partial unique index** over live holds only
(`gig_id + starts_at`, filtered to held statuses), so a declined booking does
not block the slot forever. Same reasoning as the short-link slug index.

**5. There is no expired state.** `BookingPatch` allows
`accepted|declined|completed|cancelled`. Expiry is a *system* transition, not a
provider action, so it needs its own status and must not be settable through
that endpoint.

**6. "Held" is a set, not a flag.** Availability has to test membership in
`{pending, accepted}` every time. Worth a single helper rather than repeating
the list; getting it wrong in one place silently double-books.

**7. WhatsApp gigs cannot hold anything.** `create_booking` rejects them with
400, so there is no record to hang a hold on. That is precisely why S3(a) and
S3(b) exist — (a) gives the owner a way to block time with no customer record
at all, (b) turns a lead into a real booking after the fact.

**8. The hold length belongs to a business; the booking mode belongs to a
gig.** `booking_mode` and `slot_duration_minutes` are gig fields, but S2 makes
the hold configurable **per business**. It goes on the business document, with
gigs inheriting — and a gig whose business is missing falls back to 24h rather
than to nothing.

**9. The daily loop is too coarse.** `availability_reminders_daily_loop` runs
once at 06:00 UTC. A 24h hold with a 12h nudge needs finer resolution — either
a sweep every 15–30 minutes, or lazy expiry evaluated on read with the sweep
only for sending the notifications. Lazy expiry is the safer primary: it cannot
be defeated by a restart.

---

## Order

1. **S0** the bug — server-side "taken" + exclude from the picker
2. **S3(a)** block time, which the owner needs regardless
3. **S3(c)** the honest line on WhatsApp listings — one string, ships anytime
4. **S1 + S2** holds and expiry, including the halfway nudge
5. **S3(b)** the day-after "did it get booked?" prompt
6. **S4** iCal export, then import

## Constraints

- Real availability only. A slot the site cannot vouch for must not be
  presented as bookable.
- Strings in both `en.js` and `he.js`; verify LTR and RTL.
- The exclusivity guarantee needs a **test**, not a comment — two concurrent
  requests for one slot, one winner.
