> ⚠ **PARTIALLY SUPERSEDED (2026-08-06).** The home page (`/`) is now the scroll-driven cinematic experience in `cinematic-preview.html` — where THIS file's verbatim DOM/CSS (`.hero-stage`, `.hero-in`, `.trust-chip`, framed-hero layout) conflicts with that file, **`cinematic-preview.html` wins**. Do NOT build the framed hero described below as the home page.
> Still authoritative and in force: the **Implementation notes** section (lucide icon mapping table, hero i18n keys + Hebrew, the HeroSlideshow wrapping caveat, the fail-safe `.js-reveal` rule, social-link a11y note). The framed-hero CSS below is retained only as a reference for the section library (`home-redesign-preview.html`).

# Home hero — cinematic framed hero (copy EXACTLY) + keep the rotating scenes

Reproduce the hero from `home-redesign-preview.html` **exactly** — same layout, spacing, gradients, radii, and the "darkened window floating on a continuous photo" effect. **Copy the CSS values below verbatim; do not re-derive or approximate.** In the React app map the raw hex to the theme tokens in `brand/design-tokens.css` where one exists (`--teal`→`--primary`, `--gold`→`--gold`), but keep every number identical.

## Critical requirement: KEEP the rotating background scenes

The current live hero uses `components/HeroSlideshow` cross-fading through the `HERO_IMAGES` array (4 photos, ~6s hold, ~1.5s fade). **That rotation must stay.** In this design the rotating image is the *stage* background, and the darkened card is transparent — so the crossfade shows through the card AND around it at once, perfectly aligned. Do NOT put a static image on the card.

Layering, back → front:
1. **Rotating slideshow** — `HeroSlideshow` (keep `HERO_IMAGES`, `holdMs={6000}`, `fadeMs={1500}`), rendered as a full-bleed layer filling `.hero-stage`, `position:absolute; inset:0; z-index:0`, `object-fit/background:cover; center`. This replaces the `background:url(...)` that's on `.hero-stage` in the mockup.
2. **Light veil + bottom fade** — `z-index:1` (the `.hero-stage::before` / `::after` below; if pseudo-element stacking fights the slideshow child, use two real overlay `<div>`s instead, same values).
3. **Darkened card** `.hero` — `z-index:2`, transparent except its dark readability gradient (`.hero .bg`), so the active slide shows through it, darkened for legibility.

Sync (nice-to-have, not required for MVP): drive the `.hero-progress span` width and the active `.hero-dots i.on` from the slideshow's current index so the progress line + dots track the live scene. If skipped, leave them static as in the mockup. Pause autoplay under `prefers-reduced-motion`.

## DOM structure

```html
<section class="hero-stage">
  <!-- (1) rotating scenes: HeroSlideshow full-bleed, z-index:0 -->
  <!-- (2) veil + bottom fade: .hero-stage::before / ::after (z-index:1) -->
  <div class="hero">
    <div class="bg"></div>              <!-- dark readability gradient only, NO image -->
    <div class="hero-social">
      <a href="#" aria-label="Facebook"><span class="ic"><svg><use href="#i-fb"/></svg></span></a>
      <a href="#" aria-label="Instagram"><span class="ic"><svg><use href="#i-ig"/></svg></span></a>
      <a href="#" aria-label="WhatsApp"><span class="ic"><svg><use href="#i-msg"/></svg></span></a>
    </div>
    <div class="hero-in">
      <div class="eyebrow">Rentals &amp; local services · across Israel</div>
      <h1>Rent a home.<br>Hire the pros. <span class="accent">with ease.</span></h1>
      <p class="sub">Verified rentals from owners and trusted local pros — cleaners, movers, plumbers and more. In English &amp; Hebrew, with no service fees.</p>
      <div class="trust-chip">
        <span class="g"><span class="ic"><svg><use href="#i-check"/></svg></span> Free to search</span><span class="sep">·</span>
        <span>No service fees</span><span class="sep">·</span>
        <span>Deal with owners &amp; pros directly</span>
      </div>
      <div class="hero-cta">
        <button class="btn-white">Explore rentals <span class="arw">→</span></button>
        <button class="btn btn-outline-white btn-lg">Explore services</button>
      </div>
      <div class="hero-meta">
        <div class="hero-progress"><span></span></div>
        <div class="hero-dots"><i class="on"></i><i></i><i></i></div>
      </div>
    </div>
  </div>
</section>
```
The two CTA buttons deep-link like the rest of the home page: "Explore rentals" → `/stays`, "Explore services" → `/services`.

## CSS (verbatim)

