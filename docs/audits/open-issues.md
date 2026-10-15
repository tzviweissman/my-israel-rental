# Open issues from the audits

One line per issue. Every audit reads this before reporting, so a known
issue shows as "still open" instead of being found again as new. Update it
at the end of every run: add what is new, mark what was fixed (with the
commit), and move fixed lines to the bottom section after a week.

Format: `- [Severity] Area: what goes wrong, for whom. First seen DATE (report). Status.`

## Open

- [Low] Gift Boutique: a "Scroll to open" cue sat over the opening box (banned by page rules). Fixed 15 Oct, ee73f895 (2026-10-15-ui-audit.md).
- [Low] Business insights: an en dash shown for an empty average. Fixed 15 Oct, a3bb67b5.
- [Low] Restaurants search box: the hint is cut off at 375 wide ("...neighbourh"). First seen 15 Oct (2026-10-15-ui-audit.md).
- [Low] Business insights: new hardcoded error colour #B42318 (BusinessInsights.jsx:~108). First seen 15 Oct.
- [Low] Gift Boutique pages are English only, even for Hebrew visitors. First seen 14 Oct, still open.
- [Low] Page editor link filter accepts "/%2F/evil.com"; it stays a path on this site, so probably harmless. First seen 12 Oct (site audit).
- [To check] Emails: replies now go to support@myisraelrental.com (EMAIL_REPLY_TO). The domain receives mail (Private Email); confirm that mailbox exists and is read.

- [Low] Tests: i18n parity fails on restaurants.more (count without plural); completeness script fails on the "category" checklist item. Since 8 Oct (site audit 13 Oct).
- [Low] Gift Boutique: heading contrast flagged 2.73:1 by readable.mjs, probably mid-fade; re-measure. First seen 14 Oct (UI audit).

- [Medium] Restaurants: the photo endpoint has no rate limit; anyone can use up the month's 4,000 Google photos. First seen 14 Oct (site audit 14 Oct).
- [Low] Holidays: Sukkot fallback window ended 3 Oct; needs 5788 dates. First seen 14 Oct (site audit 14 Oct).
- [Low] Memberships: sign-up emails any typed address (20 per 10 min per IP). First seen 14 Oct (site audit 14 Oct).
- [Low] Jobs board area strings: fix 51649002 sits on an unmerged branch, so en.js still lacks them. Since 8 Oct.

## Fixed

- [Medium] Orders: "Delivery not available" in a description turned delivery on. Fixed 14 Oct, 8df68686.
- [Low] Restaurants: non-ASCII admin token header gave a 500. Fixed 14 Oct, 6814df4.

- [Medium] Join rules page: back link and title sat under the taller nav on phones. Fixed 14 Oct (UI audit).

- [Low] Jobs board: area filter strings were missing in English and Hebrew. Fixed 13 Oct, 51649002.

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
