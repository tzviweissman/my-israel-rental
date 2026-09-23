# Verified reviews

Built 23 Sep 2026 on `feature/verified-reviews`. Two sources only, and nothing a
business can type in, edit, hide or remove (FTC 16 CFR Part 465):

- **Verified reviews**: written by a guest after a finished booking on the site.
- **Google reviews**: imported, all of them or none, from the business's own
  Google Business Profile.

Code: rules in `backend/utils/reviews.py`, Google in `backend/utils/google_reviews.py`,
endpoints and the two daily jobs in `backend/routes/reviews.py`, pages in
`frontend/src/components/reviews/ReviewsSection.jsx` and `frontend/src/pages/WriteReview.jsx`,
the admin queue in `frontend/src/components/admin/ReviewsModerationTab.jsx`, the
connect card in `frontend/src/components/dashboard/GoogleReviewsCard.jsx`.

## Decisions (Tzvi, 23 Sep 2026)

- A **stay** has earned a review when the owner confirmed it, it was not cancelled,
  and the checkout date has passed. Bookings carry no "paid" or "completed" state;
  payment happens off the site.
- A **service booking** counts once the business marks it completed. Store orders
  do not count: the customer there has no account to check.
- **Old service reviews** (`marketplace_reviews`, which anyone signed in could post):
  those whose writer has a completed booking of that service become verified; the
  rest stay in the old collection, untouched, and are not shown while the flag is on.
- **Disconnecting Google** takes every imported review off the page together
  (hidden, not deleted, with an audit entry). Reconnecting shows them again.

## Switches (backend env vars, read at runtime, no rebuild)

| Variable | Meaning |
|---|---|
| `REVIEWS_NATIVE_ENABLED` | `1` = verified reviews on. Anything else = off, and the old service reviews work exactly as before. |
| `REVIEWS_GOOGLE_IMPORT_ENABLED` | `1` = the Google import on. |
| `REVIEW_WINDOW_DAYS` | Days after checkout a guest may review. Default 30. |
| `GOOGLE_CLIENT_SECRET` | Google import only: the secret of the same OAuth client as `GOOGLE_CLIENT_ID`. |
| `REVIEWS_TOKEN_ENCRYPTION_KEY` | Google import only: encrypts stored refresh tokens. Generate once (see `backend/.env.example`). Changing it disconnects everyone. |
| `GOOGLE_REVIEWS_REDIRECT_URI` | Optional. Default `{PLATFORM_PUBLIC_URL}/api/reviews/google/callback`. |

With both flags off nothing on any page changes; checked in a browser on the
property, service, business and dashboard pages.

## New collections

`reviews`, `review_audit_log`, `review_reports`, `review_tokens` (single-use
email links), `review_requests` (how many emails a booking has had),
`google_review_connections`. Indexes are created by the migration script, not
at startup.

## Running it

Dev:

```
cd backend
.venv/Scripts/python -m scripts.migrate_reviews            # dry run
.venv/Scripts/python -m scripts.migrate_reviews --apply
.venv/Scripts/python -m scripts.seed_reviews_dev           # sample data, local only
```

Production, in this order (Tzvi runs these):

1. `cd backend` then `railway run .venv\Scripts\python -m scripts.migrate_reviews`
   (dry run: check the first line names the production database and read the counts).
2. The same with `--apply`: creates the indexes, carries over the proven old reviews.
3. Set `REVIEWS_NATIVE_ENABLED=1` on the backend service. From then on, guests get
   one email the day after checkout and at most one reminder a week later.
4. Google import: only after the approval steps below, set the three Google
   variables and `REVIEWS_GOOGLE_IMPORT_ENABLED=1`.

## Google approval steps

1. **Enable the APIs** in the Google Cloud project that owns the sign-in client:
   My Business Account Management API, My Business Business Information API, and
   the Google My Business API (v4, which serves reviews).
2. **Apply for Business Profile API access.** Until Google approves the project,
   its quota is 0 and every call fails. Use the access request form linked from
   Google's "Basic setup / prerequisites" page for the Business Profile APIs. It
   asks for the Cloud project number and a contact email; Google expects that email
   to manage a verified, active Business Profile (their guidance has said for 60+
   days) and the company website to match. Approval is not instant.
3. **OAuth consent screen:** add the scope `https://www.googleapis.com/auth/business.manage`.
   It is a sensitive scope, so publishing the app for all users means Google's app
   verification: home page and privacy policy on the verified domain, why the scope
   is needed, and a short video of the "Connect Google reviews" flow.
4. **OAuth client** (Web application): add the authorized redirect URI
   `https://myisraelrental.com/api/reviews/google/callback`, and copy the client
   secret into `GOOGLE_CLIENT_SECRET` on Railway.
5. Generate `REVIEWS_TOKEN_ENCRYPTION_KEY`, set it, then the flag.

## Open legal questions (TODO(legal) in the code)

- Do Google's Business Profile API terms allow showing imported reviews on a
  third-party site, and what attribution do they require? Cards say "From Google"
  and link to the place on Google Maps; that may not be enough.
- Google's API Services User Data Policy on revoked access: we hide on disconnect
  and revoke the token, but may have to delete the stored copies within a set time.
- Showing Google reviewers' names on our site, and our privacy policy's wording
  for both review sources.
- A check of the review copy and email against the FTC rule (no incentive is
  offered; the `incentivized` field exists and is shown if ever set).

## What the brief asked for that the codebase changed

- Stack is Python/FastAPI, not Node/Express.
- "Paid" can't be checked (no payments on bookings); "completed" means the rules above.
- Co-hosts and employees don't exist: a business has one owner. The owner is
  blocked by account, and anyone sharing the owner's non-webmail email domain.
- Property reviews carry the owner's business id when they have one, so they show
  on the business page too; `owner_user_ids` is what authorisation uses.
- An owner can report but never remove. A Google review's reply comes from Google;
  owners respond to verified reviews only.
- Disconnect hides rather than removing: the removal-reason list is kept for
  moderation, and "disconnected" is not a moderation reason.
- Structured data: `AggregateRating` and `Review` from verified reviews only, on the
  property and business pages; the service page keeps its existing block, whose
  average now comes from verified reviews once the flag is on.
