# Code review, 11 Nov 2026

## In short
- Top issue: a customer's email to a business's new email address can vanish from the leads board. When the site restarts (every update does this) between an email arriving and the AI reading it, the email is never read, never shown to the business, and never reminded about. That breaks the "never miss a lead" promise for exactly the people who wrote in.
- Fixed tonight: order and booking emails to customers opened with a line copied from the text messages, "Your order #1042 from Bakery is confirmed. Your tracking link:", with no link after the colon. They now end at "is confirmed." (English and Hebrew).
- Fixed tonight: two problems in the new "fill the sign-up from my Instagram or website" step. Looking up a slow website froze the whole site for everyone for about 2 seconds, and a website with a huge page was loaded into the server's memory in full. Both fixed. All three fixes are on branch `claude/exciting-bell-3wheie`.
- Needs your decision: nothing tonight. The lost-email fix changes how the leads board treats unread emails (show them before the AI has read them, or retry the reading), so it is left for whoever builds that feature.

## New findings
1. **Medium: an unread email never reaches the leads board.** `backend/routes/marketplace/email_inbox.py:300` stores every email that is not obvious spam as `category: "pending"` and hands the AI reading to a background task (`spawn(make_draft(...))`, line 323). `email_cards` (line 211) shows only `lead, question, booking, complaint, other`, and nothing anywhere picks up a `pending` email again (`grep -n pending` finds only the lines that write it). A restart or deploy while the task waits loses it for good; `lead_nudge.waiting()` reads the same cards, so no reminder either. Proof: a scratch test with mongomock, the background task dropped as a restart would: `STORED category= pending draft_state= pending | cards on board: 0`. Fix (either): include `"pending"` in `email_cards` (shown with its subject until read), or have `lead_nudge_loop` call `make_draft` for `pending` emails older than a few minutes. Not fixed here: it changes the leads board's logic.
2. **Low (fixed): the text's link pointer left in emails.** `order_emails.email_line` (from 13da7418) reuses `order_texts.TEMPLATES`, whose lines end "Your tracking link:", "See the details:", "Details:", "פרטים ומעקב:" because the text puts the link right after. Proof: `email_customer_decision` and the auto-confirmed receipt both opened `Your order #1042 from Bakery is confirmed. Your tracking link:` followed by the item list. Fixed in 087ca753.
3. **Medium (fixed): sign-up socials reader blocked the server.** `product_extract._public_text` (from 624e90e4) called `_is_public_ical_url`, which runs a blocking `socket.getaddrinfo`, inside the async handler, up to 4 hops for each of 4 links. Proof: with a 2 s DNS answer stubbed in, an event-loop ticker stalled 2.01 s. Fixed in 68ce50f5.
4. **Low (fixed): socials reader read whole pages into memory.** Same function: `http.get` downloaded the full body and only then cut it to `_PAGE_BYTES` (1.5 MB). Proof: a 60 MB local page was held as 60,000,000 bytes. Fixed in d9e5be86.

No other findings; none dropped.

## Fixed this run
- 68ce50f5: the host check runs through `asyncio.to_thread`. After: stall 0.02 s on the same stub; `test_business_lookup.py` 6 passed.
- d9e5be86: the page is streamed and reading stops at 1.5 MB. After: peak memory 10.3 MB on the 60 MB page; a redirect is still followed and the title and a Hebrew `og:description` still come through; `test_business_lookup.py` 6 passed.
- 087ca753: `email_line` drops a closing sentence that ends in a colon when another sentence comes before it; a business's own one-sentence wording is left alone. New test `test_email_drops_the_texts_pointer_at_a_link`. After: `test_order_emails.py` and `test_email_inbox.py` 26 passed; both emails now open `Your order #1042 from Bakery is confirmed.`

