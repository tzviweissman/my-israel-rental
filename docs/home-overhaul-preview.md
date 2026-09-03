# Home overhaul — preview at `/home-preview`

**Status:** built, not adopted. `/` is still the cinematic page. Nothing links to
the preview and it ships `noindex`, so it costs a visitor nothing while it waits
for a decision.

## What it is

A home page whose hero is the site's own supply. Two rails of cards ride out of
a vanishing point toward the viewer on a white ground; every card is a live
listing or a live business, pulled from the same public endpoints the boards
use. Beneath it: search doors, a featured-rentals rail, a businesses rail,
how-it-works, a supply-side CTA with a four-photo gallery, and the finale the
current page already ends with.

The hero is **white** (Tzvi, 3 September; it was the deep brand blue). That is
not only a fill: the type flips to ink with the on-light display gold, the
CTAs stop being the white/outline-white pair that exists for a hero photo, and
the fixed nav — white text in translucent bubbles under a dark gradient — has
to change with it or it is white on white. The page marks the body while it is
mounted and `home-v2.css` carries a light nav variant scoped to that mark, so
no other page is touched and the nav's own file is unchanged.

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
| `frontend/src/components/ui/cta-section-with-gallery.jsx` | The supply-side CTA's staggered text column and offset four-cell photo grid. Also ported from TypeScript. Needs `motion`, the one dependency added; it lands in this page's lazy chunk, and the entry bundle did not move. |
| `frontend/src/components/ui/anti-metal-button.jsx` | The CTA's primary button, whose gold panel sweeps the width on hover. Ported from TypeScript and recoloured to the palette. |
| `frontend/src/utils/cdnImage.js` | Gained `framedImage`, which fits a whole image into a fixed box and pads the rest. |
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

## The gallery pads its photos rather than cropping them

Many businesses upload a **flyer** as their cover, not a photograph. Fitting a
wide flyer into the gallery's portrait cell by cropping took the first and last
letters off every line: the section shipped reading "sach & / ar round / tchen
/ shering". A content-aware crop (`c_fill,g_auto`) was better and still wrong —
on that same flyer it locked onto the person and cut the words anyway.

`framedImage` pads instead, with `b_auto` filling the remainder from a colour
sampled out of the image, so a flyer reads as a framed flyer and a photo that
already fits the box is untouched. Nothing is ever cut. The check asserts the
transform, because the failure is legible only by reading the words in the
picture.

Motion is configured with `reducedMotion="user"`, which drops transform and
layout animation for anyone who asked for less movement while letting the fade
run. The alternative — disabling the animation outright — is how content that
starts at `opacity: 0` never appears at all.

## The gallery's cells are cards, not photographs

Each cell names the listing or business it is showing and opens it. An
unlabelled photo of somebody's business, on a section asking you to add yours,
is decoration; with a name on it, it is the evidence for the claim. The four
are drawn from deeper in each list than the rails above show, so nothing on
this page appears twice — which the check asserts, because the duplication
would be four screens apart and nobody would catch it by eye.

## Three deviations in the sweep button, and why each one is not taste

The source is lime-on-near-black, pins its label with `right-4`, and puts the
accent panel **above** the label.

- The colours are the palette's: solid blue body with white text, gold panel
  with ink dots. Those are the two treatments the design system defines, and
  ink-on-gold is the one that measures 6.71:1. Its `dark:` variants went with
  them — they invert the button to white, a third treatment this system does
  not have.
- `right`/`left` became `end`/`start`, and the chevrons mirror under RTL.
  Otherwise the panel enters from the wrong edge in Hebrew and lands on top of
  the label.
- The label now sits **above** the panel and turns ink as the panel arrives
  under it. In the source, full hover wipes the text out: the button is blank
  at the moment someone has decided to press it. The colour change is delayed
  by the length of the sweep so the two land together instead of the text going
  dark while it is still over blue.

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
- **The CTA heading is a campaign line.** "Scale your business through
  innovation" (Tzvi, 3 September) replaced "Add your business — free" as the
  heading. The standing supply-side CTA is still the button and the first fact
  under it, so the offer itself is not lost — but the heading no longer states
  it, and headings are what people read.
- **Cards are unfiltered.** Every published listing and business with a photo is
  eligible for the corridor. There is no quality bar, so a dark or badly cropped
  photo rides past the headline at full size. Featured-first ordering exists on
  the rentals rail but the corridor interleaves by recency.
- **Twelve distinct images, twenty-four cards.** Both rails walk the same
  sequence from index 0, so `cards` is also how many distinct photos ever
  appear — the component's default of nine showed nine listings and ignored the
  rest. Twelve per rail is the current setting. Raising it only makes the
  corridor denser; lowering it is the direction that tears the ribbon.
