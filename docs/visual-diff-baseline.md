# Visual diff — expected floors, and what is NOT a regression

`scripts/sweep-scenes.mjs` captures the app and the preview at matching
scroll progress; the pairs are compared as mean per-pixel difference. A
non-zero number is normal. This records what the floor is made of, so a
future run at ~1% is not mistaken for a defect and chased.

## Home `/` — measured floor: worst 2.01%, median 1.22%, best 0.83%

Everything below is intentional and will never diff to zero:

| Source | Why it differs |
|---|---|
| Nav: "How it works" absent | Dropped by ruling — the cinematic home IS the how-it-works |
| Nav: "Join free" → "List your property" | Ruling: the one solid slot recruits listers |
| Nav: no separate "Sign Up" | Google Identity makes sign-in and sign-up one flow |
| Video frame timing | Captures block MP4s and use posters; the preview's poster and the app's are the same asset, but compression differs after resize |

The floating WhatsApp CTA used to sit in this list. It is now suppressed on
`/` (see `FloatingContact` in `App.js`), which is what moved the median from
1.4% to 1.22%.

## Stays / Services / Requests — floor accepted as-is

These keep the floating WhatsApp CTA and the accessibility button. The
previews have neither, so every frame carries roughly a 1% floor from those
two widgets alone. **Accepted deliberately** — do not chase it, and do not
remove the widgets from those pages to make a number look better.

## Things that ARE regressions

Anything that moves a frame well clear of these floors. The one real defect
this tool has caught so far sat at 4.8–6.6% against a ~1.4% median: the
lister scene was missing its second notification card, and because `.note`
is a flex column, the invisible second card had been displacing the visible
first one by 164px for the whole scene.

That is the shape to watch for — a single scene several points above its
neighbours. It is also the reason the diff exists: no structural check could
see it, because the card that was present was correct in isolation.

## Note on `prefers-reduced-motion`

`sweep-scenes.mjs --reduced` runs the same sweep with reduced motion
emulated. Captions are all visible, video is replaced by posters, and the
scroll-progress bar still tracks (it is a position indicator, not an
animation — verified at 0/25/50/100%). Frames will differ substantially from
the normal-motion set by design; compare reduced against reduced.
