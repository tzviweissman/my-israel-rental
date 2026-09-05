/**
 * HeroBand — the dark photo band that opens /stays and /services (and
 * will open the Requests board in Phase 3).
 *
 * All five preview mockups define this with identical CSS and the brief
 * calls it a shared design-system piece, so it lives here rather than
 * being re-typed per page. Styles are `.hero-band*` in App.css.
 *
 * The global nav is `position: fixed` and floats OVER this band — that is
 * the whole point of the glass treatment, since the bubbles only read as
 * glass with a photo behind them. A page rendering this band must
 * therefore NOT pad its wrapper by `--nav-h` the way the plain pages do;
 * `.hero-band-head` carries that padding instead so the headline still
 * clears the bar.
 *
 * `title` + `accent` are separate props rather than one interpolated
 * string because the accent is the gold-coloured tail of the headline and
 * Hebrew puts the emphasis on a different word — the two halves have to
 * be translatable independently.
 */
import React from 'react';

const HeroBand = ({
  image,
  title,
  accent,
  lede,
  // Overrides the whole headline — SEO landing routes need their own H1
  // (the long-tail phrase they exist to rank for), not the page default.
  headline,
  headlineTestId,
  ledeTestId,
  testId = 'hero-band',
  // The band is the page's title everywhere it was designed for, so h1
  // is the default. On a composed business page it is not: the business
  // name above it already is, and two h1s leave a screen reader with two
  // page titles. Additive rather than a change of contract - the three
  // existing callers pass nothing and keep the h1 they had.
  headingLevel: Heading = 'h1',
  children,
}) => (
  <div className="hero-band" data-testid={testId}>
    {/* Decorative: the headline carries the meaning, so the photo is a
        background rather than an <img> a screen reader would announce. */}
    <div
      className="hero-band-bg"
      style={{ backgroundImage: `url('${image}')` }}
      aria-hidden="true"
    />
    <div className="hero-band-shade" aria-hidden="true" />
    <div className="hero-band-head">
      <Heading data-testid={headlineTestId}>
        {headline ?? (
          <>
            {title} <span className="accent">{accent}</span>
          </>
        )}
      </Heading>
      {lede && (
        <p className="mx-auto max-w-2xl" data-testid={ledeTestId}>
          {lede}
        </p>
      )}
      {children}
    </div>
  </div>
);

export default HeroBand;
