# Failure patterns from 2026-08-02

Eight bugs in one session, several of them shipped by the same person who
then had to find them. They aren't eight unrelated mistakes — they're about
four shapes, repeated. This is the list, with what actually catches each.

The common thread: **every one of them was silent.** Nothing threw, nothing
logged, no test went red. They were all found by a person looking at a screen
and saying "that's not right."

---

## 1. Two sides of a boundary, each correct alone

The most expensive shape of the day. Three separate instances:

| Writer | Reader | Result |
|---|---|---|
| `PUT /auth/whatsapp` wrote `users.phone` | `GET /properties/{id}` read `users.whatsapp_number` | WhatsApp button dead for **all 47 owners** |
| `/my-gigs` sent 4 provider fields | `MyGigsTab` read `paypal_subscription_status` | Cancelling appeared to do nothing |
| `routes/misc.py` imported from the package | The helper lived in `marketplace/shared.py` | Every accepted upsell 500'd |

Reading either file convinces you it's right. The bug only exists in the gap.

**What catches it:** a test that reads *both* sides and compares.
`tests/test_my_gigs_provider_contract.py` parses the API's field list and the
component's `provider.<field>` accesses and fails on any mismatch.
`tests/test_package_imports.py` does the same for every
`from <package> import <name>`.

**Rule:** when a hand-picked payload feeds a specific consumer, pin them
together. Don't rely on noticing.

---

## 2. A condition that quietly matches nothing

Four blank pages, four causes, one symptom:

- `t()` called in a component with no `useTranslation()` → ReferenceError
- Dashboard default tab `properties`, which providers don't have
- Tab content gated on a role that couldn't be true
- One on logout, still unfound

React unmounts the whole tree on a render error, and there was **no error
boundary anywhere**, so all four looked identical: a white document with no
message and nothing in reach.

**What catches it:** `components/common/ErrorBoundary.jsx`. It doesn't prevent
the bug — it converts "it's blank" into a readable message plus the error
text, which is the difference between a five-minute fix and an hour of
guessing.

**Rule:** every `{cond && <Thing/>}` that is the *only* thing rendering needs
an else. "Nothing rendered" is not a state a user can interpret.

---

## 3. An empty filter means "everything"

`GET /bookings` built `query = {}` and narrowed it for renter, owner and
manager. Every other role — provider, admin, anything added later — fell
through with the empty dict, which in Mongo matches every document. A new
provider account opened its dashboard to **strangers' bookings**.

An empty query is perfectly valid. Nothing failed.

**What catches it:** `tests/test_bookings_scope.py` asserts the *property* —
the filter is never empty, and every leaf value in it is the caller's own id —
across every role including ones that don't exist yet.

**Rule:** deny by default. A new role should be safe automatically, not
because someone remembered to add it. Naming `provider` explicitly would have
left the next one exposed.

---

## 4. Guessing where the data is ambiguous

`normalizeWhatsAppNumber` assumed a number without a leading `0` already
carried a country code. In production that dialled:

- `553304424` (Israeli mobile, no trunk 0) → **+55 Brazil**
- `732 723 8572` (New Jersey) → **+7 Russia**

Renters clicking those reached strangers abroad. Worse than a dead button.

**The fix wasn't better validation — it was removing the ambiguity.** The
phone field is now a country selector plus a number, emitting explicit
`+<dial><local>`. There is nothing left to infer.

**Rule:** when input is genuinely ambiguous, change the input. Validating a
guess afterwards still leaves you guessing.

---

## 5. Environment-blind caching

PayPal plan ids were stored flat with no record of which environment created
them. Switching `PAYPAL_MODE` to live would have handed **sandbox ids to live
PayPal** — and the admin panel, reading the same store, would have shown "All
tiers ready" throughout.

Caught by inspection before the switch, not by anything automated.

**Rule:** anything cached from an external system must be keyed by which
system it came from. Sandbox and live are different systems.

---

## 6. Raw library errors reaching users

Three in one day:

```
Client error '422 Unknown Error' for url '…/subscriptions/I-…/cancel'
Client error '401 Unauthorized' for url '…/v1/oauth2/token'
```

…each with a link to MDN explaining what the status code means in general.
The actual causes — "this subscription was never approved" and "these are
sandbox keys pointed at live" — were in the response body or in our own
context. `str(exception)` carried neither.

**What catches it:** `utils/errors.py`. `api_error()` logs the real exception
and returns a written message, making the right thing the easy thing.

**Rule:** never interpolate a caught third-party exception into an API
`detail`. At the boundary we almost always know more about the likely cause
than the library does — write that down. Our *own* exception types are the
exception: `PayPalCancelError` composes a message naming the PayPal issue,
which is exactly why that class exists.

---

## 7. A check that silently stopped checking

`test_type_coverage.py` looked for `mypy` on PATH. It was installed in the
venv, so the check skipped itself on **every run and reported success** while
137 type errors accumulated — including the ImportError in #1.

Same shape, smaller stakes: an area census piped through `head -45` on a
49-row list silently dropped four spellings and a whole neighbourhood, and
the resulting mapping shipped with gaps.

**Rule:** a check must fail if it stops checking. Both new test files assert
they collected a non-empty set before asserting anything about it — a rename
that breaks a regex turns the suite red, not green.

---

## 8. Reporting verification you didn't do

Said "build clean with no warnings" several times while reading a truncated
tail of the log. There were 23 pre-existing warnings throughout. The
substance held — none were mine — but the claim was unearned.

**Rule:** quote the check that was actually run. "No warnings in the files I
touched" is a different, verifiable claim from "no warnings".

---

## The through-line

Six of these eight were **invisible by construction**: an empty query, an
undefined property, a skipped check, a missing key, a guess that looked like a
value. Type checkers and unit tests don't see any of them, because nothing is
wrong locally.

What does work, and what the new tests do:

1. **Compare the two sides** that have to agree — payload vs consumer, JS vs
   Python, writer vs reader.
2. **Assert the safety property**, not the shape — "never unscoped" survives a
   refactor that changes the query.
3. **Make the collector fail loudly** if it collects nothing.
4. **Make silent states visible** — the error boundary doesn't stop crashes,
   it stops them being unreportable.
