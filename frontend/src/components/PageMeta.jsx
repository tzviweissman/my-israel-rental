/**
 * PageMeta — declarative per-route SEO tags.
 *
 * Wraps react-helmet-async to set `<title>`, `<meta name="description">`,
 * `<link rel="canonical">`, and the matching Open Graph + Twitter Card
 * tags from a single component. Drop one of these at the top of every
 * top-level page (Home, Stays, Services, FAQ, /properties/*) so search
 * engines see a distinct snippet per route instead of the duplicate
 * SPA shell defaults shipped in `index.html`.
 *
 * Canonical URL is derived from the current `window.location.pathname`
 * stitched onto a fixed production origin so dev / preview crawls
 * never get pinned as the canonical URL.
 */
import React from 'react';
import { Helmet } from 'react-helmet-async';

const CANONICAL_ORIGIN = 'https://myisraelrental.com';

const PageMeta = ({ title, description, path, image }) => {
  // Prefer the explicit `path` prop so server-rendered crawlers and
  // navigations both resolve to the same canonical. Fallback to the
  // browser path if the caller didn't pass one in.
  const resolvedPath =
    path ?? (typeof window !== 'undefined' ? window.location.pathname : '/');
  const canonical = `${CANONICAL_ORIGIN}${resolvedPath}`;
  const ogImage =
    image ??
    'https://customer-assets.emergentagent.com/job_listing-manager-pro-2/artifacts/hx4hc6hw_IMG_1745%20%281%29.PNG';
  return (
    <Helmet prioritizeSeoTags>
      <title>{title}</title>
      <meta name="description" content={description} />
      <link rel="canonical" href={canonical} />
      {/* Open Graph */}
      <meta property="og:title" content={title} />
      <meta property="og:description" content={description} />
      <meta property="og:url" content={canonical} />
      <meta property="og:image" content={ogImage} />
      {/* Twitter card */}
      <meta name="twitter:title" content={title} />
      <meta name="twitter:description" content={description} />
      <meta name="twitter:image" content={ogImage} />
    </Helmet>
  );
};

export default PageMeta;
