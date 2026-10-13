# Open issues from the audits

One line per issue. Every audit reads this before reporting, so a known
issue shows as "still open" instead of being found again as new. Update it
at the end of every run: add what is new, mark what was fixed (with the
commit), and move fixed lines to the bottom section after a week.

Format: `- [Severity] Area: what goes wrong, for whom. First seen DATE (report). Status.`

## Open

- [Medium] Subscriptions: a business paying through PayPal has no way to cancel in the app (`POST /marketplace/subscription/cancel` has no caller). First seen 11 Oct (dead-ends). Needs a decision: build the control, or confirm no paid plans are live.
- [Medium] Emails: several say "reply to this email", but they come from a no-reply address with no Reply-To. First seen 11 Oct (dead-ends). Needs a decision: which address replies go to.
- [Medium] Restaurants: "we will email you when you are listed" and the claim-rejected message promise emails that are never sent. First seen 11 Oct (dead-ends).
- [Medium] Requests board: a poster cannot edit their request (typo, budget, WhatsApp); the endpoint exists with no screen. First seen 11 Oct (dead-ends).
- [Medium] Published services: availability, contact details, area and Hebrew title cannot be changed after publishing. First seen 11 Oct (dead-ends).
- [Low] Saved-search alerts are not sent for listings added by bulk upload. First seen 11 Oct (dead-ends).
- [Low] Pricing tips toggle promises a weekly note for any rental; it only runs for vacation listings with Smart Pricing. First seen 11 Oct (dead-ends).
- [Low] Dashboard, My services: the "Edit provider profile" window is English only. First seen 13 Oct (follow-up).
- [Low] KasherMyBnb site: the services list is three equal cards (a design ban). First seen 13 Oct (UI audit). Design call.
- [Low] Page editor link filter accepts "/%2F/evil.com"; it stays a path on this site, so probably harmless. First seen 12 Oct (site audit).
- [Owner action] Blazin' Boards: "Deliver to me" is hidden because delivery was never turned on in their order settings (the default). First seen 12 Oct.

## Fixed

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
