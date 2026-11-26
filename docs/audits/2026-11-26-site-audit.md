# Code review, 26 Nov 2026

## In short
- One gap in today's code, not yet live anywhere: the new "choose up to 3 flavours" sheet on hand-built business sites does not know when the owner has marked a flavour out of stock. A customer can pick it, the order is refused behind the scenes, so it never reaches the business's dashboard, and WhatsApp still opens as if all is well. No live site uses flavour picks yet; it matters from the first one (Bawk Bawk).
- Everything else today was build tools, ad rules and one card layout change, and they hold up: nothing touched the server, prices, sign-in or contracts. The website still prices every listing the same way the server does.
- Fixed tonight: nothing; the one finding touches orders, which audits report and do not change.
- Needs your decision: none new. Simplest fix for the above, when you want it: grey out a flavour the owner has marked out of stock, the way sizes already are. Still waiting from earlier: staff sending test texts (24 Nov), the discount-code items (22 and 23 Nov), the payment-link draft clash (25 Nov).

## New findings

1. **[Medium] Starter shop flavour picks ignore a flavour being out of stock, and the order is then lost to the dashboard.** New in 46bb36c5. The picks sheet draws every flavour as a free checkbox (`scrollcraft/starter/shop.js:50-51`); nothing reads the flavour's stock. The live-stock pass that keeps the page in step with the dashboard only updates basket entries named `<product>::<option>` (`scrollcraft/starter/catalog.js:49`), and a picks product has none (it is given `sizes: []`, `shopkit.py:43`). The owner can untick "In stock" per option in the dashboard (`frontend/src/components/dashboard/ProductExtras.jsx:112`), and the site's own order page hides such options (`frontend/src/pages/OrderPage.jsx:509`). The server drops out-of-stock options and refuses when the count no longer matches (`backend/routes/marketplace/orders.py:2800-2802`, 400 "Pick up to N for ..."). On a 400 the shop's `save()` returns null (`shop.js:176`) and the submit handler opens WhatsApp regardless (`shop.js:193`), with no message on the page and no tracking link. Sequence: owner marks "Spicy" out of stock; customer picks Spicy + BBQ; presses Send; WhatsApp opens; the dashboard has no order. Fix: in `catalog.js` liveStock, also set `f.out` on `it.flavours` from `p.options[].in_stock`, and in `shop.js:51` render such a chip `disabled` with the `out` class (about 4 lines). Not fixed: it changes what an order can contain. Latent: no published site's catalog uses `picks` today (grep of `frontend/public/pages/*/catalog.js` and `scrollcraft/builds/*/catalog.js` found none).

No other findings; none dropped.

## Fixed this run
- None.

## Still open
- 25 Nov [Medium]: a saved page draft puts old payment links back over ones changed on Texts and emails; not touched today.
- 24 Nov [Low]: staff with the Orders area can send test texts and use translations on Texts and emails.
- 22 and 23 Nov discount-code findings: waiting on a decision.
- `test-i18n-parity` fails the same 3 checks as last night (stray he.js keys, t() keys missing from en.js, plural sets); the fixes are on audit merge branches, not on main.
- Everything else in `open-issues.md` was outside today's changes and not re-checked.

## Could not confirm
- The flavour finding end to end in a browser: no database or API here. A local store whose platter has `picks: 3` with one option `in_stock: false`, opened on a starter-kit shop page, would show it.

## Verified working
- **Flavour picks pricing** (`shop.js`, `orders.py:2797`): the page charges the product's own price for any picks line, and so does the server; the line is sent as `option_ids`, which the server takes (max 10), and more than N picks is refused on both sides. Normal products and sizes still send `option_id` as before.
- **Service cards** (`ServiceCard.jsx`): the swap of business name and service title is display only; `bizFirst` falls back to the title when a card has no business name; a business's own page passes `bizFirst={false}`.
- **Publish check for phone video** (`publish-page.mjs:125`): every mp4, webm and mov under a site's assets is read with ffprobe and refused unless 4:2:0; run over every build's assets here, all pass (American Crust's loop is `yuvj420p`, accepted). `check-film-plays.mjs` only reads pages, writes nothing, and marks itself `mir-check` so it is not counted as a visitor.
- **`stop-stale-servers.mjs`**: dry run by default, only processes older than 6 hours and matching dev-server patterns; Windows only (PowerShell), so it does nothing here.
- **Other scripts** (screen-strip, check-site, check-opening-photo, judges, ad-blueprint, check-ad-designs, ad-chat-view, check-concept): read local pages and files only; no data, secrets or network beyond the local preview.
- **Tests**: price parity 17 passed. Script tests: 10 pass; `test-i18n-parity` as above; 4 need a browser or API (below).
- **Build**: production build passes (exit 0; only the old Tailwind `ease-[...]` / `duration-[...]` ambiguity warnings).

## Not checked
- PRICE CHECK DID NOT RUN: `could not read https://myisraelrental.com/api/properties (<urlopen error Tunnel connection failed: 403 Forbidden ...>)`. The price parity test ran and passed.
- `FAILED  playwright + chromium`, `FAILED  mongodb on :27017 (... curl: (22) The requested URL returned error: 403 )`, `SKIPPED api (no database)`. So `test-order-picks.mjs`, `test-signup-flow.mjs`, `test-tier-limit.mjs` and `test-moving-ad-checks.mjs` did not run.
- Full backend suite: not run without a database (no backend change today).
- How the new service cards and the American Crust opening look: the UI audit's area.
