/**
 * THE UNPINNED THEME - shared kit for the /v3/* preview pages.
 *
 * This is a REBRAND PROPOSAL, not a component library for the live app.
 * It exists so the taste-skill's unpinned direction can be judged once,
 * across several pages, instead of page by page. Every /v3 page composes
 * these primitives, so what you are judging is one design system applied
 * seven times rather than seven unrelated looks.
 *
 * IT DELIBERATELY VIOLATES CLAUDE.md's locked design system. No brand
 * blue, no gold, no limestone, no Playfair. That is the entire point.
 *
 * CONTAINMENT, and why it is safe to leave in the tree:
 *   - every rule is scoped under `.v3`, so nothing matches outside a
 *     V3Page wrapper;
 *   - every custom property is namespaced `--v3-*`, so no shadcn or brand
 *     token is redefined (redefining --primary, --border or --muted would
 *     break real pages - see CLAUDE.md);
 *   - the fonts load per-page rather than globally.
 * Deleting src/components/v3 and src/pages/v3 plus their routes removes
 * the whole experiment.
 *
 * THE CHOICES, and which of the skill's rules forced each:
 *   - Colour: it bans the warm-cream-plus-brass family for this kind of
 *     brief and lists #efeae0 and #ece6db among banned backgrounds, which
 *     is the family your limestone #EFE9DC belongs to. Of the palettes it
 *     offers instead, Forest (deep green, bone, amber) fits a business
 *     about land and buildings. One accent, amber, on every page.
 *   - Type: serif display is "very discouraged as default"; unpinned it
 *     goes to sans. Bricolage Grotesque display, Geist body.
 *   - Shape: radius 0 everywhere, chosen once per its shape-consistency
 *     lock. Your app is pills and 16px cards, so this is the loudest
 *     structural difference after colour.
 *   - No eyebrow on more than one section in three, no numbered step
 *     labels, no em-dashes, no three-equal-card rows.
 *
 * SAMPLE CONTENT: the listing and request cards below are illustrative,
 * for judging layout only. They are not real listings and must never be
 * presented as such. Names and numbers are deliberately ordinary rather
 * than round, per the skill's rule against fake-perfect data.
 */
import React from 'react';
import { ArrowRight } from 'lucide-react';

