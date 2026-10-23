# Open issues from the audits

One line per issue. Every audit reads this before reporting, so a known
issue shows as "still open" instead of being found again as new. Update it
at the end of every run: add what is new, mark what was fixed (with the
commit), and move fixed lines to the bottom section after a week.

Format: `- [Severity] Area: what goes wrong, for whom. First seen DATE (report). Status.`

## Open

Merged 23 Oct 2026 from every audit branch of 16 to 22 Oct (none had been merged), each line re-checked against main.

- [Decide] Leads board shows a chat-only customer's profile phone to the business (leads.py:105). First seen 22 Oct (site audit). Needs Tzvi.
- [Decide] Table orders: anyone with a restaurant's order link can send table orders with no name or phone (20 per 10 min per address; no per-table secret). First seen 20 Oct. Needs Tzvi.
- [Decide] Business calendar feed (private link) carries customer phone, email and delivery address. First seen 18 Oct. Needs Tzvi.
- [Medium] Reorder: if sending raises (not just fails), the run stays "sending" and can never be sent or skipped (reorder.py:279-289). First seen 22 Oct.
- [Medium] Appointment reminder is logged as sent before the email; a failed send is never retried (appointment_reminders.py:107, 133). First seen 21 Oct.
- [Medium] Table orders appear in the order form's returning-customer suggestions as "Table 5" (orders.py returning_customers groups by name). First seen 20 Oct.
- [Medium] Gift-card order email goes to any typed address with no confirmation and no unsubscribe link (gift_cards.py:151-203). First seen 21 Oct.
- [Low] Five count texts have no singular/plural forms (customers.more, editListing.extrasPairs, restaurants.more, summary.appointments, summary.visits); test-i18n-parity fails on them. 23 Oct.
- [Low] Customer messages: any "[text]" of 3+ letters blocks sending (customer_messages.py:185). First seen 21 Oct.
- [Low] Calendar import downloads the whole file before checking its size (calendar_sync.py:283; property iCal sync has no cap). First seen 16 Oct.
- [Low] Hardcoded colours in new panels (PaymentRequestsPanel, AutomationsPanel, LeadsBoard, AppointmentsTab, RestockNotify) and the services map popup. First seen 21 Oct.
- [Low] Page editor link filter accepts "/%2F/evil.com"; stays a path on this site, probably harmless. First seen 12 Oct.
- [To check] Emails: replies go to support@myisraelrental.com; confirm that mailbox exists and is read. Tzvi.
- [To check] The Brown Box and Blazin' Boards: pinned opening reported 64 to 96px taller than the room under the header at 360 to 768 wide (23 Oct UI audit; screenshots show nothing hidden); check on a real phone.
- [To fix] Audit setup: most runs since 15 Oct could not download Playwright or MongoDB in the sandbox, so pages behind sign-in, Hebrew renders and order flows were not checked.

## Fixed

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
