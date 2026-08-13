/**
 * EXPERIMENT - /why-host-v3 - THE SKILL OFF THE LEASH
 *
 * Same page again, but with NOTHING pinned. No MyIsraelRental palette, no
 * Playfair, no limestone, no existing components. The taste-skill picks
 * colour, type, shape and composition by its own rules, so we can see what
 * it does when the brand is not protecting the page.
 *
 * THIS IS DELIBERATELY OFF-BRAND. It violates the locked design system in
 * CLAUDE.md on purpose. It is a look-only experiment. Nothing here should
 * be copied into a real page without a separate decision.
 *
 * CONTAINMENT: every style below is scoped under `.v3` and every custom
 * property is namespaced `--v3-*`. No global CSS, no shared component, no
 * token redefined. Deleting this file and its route removes it completely.
 *
 * ---------------------------------------------------------------------
 * DESIGN READ: property-owner landing page for a two-sided rental
 * marketplace in Israel, audience is landlords deciding whether to trust a
 * platform with their apartment, leaning toward an editorial-utilitarian
 * language with a land-and-property feel.
 *
 * DIALS: DESIGN_VARIANCE 6, MOTION_INTENSITY 3, VISUAL_DENSITY 4.
 * The skill's own table puts "trust-first" at low variance and low motion,
 * and a landing page higher. This is both, so it sits in the middle and
 * resolves ties toward trust: a page asking for your apartment should not
 * feel like a product launch.
 *
 * TYPE - what changed and why the skill forced it:
 * Section 4.1 calls serif display "very discouraged as default" and names
 * "creative brief equals serif" as its single most-tested tell. Playfair
 * is in its approved pool, but only when the brand names it. Unpinned,
 * the rule sends it to sans display. Bricolage Grotesque for display,
 * Geist for body, which is one of the pairings the skill names.
 *
 * COLOUR - the biggest departure:
 * Section 4.2 bans the warm cream plus brass family outright for this kind
 * of brief, listing #efeae0 and #ece6db among the banned backgrounds. Your
 * limestone #EFE9DC sits inside that family, so unpinned the skill will
 * not choose it. Of the alternatives it offers, Forest (deep green, bone,
 * amber accent) is the defensible pick here: the product is land and
 * buildings, and the palette carries permanence without the beige.
 * One accent only, amber, used on the whole page. Zero green as decoration
 * anywhere else, so the accent stays singular.
 *
 * SHAPE: all-sharp, radius 0, chosen once and applied everywhere per the
 * shape-consistency lock. Your app is pills and 16px cards, so this is the
 * most visible structural difference after colour.
 */
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import PageMeta from '../components/PageMeta';
import SITE_ASSETS from '../lib/siteAssets';

const STEPS = {
  longTerm: [
    ['List', 'Photos, price and availability. A few minutes, no fee, no card.'],
    ['Reply', 'Renters message you directly, in your language or theirs.'],
    ['Sign', 'Agree terms and sign the contract without either of you printing anything.'],
  ],
  vacation: [
    ['List', 'Set nightly rates and block the dates you keep for yourself.'],
    ['Sync', 'Connect the calendar you already use so nothing double books.'],
    ['Host', 'Guests book, you keep the whole amount you agreed.'],
  ],
};

