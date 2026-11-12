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
Merged 28 Oct 2026 from the audit branches that were still unmerged (Sep to 27 Oct). These lines appear on a branch's copy of this file and not above. They are kept as written and have NOT been re-checked against main, so some may already be fixed; the next audit run should confirm or move each one.

- (info, audit tooling, 2026-10-16) Sandbox blocks MongoDB and Playwright downloads, so UI audits cannot run the API; see docs/audits/2026-10-16-ui-audit.md
- Fixed 24 Oct: awayReply.body plural-check failure (3361830).
- Low, backend/listings: a time window with one time left blank is dropped silently (day saved as closed) by `clean_weekly`. First seen 25 Oct 2026, 2026-10-25-site-audit.md.
- [Could not confirm] Table ordering codes (23 Oct, code audit): a business that had table ordering on before the codes shipped has no key until the owner opens the table sheet; two simultaneous loads could create two keys. Needs a database to show. Report: 2026-10-23-site-audit.md
- [Low] Appointment reminder is marked sent before emailing; a failed send is never retried. First seen 16 Oct (site audit).
- [Low] Ask this business: forwarding a question has no per-business limit, so many visitors can fill one business's leads board; the shared 300-a-day answer cap can be used up by one visitor. First seen 24 Oct (2026-10-24-site-audit).
- [Low] Audit setup: `pytest_asyncio` is not installed in the sandbox so 3 backend test files do not collect, and the full suite exceeds 8 minutes. First seen 20 Oct (2026-10-20-site-audit).
- [Low] Away reply card: {{count}} renamed {{minutes}} so the plural check passes, and the default text lost its exclamation mark (copy rule), EN and HE. Fixed 25 Oct in the audit merge (33618306, 05507564).
- [Low] Away reply loop queries per business every minute; fine now, will not scale. First seen 24 Oct (2026-10-24-site-audit).
- [Low] Blazin' Boards home, phone 360x640: size labels cut by the plank box, "$700" 4.09:1. First seen 27 Oct, 2026-10-27-ui-audit.md.
- [Low] Business insights: an en dash shown for an empty average. Fixed 15 Oct, a3bb67b5.
- [Low] Business insights: new hardcoded error colour #B42318 (BusinessInsights.jsx:~108). First seen 15 Oct.
- [Low] Business pages: clipped.mjs flags pinned opening block under the header on the-brown-box and blazin-boards at phone widths; screenshots look fine. First seen 23 Oct (2026-10-23-ui-audit). Unconfirmed.
- [Low] Calendar import downloads the whole file before checking its size. First seen 19 Oct (2026-10-19-site-audit).
- [Low] Chicken Munch page: English only (no Hebrew version) for a Jerusalem business. First seen 19 Oct (UI audit). Decision for Tzvi.
- [Low] Chicken Munch page: the sticky top bar is 92% opaque, so menu text shows faintly behind the logo while scrolling on a phone. First seen 19 Oct (UI audit). Decision: leave, or make it solid.
- [Low] Completeness checklist: "category" opens a form without a category control. Seen 15 Oct (dead-ends area).
- [Low] Customer messages: any "[text]" in a message blocks sending, even when the owner meant it. First seen 21 Oct (2026-10-21-site-audit).
- [Low] Dashboard business form: hours placeholder is hard-coded English (also shown in Hebrew); en dashes removed 18 Oct. First seen 18 Oct, 2026-10-18-ui-audit.md.
- [Low] Dashboard checklist: "category" item points at a form with no category control (test-completeness-actions fails). First seen 22 Oct (site audit).
- [Low] Dashboard setup checklist: "category" opens a form with no category control. First seen 19 Oct (2026-10-19-site-audit).
- [Low] Dead end: business checklist item "category" opens a form with no category control (test-completeness-actions fails). First seen 18 Oct (2026-10-18-site-audit; for the dead-ends audit).
- [Low] Gift Boutique pages are English only, even for Hebrew visitors. First seen 14 Oct, still open.
- [Low] Gift Boutique: a "Scroll to open" cue sat over the opening box (banned by page rules). Fixed 15 Oct, ee73f895 (2026-10-15-ui-audit.md).
- [Low] Gift Boutique: heading contrast flagged 2.73:1 by readable.mjs, probably mid-fade; re-measure. First seen 14 Oct (UI audit).
- [Low] Gift-card order and "tell me when it's back" email any typed address without confirming it; gift-card order mail has no unsubscribe link. First seen 16 Oct (site audit).
- [Low] Hebrew UI: 7 count strings with no plural set (basket.items, summary.visits and others). First seen 23 Oct (2026-10-23-ui-audit).
- [Low] Hebrew map texts showed English for exactly two businesses (no `_two` plural). Fixed 21 Oct (d9603292, 2026-10-21-ui-audit).
- [Low] Hebrew: 14 label keys (basket buttons in CardAction.jsx, Jobs board area box) are in neither en.js nor he.js, so Hebrew shows English. First seen 18 Oct (2026-10-18-site-audit).
- [Low] Holidays: Sukkot fallback window ended 3 Oct; needs 5788 dates. First seen 14 Oct (site audit 14 Oct).
- [Low] Jobs board area strings: fix 51649002 dropped 25 Oct: main already has jobsBoard.areaPh and areaFreeText (fixed 22 Oct, da0754f6). Since 8 Oct.
- [Low] Jobs board area strings: fix 51649002 sits on an unmerged branch, so en.js still lacks them. Since 8 Oct.
- [Low] Jobs board: area filter strings were missing in English and Hebrew. Fixed 13 Oct, 51649002.
- [Low] JobsBoard keys `jobsBoard.areaPh`, `jobsBoard.areaFreeText` missing from en.js. First seen 15 Oct (site audit).
- [Low] Memberships: sign-up emails any typed address (20 per 10 min per IP). First seen 14 Oct (site audit 14 Oct).
- [Low] Michal Simkin reviews, phone 360x640: last quote cut by the stage and covered by the booking bar. First seen 27 Oct, 2026-10-27-ui-audit.md.
- [Low] New dashboard panels use hardcoded hexes (#B45309 amber) instead of tokens. First seen 22 Oct (UI audit).
- [Low] Own domains: a rejected change has already deleted the old domain in Railway. First seen 15 Oct (site audit).
- [Low] Page editor link filter accepts "/%2F/evil.com"; it stays a path on this site, so probably harmless. First seen 12 Oct (site audit).
- [Low] Reorder: a send that errors leaves the run stuck on "sending" (suspected, needs database). First seen 22 Oct (site audit).
- [Low] Restaurants search box: the hint is cut off at 375 wide ("...neighbourh"). First seen 15 Oct (2026-10-15-ui-audit.md).
- [Low] Restaurants: a non-ASCII X-Restaurant-Admin-Token header gives a 500 instead of 401 (compare_digest on str). First seen 13 Oct (site audit).
- [Low] Restaurants: non-ASCII admin token header gave a 500. Fixed 14 Oct, 6814df4.
- [Low] Restock box: buttons and field are 36 to 40px tall, under the 44px rule on phones (`RestockNotify.jsx`). First seen 17 Oct (UI audit).
- [Low] Services map popup: hardcoded `#fff`/`#111827` and `system-ui` font in new pin and header code. First seen 21 Oct (2026-10-21-ui-audit).
- [Low] Services map: city names with a hyphen or apostrophe (Tel-Aviv, Modi'in, Ra'anana, Be'er Sheva) never matched, so those businesses had no pin. Fixed 20 Oct (0492ea0, 2026-10-20-site-audit).
- [Low] Table orders show up as a returning customer named "Table 5" in the order-form name suggestions (customers list groups by name when there is no phone). First seen 17 Oct (site audit 2026-10-17).
- [Low] Test script: `editListing.extras` and `restaurants.more` still flagged by test-i18n-parity. First seen 15 Oct (site audit).
- [Low] Tests: i18n parity fails on restaurants.more (count without plural); completeness script fails on the "category" checklist item. Since 8 Oct (site audit 13 Oct).
- [Low] Tests: i18n parity fails on restaurants.more (count without plural); completeness script fails on the "category" checklist item. Since 8 Oct (site audit 13 Oct). (25 Oct: scripts/test-i18n-parity.mjs passes on main plus the audit fixes)
- [Low] The Brown Box page: "Scroll" cue removed. Fixed 17 Oct (c67e586).
- [Low] Two script checks fail: test-i18n-parity (14 t() keys missing from en.js, e.g. basket.* in CardAction.jsx, plus 7 plural sets) and test-completeness-actions (business "category" has no control). Both failed before 16 Oct too. First seen 17 Oct (site audit 2026-10-17).
- [Low] `jobsBoard.areaPh` / `areaFreeText` missing from en.js. First seen 15 Oct (site audit).
- [Low] i18n: 14 keys used in code but missing from `en.js` (`basket.*` in `CardAction.jsx`, `jobsBoard.areaFreeText`, `jobsBoard.areaPh`). First seen 17 Oct (UI audit).
- [Medium] Basket card buttons (Book, Message, Add to order, Send order) lost their Hebrew text after a duplicate `basket` block in the language files. Fixed 16 Oct, d261160c.
- [Medium] Chicken Munch (all pages): on phones the page scrolls sideways (439px wide on 375) and the opening word "CHICKEN" runs off both edges. First seen 24 Oct (2026-10-24-ui-audit.md). Open, needs a design choice.
- [Medium] Dead end: the "category" item of the completeness list opens a form with no category control. First seen 21 Oct (2026-10-21-site-audit).
- [Medium] Hebrew UI: 14 t() keys (basket.* on marketplace cards, jobsBoard.areaPh/areaFreeText) missing from en.js and he.js; Hebrew users see English. First seen 23 Oct (2026-10-23-ui-audit).
- [Medium] Hebrew: 14 texts (`basket.*` in CardAction, 2 in JobsBoard) are in neither language file, so Hebrew readers see English on shop basket buttons. First seen 19 Oct (2026-10-19-site-audit).
- [Medium] Hebrew: 14 texts (order basket buttons, jobs board area box) exist in neither language file, so Hebrew shows English. First seen 21 Oct (2026-10-21-site-audit).
- [Medium] Holidays: Sukkot fallback dates ended 3 Oct; if Hebcal is down the Sukkot booking calendar is all greyed out. First seen 22 Oct (site audit).
- [Medium] Join rules page: back link and title sat under the taller nav on phones. Fixed 14 Oct (UI audit).
- [Medium] Leads board shows customers' profile phone numbers to the business; decision needed. First seen 22 Oct (site audit).
- [Medium] Order from the table: anyone who knows a restaurant's order link can place table orders with no name, phone or sign-in (20 per 10 minutes per address), and they land on the board as "Table N". Needs Tzvi's decision. First seen 17 Oct (site audit 2026-10-17).
- [Medium] Orders: "Delivery not available" in a description turned delivery on. Fixed 14 Oct, 8df68686.
- [Medium] Own domains: an address is reserved before the owner proves they own it, so one business can block another's. First seen 15 Oct (site audit). Needs decision.
- [Medium] Restaurants: the photo endpoint has no rate limit; anyone can use up the month's 4,000 Google photos. First seen 14 Oct (site audit 14 Oct).
- [Medium] Services marketplace: 14 basket.* strings missing from en.js and he.js, so Hebrew visitors see English on card quantity buttons. First seen 22 Oct (UI audit).
- [To check] Backend tests that need the database (including test_away_reply_and_weekly_todo) did not run on 24 Oct: MongoDB could not be installed in the sandbox.
- [To check] Database tests (claim links, contract storage) could not run in the audit sandbox on 18 Oct: no MongoDB download allowed.
- [To check] Emails: replies now go to support@myisraelrental.com (EMAIL_REPLY_TO). The domain receives mail (Private Email); confirm that mailbox exists and is read.
- [To check] The Brown Box home: pinned film reported 64px taller than the room under the header; check on a real phone. First seen 17 Oct (UI audit).
- [To check] UI audit cannot render: sandbox blocks the Playwright download (cdn.playwright.dev 403) and the API did not start. First seen 21 Oct.
- [To decide] Business calendar feed lists customer phone and delivery address behind a private link. First seen 19 Oct (2026-10-19-site-audit).
- [To fix] Audit setup: most runs since 15 Oct could not download Playwright or MongoDB in the sandbox, so pages behind sign-in, Hebrew renders and order flows were not checked. Still so on 25 Oct (MongoDB download 403); the preinstalled Chromium at /opt/pw-browsers/chromium works if the setup script launches it with executablePath.

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

## Merged from audit branches, 30 Oct 2026

- [Could not confirm] Table ordering codes (23 Oct, code audit): a business that had table ordering on before the codes shipped has no key until the owner opens the table sheet; two simultaneous loads could create two keys. Needs a database to show. Report: 2026-10-23-site-audit.md
## Merged from audit branches, 31 Oct 2026

- [Low] [FIXED in 1c5cc096 for repliesWithinHours; awayReply.body still open] Dashboard away-reply card: `awayReply.body` uses {{count}} with no plural forms, fails test-i18n-parity. First seen 28 Oct 2026 (2026-10-28-site-audit.md). Open.
- [Medium] Truthfulness: the new "people searched" lines on Why list, Why host and join can be made up by anyone. /site/search takes the visitor id from a request header, so three made-up ids reach MIN_SHOWN=3, and the free-text `area` becomes the public "most searched area". First seen 29 Oct (2026-10-29-site-audit.md).
- [Low] Rental figures: a designed-site visit (`/business/{slug}/visit`) trusts the client's visitor id, so an owner's visitor count and requests-per-hundred rate can be inflated (120 per 10 min per IP). First seen 29 Oct (2026-10-29-site-audit.md).
- [Low] Page translate: the daily translation allowance (300) is used up by calls that failed, because the counter is raised before the model is called. First seen 29 Oct (2026-10-29-site-audit.md).
- [Low] Tests: audit sandbox had no MongoDB again, so the full backend suite and API checks could not run (the 45 tests that need no database pass). 29 Oct (2026-10-29-site-audit.md).
## Added by the audit merge of 29 Oct 2026
Lines from the 24 to 29 Oct audit branches that were not yet here (some repeat older items in other words; kept as written).
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
- [To fix] Audit setup: most runs since 15 Oct could not download Playwright or MongoDB in the sandbox, so pages behind sign-in, Hebrew renders and order flows were not checked. Still so on 25 Oct (MongoDB download 403); the preinstalled Chromium at /opt/pw-browsers/chromium works if the setup script launches it with executablePath.
- [Low] Blazin' Boards home, phone 360x640: size labels cut by the plank box, "$700" 4.09:1. First seen 27 Oct, 2026-10-27-ui-audit.md.
- [Low] Michal Simkin reviews, phone 360x640: last quote cut by the stage and covered by the booking bar. First seen 27 Oct, 2026-10-27-ui-audit.md.
- [Low] Dashboard away-reply card: `awayReply.body` uses {{count}} with no plural forms, fails test-i18n-parity. First seen 28 Oct 2026 (2026-10-28-site-audit.md). Open.
- [Medium] Truthfulness: the new "people searched" lines on Why list, Why host and join can be made up by anyone. /site/search takes the visitor id from a request header, so three made-up ids reach MIN_SHOWN=3, and the free-text `area` becomes the public "most searched area". First seen 29 Oct (2026-10-29-site-audit.md).
- [Low] Rental figures: a designed-site visit (`/business/{slug}/visit`) trusts the client's visitor id, so an owner's visitor count and requests-per-hundred rate can be inflated (120 per 10 min per IP). First seen 29 Oct (2026-10-29-site-audit.md).
- [Low] Page translate: the daily translation allowance (300) is used up by calls that failed, because the counter is raised before the model is called. First seen 29 Oct (2026-10-29-site-audit.md).
- [Low] Tests: audit sandbox had no MongoDB again, so the full backend suite and API checks could not run (the 45 tests that need no database pass). 29 Oct (2026-10-29-site-audit.md).
## Added by the audit merge of 29 Oct 2026
Lines from the 24 to 29 Oct audit branches that were not yet here (some repeat older items in other words; kept as written).
- [Low] Dashboard away-reply card: `awayReply.body` uses {{count}} with no plural forms, fails test-i18n-parity. First seen 28 Oct 2026 (2026-10-28-site-audit.md). Fixed 29 Oct in the audit merge (02b65ebe).
- [Low] i18n: `awayReply.body` and `stays.repliesWithinHours` use a count with no plural set, so the parity check fails. First seen 29 Oct, 2026-10-29-ui-audit.md. Fixed 29 Oct in the audit merge (02b65ebe, b0f3bbff).
- [Low] Copy: exclamation mark in the away-reply placeholder (en.js:915). First seen 29 Oct, 2026-10-29-ui-audit.md. Fixed 29 Oct in the audit merge (7f048e75).
- [Low] i18n: `awayReply.body` and `stays.repliesWithinHours` use a count with no plural set, so the parity check fails. First seen 29 Oct, 2026-10-29-ui-audit.md.
- [Low] Blazin' Boards home, phone 360x640: size labels cut by the plank box, "$700" 4.09:1. First seen 27 Oct, 2026-10-27-ui-audit.md.
- [Low] Michal Simkin reviews, phone 360x640: last quote cut by the stage and covered by the booking bar. First seen 27 Oct, 2026-10-27-ui-audit.md.
- [Low] [FIXED in 1c5cc096 for repliesWithinHours; awayReply.body still open] Dashboard away-reply card: `awayReply.body` uses {{count}} with no plural forms, fails test-i18n-parity. First seen 28 Oct 2026 (2026-10-28-site-audit.md). Fixed 29 Oct in the audit merge (02b65ebe).
- [Low] [FIXED in 1c5cc096 for repliesWithinHours; awayReply.body still open] i18n: `awayReply.body` and `stays.repliesWithinHours` use a count with no plural set, so the parity check fails. First seen 29 Oct, 2026-10-29-ui-audit.md. Fixed 29 Oct in the audit merge (02b65ebe, b0f3bbff).
- [Low] Copy: exclamation mark in the away-reply placeholder (en.js:915). First seen 29 Oct, 2026-10-29-ui-audit.md. Fixed 29 Oct in the audit merge (7f048e75).
- [Low] [FIXED in 1c5cc096 for repliesWithinHours; awayReply.body still open] i18n: `awayReply.body` and `stays.repliesWithinHours` use a count with no plural set, so the parity check fails. First seen 29 Oct, 2026-10-29-ui-audit.md.
- [Low] Copy: exclamation mark in the away-reply placeholder (en.js:915). First seen 29 Oct, 2026-10-29-ui-audit.md.
- [Low] Ad maker close button about 34px, under the 44px touch size (`AdMaker.jsx:309`). First seen 30 Oct 2026 (2026-10-30-ui-audit.md).
- [Low] New hardcoded hex classes in `AdMaker.jsx` and `ListingStrength.jsx`. First seen 30 Oct 2026 (2026-10-30-ui-audit.md).
- Fixed (merged 30 Oct): awayReply.body plural-check failure (ef559ca8); away-reply default text exclamation mark removed, EN and HE (5943bd5d); stays.repliesWithinHours plural-check failure (1c4c8d33).
- Dropped (30 Oct): Gift Boutique "Scroll to open" cue fix 669299b7 is already on main (the cue is gone from both copies).
## Added by the code review of 30 Oct 2026
- [Low] Config: `WHATSAPP_PHONE_NUMBER_ID` (needed by the Meta WhatsApp sender, `utils/whatsapp.py` `_meta_config`) was missing from `backend/.env.example`. First seen 30 Oct (2026-10-30-site-audit.md). Fixed 30 Oct, 5d2b6f5f.
- [Low] WhatsApp confirm webhook: a button tap is marked "seen" before the order is moved, so if the move fails (database hiccup, a 409 race) the tap is lost and the owner gets no reply. Not reproduced. First seen 30 Oct (2026-10-30-site-audit.md).
- [Low] Tests: `tests/test_type_coverage.py` (mypy) fails on old untyped code across the backend, including the new `whatsapp.py`, `whatsapp_webhook.py` and the ad maker. Not new tonight, but the new files add to it. 30 Oct (2026-10-30-site-audit.md).
- [Low] Tests: audit sandbox had no MongoDB and no Chromium again (30 Oct); full backend suite and the live price check could not run.
- [Low] Blazin' Boards home, phone 360x640: size labels cut by the plank box, "$700" 4.09:1. First seen 27 Oct, 2026-10-27-ui-audit.md.
- [Low] Michal Simkin reviews, phone 360x640: last quote cut by the stage and covered by the booking bar. First seen 27 Oct, 2026-10-27-ui-audit.md.
- [Low] Dashboard away-reply card: `awayReply.body` uses {{count}} with no plural forms, fails test-i18n-parity. First seen 28 Oct 2026 (2026-10-28-site-audit.md). Fixed 29 Oct in the audit merge (02b65ebe).
- [Low] i18n: `awayReply.body` and `stays.repliesWithinHours` use a count with no plural set, so the parity check fails. First seen 29 Oct, 2026-10-29-ui-audit.md. Fixed 29 Oct in the audit merge (02b65ebe, b0f3bbff).
- [Low] Copy: exclamation mark in the away-reply placeholder (en.js:915). First seen 29 Oct, 2026-10-29-ui-audit.md. Fixed 29 Oct in the audit merge (7f048e75).
- [Low] Ad maker close button about 34px, under the 44px touch size (`AdMaker.jsx:309`). First seen 30 Oct 2026 (2026-10-30-ui-audit.md).
- [Low] New hardcoded hex classes in `AdMaker.jsx` and `ListingStrength.jsx`. First seen 30 Oct 2026 (2026-10-30-ui-audit.md).

## Follow-up of 31 Oct 2026
- [Low] WhatsApp webhook: a tap whose order move failed was recorded and lost (2026-10-30-site-audit.md #2). Fixed in the 31 Oct follow-up: the id is forgotten and the owner is asked to tap again (test_failed_move_is_not_lost).
- [Low] Ad maker close button about 34px (2026-10-30-ui-audit.md #1). Fixed in the 31 Oct follow-up (p-3, 44px).
- [Low] Plural checks awayReply.body and stays.repliesWithinHours, and the away-reply exclamation marks: reached main with the 31 Oct follow-up merge (test-i18n-parity passes; it failed on main before).
- [Low] Chicken Munch order page shows "Total 0" with no currency while the basket is empty (2026-10-31-ui-audit.md). Open: a business site change needs a full republish; left for the next Chicken Munch change.
- [Low] Hardcoded #F9FAFB / #E3E3E3 class names in AdMaker.jsx and ListingStrength.jsx (2026-10-30-ui-audit.md #2). Open, nit; values match the flow theme.
## Dead-ends audit of 1 Nov 2026
- [Low] `POST /notifications/preferences` saves a document nothing reads and no screen writes. Seen 1 Nov (2026-11-01-dead-ends.md). Orphaned; no site promise depends on it.
- Dead-ends audit 1 Nov: no new broken links or empty promises; still no database in the sandbox, so signed-in clicking was not possible (see "Audit setup" above).
## Code review of 1 Nov 2026
- [Low] `GET /marketplace/gigs?limit=0` (public) now reads every published listing on each request before cutting; fine at 62, worth paging in Mongo past a few hundred. Seen 1 Nov (2026-11-01-site-audit.md). Noted by the author in a code comment.
- [To fix] Audit setup still fails: MongoDB download 403 again (1 Nov), Chromium download fails; `pytest_asyncio` is also missing from the backend venv, so test_dropship, test_jobs_end_to_end, test_page_products fail to collect and the DB tests (including the new test_gigs_list_all.py) error. The preinstalled /opt/pw-browsers/chromium is still not used by the script.
- [Medium] Audit setup: 2 Nov run again had no MongoDB (403) and no Chromium, so the full backend suite could not run (only 30 tests that need no database passed). First seen 15 Oct, still open (2026-11-02-site-audit.md).
- [Low] Ad cut-outs: the cut-out step downloads each item photo URL from the server (utils/cutout.py); whether that URL is checked against the allowed-media list was not confirmed. First seen 2 Nov (2026-11-02-site-audit.md).
- [Fixed 2 Nov, 74fd0a4d] Orders: the no-login Confirm page looked orders up by an unindexed key (full scan per request).
## UI audit of 2 Nov 2026
- [Low] Chicken Munch home scrolls 7px sideways at 375 (closing block `.go-order`, `site.css:312`). First seen 2 Nov 2026 (2026-11-02-ui-audit.md).
- [Low] Footer and menu links on the 17 business sites are 19 to 24px tall on phones, under 44px. First seen 2 Nov 2026 (2026-11-02-ui-audit.md).

## Audit merge of 10 Nov 2026 (lines from the audit branches not yet on main, every line kept)

- [Fixed 2 Nov, 26b56084] Orders: the no-login Confirm page looked orders up by an unindexed key (full scan per request).
- [Fixed 5 Nov, 512b5b07] Ad maker i18n: `ads.weekVisits` and `ads.nudgeVisits` use `{count}` with no plural forms, so the parity check fails. First seen 2026-11-05 (2026-11-05-ui-audit.md). Open. Fixed 8 Nov, 60f3d4aa (names changed to {{n}}). [Fixed 10 Nov, d5450913: names changed to {{n}}]
- [Fixed 5 Nov, 512b5b0] Visit counters used {{count}} with no plural forms; test-i18n-parity failed (2026-11-05-site-audit.md). [Fixed 10 Nov, d5450913: names changed to {{n}}]
- [Low] Ad maker i18n: `ads.weekVisits` and `ads.nudgeVisits` use `{count}` with no plural forms, so the parity check fails. First seen 2026-11-05 (2026-11-05-ui-audit.md). Open. [Fixed 10 Nov, d5450913: names changed to {{n}}]
- [Low] Ads: ads.weekVisits, ads.nudgeVisits, advertising.visits have no plural forms; test-i18n-parity fails. First seen 8 Nov (2026-11-08-ui-audit). [Fixed 10 Nov, d5450913: names changed to {{n}}]
- [Low] Ads: ads.weekVisits, ads.nudgeVisits, advertising.visits have no plural forms; test-i18n-parity fails. First seen 8 Nov (2026-11-08-ui-audit). Fixed 8 Nov, 60f3d4aa (names changed to {{n}}). [Fixed 10 Nov, d5450913: names changed to {{n}}]
- [Low] Audit sandbox again had no MongoDB or Chromium for the repo's Playwright, so the new business sign-up wizard beyond its first screen and the Finest Cuts clipped/readable checks were not run. First seen 15 Oct, still open (2026-11-10-ui-audit.md).
- [Low] Backend tests: `test_dropship.py`, `test_jobs_end_to_end.py`, `test_page_products.py` fail to collect in the audit sandbox (pytest_asyncio not installed by audit-setup). First seen 9 Nov 2026 (2026-11-09-site-audit.md).
- [Low] Bookings: the price used for a code's minimum order comes from the browser (`gigs.py:1357`, `payload.amount`); unconfirmed, needs the API. First seen 6 Nov (2026-11-06-site-audit.md).
- [Low] Counters `ads.nudgeVisits`, `ads.weekVisits`, `advertising.visits` have no plural forms ("1 visits"); test-i18n-parity fails. First seen 7 Nov (2026-11-07-site-audit.md), introduced 4 Nov a27f0168. [Fixed 10 Nov, d5450913: names changed to {{n}}]
- [Low] Counters `ads.nudgeVisits`, `ads.weekVisits`, `advertising.visits` have no plural forms ("1 visits"); test-i18n-parity fails. First seen 7 Nov (2026-11-07-site-audit.md), introduced 4 Nov a27f0168. Fixed 8 Nov, 60f3d4aa (names changed to {{n}}). [Fixed 10 Nov, d5450913: names changed to {{n}}]
- [Low] Find your business on Google: an overnight opening period (Mon 20:00 to Tue 02:00) becomes start 20:00, end 02:00 on Monday (`product_extract.py` `_hours`). First seen 9 Nov 2026 (2026-11-09-site-audit.md).
- [Low] i18n: three counts without plural forms (`ads.nudgeVisits`, `ads.weekVisits`, `advertising.visits`); test-i18n-parity fails. First seen 6 Nov (2026-11-06-site-audit.md). [Fixed 10 Nov, d5450913: names changed to {{n}}]
- [Low] i18n: three counts without plural forms (`ads.nudgeVisits`, `ads.weekVisits`, `advertising.visits`); test-i18n-parity fails. First seen 6 Nov (2026-11-06-site-audit.md). Fixed 8 Nov, 60f3d4aa (names changed to {{n}}). [Fixed 10 Nov, d5450913: names changed to {{n}}]
- [Medium] Audit setup hung over 40 minutes at the dev-server step on 5 Nov, so no build or full suite ran (2026-11-05-site-audit.md).
- [Medium] Audit setup, 7 Nov: no MongoDB (403), no Chromium, full backend suite cannot run; `pytest_asyncio` and `mongomock_motor` missing from the venv. Still open since 15 Oct.
- [Medium] Sign-up draft reminder email goes to any address a visitor types (no verification), up to 10 new drafts per day per IP (`signup_drafts.py` save_draft). First seen 9 Nov 2026 (2026-11-09-site-audit.md).
- [To fix] Audit setup hung over 10 minutes without a database on 8 Nov (dead-ends audit), so no signed-in clicking. First seen 23 Oct (2026-11-08-dead-ends.md).

## Code review of 10 Nov 2026
- [Low] Weekly "your ad is ready" email: "Stop these emails" has no switch to turn them back on (`ad_emails_off` missing from `EMAIL_SWITCHES` and `EmailSwitches.jsx`). First seen 10 Nov 2026 (2026-11-10-site-audit.md). Open.
- [Medium] Catalog and ad picture cutting blocked the server for every visitor (~0.4 s a picture, up to 30). First seen 10 Nov 2026 (2026-11-10-site-audit.md). [Fixed 10 Nov, 879d76dc; on this branch fb2b7fa0]
- [Low] `dashboard.adPicsDone` without plural forms ("with 1 photos"); test-i18n-parity failed. First seen 10 Nov 2026 (2026-11-10-site-audit.md). [Fixed 10 Nov, d10948a5; on this branch 2f994fc4]
- [Medium] Customer messages: holiday and "been a while" templates could be sent with their [What you offer...] gaps unfilled; `_UNFILLED` matched only "Your"/"שלכם" since 5 Nov. First seen 10 Nov 2026 (2026-11-10-site-audit.md). [Fixed 10 Nov, 965610bd; on this branch 3c9a22fa]
- [Decision] Weekly ad email will reach every existing business with a product photo and no saved ad on the first weekday morning after deploy. First seen 10 Nov 2026 (2026-11-10-site-audit.md).

## UI audit of 11 Nov 2026
- [Low] Sign-up: "Your page is 0% ready" sits on a step bar already a third full, so the two progress signals disagree on the first screen (`CreateGig.jsx:1157` and `:1183`). First seen 11 Nov 2026 (2026-11-11-ui-audit.md). [Fixed 11 Nov, 94740084]
- [Low] Sign-up: the seven "+ Add ..." shortcut chips are 26px tall, "Start over" 16px and the bare-header language switch 34px, under 44px on phones (`CreateGig.jsx:1198`, `:1176`; `Navigation.js:354`). First seen 11 Nov 2026 (2026-11-11-ui-audit.md). [Fixed 11 Nov, 94740084]
- [Low] L.A. Cholent home, 1000x700 window: the kosher line "Kosher, hechsher from Rabbi Weiner" wraps and its second line is cut by the pinned opening (bottom 713px of 700) while the opening holds. First seen 11 Nov 2026 (2026-11-11-ui-audit.md).
- [Low] Sign-up "your page is live" heading had an exclamation mark (en + he). First seen 11 Nov 2026. [Fixed 11 Nov, 9d2ecd60; on this branch 46fada04]

## Follow-up 11 Nov 2026 (audits of 6 to 11 Nov)

- Fixed, merged to main with this follow-up: visit counters' plural check (`advertising.visits`, `ads.nudgeVisits` read {{n}}; `ads.weekVisits` got plural forms in the locales, so `AdMaker.jsx` stayed untouched); `dashboard.adPicsDone` plural; picture cutting in a thread; holiday and win-back template gaps; "Your page is live" without "!".
- Fixed 11 Nov (9eb94972): ad emails stop link now has a switch (Ready-made ads, email settings); Google hours past midnight end at 23:59; sign-up bar fills with readiness, not step; sign-up chips, Start over and language switch 44px; sign-up welcome eyebrow readable (was accent on accent).
- Fixed 11 Nov: `audit-setup.sh` installs pytest-asyncio and mongomock-motor, so the three test files collect.
- Not a bug: booking discount minimum uses the browser's amount (`gigs.py`, 6 Nov). Hand-built pages send their own composed price, the business sees that price and the discount in the booking message, and no payment is taken, so an inflated amount only fools the customer's own booking. Rejected.
- Not a bug: `GET /gigs/{id}/code-box` without a rate limit (6 Nov). It returns a yes/no and the pause state only. Rejected.
- Moot: the weekly ad email going to every owner at once on first deploy (10 Nov). It deployed with main on 10 Nov.
- Decided 12 Nov (Tzvi: "do it for any email they put in"): the sign-up draft reminder keeps going to any typed address. Closed; noted in `signup_drafts.py` so audits do not re-report it.
- Left to the L.A. Cholent session: the kosher line is cut by 11px at 1000x700 (11 Nov). Another session was changing that site the same day.
- Still open, not re-checked: Hadassah Prys phone booking bar over the Day field (9 Nov, unconfirmed); Gifted Israel basket column at the end of the shop (11 Nov, unconfirmed); footer and menu links on business sites under 44px (2 Nov); ad maker close button about 34px (30 Oct, `AdMaker.jsx` needs check-ad-designs with local servers); audit sandbox has no MongoDB or Chromium download (proxy, since 15 Oct).

## Code review of 11 Nov 2026
- [Medium] Leads board / business email: an email whose AI reading never runs (the server restarts or deploys between receiving it and reading it) stays "pending" for good and never appears on the leads board or in a nudge; nothing retries it (`email_inbox.py` `receive`, `email_cards`). First seen 11 Nov (2026-11-11-site-audit.md).
- [Low] Backend tests: `mongomock_motor` and `pytest_asyncio` are not in requirements, so the new `test_email_inbox.py` (and the three older files) cannot collect on a fresh install. First seen 20 Oct; now 4 files (2026-11-11-site-audit.md). [Partly fixed 11 Nov, bbea0462: audit-setup.sh installs both; still not in requirements.txt]
- [Fixed 11 Nov, 68ce50f5; on this branch fae1e96c] Socials reader: the website lookup at sign-up blocked the whole server while DNS resolved (2.01 s stall with a slow domain).
- [Fixed 11 Nov, d9e5be86; on this branch 6fe9f6a8] Socials reader: a website's whole page was read into memory before it was cut to 1.5 MB (60 MB held for a 60 MB page).
- [Fixed 11 Nov, 087ca753; on this branch d9211791] Order and booking emails ended their first line with the text's "Your tracking link:" / "Details:" pointing at nothing.
- Still open on main, fixed on audit branches: `ads.nudgeVisits`, `ads.weekVisits`, `advertising.visits` (d5450913) and `dashboard.adPicsDone` (d10948a5) plural sets; test-i18n-parity still fails on main for these 4. [Fixed, merged to main with the 11 Nov follow-up, 162b4996]

## UI audit of 12 Nov 2026
- [Medium] Business sites, phones: the "Back to businesses" pill sits over the in-page "Order Large" button on L.A. Cholent's order page; `lift()` only clears fixed bars (`mir-back.js:26`). First seen 12 Nov 2026 (2026-11-12-ui-audit.md).
- [Low] Business sites: "Back to businesses" pill is 26px tall, under 44px (`mir-back.js:23`); size needs Tzvi's decision ("block less"). First seen 12 Nov 2026 (2026-11-12-ui-audit.md).
- [Low] M and N Jewelry home: "Scroll to see the stone" scroll hint (`m-and-n-jewelry/index.html:39`, `build.py:100`), against rule 5b.6; RULES.md marks it passed. First seen 12 Nov 2026 (2026-11-12-ui-audit.md).
- [Medium] M and N Jewelry home: opening film frozen on 48% of frames (`check-film-video`), RULES.md R3h.24 marks it passed; blocks any republish of the site. First seen 12 Nov 2026 (2026-11-12-ui-audit.md).
- [Low] Dashboard leads settings, order texts panel and overview: new controls at 36 to 40px (`LeadsSettings.jsx:23,71,80,108`, `TextNotificationsPanel.jsx:152,188,199`, `OverviewTab.jsx:193`). First seen 12 Nov 2026 (2026-11-12-ui-audit.md).
- (info, audit tooling) The repo's Playwright runs if `/opt/pw-browsers/chromium_headless_shell-1243` is linked as `-1234` (and `chromium-1243` as `-1234`). 12 Nov 2026.

## Code review of 12 Nov 2026
- [Low] Discount codes: the new practice order (`POST /order-form/{gig}/orders?dry_run=true`, no sign-in) checks a code and answers which ones are real at 400 tries per 10 minutes per address, against 30 on the code box; a business's own word codes ("SUMMER10") can be guessed that way. Fix: also apply the `discount_check` limit when `dry_run` carries a code (`orders.py:2515`). First seen 12 Nov 2026 (2026-11-12-site-audit.md). Report only (discounts).
- [Medium] Sign-up website reader blocked the whole server on a slow domain and read whole pages into memory: last night's fixes (68ce50f5, d9e5be86) never reached main and 508a81d made it fetch up to six pages per site. First seen 11 Nov; came back 12 Nov (2026-11-12-site-audit.md). [Fixed 12 Nov, d69087db, on claude/exciting-bell-jpiuoz; the old fix on claude/audit-merge-4mafu8 will conflict with main and should be dropped in favour of this one]
- [Medium] Designed-page menus (Finest Cuts, mir-catalog.js): products lost their description and products saved before ids existed lost their order id, so they dropped off the Finest Cuts menu; 5ebe10b8 undid that part of 5dee7ca8 unnoticed. First seen 12 Nov 2026 (2026-11-12-site-audit.md). [Fixed 12 Nov, 777b4185, on claude/exciting-bell-jpiuoz]
- Still open: unread business emails never reaching the leads board (11 Nov); `mongomock_motor` and `pytest_asyncio` not in requirements (20 Oct); audit sandbox has no MongoDB or Chromium download (15 Oct).
