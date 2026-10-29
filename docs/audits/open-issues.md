# Open issues from the audits

One line per issue. Every audit reads this before reporting, so a known
issue shows as "still open" instead of being found again as new. Update it
at the end of every run: add what is new, mark what was fixed (with the
commit), and move fixed lines to the bottom section after a week.

Format: `- [Severity] Area: what goes wrong, for whom. First seen DATE (report). Status.`

## Open

Merged 23 Oct 2026 from every audit branch of 16 to 22 Oct (none had been merged), each line re-checked against main.

- [Low] Page editor link filter accepts "/%2F/evil.com"; stays a path on this site, probably harmless. First seen 12 Oct.
- [To check] The Brown Box and Blazin' Boards: pinned opening reported 64 to 96px taller than the room under the header at 360 to 768 wide (23 Oct UI audit; screenshots show nothing hidden); check on a real phone.
- [To fix] Audit setup: most runs since 15 Oct could not download Playwright or MongoDB in the sandbox, so pages behind sign-in, Hebrew renders and order flows were not checked.

- [Medium] Truthfulness: the new "people searched" lines on Why list, Why host and join can be made up by anyone. /site/search takes the visitor id from a request header, so three made-up ids reach MIN_SHOWN=3, and the free-text `area` becomes the public "most searched area". First seen 29 Oct (2026-10-29-site-audit.md).
- [Low] Rental figures: a designed-site visit (`/business/{slug}/visit`) trusts the client's visitor id, so an owner's visitor count and requests-per-hundred rate can be inflated (120 per 10 min per IP). First seen 29 Oct (2026-10-29-site-audit.md).
- [Low] Page translate: the daily translation allowance (300) is used up by calls that failed, because the counter is raised before the model is called. First seen 29 Oct (2026-10-29-site-audit.md).
- [Low] Tests: audit sandbox had no MongoDB again, so the full backend suite and API checks could not run (the 45 tests that need no database pass). 29 Oct (2026-10-29-site-audit.md).

## Fixed

