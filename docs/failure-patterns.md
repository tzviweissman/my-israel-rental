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

### 1b. The same shape, with *authorisation* on one side (2026-08-02)

A fourth instance, worth calling out separately because the two sides weren't
a payload and a reader — they were a **permission check and a button**.

The API authorises every booking action on the caller's *relationship to that
booking* (`owner_id`, `renter_id`). The dashboard decided which buttons to
show from `user.role`. Both are reasonable sentences. They are not the same
question, and the difference is invisible until someone hits it:

| Frontend gate | Backend check | Result |
|---|---|---|
| `user.role === 'owner' \|\| 'manager'` | `booking.owner_id == user_id` | Cancel button on bookings you don't own → **403** |
| `user.role === 'renter'` | `booking.renter_id == user_id` | **No cancellation button at all** for an owner/manager/admin who books a place |

The second one is the nastier direction. A 403 at least produces an error
someone can report; a button that never renders produces a user who assumes
the feature doesn't exist. It was found only because the site owner happened
to test a booking from their own non-renter account.

Note that `BookingChip` already had the renter side right and the lister side
wrong — so "we fixed this pattern once" was not true even within one feature.

**What catches it:** `tests/test_booking_actions_contract.py` parses the
authorisation checks out of `routes/bookings/cancel.py` and fails if either
component reintroduces `user.role`. The rule it enforces is deliberately
blunt — no role checks at all in those files — because the narrower version
("role may be read, just not for a can* flag") is exactly the rule that was
being followed when both bugs shipped.

**Rule:** the UI's condition for *offering* an action must be the same
predicate the server uses to *allow* it. If the server says `owner_id`, the
button says `owner_id`. Role is a different question and answers it wrong.

---

### 1c. The error path had the same bug, and hid the first one (2026-08-02)

Denying a cancellation request blanked the page. Two bugs stacked, and the
order matters:

1. `/deny-cancel` takes a body field named `denial_reason`. `/cancel` and
   `/request-cancel` take `reason`. The hook posted `reason` to all three, so
   **every** denial returned 422.
2. FastAPI's 422 body is `{"detail": [ {...}, ... ]}` — an **array of
   objects**. The app does `toast.error(err.response?.data?.detail || '…')`
   ~115 times. An array is truthy, so the fallback never runs, the array
   reaches sonner, and React throws *"Objects are not valid as a React
   child"*. `<Toaster/>` is mounted at the root **outside** the route-level
   boundary, so this unmounted the entire app.

The first bug was ordinary and would have taken minutes to find — *if* the
error had been displayed. The second turned it into a blank white page, which
is the one symptom that carries no information at all. **An error path that
can itself crash converts every small bug downstream of it into the same
unreportable one.**

Note the near-miss in the fix: the obvious move was to wrap `<Toaster/>` in
the existing `ErrorBoundary`. That component calls `useLocation()` and
`useNavigate()`, and there is no `<Router>` at that level — it would have
crashed the app on startup. Hence `SilentBoundary`, which needs no context and
renders `null`, because a failed toast should cost you the toast.

**What catches it:** `tests/test_cancel_body_fields_contract.py` compares each
endpoint's `Body(...)` field to what the hook posts. `utils/apiError.js`
guarantees a renderable string for every shape — string detail, 422 array,
structured 409, network failure, unknown.

**Rules:**
- Never pass a value straight from the wire to anything that renders it.
  `|| fallback` does not sanitise a type; it only catches falsiness.
- Boundaries belong around *root-level* UI too, not just routes. Ask what is
  mounted outside the boundary you already have.
- Request bodies are a contract in the same way response payloads are. Three
  sibling endpoints with three field names is a trap regardless.

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

---

# Two more, from 2026-09-02

Both found while verifying something else, and both had passed every check
that existed.

## 9. A re-export gives the module no binding

`App.js` decides the API base for the whole app. Consolidating twelve
copies of that decision into `lib/apiBase.js` left this line behind:

```js
export { API } from './lib/apiBase';
```

It compiles, and every importer of `App.js` gets a working `API`. But
`export … from` **forwards** a binding without creating one locally, so
sixteen lines further down

```js
const response = await axios.get(`${API}/auth/me`, …);
```

threw `ReferenceError: API is not defined`. That call sits in
`fetchCurrentUser`, whose `catch` calls `logout()`. So the failure did not
look like a broken API call — it looked like **every signed-in visitor
being signed out by their next page load**, with a console error nobody
was reading. It shipped, and ran in production until somebody tried to
photograph a logged-in screen.

Nothing caught it. CRA's ESLint does not run `no-undef` on module scope,
the bundle built clean, and `scripts/test-api-base.mjs` passed because it
looked for the *substring* `from './lib/apiBase'` and found it.

**The tell, if you ever have to find one of these in a minified bundle:**
free variables are the only identifiers a minifier cannot rename. Local
ones become `d`, `s`, `t`; this stayed literally `API`:

```js
const d=async()=>{try{const r=await s.A.get(`${API}/auth/me`,…
```

**Rule:** import it, then export it. `import { X } from …; export { X };`
Never `export { X } from …` in a file that also uses `X`.
`scripts/test-api-base.mjs` now fails on exactly that combination.

## 10. The check was satisfied by the comment explaining the bug

The guard written for #9 asks whether a file that uses `API` also imports
it. It passed on `App.js` — while `App.js` was still broken — because the
regex matched this, four lines above the defect:

```js
// because ~100 modules already import { API } from '../App'.
```

Nothing about the check was wrong except that it read prose as code. It
would have shipped as a permanently green check over a permanently broken
app, which is worse than no check.

**What surfaced it:** running the check against the broken file on
purpose, and *expecting a failure*. That is the same discipline as #7 —
a check must fail when the thing it checks is absent — but pointed at a
new place: not "does it still collect anything", but "does it still say no
when the answer is no".

**Rule:** a new check is not finished until it has been run against the
defect it was written for and seen to fail. Strip comments before scanning
source; `scripts/test-i18n-parity.mjs` had the same false positive from a
comment that discussed a deliberately-invalid key.

## 11. A list validated as a unit

`GET /api/properties` declares `response_model=list[PropertyOut]`, and
`PropertyOut` requires `area` and `property_type`. FastAPI validates the
whole list before sending any of it, so ONE document missing either field
turned the endpoint behind /stays, the home page and every search into a
500 for every visitor - while `?page=1&limit=2` kept answering 200,
because that page happened not to include the bad row. Locally the bad
rows were twenty-three seeds from a test whose cleanup was not in a
`finally`; in production an import or an admin tool writing a partial
document would do exactly the same.

**Rule:** a collection endpoint validates per row and drops what does not
fit, logging the id at warning. The page works and the data problem is in
the logs, instead of the data problem BEING the outage. And test seeds
are cleaned up in `finally`, because the row that leaks is the row that
was written before the assertion that failed.

## 12. The empty state passed the check the full state would have failed

A locale-aware title helper was wired into the jobs board's row component
without being handed the `i18n` instance it needs; the page component had
it, the row did not. Every row threw `ReferenceError: i18n is not defined`
the moment a job existed. The build compiled (CRA does not fail the build
on `no-undef`), the static checks passed, and every browser check that
existed opened pages with nothing on them - the auth walk, the listing
page, the logo flow - none of which renders a job row. It shipped, and an
overnight audit caught it before a person did.

**Rule:** a page with a list has two states and the check has to render the
FULL one. A browser check that only ever sees the empty state is a check of
the empty state. `scripts/check-jobs-board.mjs` posts a job first, then
loads the board; the same discipline belongs to any check on a list page.