const CSS = `
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

  background:var(--v3-bone);
  color:var(--v3-ink);
  font-family:'Geist',system-ui,sans-serif;
  min-height:100vh;
}
.v3 h1,.v3 h2,.v3 h3,.v3 .v3-fig{
  font-family:'Bricolage Grotesque',system-ui,sans-serif;
  font-weight:800;
  letter-spacing:-0.02em;
  line-height:1.02;
}
.v3 p{ line-height:1.6; }

/* Radius 0 everywhere. One shape language, no exceptions. */
.v3 .v3-btn{
  display:inline-flex; align-items:center; gap:10px;
  padding:15px 26px; border-radius:0; border:0;
  background:var(--v3-amber); color:var(--v3-ink);
  font-weight:600; font-size:15px; cursor:pointer;
  transition:transform .12s ease, background .2s ease;
}
.v3 .v3-btn:hover{ background:#E0983A; }
.v3 .v3-btn:active{ transform:translateY(1px); }
.v3 .v3-btn-ghost{
  background:transparent; color:var(--v3-bone);
  box-shadow:inset 0 0 0 1px rgba(231,233,227,.45);
}
.v3 .v3-btn-ghost:hover{ background:rgba(231,233,227,.10); }

.v3 .v3-wrap{ max-width:1200px; margin:0 auto; padding:0 28px; }

/* Hero: full-bleed forest, asymmetric 7/5 split, image bleeds off the
   right edge rather than sitting in a tidy box. */
.v3 .v3-hero{ background:var(--v3-forest); color:var(--v3-bone); overflow:hidden; }
.v3 .v3-hero-grid{
  display:grid; grid-template-columns:1.15fr 1fr; gap:56px; align-items:center;
  padding:88px 0 0;
}
.v3 .v3-hero h1{ font-size:clamp(40px,5.4vw,76px); margin:18px 0 20px; }
.v3 .v3-hero p{ color:rgba(231,233,227,.78); font-size:18px; max-width:44ch; margin-bottom:32px; }
.v3 .v3-eyebrow{
  font-size:11px; text-transform:uppercase; letter-spacing:.2em;
  font-weight:600; color:var(--v3-amber);
}
.v3 .v3-hero-img{ align-self:end; margin-right:-120px; }
.v3 .v3-hero-img img{ width:100%; display:block; filter:saturate(.85) contrast(1.05); }

/* Facts: a hairline rule row, not cards. */
.v3 .v3-facts{ display:grid; grid-template-columns:repeat(3,1fr); gap:0; }
.v3 .v3-fact{ padding:40px 32px 40px 0; border-top:2px solid var(--v3-ink); }
.v3 .v3-fact + .v3-fact{ padding-left:32px; }
.v3 .v3-fig{ font-size:44px; color:var(--v3-ink); margin-bottom:10px; }
.v3 .v3-fact b{ display:block; font-size:16px; margin-bottom:4px; }
.v3 .v3-fact span{ color:var(--v3-muted); font-size:14px; }

/* Feature list: a numbered editorial run, not a card grid. */
.v3 .v3-list{ border-top:1px solid var(--v3-line); }
.v3 .v3-row{
  display:grid; grid-template-columns:64px 1.1fr 1.4fr; gap:32px; align-items:start;
  padding:34px 0; border-bottom:1px solid var(--v3-line);
}
.v3 .v3-row .idx{ font-size:13px; color:var(--v3-muted); padding-top:6px; letter-spacing:.08em; }
.v3 .v3-row h3{ font-size:24px; font-weight:600; }
.v3 .v3-row p{ color:var(--v3-muted); font-size:15px; }

.v3 .v3-feature{ position:relative; }
.v3 .v3-feature img{ width:100%; display:block; }
.v3 .v3-quotebar{
  background:var(--v3-forest-2); color:var(--v3-bone); padding:56px 0;
}

.v3 .v3-steps{ display:grid; grid-template-columns:repeat(3,1fr); gap:40px; }
.v3 .v3-step{ border-top:2px solid var(--v3-amber); padding-top:18px; }
.v3 .v3-step h3{ font-size:26px; margin-bottom:8px; }
.v3 .v3-step p{ color:var(--v3-muted); font-size:15px; }

.v3 .v3-tabs{ display:inline-flex; gap:0; }
.v3 .v3-tab{
  padding:10px 20px; border:1px solid var(--v3-line); background:transparent;
  font:inherit; font-size:14px; cursor:pointer; color:var(--v3-muted);
}
.v3 .v3-tab + .v3-tab{ border-left:0; }
.v3 .v3-tab[aria-selected="true"]{ background:var(--v3-ink); color:var(--v3-bone); border-color:var(--v3-ink); }

@media (max-width:860px){
  .v3 .v3-hero-grid{ grid-template-columns:1fr; gap:32px; padding-top:56px; }
  .v3 .v3-hero-img{ margin-right:-28px; }
  .v3 .v3-facts{ grid-template-columns:1fr; }
  .v3 .v3-fact + .v3-fact{ padding-left:0; }
  .v3 .v3-row{ grid-template-columns:1fr; gap:10px; padding:26px 0; }
  .v3 .v3-row .idx{ padding-top:0; }
  .v3 .v3-steps{ grid-template-columns:1fr; gap:28px; }
}
@media (prefers-reduced-motion:reduce){
  .v3 *{ transition:none !important; }
}
`;