export const V3_CSS = `
@import url('https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,400;12..96,600;12..96,800&family=Geist:wght@400;500;600&display=swap');

.v3{
  --v3-ink:#0E1A13;
  --v3-forest:#14301F;
  --v3-forest-2:#1D4430;
  --v3-bone:#E7E9E3;
  --v3-surface:#FFFFFF;
  --v3-amber:#D08A2C;
  --v3-muted:#5C6862;
  --v3-line:#C9CEC6;
  background:var(--v3-bone); color:var(--v3-ink);
  font-family:'Geist',system-ui,sans-serif; min-height:100vh;
}
.v3 h1,.v3 h2,.v3 h3,.v3 .v3-fig{
  font-family:'Bricolage Grotesque',system-ui,sans-serif;
  font-weight:800; letter-spacing:-0.02em; line-height:1.03;
}
.v3 p{ line-height:1.6; }
.v3 .v3-wrap{ max-width:1200px; margin:0 auto; padding:0 28px; }
.v3 .v3-eyebrow{ font-size:11px; text-transform:uppercase; letter-spacing:.2em; font-weight:600; color:var(--v3-amber); }

/* Radius 0 everywhere. One shape language. */
.v3 .v3-btn{
  display:inline-flex; align-items:center; gap:10px; padding:15px 26px;
  border-radius:0; border:0; background:var(--v3-amber); color:var(--v3-ink);
  font-weight:600; font-size:15px; cursor:pointer;
  transition:transform .12s ease, background .2s ease;
}
.v3 .v3-btn:hover{ background:#E0983A; }
.v3 .v3-btn:active{ transform:translateY(1px); }
.v3 .v3-btn-ghost{ background:transparent; color:var(--v3-bone); box-shadow:inset 0 0 0 1px rgba(231,233,227,.45); }
.v3 .v3-btn-ghost:hover{ background:rgba(231,233,227,.10); }
.v3 .v3-btn-dark{ background:var(--v3-ink); color:var(--v3-bone); }

/* Hero: full-bleed forest, asymmetric split, image bleeds off the edge */
.v3 .v3-hero{ background:var(--v3-forest); color:var(--v3-bone); overflow:hidden; }
.v3 .v3-hero-grid{ display:grid; grid-template-columns:1.15fr 1fr; gap:56px; align-items:center; padding:88px 0 0; }
.v3 .v3-hero h1{ font-size:clamp(40px,5.2vw,74px); margin:18px 0 20px; }
.v3 .v3-hero p{ color:rgba(231,233,227,.78); font-size:18px; max-width:44ch; margin-bottom:32px; }
.v3 .v3-hero-img{ align-self:end; margin-right:-120px; }
.v3 .v3-hero-img img,.v3 .v3-hero-img video{ width:100%; display:block; filter:saturate(.85) contrast(1.05); }
.v3 .v3-hero-copy{ padding-bottom:88px; }

/* Facts: hairline rules, not cards */
.v3 .v3-facts{ display:grid; grid-template-columns:repeat(3,1fr); }
.v3 .v3-fact{ padding:40px 32px 40px 0; border-top:2px solid var(--v3-ink); }
.v3 .v3-fact + .v3-fact{ padding-left:32px; }
.v3 .v3-fig{ font-size:44px; margin-bottom:10px; }
.v3 .v3-fact b{ display:block; font-size:16px; margin-bottom:4px; }
.v3 .v3-fact span{ color:var(--v3-muted); font-size:14px; }

/* Numbered editorial list */
.v3 .v3-list{ border-top:1px solid var(--v3-line); }
.v3 .v3-row{ display:grid; grid-template-columns:64px 1.1fr 1.4fr; gap:32px; align-items:start; padding:34px 0; border-bottom:1px solid var(--v3-line); }
.v3 .v3-row .idx{ font-size:13px; color:var(--v3-amber); padding-top:6px; letter-spacing:.08em; }
.v3 .v3-row h3{ font-size:24px; font-weight:600; }
.v3 .v3-row p{ color:var(--v3-muted); font-size:15px; }

/* Bands and steps */
.v3 .v3-band{ background:var(--v3-forest-2); color:var(--v3-bone); padding:60px 0; }
.v3 .v3-steps{ display:grid; grid-template-columns:repeat(3,1fr); gap:40px; }
.v3 .v3-step{ border-top:2px solid var(--v3-amber); padding-top:18px; }
.v3 .v3-step h3{ font-size:26px; margin-bottom:8px; }
.v3 .v3-step p{ color:var(--v3-muted); font-size:15px; }
.v3 .v3-tabs{ display:inline-flex; }
.v3 .v3-tab{ padding:10px 20px; border:1px solid var(--v3-line); background:transparent; font:inherit; font-size:14px; cursor:pointer; color:var(--v3-muted); }
.v3 .v3-tab + .v3-tab{ border-left:0; }
.v3 .v3-tab[aria-selected="true"]{ background:var(--v3-ink); color:var(--v3-bone); border-color:var(--v3-ink); }

/* Search bar: a sharp bar, not a floating rounded panel */
.v3 .v3-search{ display:grid; grid-template-columns:1.4fr 1fr 1fr auto; background:var(--v3-surface); border:1px solid var(--v3-line); }
.v3 .v3-search > div{ padding:16px 20px; border-right:1px solid var(--v3-line); }
.v3 .v3-search label{ display:block; font-size:10px; text-transform:uppercase; letter-spacing:.16em; color:var(--v3-muted); margin-bottom:5px; }
.v3 .v3-search .val{ font-size:15px; font-weight:500; }
.v3 .v3-search button{ border:0; background:var(--v3-ink); color:var(--v3-bone); padding:0 34px; font:inherit; font-weight:600; cursor:pointer; }

/* Listing cards: image, then plain text. No card chrome, no shadow. */
.v3 .v3-cards{ display:grid; grid-template-columns:repeat(3,1fr); gap:28px; }
.v3 .v3-card img{ width:100%; aspect-ratio:4/3; object-fit:cover; display:block; margin-bottom:14px; }
.v3 .v3-card h3{ font-size:18px; font-weight:600; margin-bottom:4px; }
.v3 .v3-card .meta{ color:var(--v3-muted); font-size:14px; }
.v3 .v3-card .price{ margin-top:8px; font-weight:600; }
.v3 .v3-card .price b{ color:var(--v3-amber); }

/* Request rows: demand reads as a list, not as merchandise */
.v3 .v3-req{ border-top:1px solid var(--v3-line); }
.v3 .v3-req-row{ display:grid; grid-template-columns:auto 1fr auto; gap:24px; align-items:center; padding:24px 0; border-bottom:1px solid var(--v3-line); }
.v3 .v3-tag{ font-size:11px; text-transform:uppercase; letter-spacing:.14em; padding:5px 10px; background:var(--v3-ink); color:var(--v3-bone); }
.v3 .v3-tag-alt{ background:var(--v3-amber); color:var(--v3-ink); }
.v3 .v3-req-row h3{ font-size:19px; font-weight:600; margin-bottom:3px; }
.v3 .v3-req-row .meta{ color:var(--v3-muted); font-size:14px; }

@media (max-width:960px){
  .v3 .v3-cards{ grid-template-columns:repeat(2,1fr); }
  .v3 .v3-search{ grid-template-columns:1fr 1fr; }
  .v3 .v3-search button{ grid-column:1/-1; padding:16px; }
}
@media (max-width:860px){
  .v3 .v3-hero-grid{ grid-template-columns:1fr; gap:32px; padding-top:56px; }
  .v3 .v3-hero-copy{ padding-bottom:0; }
  .v3 .v3-hero-img{ margin-right:-28px; }
  .v3 .v3-facts{ grid-template-columns:1fr; }
  .v3 .v3-fact + .v3-fact{ padding-left:0; }
  .v3 .v3-row{ grid-template-columns:1fr; gap:10px; padding:26px 0; }
  .v3 .v3-row .idx{ padding-top:0; }
  .v3 .v3-steps{ grid-template-columns:1fr; gap:28px; }
  .v3 .v3-cards{ grid-template-columns:1fr; }
  .v3 .v3-req-row{ grid-template-columns:1fr; gap:10px; align-items:start; }
}
@media (prefers-reduced-motion:reduce){ .v3 *{ transition:none !important; } }
`;

