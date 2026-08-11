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
// Read once at module load — CRA inlines env vars at build time so the
// tag ships on every rendered page without a runtime lookup per mount.
const GOOGLE_VERIFICATION = process.env.REACT_APP_GOOGLE_VERIFICATION;
// Set to "1" on the Railway preview service ONLY. When on, every page
// ships noindex regardless of what the caller asked for — a preview is a
// second copy of the whole site, and if Google indexes it, it competes
// with the real domain for its own content and shows visitors half-built
// pages. Baked at build time like every REACT_APP_* var, so flipping it
// requires a rebuild, not a restart.
const IS_PREVIEW = process.env.REACT_APP_PREVIEW === '1';

const PageMeta = ({ title, description, path, image, jsonLd, noindex = false }) => {
  // Force-on for preview builds; individual pages can still opt in via the
  // prop on production (coming-soon pages, placeholders).
  const suppressIndexing = noindex || IS_PREVIEW;
  // `noindex` keeps a page out of search results. Needed for coming-soon and
  // placeholder pages: if one gets indexed it will outrank the real page for
  // its own name once that ships, and removing a URL from an index is far
  // slower than never adding it.
  // Prefer the explicit `path` prop so server-rendered crawlers and
  // navigations both resolve to the same canonical. Fallback to the
  // browser path if the caller didn't pass one in.
  const resolvedPath =
    path ?? (typeof window !== 'undefined' ? window.location.pathname : '/');
  const canonical = `${CANONICAL_ORIGIN}${resolvedPath}`;
  const ogImage =
    image ??
    `${CANONICAL_ORIGIN}/brand-logo.png`;
  // Normalise jsonLd into an array so callers can pass a single object
  // or a list of structured-data blocks (Organization + WebSite, etc.)
  const ldBlocks = jsonLd ? (Array.isArray(jsonLd) ? jsonLd : [jsonLd]) : [];
  return (
    <Helmet prioritizeSeoTags>
      <title>{title}</title>
      <meta name="description" content={description} />
      {suppressIndexing && <meta name="robots" content="noindex,nofollow" />}
      <link rel="canonical" href={canonical} />
      {/* Google Search Console verification. Ships site-wide when the
          REACT_APP_GOOGLE_VERIFICATION env var is set — see
          /app/docs/google-search-console-setup.md */}
      {GOOGLE_VERIFICATION && (
        <meta name="google-site-verification" content={GOOGLE_VERIFICATION} />
      )}
      {/* Open Graph */}
      <meta property="og:title" content={title} />
      <meta property="og:description" content={description} />
      <meta property="og:url" content={canonical} />
      <meta property="og:image" content={ogImage} />
      {/* Twitter card */}
      <meta name="twitter:title" content={title} />
      <meta name="twitter:description" content={description} />
      <meta name="twitter:image" content={ogImage} />
      {/* JSON-LD structured data — emits one <script> per block so
          Google can pick out Organization, WebSite, Product, etc.
          independently. */}
      {ldBlocks.map((block, i) => (
        <script key={i} type="application/ld+json">
          {JSON.stringify(block)}
        </script>
      ))}
    </Helmet>
  );
};

export default PageMeta;
