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
