/**
 * SkylineRule - a horizontal rule shaped like the logo's skyline.
 *
 * Visual rhyming: the logo mark is a row of buildings at stepped heights
 * with one pointed peak, and until now that silhouette appeared nowhere
 * else on the site. Repeating a component of the mark in another role is
 * what makes a page feel like it comes from one place rather than from a
 * component library.
 *
 * Deliberately quiet. It reads as a textured hairline at a glance and
 * only resolves into buildings when you look at it, which is the point:
 * a rhyme that shouts competes with the content it is separating.
 *
 * Takes its colour from the caller so the same shape can be a border-grey
 * divider in one place and a gold accent in another. No colour is
 * hardcoded here.
 *
 * Purely decorative, so `aria-hidden` - a screen reader announcing
 * "image" between two sections is noise.
 */
import React, { useId } from 'react';

/**
 * One tile of the skyline, 120 x 8, sitting on the baseline. The
 * proportions follow the mark: low block, taller block, tallest with a
 * pointed roof, then stepping back down.
 *
 * CONTIGUOUS ON PURPOSE. The first version drew separated buildings with
 * gaps between them, exactly like the logo. At 8px tall that did not read
 * as a skyline at all, it read as a dashed rule, which is worse than the
 * plain line it replaced. Buildings that touch read as a stepped profile,
 * which is the silhouette the eye actually recognises at this size.
 */
const TILE = 'M0 8V5.2H15V3.4H30V6H45V2.2L52 0L59 2.2V4.6H75V3.2H92V5.8H105V4H120V8Z';

const SkylineRule = ({
  color = 'var(--brand-border)',
  height = 8,
  className = '',
  style = {},
}) => {
  // Unique per instance: two rules on one page would otherwise share a
  // pattern id and the second would silently take the first one's colour.
  const id = useId().replace(/:/g, '');
  const scale = height / 8;
  return (
    <svg
      className={className}
      width="100%"
      height={height}
      aria-hidden="true"
      focusable="false"
      style={{ display: 'block', ...style }}
    >
      <defs>
        {/* No viewBox on purpose. A viewBox would scale one tile across
            the whole width and stretch the buildings flat; without one,
            user units are CSS pixels and the pattern REPEATS at its true
            proportions however wide the rule is. patternTransform scales
            the tile as a whole when a different height is asked for. */}
        <pattern
          id={`sky-${id}`}
          width="120"
          height="8"
          patternUnits="userSpaceOnUse"
          patternTransform={scale === 1 ? undefined : `scale(${scale})`}
        >
          <path d={TILE} fill={color} />
        </pattern>
      </defs>
      <rect width="100%" height={height} fill={`url(#sky-${id})`} />
    </svg>
  );
};

export default SkylineRule;