const WhyHostV3 = () => {
  const navigate = useNavigate();
  const [tab, setTab] = useState('longTerm');
  const start = () => navigate('/join');

  return (
    <div className="v3" data-testid="why-host-v3">
      <style>{CSS}</style>
      <PageMeta
        title="List your property on MyIsraelRental | For owners"
        description="List your apartment or vacation rental free. No listing fee, no booking fees, no commission."
        path="/why-host-v3"
      />

      <section className="v3-hero">
        <div className="v3-wrap">
          <div className="v3-hero-grid">
            <div style={{ paddingBottom: 88 }}>
              <div className="v3-eyebrow">For property owners</div>
              <h1>List your property.<br />Keep every shekel.</h1>
              <p>
                Renters looking for a home in English find you here and message you
                directly. No commission on what you agree.
              </p>
              <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                <button className="v3-btn" onClick={start} data-testid="v3-hero-cta">
                  List your property free <ArrowRight size={16} />
                </button>
                <button className="v3-btn v3-btn-ghost" onClick={() => navigate('/requests')}>
                  See who is looking
                </button>
              </div>
            </div>
            <div className="v3-hero-img">
              <img
                src={SITE_ASSETS['scene5-lister-jerusalem']}
                alt="A property owner at home in Jerusalem, reading a message from a renter"
              />
            </div>
          </div>
        </div>
      </section>

      <section className="v3-wrap" style={{ paddingTop: 72, paddingBottom: 24 }}>
        <div className="v3-facts">
          {[
            ['₪0', 'Free to list', 'No listing fee, no card, ever.'],
            ['0%', 'No commission', 'What you agree is what you get.'],
            ['2', 'Languages', 'Messages translate both ways.'],
          ].map(([fig, title, body]) => (
            <div className="v3-fact" key={title}>
              <div className="v3-fig">{fig}</div>
              <b>{title}</b>
              <span>{body}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="v3-wrap" style={{ paddingTop: 64, paddingBottom: 72 }}>
        <h2 style={{ fontSize: 'clamp(30px,3.6vw,46px)', maxWidth: '16ch', marginBottom: 44 }}>
          Everything you need to let a place.
        </h2>
        <div className="v3-list">
          {[
            ['01', 'No booking fees', 'Neither side pays us a cut. The rent you agree is the rent you receive.'],
            ['02', 'Direct contact', 'Renters reach you on WhatsApp or in the app. Nobody sits in between.'],
            ['03', 'Translated chat', 'Write in Hebrew, they read English. Every message, both directions.'],
            ['04', 'Contracts signed on screen', 'Send the agreement, both of you sign, and it stays available to both sides.'],
            ['05', 'Calendar sync', 'Connect the calendar you already use so short lets stop colliding with family weeks.'],
            ['06', 'People asking for your place', 'Renters post what they are looking for. If yours fits, you hear about it.'],
          ].map(([idx, title, body]) => (
            <div className="v3-row" key={idx}>
              <div className="idx">{idx}</div>
              <h3>{title}</h3>
              <p>{body}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="v3-feature">
        <img
          src={SITE_ASSETS['scene6-contract-laptop']}
          alt="An owner signing a rental contract on a laptop"
          style={{ maxHeight: 460, objectFit: 'cover' }}
        />
      </section>

      <section className="v3-quotebar">
        <div className="v3-wrap" style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 18 }}>
          <h2 style={{ fontSize: 'clamp(26px,3vw,40px)', maxWidth: '22ch' }}>
            The paperwork is the part people dread. It takes about four minutes here.
          </h2>
        </div>
      </section>

      <section className="v3-wrap" style={{ paddingTop: 76, paddingBottom: 84 }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 24, alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 40 }}>
          <h2 style={{ fontSize: 'clamp(28px,3.4vw,44px)' }}>How hosting works</h2>
          <div className="v3-tabs" role="tablist" aria-label="How hosting works">
            {[['longTerm', 'Long term'], ['vacation', 'Vacation']].map(([k, label]) => (
              <button
                key={k}
                type="button"
                role="tab"
                className="v3-tab"
                aria-selected={tab === k}
                aria-controls={`v3-steps-${k}`}
                onClick={() => setTab(k)}
                data-testid={`v3-tab-${k}`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
        {Object.entries(STEPS).map(([k, steps]) => (
          <ol
            key={k}
            id={`v3-steps-${k}`}
            role="tabpanel"
            className="v3-steps"
            style={{ display: tab === k ? 'grid' : 'none' }}
            data-testid={`v3-steps-${k}`}
          >
            {steps.map(([verb, body]) => (
              <li className="v3-step" key={verb}>
                <h3>{verb}</h3>
                <p>{body}</p>
              </li>
            ))}
          </ol>
        ))}
      </section>

      <section style={{ background: 'var(--v3-ink)', color: 'var(--v3-bone)', padding: '84px 0' }}>
        <div className="v3-wrap" style={{ textAlign: 'center' }}>
          <h2 style={{ fontSize: 'clamp(30px,3.8vw,50px)', marginBottom: 16 }}>
            Your next tenant is already looking.
          </h2>
          <p style={{ color: 'rgba(231,233,227,.72)', marginBottom: 32 }}>
            Listing takes a few minutes and costs nothing.
          </p>
          <button className="v3-btn" onClick={start} data-testid="v3-closing-cta">
            List your property free <ArrowRight size={16} />
          </button>
        </div>
      </section>
    </div>
  );
};

export default WhyHostV3;