## Still open
- Plural sets for `ads.nudgeVisits`, `ads.weekVisits`, `advertising.visits` (first seen 6 Nov) and `dashboard.adPicsDone` (10 Nov): fixed on audit branches (d5450913, d10948a5), not on main; test-i18n-parity fails on main for these 4 only.
- Ad emails opt-out has no switch back on, first seen 10 Nov.
- Sign-up draft reminder emails any typed address, first seen 9 Nov.
- Overnight Google opening hours read wrong (`_hours`), first seen 9 Nov.
- Test files that cannot collect without `pytest_asyncio` and `mongomock_motor` (neither is in requirements), first seen 20 Oct; tonight's new `test_email_inbox.py` makes it four files. Installed by hand in the sandbox tonight, after which all four new-code test files pass (48 tests).
- Audit sandbox has no MongoDB or Chromium, first seen 15 Oct.

## Could not confirm
- The business email address can be written to by anyone who knows it, and the `From:` line is not checked. A message forged "from" the owner's own address is treated as the owner forwarding, so the customer address then comes from the message text or the AI's reading of it; the owner could be shown a reply going to an address the forger chose. The owner still reads and presses Send, so the harm is small. Confirming needs Postmark's inbound SPF/DKIM fields on a real message.
- The 40 AI drafts a day are shared by emails and chats, so 40 junk emails that get past the spam filter use up a business's drafts for the day. Needs real inbound traffic to judge.
- `waiting_count` builds the whole leads board for every business the user owns on every dashboard summary call. Fine for one business; slow for an owner with many. Needs production counts.

## Verified working
- Business email: the Postmark webhook needs the secret (`compare_digest`) and refuses all mail when none is set; email is matched to a business only by its own address token; repeats are dropped by a unique index; replies go only to the address stored with that email, only for that business (`find_one({"_id", "business_id"})`), at most 200 a day; reply text is HTML-escaped; the Gmail confirm link is accepted only from `mail.google.com` / `mail-settings.google.com`.
- Leads board, draft and reply endpoints: every one goes through `business_access(..., "customers")`; the nudge switch is owner only; each customer message is nudged once (unique id claimed first), not at night, not on Shabbat for a business that closes.
- Order emails: the owner's own address and switch (owner only, address format checked); customers still get their receipt with business emails off; customer text is escaped (test); the auto-confirmed path sends one email, not two; recent emails show a masked address only.
- Social links: Instagram, Facebook and TikTok must be on their own host (`instagram.com.evil.io` refused), `javascript:` and bare words dropped; `python utils/social_links.py` prints ok. Exposed on the public business page, which is intended (they are public accounts, no phone or email).
- Onboarding goals: unknown goals dropped, at most 4.
- `INBOUND_EMAIL_DOMAIN` and `INBOUND_EMAIL_SECRET` are in `backend/.env.example` with no values.
- `test_listing_price_parity.py`: passed.
- Production build passes.
- `scripts/test-*.mjs`: 9 of 11 pass; test-i18n-parity (the 4 known counters above) and test-store-basket (cannot load `react` from the repo root in this sandbox; not new).

## Not checked
- PRICE CHECK DID NOT RUN: the routine forbids fetching myisraelrental.com and the sandbox proxy blocks it. The parity test passed.
- FAILED  playwright + chromium (last lines:     at ChildProcess.<anonymous> (/home/user/my-israel-rental/node_modules/playwright-core/lib/coreBundle.js:32015:32)     at ChildProcess.emit (node:events:519:28)     at ChildProcess._handle.onexit (node:internal/child_)
- FAILED  mongodb on :27017 (last lines:     at ChildProcess.emit (node:events:519:28)     at ChildProcess._handle.onexit (node:internal/child_process:293:12) curl: (22) The requested URL returned error: 403 )
- SKIPPED api (no database)
- Full backend suite, no database: stopped at about 15% after 25 minutes when the sandbox restarted (each database test waits for a connection that cannot exist). Up to there: 164 passed, 235 skipped, 16 failed, 13 errors (whether every failure is a database one was not read, the log was cut off by the restart). The files for today's code (`test_email_inbox`, `test_order_emails`, `test_business_lookup`, `test_listing_price_parity`) were run on their own: 49 passed.
- The inbound email webhook, the nudge loop and the sign-up socials reader were not run end to end against Postmark, Claude or a real website (pure functions and mongomock tests only).
- The commits that only touched business sites (RBS Cleaning, M and N Jewelry, L.A. Cholent, Finest Cuts), ad blueprints and ad-checker scripts were not reviewed for logic (visual layer and tooling).
