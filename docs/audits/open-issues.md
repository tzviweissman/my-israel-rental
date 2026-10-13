# Open issues from the audits

One line per issue. Every audit reads this before reporting, so a known
issue shows as "still open" instead of being found again as new. Update it
at the end of every run: add what is new, mark what was fixed (with the
commit), and move fixed lines to the bottom section after a week.

Format: `- [Severity] Area: what goes wrong, for whom. First seen DATE (report). Status.`

## Open

- [Medium] Business page: the browser tab title uses a long dash. First seen 11 Oct (UI audit).
- [Medium] Dashboard, My services: a button's text fails the contrast minimum. First seen 11 Oct (UI audit).
- [Medium] Dashboard, Deliveries: an in-app link uses a plain `<a>`, which reloads the whole app. First seen 11 Oct (UI audit).
- [Medium] Dashboard, Overview: "Waiting on you" can open an empty pane. First seen 11 Oct (dead-ends).
- [Medium] Dashboard: renters have no Contracts tab to reach their signed contracts. First seen 11 Oct (dead-ends).
- [Medium] Contracts: the WhatsApp message about a contract is missing the booking reference. First seen 11 Oct (dead-ends).
- [Low] Admin, restaurants: finding map pins fails the whole batch if one address lookup times out. First seen 11 Oct (site audit).
- [Low] Page editor and showcase: new screens use fixed colour codes instead of the design tokens. First seen 11 Oct (site audit).
- [Owner action] Blazin' Boards: "Deliver to me" is hidden because delivery was never turned on in their order settings (the default). First seen 12 Oct.

## Fixed

- [Medium] Page editor: an owner could save a link to another site ("//evil.com"). Fixed 12 Oct, 8e2da7fb.
- [Low] Hand-built pages: anyone could skip the cache with `?fresh` as often as they liked. Fixed 12 Oct, 8e2da7fb (limited to once a second).
