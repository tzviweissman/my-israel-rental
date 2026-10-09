# Hand-built business pages on the live site

Since 7 Oct 2026 (Tzvi: "push Blazin' Boards to the live site", replacing
their listing page), a page built by hand in `scrollcraft/builds/<folder>`
can be shown at the business's own address, `/business/<slug>`, instead of
the standard listing page.

## Publish

```
node scripts/publish-page.mjs <build-folder> <business-slug>
```

That copies the page's HTML, CSS, JS and `assets/` into
`frontend/public/pages/<slug>/`, rewrites its relative links to
`/pages/<slug>/...` (stamped `?v=` so a republish never runs with cached
CSS), and adds the slug to `frontend/public/pages/pages.json`. Commit and
push; the frontend deploy ships it.

## How it is served

- `frontend/server.js`: a full load of `/business/<slug>` (or the root of
  `<slug>.myisraelrental.com`) answers with `build/pages/<slug>/index.html`
  when the slug is in `pages.json`. The page's other HTML files
  (`/pages/<slug>/order.html`) are answered directly too.
- `frontend/src/pages/BusinessPage.jsx`: navigation inside the app never
  reaches the server, so in production the standard page reloads into the
  hand-built one when its slug is listed. Not in dev, where it would loop.
- Link previews (WhatsApp and the like) still get the business's card: the
  bot branch in `server.js` answers before this.

## Gotchas found while building it

- **`/p/` is taken**: `public/serve.json` redirects `/p/:slug` to the short
  links API. The pages live under `/pages/`.
- **`order.html` turned into "page not found"**: serve-handler's clean URLs
  redirect `x.html` to `x`, and the SPA catch-all rewrite then answers `x`
  with the app. Hence `server.js` serves the pages' HTML itself.
- **Assets are cached for a year** by `serve.json`; the publish script's
  `?v=` stamp is what makes an update visible.
- **The page's order form must read the live listing**, not the local seed:
  live product names differ ("Medum Blazin Board", "mini board"), have no
  groups or sizes, and delivery may be off. Blazin' Boards' `order.html`
  matches each product to their published price list by its words and takes
  the id and price from the listing, so what is ordered and charged is the
  listing's. Test a page against the live API (the `frontend-build` launch
  config proxies `/api` to production) before publishing it; read only,
  never place a test order on a real business.

## Unpublish

Delete `frontend/public/pages/<slug>/`, remove the slug from `pages.json`,
commit and push.

## No flash of the standard page (9 Oct 2026)

Inside the app, a business page or one of its listings used to render the
standard page and then jump to the hand-built one. `frontend/src/utils/
handBuiltPages.js` now fetches `pages.json` once at start-up, and
`BusinessPage.jsx` and `GigDetail.jsx` hold their loader until they know, so
the standard page never shows for a business in the list. Nothing to do per
page: publishing adds the slug, and that is all the check reads.

## Show it on /showcase (the Mobbin-style gallery)

Every published page also goes on `/showcase`, a grid of live previews
(Tzvi, 9 Oct 2026, after Mobbin's sites gallery). After publishing:

```
cd frontend && node ../scripts/showcase-preview.mjs <slug>
```

writes `frontend/public/showcase/<slug>.mp4` (a 12 s, 960 px clip of the live
page scrolling) and `<slug>.webp` (its still). Then add the business to
`frontend/public/showcase/showcase.json`: `slug`, `name`, `line` (one line
in their words) and `line_he`, and `logo` (a 96 px square in the same
folder) or `mark` + `markColor` + `markInk` when there is no logo. Newest
first.

## The owner edits it in their dashboard (9 Oct 2026)

Tzvi: "easy to move text or change text like I can on Claude design ... or
photos". A business with a hand-built page gets **Edit your page** in its
dashboard card (MyBusinessesTab), which opens `/dashboard/page-editor/<id>`
(`src/pages/PageEditor.jsx`). There they click text to select it and click
again to type, drag anything to move it (laptop and phone moves are kept
separately), make it bigger or smaller, align or hide it, and replace a
photo. Undo, redo, Save, and "Original design" to drop every saved change.

How it fits together:

- **publish-page.mjs** marks what may be edited with `data-mir-key`: every
  `<img>`, and the outermost element that holds text directly with only
  inline formatting inside. Keys hash the original content, so a republish
  of unchanged content keeps the owner's edits; text the page's own script
  writes (an `aria-live` total, an element its script finds by id) is left
  alone. `data-mir-skip` on an element keeps it and everything inside it out.
- **Edits are saved** by `routes/marketplace/page_edits.py`
  (`PUT /marketplace/businesses/{id}/page-edits`, owner or admin; `DELETE`
  resets). Text keeps only inline formatting and safe links; photos must be
  https; moves and sizes are bounded numbers.
- **frontend/server.js applies them** when it serves the page (text, photo,
  a style block for moves), so visitors never see the old version first.
  With `?mir-edit=1` it also adds `public/pages/mir-editor.js`, which is the
  editing itself; the dashboard frames that.

## Prices follow the dashboard

Put a `prices.json` in the build folder naming which listing each price on
the page shows:

```
{ "Personal Training": { "was": 60, "sym": "₪" } }
```

The name is the product or tier name exactly as in their listing. When the
listing's price changes, server.js changes "₪60" (and "60 NIS") in the
page's text to the new price. It does not touch the page's own scripts, and
it skips a price two items share, since it cannot tell them apart. Set up
for Michal Yodaiken, KasherMyBnb and Blazin' Boards; Bun Intended's listing
has one price for every flavour and La Cholent's prices live in its script,
so those two are not synced.
