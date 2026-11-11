# Business email address + "never miss a lead"

Built 11 Nov 2026. Code: `backend/routes/marketplace/email_inbox.py`,
`backend/routes/marketplace/lead_nudge.py`, `backend/utils/lead_assist.py`,
UI in `frontend/src/components/dashboard/InboxCard.jsx` and `LeadsBoard.jsx`
(Dashboard, Customers, Leads). Tests: `backend/tests/test_email_inbox.py`.

## What it does

- Every business gets its own address, e.g. `danimovers-k3x9qp@in.myisraelrental.com`.
  The owner forwards customer emails to it (a Gmail/Outlook rule, by hand, or CC).
- Spam, bulk mail and automatic replies are filtered without spending AI credit.
  Gmail's "confirm forwarding" email is shown on the page with its code and link.
- Every other email: Claude sorts it, finds the customer (also inside a hand
  forward), writes a one-line summary and a reply draft from the business's
  own published facts only. It becomes a card on the leads board.
- The owner edits the draft and presses Send. It goes from our address under the
  business's name, Reply-To the owner's own email, threaded on the customer's
  message, and only to the address the email itself gave.
- **Nudge:** a chat or email that waits more than an hour (08:00 to 21:00 Israel,
  not during the business's Shabbat closing) gets the owner one bell + one email
  listing who is waiting, each with a drafted reply. Once per customer message,
  at most one email per business every 3 hours. On by default, a switch on the
  Leads page turns it off.
- Cost guard: 40 AI drafts per business per day (`lead_assist.DAILY_CAP`).
  Past it, the enquiry still shows and is answered by hand.

## Setup before it works in production (not done yet)

1. Choose the inbound domain, e.g. `in.myisraelrental.com`.
2. DNS: an `MX` record for that domain pointing at `inbound.postmarkapp.com` (priority 10).
3. Postmark, the same server as outbound: Settings, Inbound, set the inbound domain,
   and the webhook URL
   `https://<backend host>/api/webhooks/postmark-inbound?token=<INBOUND_EMAIL_SECRET>`.
   Turn on "Include raw email content" off; we read TextBody, HtmlBody and Headers.
4. Railway backend variables: `INBOUND_EMAIL_DOMAIN`, `INBOUND_EMAIL_SECRET`.
   Until `INBOUND_EMAIL_DOMAIN` is set the Leads page simply does not show the card.
   The nudge works without any of this (chats on the site).

## Gotchas

- Gmail will not auto-forward until the forwarding address is confirmed by a link
  Gmail emails to it. That email lands in our inbox, so the page shows the code.
- A hand forward has the owner as sender; the original sender is read from the
  forwarded part (regex first, then Claude). Gmail's automatic forward keeps the
  customer as sender.
- An owner who CCs their address on their own reply marks the enquiry answered
  (matched by In-Reply-To / References).
- Emails are kept 180 days (TTL index on `inbox_emails.expires_at`).
