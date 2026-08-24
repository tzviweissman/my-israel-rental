/**
 * The cover band on a business page when the owner has not uploaded one.
 *
 * Why this exists: the band used to be a flat tint — CoverPlaceholder with
 * `mark={false}` — which at roughly 1100x160 is not a placeholder, it is a
 * large empty pastel rectangle sitting above the business's name. It reads
 * as a broken image rather than a designed default, and most owners will
 * never upload anything, so this IS the page for most businesses.
 *
 * The constraint that shapes it (docs/business-page-customization-spec.md):
 * the page must already look excellent with every customization field
 * empty. A default nobody chose is still the first thing a visitor judges.
 *
 * What it draws, in the same tint the logo tile uses so the pair belong to
 * each other:
 *
 *   - A vertical wash from the tint down to near-white, so the band seats
 *     into the card instead of stopping at a hard edge.
 *   - A soft off-centre glow, which is what stops a flat fill reading as
 *     an unstyled block.
 *   - The initial as a large, very low-opacity display letter — a book
 *     plate, not a logo. It sits opposite the logo tile (which is at the
 *     start edge) and mirrors under RTL, so the two never collide.
 *
 * Deliberately no category icon: the logo tile directly below already
 * draws one from the same name, and the pair read as a duplication rather
 * than a design. That was the original reason `mark={false}` existed.
 */
import React from 'react';
import { tintForName } from '../common/CoverPlaceholder';
import useIsRtl from '../../hooks/useIsRtl';

/** Mix a hex toward white. The card tints were chosen to carry a 96px
 *  square; across a band ten times that area the same value reads as a
 *  slab of colour rather than a header, so the band uses a diluted
 *  version of its own tint — same identity, a fraction of the weight. */
function towardWhite(hex, amount) {
  const h = hex.replace('#', '');
  const mix = (c) => Math.round(c + (255 - c) * amount);
  const r = mix(parseInt(h.slice(0, 2), 16));
  const g = mix(parseInt(h.slice(2, 4), 16));
  const b = mix(parseInt(h.slice(4, 6), 16));
  return `rgb(${r}, ${g}, ${b})`;
}

export default function BusinessCoverBand({ name = '', className = '', testid = 'business-cover-empty' }) {
  const isRtl = useIsRtl();
  const tint = tintForName(name);
  const soft = towardWhite(tint, 0.45);
  const initial = String(name).trim().charAt(0).toUpperCase();

  return (
    <div
      className={`relative overflow-hidden ${className}`}
      // The wash ends just short of white rather than at the card's own
      // white: a band that fades to exactly the card colour loses its
      // bottom edge and the logo tile appears to float.
      style={{ background: `linear-gradient(168deg, ${soft} 0%, ${towardWhite(tint, 0.7)} 46%, #FCFBF7 100%)` }}
      data-testid={testid}
      data-tint={tint}
      aria-hidden="true"
    >
      {/* The glow. Positioned away from the logo tile and mirrored in RTL
          so the monogram never sits behind it. */}
      <div
        className="absolute inset-0"
        style={{
          background: `radial-gradient(120% 140% at ${isRtl ? '18%' : '82%'} 12%, rgba(255,255,255,.55) 0%, rgba(255,255,255,0) 62%)`,
        }}
      />
      {/* A hairline foot. Without it the wash simply stops, and a
          gradient that ends on nothing looks unfinished next to the
          card's own crisp border. */}
      <div
        className="absolute inset-x-0 bottom-0"
        style={{ height: 1, background: 'var(--brand-border)', opacity: 0.7 }}
      />
      {initial && (
        <span
          className="absolute select-none"
          style={{
            // Sized from the band's HEIGHT, not its width: this element is
            // ten times wider than it is tall, and a width-derived size
            // renders the letter comically large — the exact trap that
            // made the old placeholder unusable here.
            fontFamily: 'var(--font-head)',
            fontWeight: 700,
            fontSize: 'clamp(56px, 92%, 132px)',
            lineHeight: 1,
            color: 'var(--ink)',
            // Faint, but present. At 0.09 it disappeared and the band
            // read as empty; this is still a texture rather than a mark
            // that competes with the business's own name below it.
            opacity: 0.14,
            top: '50%',
            transform: 'translateY(-50%)',
            [isRtl ? 'left' : 'right']: 'clamp(16px, 5%, 56px)',
          }}
        >
          {initial}
        </span>
      )}
    </div>
  );
}
