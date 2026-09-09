---
name: dead-ends
description: Audit that every control goes where it says and that every promise has a place to be kept. Finds broken destinations, dead-end prompts, no-op buttons, and orphaned capabilities (model fields, endpoints and status values with no UI). Use when asked to check buttons, links, navigation, dead ends, "does this actually work", or as a periodic routine.
---

# Dead ends and broken promises

Two questions, asked in both directions:

1. **Forward:** does every control take you where its label says?
2. **Backward:** does every promise have a place where it can be kept, and does
   every capability the code has a way to be reached?

The second is the one that finds the bug nobody reports. The dashboard says
"add a logo", you click it, and the page it opens has no logo field. Nothing
errors. Nothing 404s. The user simply concludes the site is broken and leaves.

**This has happened here repeatedly.** Documented cases: "Message on
MyIsraelRental" opened a form whose endpoint rejected the request with a 400 for
most listings; `_normalize_category` existed with a comment promising bookmarked
links still worked, and was called from nowhere; `GigPatch.status` accepts
`paused` and no frontend has ever set it; the Requests API accepts `condition`,
`min_price`, `max_price` and `include_sold` and the board sends none of them;
two admin moderation endpoints work and nothing in the frontend calls them; a
jobs digest endpoint exists with no scheduler while the UI promises a daily
email. **Assume more exist.**

---

## Part 1 - Build the route table first

Everything else depends on knowing what routes exist.

```bash
rg -n "path=" frontend/src/App.js
```

Record every route, its component, and any guard on it (auth, role, ownership).
Note which are parameterised and what the parameter must be.

## Part 2 - Forward: every control, and where it actually goes

Enumerate every navigable control:

```bash
rg -n "<Link|to=\{|navigate\(|href=|window.location" frontend/src --glob '*.jsx' --glob '*.js'
```

For each one, resolve the destination and record a verdict:

- **Route does not exist.** The path matches nothing in `App.js`.
- **Route exists but the guard will bounce them.** Auth-only, role-only, or
  ownership-checked, with no return-to so the destination is lost after sign-in.
- **Anchor target does not exist.** `href="#something"` where no element has that id.
- **Query parameter is ignored.** A link passes `?tab=x` or `?edit=y` and the
  destination never reads it. **This is the most common cause of the dead-end
  promise** - the link is right, the deep-link handling was never built.
- **External link** with the wrong protocol, a typo, or no `rel="noopener"`.
- **Handler does nothing.** `onClick` that is empty, logs, or sets state nothing reads.
- **Destination rejects the action.** The page loads, the action fires, the API
  returns 4xx for a state the UI allowed. Check the endpoint's own guards against
  the conditions under which the button renders.

## Part 3 - Backward: does the promise have a home?

This is the part that finds the reported bug, and it is the part that gets skipped.

**Find every place the UI tells someone to do something**, then verify the thing
can actually be done at the destination:

- Setup and completeness checklists (dashboard, business page completeness, any
  "your page is N% complete")
- Empty-state CTAs
- Contextual tips and onboarding prompts
- Toasts and inline hints that say "add", "set", "upload", "choose", "connect"
- Email copy that links back into the app

For each: **open the destination and confirm the field or control is present,
visible in that user's role and state, and enabled.** A field that exists but is
hidden behind a collapsed section the prompt does not open still counts as a
dead end.

Report as: *the prompt, its exact text, where it links, and what is actually
there.*

## Part 4 - Orphaned capabilities

The systematic version of the same bug, from the other end.

**Model fields with no editor.** For each model in `backend/routes/` and
`backend/models.py`, is there UI that writes it? Recent examples: `faqs` on gigs,
`kosher_certification`, `delivery_note`, `lead_time`, `payment_note`,
`founded_year`. A field nobody can fill is a feature that does not exist.

**Enum values nothing can set.** Grep every status and mode enum, then check the
frontend for each value. `GigPatch.status` accepting `paused` with no pause
button is the canonical case.

**Endpoints with no caller.** For every route in `backend/routes/`, grep the
frontend for its path. Flag anything unreferenced. Some are legitimately
external, webhooks or admin-only tooling; say which, do not just list them.

**Query parameters the API accepts and no client sends.** Compare each endpoint's
parameters against what the frontend actually sends. This is where filters go to
die.

**Components imported by nothing.** 

```bash
for f in frontend/src/components/**/*.jsx; do n=$(basename "$f" .jsx); c=$(rg -l "\b$n\b" frontend/src --glob '*.js*' | grep -v "$f" | wc -l); [ "$c" -eq 0 ] && echo "ORPHAN: $f"; done
```

**Scheduled work with no scheduler.** Any function that looks like a job, digest,
sweep or reminder: is it started in `backend/server.py`? Grep
`asyncio.create_task` and compare.

## Part 5 - Verify by clicking, not by reading

Static analysis will produce false positives. Confirm the important ones.

```bash
node scripts/screenshot.mjs   # check the file for its arguments
```

The repo has ~30 `scripts/check-*.mjs` and `scripts/shot-*.mjs`; run the ones
covering the areas you flagged. If a check needs a dev server or a browser binary
you do not have, put it in "Not checked" rather than guessing.

**Prioritise clicking these, because they are where money and trust live:**
the primary contact or message button on every listing type, every checklist item,
every empty-state CTA, the sign-up and sign-in returns, and anything an email
links to.

## Part 6 - The report

Write `docs/audits/YYYY-MM-DD-dead-ends.md`.

```
# Dead ends - {date}

## Broken: goes nowhere or errors
## Dead-end promises: destination lacks the affordance
## Wrong destination
## Orphaned capabilities
## Verified working
## Not checked (and why)
```

Rules:

- **Every finding: file:line, the control's exact label, its destination, and what
  is actually there.** Never "some links may be broken."
- **Every finding needs the fix**, and say which of the two it is: build the
  missing affordance, or change the promise. Both are valid. Removing a checklist
  item is a legitimate fix when the feature genuinely does not exist yet.
- **"Verified working" is required.** A list of only failures gives no sense of
  coverage and cannot be trusted.
- **Distinguish "this is broken" from "I could not verify".** Do not report a
  suspicion as a defect.
- Do not fix during the audit. Report, get approval, then fix.

## Part 7 - Make it cheaper next time

If you find more than a handful, write `scripts/check-dead-ends.mjs` that does the
mechanical parts: parse the route table from `App.js`, resolve every `to=` and
`navigate()` target against it, and fail on any unresolvable one. Route resolution
and orphan detection automate cleanly. Whether a destination *contains the promised
affordance* does not, and stays a human-judgement pass.

A check that runs in CI catches the next one on the day it lands, which is the
only time it is cheap to fix.