```css
.hero-stage{position:relative;overflow:hidden;min-height:86vh;display:flex;align-items:center;justify-content:center;padding:clamp(28px,5vw,90px);background-color:var(--bg)}
/* the slideshow layer fills the stage behind everything: */
.hero-slides{position:absolute;inset:0;z-index:0}
.hero-slides img{width:100%;height:100%;object-fit:cover;object-position:center}
.hero-stage::before{content:"";position:absolute;inset:0;z-index:1;pointer-events:none;background:rgba(243,238,229,.28)}
.hero-stage::after{content:"";position:absolute;inset:0;z-index:1;pointer-events:none;background:linear-gradient(180deg,transparent 60%,var(--bg) 100%)}
.hero{position:relative;z-index:2;width:100%;max-width:1180px;margin:0 auto;border-radius:26px;overflow:hidden;color:#fff;min-height:58vh;display:flex;flex-direction:column;justify-content:flex-end;box-shadow:0 30px 70px rgba(8,20,26,.30);border:1px solid rgba(255,255,255,.22)}
.hero .bg{position:absolute;inset:0;z-index:0;background:linear-gradient(95deg,rgba(8,20,26,.82) 0%,rgba(8,20,26,.5) 42%,rgba(8,20,26,.12) 74%,rgba(8,20,26,.28) 100%)}
.hero::after{content:"";position:absolute;inset:0;z-index:1;pointer-events:none;background:linear-gradient(0deg,rgba(6,16,20,.6),transparent 46%)}
.hero-in{position:relative;z-index:2;width:100%;max-width:1160px;margin:0 auto;padding:clamp(34px,5vh,52px) clamp(24px,4vw,52px) clamp(40px,6vh,60px);text-align:start;text-shadow:0 1px 3px rgba(0,0,0,.35)}
.hero .eyebrow{color:var(--gold);letter-spacing:.22em}
.hero h1{font-size:clamp(36px,5.6vw,66px);font-weight:800;line-height:1.02;letter-spacing:-1.2px;margin-top:14px;text-shadow:0 2px 20px rgba(0,0,0,.35)}
.hero h1 .accent{color:var(--gold)}
.hero .sub{font-size:clamp(16px,1.6vw,19px);color:rgba(255,255,255,.9);max-width:520px;margin:20px 0 0;font-weight:500}
.hero-cta{display:flex;gap:14px;flex-wrap:wrap;margin-top:30px}
.btn-white{background:#fff;color:var(--ink);border:1.5px solid #fff;border-radius:999px;font-weight:700;font-size:15px;padding:15px 28px;display:inline-flex;align-items:center;gap:9px;cursor:pointer;transition:transform .26s cubic-bezier(.16,.7,.3,1),box-shadow .26s}
.btn-white:hover{transform:translateY(-2px);box-shadow:0 16px 34px rgba(0,0,0,.3)}
.hero-meta{display:flex;align-items:center;gap:18px;margin-top:36px}
.hero-progress{position:relative;width:150px;height:2px;background:rgba(255,255,255,.28);border-radius:2px;overflow:hidden}
.hero-progress span{position:absolute;inset:0;width:40%;background:var(--gold)}
.hero-dots{display:flex;gap:7px}
.hero-dots i{width:7px;height:7px;border-radius:50%;background:rgba(255,255,255,.4);transition:all .3s}
.hero-dots i.on{background:#fff;width:22px;border-radius:99px}
.hero-social{position:absolute;left:clamp(16px,2.4vw,30px);bottom:clamp(40px,7vh,78px);z-index:3;display:flex;flex-direction:column;gap:16px}
.hero-social a{color:rgba(255,255,255,.72);display:inline-flex;transition:color .2s,transform .2s}
.hero-social a:hover{color:var(--gold);transform:translateY(-1px)}
.hero-social .ic{font-size:16px}
.hero .trust-chip{margin-top:24px}
.trust-chip{display:inline-flex;align-items:center;gap:9px;flex-wrap:wrap;background:rgba(201,162,39,.13);border:1px solid rgba(201,162,39,.55);backdrop-filter:blur(8px);border-radius:999px;padding:8px 18px;font-size:14px;font-weight:600;color:#fff}
.trust-chip .g{color:var(--gold);font-weight:800;display:inline-flex;align-items:center;gap:6px}
.trust-chip .g .ic{font-size:14px}
.trust-chip .sep{opacity:.4}
@media(max-width:820px){.hero-stage{min-height:auto;padding:12px}.hero{min-height:66vh;max-width:none}.hero-social{display:none}}
```

## Rules
- The card is **transparent** — only `.hero .bg` (a dark gradient) darkens it; the rotating stage image must be visible through it and continue, sharp, all around it.
- The **height lives on `.hero-stage` (86vh)**, not the card — that keeps the photo at full scale. The card is `max-width:1180px; min-height:58vh`, centered, so more of the image shows around it. Don't move the height back onto the card (it re-crops/"zooms" the photo).
- Keep it fully responsive and RTL-correct; on mobile the social rail hides and the stage sizes to content (see the media query).
- Verify against `home-redesign-preview.html` with a screenshot before calling it done (use `scripts/screenshot.mjs`).

## Implementation notes — resolves the "don't invent" gaps

**Buttons.** `.btn`, `.btn-lg`, `.btn-white`, `.btn-outline-white` are all defined in `brand/design-tokens.css` — import it; don't redefine. In the hero the primary CTA is **solid white** (`.btn-white`) and the secondary is **outline-white** (`.btn .btn-outline-white .btn-lg`). This is the deliberate exception to "accent buttons are gold": the gold-glass button (`.btn-accent`) is for accent CTAs on the *rest* of the site, not over the hero photo.

