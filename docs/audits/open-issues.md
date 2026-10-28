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

- [Low] Dashboard away-reply card: `awayReply.body` uses {{count}} with no plural forms, fails test-i18n-parity. First seen 28 Oct 2026 (2026-10-28-site-audit.md). Open.
