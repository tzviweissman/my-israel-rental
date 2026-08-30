/**
 * An image that shows ALL of itself, in a fixed-shape box.
 *
 * THE PROBLEM. Businesses here upload flyers, not photographs. A kitchen
 * kashering advert is a portrait poster with the trade name across the
 * top and a phone number across the bottom; `object-fit: cover` in a 16:9
 * hero crops both away and leaves the middle. The listing card showed
 * "esach & ear round itchen ashering" — every line beheaded by a few
 * pixels — and the phone number, the single most useful thing on the
 * image, was outside the frame entirely.
 *
 * `cover` is right for photographs, where the edges are background and
 * the subject is central. It is wrong for anything with words on it, and
 * this marketplace is full of things with words on them. We cannot tell
 * the two apart from a URL, so the treatment has to be safe for both.
 *
 * WHY NOT PLAIN `contain`. It shows everything, which is the requirement,
 * but pillarboxes a portrait poster inside a landscape card with two
 * broad empty bars. In a grid of cards that reads as a broken image
 * rather than a considered one, which is the complaint `cover` was
 * presumably chosen to avoid in the first place.
 *
 * SO: `contain` for the real image, and a blurred, scaled copy of the
 * same image behind it to fill what is left. Nothing is cropped, the box
 * keeps its shape so grids stay aligned, and the surround is derived from
 * the image itself rather than an arbitrary grey. The blurred layer is
 * `aria-hidden` and carries no alt text — it is the same picture twice,
 * and a screen reader should hear about it once.
 */
import React from 'react';
import SafeImage from './SafeImage';

export default function FitImage({
  src,
  alt = '',
  name = '',
  category = '',
  className = '',
  imgClassName = '',
  rounded = '',
  testid,
  children,
  ...rest
}) {
  // POSITION IS THE CALLER'S IF THEY GAVE ONE. Hardcoding `relative` here
  // and letting callers add `absolute inset-0` puts two position
  // utilities on one element, and Tailwind emits `.absolute` before
  // `.relative`, so the hardcoded one silently wins. The wrapper then
  // sized itself to the image instead of the slot and overflowed its
  // parent — which looked exactly like the cropping this component
  // exists to fix, in the component that fixes it.
  //
  // An absolutely positioned wrapper is still a containing block for the
  // `absolute inset-0` layers below, so nothing else needs to change.
  const positioned = /(^|\s)(absolute|fixed|sticky|relative)(\s|$)/.test(className);

  return (
    <div
      className={`${positioned ? '' : 'relative'} overflow-hidden ${rounded} ${className}`}
      data-testid={testid}
    >
      {src && (
        <div
          aria-hidden="true"
          className="absolute inset-0"
          style={{
            backgroundImage: `url(${src})`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            // Scaled past the edges so the blur has no visible boundary
            // against the box — a blurred layer at exactly 100% shows a
            // soft but definite seam at the corners.
            transform: 'scale(1.2)',
            filter: 'blur(28px) saturate(1.15)',
          }}
        />
      )}
      {/* A wash over the blur so the real image keeps its contrast against
          whatever colour the poster happens to be. */}
      {src && <div aria-hidden="true" className="absolute inset-0" style={{ background: 'rgba(0,0,0,.18)' }} />}

      <SafeImage
        src={src}
        alt={alt}
        name={name}
        category={category}
        className={`relative w-full h-full object-contain ${imgClassName}`}
        {...rest}
      />
      {children}
    </div>
  );
}
