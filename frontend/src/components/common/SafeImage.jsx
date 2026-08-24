/**
 * An <img> that falls back to the designed placeholder when the file will
 * not load, instead of the browser's broken-image glyph.
 *
 * A dead URL is not hypothetical here: Cloudinary assets get deleted, old
 * listings carry URLs from a previous host, and one listing on the live
 * business page renders as a torn-page icon in a white box today. That
 * glyph is the single most "broken site" thing a page can show, and it
 * appears on the page a business shares with its own customers.
 *
 * Failure is per-URL: changing `src` clears the error, so a retry or a
 * different photo is not permanently poisoned by one bad load.
 */
import React, { useEffect, useState } from 'react';
import CoverPlaceholder from './CoverPlaceholder';

export default function SafeImage({
  src,
  alt = '',
  name = '',
  category = '',
  className = '',
  testid,
  ...rest
}) {
  const [failed, setFailed] = useState(false);

  // A new src deserves a fresh chance — otherwise one broken photo in a
  // gallery marks every later one broken too.
  useEffect(() => { setFailed(false); }, [src]);

  if (!src || failed) {
    return (
      <CoverPlaceholder
        name={name}
        category={category}
        className={className}
        testid={testid || 'cover-placeholder'}
      />
    );
  }

  return (
    <img
      src={src}
      alt={alt}
      className={className}
      onError={() => setFailed(true)}
      data-testid={testid}
      {...rest}
    />
  );
}