- [Low] Two status colours have no design token, so they stay fixed: amber "waiting" (#B45309: payment requests, automations, deposits) and red error text (#B42318: restock box). Adding --attention and --danger tokens is a design-system choice for Tzvi. 23 Oct.
- Fixed 23 Oct: reorder crash returns the run to waiting; failed appointment reminders are retried; table orders without a phone left out of customer suggestions; gift-card order email at most once a day per address, never after an unsubscribe, with an unsubscribe link; restaurants "show more" plural forms and the plural check's false alarms (the language check now passes fully); only our own [Your ...] template gaps block a message; calendar import stops at the size limit; map popup and green status colours use tokens.
- Fixed 23 Oct, from older audits that were never merged: 'delivery not available' no longer turns delivery on (14 Oct); join rules page starts below the nav (14 Oct); customers list footer total (15 Oct); insights empty average hyphen (15 Oct); Gift Boutique "Scroll to open" cue removed (15 Oct).
- [Decided, fixed] Leads board is for new leads (Tzvi, 23 Oct): chats from people who already ordered or booked are left out, and chat cards no longer show the customer's profile phone. 23 Oct.
- [Decided, fixed] Table orders: each table's QR link carries its own code and a table order without it is refused (no business had table ordering on, so no printed codes broke). 23 Oct.
- [Decided, fixed] Calendar feed: customer phone, email and address left out; the event links to the dashboard. 23 Oct.
- [Done] support@myisraelrental.com is read (Tzvi, 23 Oct).
- [Medium] Shop basket buttons (14 texts) showed fallback English in both languages because a second `basket` block in en.js and he.js replaced the first. Renamed to basketReminder (audit fix d261160c, 16 Oct), merged 23 Oct.
- [Medium] Payment request page sent the business's phone to link holders. Fix d718eeed (22 Oct), merged 23 Oct.
- [Low] Jobs board area box English for Hebrew visitors (da0754f6); map count Hebrew dual forms (d9603292); services map city aliases with a hyphen or apostrophe (0492ea09); leads delete button 44px (eb2e7136); hours placeholder en dashes (6d1048c3); server.js comment (95f81cd0). Merged 23 Oct.
- [Low] The Brown Box: banned "Scroll" cue removed (c67e586c, 17 Oct); also removed from American Crust, and check-site now fails any Scroll cue. 23 Oct.
- [Low] Sukkot fallback dates rolled to 5788 (5787 had passed); restock box 44px; checklist "category" item confirmed correct (category is set per service), test updated. 23 Oct.
- Dropped: Chicken Munch steppers 44px (19 Oct) and its bar-opacity and English-only notes; the page was rebuilt on 22 Oct and passes check-site.

- [Medium] Payment request page sent the business's phone to link holders. Fixed 22 Oct, d718eeed.
- [Low] Jobs board area box was English for Hebrew visitors. Fixed 22 Oct, da0754f6.
- [Low] KasherMyBnb: the "what we kasher" lists on the kitchen and pots pages are now a split price list (add-ons left, ticked parts right; on a phone the list first). 13 Oct.

- [Medium] Subscriptions: a paying business can now see its plan and cancel it in Settings ("Your plan", shown only to a business with a paid plan). Fixed 13 Oct.
- [Medium] Emails: "reply to this email" replies now reach a real inbox (Reply-To). Fixed 13 Oct.
- [Medium] Restaurants: listed and claim-rejected emails are now sent. Fixed 13 Oct.
- [Medium] Requests board: posters can edit their request. Fixed 13 Oct.
- [Medium] Published services: availability, contact, area, category and Hebrew text can be edited after publishing. Fixed 13 Oct.
- [Low] Saved-search alerts now fire for bulk-uploaded listings. Fixed 13 Oct.
- [Low] Pricing tips hint now says it covers vacation rentals with Smart Pricing. Fixed 13 Oct.
- [Low] Provider profile window and its button are in Hebrew too. Fixed 13 Oct.
- [Low] Deals shelf only looked at the first 400 published listings, so offers could be missed. Fixed 13 Oct.
- [Owner action, done] Blazin' Boards: delivery turned on, across Israel, fee confirmed on WhatsApp. 13 Oct.
- [Medium] Blazin' Boards order page: a delivery order would have been refused for a store that is not nationwide, because the page never sent the city. It now asks for the city from the store's own list. Fixed 13 Oct.
- [Medium] Dashboard, Overview: "Waiting on you" opened an empty pane for renters and property hosts. Now opens bookings unless there are work offers. Fixed 13 Oct.
- [Medium] Contracts: the WhatsApp "contract signed" link opened bookings without highlighting the booking. Fixed 13 Oct.
- [Medium] Setup checklist: "Add your service areas" never ticked for a nationwide business, and "availability" never ticked for a host who connected a calendar. Fixed 13 Oct.
- [Medium] Restaurants: a certificate check that failed (site down, unreadable picture) waited a week before trying again. Now tomorrow. Fixed 13 Oct.
- [Medium] Restaurants: the daily job would run once per server copy, paying twice. Now one run a day. Fixed 13 Oct.
- [Low] Restaurants: one slow address lookup failed the whole map-pin batch. Fixed 13 Oct.
- [Low] Page editor and showcase: fixed colour codes swapped for the design tokens; buttons and arrows now 44px; the disabled Save label now readable. Fixed 13 Oct.
- [Low] Showcase cards: screen readers now hear the visible name and line; clips never start for people who turn motion off. Fixed 13 Oct.
- [Low] Dashboard, My services: faint grey labels in the provider profile window now readable; close button 44px. Fixed 13 Oct.
- [Low] KasherMyBnb and Blazin' Boards: menu links now 44px tall on phones; middle dots in the copy replaced with commas. Fixed 13 Oct.
- [Low] /businesses: restaurants tile placeholder colour now a token. Fixed 13 Oct.
- [Medium] Page editor: an owner could save a link to another site ("//evil.com"). Fixed 12 Oct, 8e2da7fb.
- [Low] Hand-built pages: anyone could skip the cache with `?fresh` as often as they liked. Fixed 12 Oct, 8e2da7fb.
- Not a bug: business page tab title (uses "|"), Deliveries links (phone, WhatsApp and Waze open outside the app), renter Contracts tab (shows where contracts are). Checked 13 Oct.

## Added by the audit merge of 29 Oct 2026

Lines from the 24 to 29 Oct audit branches that were not yet here (some repeat older items in other words; kept as written).

- [To fix] Audit setup: most runs since 15 Oct could not download Playwright or MongoDB in the sandbox, so pages behind sign-in, Hebrew renders and order flows were not checked. Still so on 25 Oct (MongoDB download 403); the preinstalled Chromium at /opt/pw-browsers/chromium works if the setup script launches it with executablePath.
- [Low] Ask this business: forwarding a question has no per-business limit, so many visitors can fill one business's leads board; the shared 300-a-day answer cap can be used up by one visitor. First seen 24 Oct (2026-10-24-site-audit).
- [Low] Away reply loop queries per business every minute; fine now, will not scale. First seen 24 Oct (2026-10-24-site-audit).
- [To check] Backend tests that need the database (including test_away_reply_and_weekly_todo) did not run on 24 Oct: MongoDB could not be installed in the sandbox.
- Fixed 24 Oct: awayReply.body plural-check failure (3361830).
- [Medium] Chicken Munch (all pages): on phones the page scrolls sideways (439px wide on 375) and the opening word "CHICKEN" runs off both edges. First seen 24 Oct (2026-10-24-ui-audit.md). Open, needs a design choice.
- [Could not confirm] Table ordering codes (23 Oct, code audit): a business that had table ordering on before the codes shipped has no key until the owner opens the table sheet; two simultaneous loads could create two keys. Needs a database to show. Report: 2026-10-23-site-audit.md
- [Low] Restaurants: a non-ASCII X-Restaurant-Admin-Token header gives a 500 instead of 401 (compare_digest on str). First seen 13 Oct (site audit).
- [Low] Tests: i18n parity fails on restaurants.more (count without plural); completeness script fails on the "category" checklist item. Since 8 Oct (site audit 13 Oct). (25 Oct: scripts/test-i18n-parity.mjs passes on main plus the audit fixes)
- [Low] Gift Boutique: heading contrast flagged 2.73:1 by readable.mjs, probably mid-fade; re-measure. First seen 14 Oct (UI audit).
- [Medium] Restaurants: the photo endpoint has no rate limit; anyone can use up the month's 4,000 Google photos. First seen 14 Oct (site audit 14 Oct).
- [Low] Holidays: Sukkot fallback window ended 3 Oct; needs 5788 dates. First seen 14 Oct (site audit 14 Oct).
- [Low] Memberships: sign-up emails any typed address (20 per 10 min per IP). First seen 14 Oct (site audit 14 Oct).
- [Low] Jobs board area strings: fix 51649002 dropped 25 Oct: main already has jobsBoard.areaPh and areaFreeText (fixed 22 Oct, da0754f6). Since 8 Oct.
- [Medium] Own domains: an address is reserved before the owner proves they own it, so one business can block another's. First seen 15 Oct (site audit). Needs decision.
- [Low] Own domains: a rejected change has already deleted the old domain in Railway. First seen 15 Oct (site audit).
- [Low] Test script: `editListing.extras` and `restaurants.more` still flagged by test-i18n-parity. First seen 15 Oct (site audit).
- [Low] JobsBoard keys `jobsBoard.areaPh`, `jobsBoard.areaFreeText` missing from en.js. First seen 15 Oct (site audit).
- [Low] Completeness checklist: "category" opens a form without a category control. Seen 15 Oct (dead-ends area).
- [Low] Gift Boutique: a "Scroll to open" cue sat over the opening box (banned by page rules). Fixed 15 Oct, ee73f895 (2026-10-15-ui-audit.md).
- [Low] Business insights: an en dash shown for an empty average. Fixed 15 Oct, a3bb67b5.
- [Low] Restaurants search box: the hint is cut off at 375 wide ("...neighbourh"). First seen 15 Oct (2026-10-15-ui-audit.md).
- [Low] Business insights: new hardcoded error colour #B42318 (BusinessInsights.jsx:~108). First seen 15 Oct.
- [Low] Gift Boutique pages are English only, even for Hebrew visitors. First seen 14 Oct, still open.
- [Low] Gift-card order and "tell me when it's back" email any typed address without confirming it; gift-card order mail has no unsubscribe link. First seen 16 Oct (site audit).
- [Low] Appointment reminder is marked sent before emailing; a failed send is never retried. First seen 16 Oct (site audit).
- [Low] `jobsBoard.areaPh` / `areaFreeText` missing from en.js. First seen 15 Oct (site audit).
- [Medium] Order from the table: anyone who knows a restaurant's order link can place table orders with no name, phone or sign-in (20 per 10 minutes per address), and they land on the board as "Table N". Needs Tzvi's decision. First seen 17 Oct (site audit 2026-10-17).
- [Low] Table orders show up as a returning customer named "Table 5" in the order-form name suggestions (customers list groups by name when there is no phone). First seen 17 Oct (site audit 2026-10-17).
- [Low] Two script checks fail: test-i18n-parity (14 t() keys missing from en.js, e.g. basket.* in CardAction.jsx, plus 7 plural sets) and test-completeness-actions (business "category" has no control). Both failed before 16 Oct too. First seen 17 Oct (site audit 2026-10-17).
- [Low] Restock box: buttons and field are 36 to 40px tall, under the 44px rule on phones (`RestockNotify.jsx`). First seen 17 Oct (UI audit).
- [Low] i18n: 14 keys used in code but missing from `en.js` (`basket.*` in `CardAction.jsx`, `jobsBoard.areaFreeText`, `jobsBoard.areaPh`). First seen 17 Oct (UI audit).
- [To check] The Brown Box home: pinned film reported 64px taller than the room under the header; check on a real phone. First seen 17 Oct (UI audit).
- [Low] Chicken Munch page: the sticky top bar is 92% opaque, so menu text shows faintly behind the logo while scrolling on a phone. First seen 19 Oct (UI audit). Decision: leave, or make it solid.
- [Low] Chicken Munch page: English only (no Hebrew version) for a Jerusalem business. First seen 19 Oct (UI audit). Decision for Tzvi.
- [Low] Services map popup: hardcoded `#fff`/`#111827` and `system-ui` font in new pin and header code. First seen 21 Oct (2026-10-21-ui-audit).
- [To check] UI audit cannot render: sandbox blocks the Playwright download (cdn.playwright.dev 403) and the API did not start. First seen 21 Oct.
- [Medium] Hebrew: 14 texts (order basket buttons, jobs board area box) exist in neither language file, so Hebrew shows English. First seen 21 Oct (2026-10-21-site-audit).
- [Medium] Dead end: the "category" item of the completeness list opens a form with no category control. First seen 21 Oct (2026-10-21-site-audit).
- [Low] Customer messages: any "[text]" in a message blocks sending, even when the owner meant it. First seen 21 Oct (2026-10-21-site-audit).
- [Medium] Holidays: Sukkot fallback dates ended 3 Oct; if Hebcal is down the Sukkot booking calendar is all greyed out. First seen 22 Oct (site audit).
- [Medium] Leads board shows customers' profile phone numbers to the business; decision needed. First seen 22 Oct (site audit).
- [Low] Reorder: a send that errors leaves the run stuck on "sending" (suspected, needs database). First seen 22 Oct (site audit).
- [Low] Dashboard checklist: "category" item points at a form with no category control (test-completeness-actions fails). First seen 22 Oct (site audit).
- [Medium] Services marketplace: 14 basket.* strings missing from en.js and he.js, so Hebrew visitors see English on card quantity buttons. First seen 22 Oct (UI audit).
- [Low] New dashboard panels use hardcoded hexes (#B45309 amber) instead of tokens. First seen 22 Oct (UI audit).
- [Low] Page editor link filter accepts "/%2F/evil.com"; it stays a path on this site, so probably harmless. First seen 12 Oct (site audit).
- [To check] Emails: replies now go to support@myisraelrental.com (EMAIL_REPLY_TO). The domain receives mail (Private Email); confirm that mailbox exists and is read.
- [Low] Hebrew: 14 label keys (basket buttons in CardAction.jsx, Jobs board area box) are in neither en.js nor he.js, so Hebrew shows English. First seen 18 Oct (2026-10-18-site-audit).
- [Low] Dead end: business checklist item "category" opens a form with no category control (test-completeness-actions fails). First seen 18 Oct (2026-10-18-site-audit; for the dead-ends audit).
- [To check] Database tests (claim links, contract storage) could not run in the audit sandbox on 18 Oct: no MongoDB download allowed.
- [Medium] Hebrew: 14 texts (`basket.*` in CardAction, 2 in JobsBoard) are in neither language file, so Hebrew readers see English on shop basket buttons. First seen 19 Oct (2026-10-19-site-audit).
- [Low] Dashboard setup checklist: "category" opens a form with no category control. First seen 19 Oct (2026-10-19-site-audit).
- [Low] Calendar import downloads the whole file before checking its size. First seen 19 Oct (2026-10-19-site-audit).
- [To decide] Business calendar feed lists customer phone and delivery address behind a private link. First seen 19 Oct (2026-10-19-site-audit).
- [Low] Audit setup: `pytest_asyncio` is not installed in the sandbox so 3 backend test files do not collect, and the full suite exceeds 8 minutes. First seen 20 Oct (2026-10-20-site-audit).
- [Medium] Orders: "Delivery not available" in a description turned delivery on. Fixed 14 Oct, 8df68686.
- [Low] Restaurants: non-ASCII admin token header gave a 500. Fixed 14 Oct, 6814df4.
- [Medium] Join rules page: back link and title sat under the taller nav on phones. Fixed 14 Oct (UI audit).
- [Low] Jobs board: area filter strings were missing in English and Hebrew. Fixed 13 Oct, 51649002.
- [Medium] Basket card buttons (Book, Message, Add to order, Send order) lost their Hebrew text after a duplicate `basket` block in the language files. Fixed 16 Oct, d261160c.
- [Low] The Brown Box page: "Scroll" cue removed. Fixed 17 Oct (c67e586).
- [Low] Services map: city names with a hyphen or apostrophe (Tel-Aviv, Modi'in, Ra'anana, Be'er Sheva) never matched, so those businesses had no pin. Fixed 20 Oct (0492ea0, 2026-10-20-site-audit).
- [Low] Hebrew map texts showed English for exactly two businesses (no `_two` plural). Fixed 21 Oct (d9603292, 2026-10-21-ui-audit).
- (info, audit tooling, 2026-10-16) Sandbox blocks MongoDB and Playwright downloads, so UI audits cannot run the API; see docs/audits/2026-10-16-ui-audit.md
- [Low] Dashboard business form: hours placeholder is hard-coded English (also shown in Hebrew); en dashes removed 18 Oct. First seen 18 Oct, 2026-10-18-ui-audit.md.
- [Medium] Hebrew UI: 14 t() keys (basket.* on marketplace cards, jobsBoard.areaPh/areaFreeText) missing from en.js and he.js; Hebrew users see English. First seen 23 Oct (2026-10-23-ui-audit).
- [Low] Hebrew UI: 7 count strings with no plural set (basket.items, summary.visits and others). First seen 23 Oct (2026-10-23-ui-audit).
- [Low] Business pages: clipped.mjs flags pinned opening block under the header on the-brown-box and blazin-boards at phone widths; screenshots look fine. First seen 23 Oct (2026-10-23-ui-audit). Unconfirmed.
- [Low] Away reply card: {{count}} renamed {{minutes}} so the plural check passes, and the default text lost its exclamation mark (copy rule), EN and HE. Fixed 25 Oct in the audit merge (33618306, 05507564).
- Low, backend/listings: a time window with one time left blank is dropped silently (day saved as closed) by `clean_weekly`. First seen 25 Oct 2026, 2026-10-25-site-audit.md.
- [Low] Blazin' Boards home, phone 360x640: size labels cut by the plank box, "$700" 4.09:1. First seen 27 Oct, 2026-10-27-ui-audit.md.
- [Low] Michal Simkin reviews, phone 360x640: last quote cut by the stage and covered by the booking bar. First seen 27 Oct, 2026-10-27-ui-audit.md.
- [Low] Dashboard away-reply card: `awayReply.body` uses {{count}} with no plural forms, fails test-i18n-parity. First seen 28 Oct 2026 (2026-10-28-site-audit.md). Fixed 29 Oct in the audit merge (02b65ebe).
- [Low] i18n: `awayReply.body` and `stays.repliesWithinHours` use a count with no plural set, so the parity check fails. First seen 29 Oct, 2026-10-29-ui-audit.md. Fixed 29 Oct in the audit merge (02b65ebe, b0f3bbff).
- [Low] Copy: exclamation mark in the away-reply placeholder (en.js:915). First seen 29 Oct, 2026-10-29-ui-audit.md. Fixed 29 Oct in the audit merge (7f048e75).