**Icons — use `lucide-react`, NOT an SVG sprite.** The mockups use `<use href="#i-…">` placeholders that don't exist in the app. Replace every one with the matching lucide component (`import { X } from 'lucide-react'`), `strokeWidth={1.75}`, sized by `font-size`/props. Mapping used across the whole build:

| mockup id | lucide | mockup id | lucide |
|---|---|---|---|
| `#i-home` | `Home` | `#i-camera` | `Camera` |
| `#i-wrench` | `Wrench` | `#i-hammer` | `Hammer` |
| `#i-check` | `Check` | `#i-compass` | `Compass` |
| `#i-arrow` | `ArrowRight` | `#i-scissors` | `Scissors` |
| `#i-pin` | `MapPin` | `#i-spark` | `Sparkles` |
| `#i-bed` | `BedDouble` | `#i-box` | `Package` |
| `#i-bath` | `Bath` | `#i-drop` | `Droplet` |
| `#i-area` | `Ruler` (or `Maximize2`) | `#i-zap` | `Zap` |
| `#i-star` | `Star` (filled) | `#i-file` | `FileText` |
| `#i-heart` | `Heart` | `#i-msg` | `MessageCircle` |
| `#i-fb` | `Facebook` | `#i-ig` | `Instagram` |

(WhatsApp: lucide has no brand glyph — use `MessageCircle`, or reuse the icon already in `components/WhatsAppButton.js`.)

**Hero copy → i18n (do NOT hardcode English).** Add these keys to `frontend/src/locales/en.js` and `he.js` (new `hero.*` keys; the old `hero.title`/`hero.anyDuration` can be retired):

| key | English | Hebrew |
|---|---|---|
| `hero.eyebrow` | Rentals & local services · across Israel | השכרות ושירותים מקומיים · בכל ישראל |
| `hero.titleLead` | Rent a home. | שכרו בית. |
| `hero.titleMain` | Hire the pros. | שכרו את המקצוענים. |
| `hero.titleAccent` | with ease. | בקלות. |
| `hero.sub` | Verified rentals from owners and trusted local pros — cleaners, movers, plumbers and more. In English & Hebrew, with no service fees. | השכרות מאומתות ישירות מהבעלים, ובעלי מקצוע מקומיים מהימנים — מנקים, מובילים, אינסטלטורים ועוד. בעברית ובאנגלית, ללא דמי שירות. |
| `hero.ctaRentals` | Explore rentals | לצפייה בהשכרות |
| `hero.ctaServices` | Explore services | לצפייה בשירותים |
| `hero.trust1` | Free to search | חינם לחיפוש |
| `hero.trust2` | No service fees | ללא דמי שירות |
| `hero.trust3` | Deal with owners & pros directly | בקשר ישיר עם בעלים ובעלי מקצוע |

(Have a Hebrew speaker sanity-check the translations before shipping.)

**`HeroSlideshow` caveat (known trap).** The existing component renders `<div className={"relative overflow-hidden " + className}>` and accepts ONLY `images / holdMs / fadeMs / className / children`. It silently drops `style`, and passing `className="absolute inset-0"` collides with its own `relative`. So: **wrap it in your own absolutely-positioned div** (`<div class="hero-slides"><HeroSlideshow …/></div>` with `.hero-slides{position:absolute;inset:0;z-index:0}`), or extend the component to accept/spread `style` + merge className. Do not rely on passing positioning through `className`.

**Reveal animation is fail-safe.** Use the `.js-reveal` pattern in `design-tokens.css`: JS adds `document.documentElement.classList.add('js-reveal')` *before* observing, then the IntersectionObserver adds `.in`. If JS fails, nothing is hidden. Don't hide `.reveal` unconditionally (this project has had blank-page incidents from exactly that).

**Social links.** `href="#"` are placeholders and will fail the a11y gate. Use the real profile URLs (or drop the rail until they exist); keep the `aria-label`s.

**Hebrew headings render in the wrong font (real, live bug).** ~69 headings across ~45 files set `style={{ fontFamily: 'Playfair Display' }}` **inline**. Inline styles beat every stylesheet selector, so `[dir="rtl"] h1 { font-family: … }` can NEVER reach them — and Playfair has no Hebrew glyphs, so RTL headings fall back to a system serif. The tokens file therefore swaps the font **variables** under `[dir="rtl"]` instead. For this to work, any heading you touch (including the hero `h1`) must read the variable, not the literal face: use `style={{ fontFamily: 'var(--font-head)' }}` (body copy → `var(--font-body)`), never `'Playfair Display'` inline. **Verify:** toggle `dir="rtl"` and confirm a heading's computed `fontFamily` actually says "Frank Ruhl Libre". (A repo-wide sweep of those 69 inline sites is the real fix; at minimum, don't add new ones.)