/** Wrapper. Loads the theme and scopes it. */
export const V3Page = ({ children, testid }) => (
  <div className="v3" data-testid={testid}>
    <style>{V3_CSS}</style>
    {children}
  </div>
);

export const V3Hero = ({ eyebrow, title, body, primary, secondary, media }) => (
  <section className="v3-hero">
    <div className="v3-wrap">
      <div className="v3-hero-grid">
        <div className="v3-hero-copy">
          {eyebrow && <div className="v3-eyebrow">{eyebrow}</div>}
          <h1>{title}</h1>
          <p>{body}</p>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            {primary && (
              <button className="v3-btn" onClick={primary.onClick}>
                {primary.label} <ArrowRight size={16} />
              </button>
            )}
            {secondary && (
              <button className="v3-btn v3-btn-ghost" onClick={secondary.onClick}>
                {secondary.label}
              </button>
            )}
          </div>
        </div>
        {media && <div className="v3-hero-img">{media}</div>}
      </div>
    </div>
  </section>
);

export const V3Facts = ({ items }) => (
  <section className="v3-wrap" style={{ paddingTop: 72, paddingBottom: 24 }}>
    <div className="v3-facts">
      {items.map(([fig, title, body]) => (
        <div className="v3-fact" key={title}>
          <div className="v3-fig">{fig}</div>
          <b>{title}</b>
          <span>{body}</span>
        </div>
      ))}
    </div>
  </section>
);

export const V3List = ({ title, items }) => (
  <section className="v3-wrap" style={{ paddingTop: 64, paddingBottom: 72 }}>
    {title && (
      <h2 style={{ fontSize: 'clamp(30px,3.6vw,46px)', maxWidth: '16ch', marginBottom: 44 }}>{title}</h2>
    )}
    <div className="v3-list">
      {items.map(([t, b], i) => (
        <div className="v3-row" key={t}>
          <div className="idx">{String(i + 1).padStart(2, '0')}</div>
          <h3>{t}</h3>
          <p>{b}</p>
        </div>
      ))}
    </div>
  </section>
);

export const V3Band = ({ children }) => (
  <section className="v3-band">
    <div className="v3-wrap">
      <h2 style={{ fontSize: 'clamp(26px,3vw,40px)', maxWidth: '24ch' }}>{children}</h2>
    </div>
  </section>
);

export const V3CTA = ({ title, body, cta }) => (
  <section style={{ background: 'var(--v3-ink)', color: 'var(--v3-bone)', padding: '84px 0' }}>
    <div className="v3-wrap" style={{ textAlign: 'center' }}>
      <h2 style={{ fontSize: 'clamp(30px,3.8vw,50px)', marginBottom: 16 }}>{title}</h2>
      {body && <p style={{ color: 'rgba(231,233,227,.72)', marginBottom: 32 }}>{body}</p>}
      <button className="v3-btn" onClick={cta.onClick}>
        {cta.label} <ArrowRight size={16} />
      </button>
    </div>
  </section>
);

export const V3Cards = ({ items }) => (
  <div className="v3-cards">
    {items.map((c) => (
      <article className="v3-card" key={c.title}>
        <img src={c.img} alt={c.alt} />
        <h3>{c.title}</h3>
        <div className="meta">{c.meta}</div>
        <div className="price">
          <b>{c.price}</b> {c.per}
        </div>
      </article>
    ))}
  </div>
);
