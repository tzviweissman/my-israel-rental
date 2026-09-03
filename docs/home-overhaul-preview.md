# Home overhaul — preview at `/home-preview`

**Status:** built, not adopted. `/` is still the cinematic page. Nothing links to
the preview and it ships `noindex`, so it costs a visitor nothing while it waits
for a decision.

## What it is

A home page whose hero is the site's own supply. Two rails of cards ride out of
a vanishing point toward the viewer; every card is a live listing or a live
business, pulled from the same public endpoints the boards use. Beneath it:
search doors, a featured-rentals rail, a businesses rail, how-it-works, the
supply band, and the finale the current page already ends with.

The argument for it over the cinematic page: the cinematic page's seven scenes
are generated stills of nobody's apartment. This one shows a visitor, in the
first second, that there are real places and real businesses here. It is also
about a fifth of the scroll length and carries no video.

The cinematic page is **exempt from the positioning rules** by Tzvi's ruling of
18 August 2026 and stays as built. This page is not exempt, so it follows them:
rentals lead, the services marketplace is equally supported, and the supply CTA
is "Add your business — free" rather than anything addressed to owners.

## The pieces

| File | What it does |
|---|---|
| `frontend/src/components/ui/image-stream-hero.jsx` | The corridor. Third-party component, ported from TypeScript to JSX because this project is CRA + JavaScript (`components.json` says `tsx: false`). Geometry and comments are the author's; nothing was re-derived. |
| `frontend/src/components/home/useHomeShowcase.js` | One fetch of each public list, three views over it: the corridor's cards, the rentals rail, the businesses rail. |
| `frontend/src/pages/HomePreview.jsx` | The page. |
| `frontend/src/styles/home-v2.css` | Its styles, namespaced `hv2-` so they cannot collide with the cinematic page's `.finale` / `.kick`, which this page reuses unchanged. |
| `scripts/check-home-preview.mjs` | The browser check. |

## Two things worth knowing before changing it

**The corridor's geometry is interdependent.** Card count, exit height and rail
spread trade against each other: the ribbon only looks solid while consecutive
cards overlap. Raising `exitHeight`, dropping `cards`, or pulling `railExit` in
all tear a visible gap near the frame edge. The component's header comment
explains why each default is what it is; read it before tuning one number.

**A hero full of fallback stills looks finished.** If both fetches fail,
`useHomeShowcase` falls back to the generated site stills and the page still
looks complete — which is right for a visitor and wrong for a check. So
`check-home-preview.mjs` reads the card `src` attributes and asserts they are
listing/business uploads rather than anything under `/site/`. A screenshot
cannot tell those two states apart; that is the whole reason the check reads
sources instead.

The check also asserts the cards are requested at card width. Twenty-four cards
at full resolution is roughly thirty megabytes of hero.

## Two defects the check caught that a card count would not have

Both were mine, both were invisible to the assertions the check started with.

**A bare `1fr` is `minmax(auto, 1fr)`,** so a grid track never shrinks below its
content's min-content width. One business card holding a 2000px flyer widened
its column until the four-card row ran past its wrapper and the last card was
sliced off by the window. Every card was still in the DOM and every count was
still green. Tailwind's `grid-cols-4` is `repeat(4, minmax(0, 1fr))` for exactly
this reason, which is why the services board never showed it. The check now
measures: no card outside its section, and every card in a row the same width.

**The first version of the "these are real photos" assertion failed the page it
was written for.** It demanded the file sit directly under `myisraelrental/`,
and every imported listing's photo is one folder deeper. It reported a broken
hero that was in fact showing ten real listings. The assertion that survives
excludes the fallback set by name, since that is the actual thing being ruled
out.

## Running it

The page needs data, so point a built bundle at an API that has some:

```bash
cd frontend && REACT_APP_BACKEND_URL= npx craco build
```

```bash
PORT=3000 API_PROXY_TARGET=https://my-israel-rental-production.up.railway.app node frontend/server.js
```

```bash
node scripts/check-home-preview.mjs
```

There is a `frontend-build` entry in `.claude/launch.json` that does the second
command. Against a local API instead, set `API_PROXY_TARGET=http://localhost:8001`
and seed some listings first, or the rails render empty and the corridor falls
back to stills.

## Open decisions

- **Does this replace `/`, or become a second surface?** If it replaces it, the
  cinematic page's scenes and its scroll engine come out with it, and
  `docs/hero-cinematic-spec.md` plus the ruling in
  `docs/redesign-and-wanted-board-prompt.md` need amending — that ruling names
  `cinematic-preview.html` as the home page.
- **Cards are unfiltered.** Every published listing and business with a photo is
  eligible for the corridor. There is no quality bar, so a dark or badly cropped
  photo rides past the headline at full size. Featured-first ordering exists on
  the rentals rail but the corridor interleaves by recency.
- **Twelve distinct images, twenty-four cards.** Both rails walk the same
  sequence from index 0, so `cards` is also how many distinct photos ever
  appear — the component's default of nine showed nine listings and ignored the
  rest. Twelve per rail is the current setting. Raising it only makes the
  corridor denser; lowering it is the direction that tears the ribbon.
