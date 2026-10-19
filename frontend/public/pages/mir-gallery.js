/*
 * A designed page's gallery, filled with the owner's own photos (Tzvi, 19 Oct
 * 2026: owners add pictures without ruining the page's look or layout).
 *
 * frontend/server.js adds this script and the photos (#mir-live-gallery, from
 * GET /api/marketplace/business/<slug>/page-edits, set in the dashboard's
 * page editor) to any page with a [data-mir-gallery] element. The page
 * supplies the look; this only fills it in:
 *
 *   <section data-mir-gallery data-max="12" hidden>
 *     <h2>...</h2>
 *     <div data-mir-photos></div>
 *     <template data-mir-photo><figure><img data-f="img" alt=""></figure></template>
 *   </section>
 *
 * Every photo goes into the same frame (the page's CSS gives it one shape),
 * cropped around the focus the owner set. A photo too small to look sharp
 * (under 640px wide) is left out rather than shown blurred. The section stays
 * hidden until at least one photo is in, so an empty gallery never shows.
 * The list carries data-count (how many are shown), so the page can lay out
 * one or two photos differently from a full grid.
 */
(function () {
  var holder = document.getElementById('mir-live-gallery');
  if (!holder) return;
  var photos;
  try { photos = JSON.parse(holder.textContent || '[]'); } catch (e) { return; }
  if (!Array.isArray(photos) || !photos.length) return;
  [].forEach.call(document.querySelectorAll('[data-mir-gallery]'), function (sec) {
    var list = sec.querySelector('[data-mir-photos]'), tpl = sec.querySelector('template[data-mir-photo]');
    if (!list || !tpl) return;
    var max = Math.max(1, Math.min(24, parseInt(sec.getAttribute('data-max'), 10) || 12));
    var shown = 0;
    var recount = function () { list.setAttribute('data-count', list.children.length); if (!list.children.length) sec.hidden = true; };
    photos.slice(0, max).forEach(function (p) {
      if (!p || !/^https:\/\//.test(p.url || '')) return;
      var node = tpl.content.firstElementChild.cloneNode(true);
      var img = node.matches('[data-f="img"]') ? node : node.querySelector('[data-f="img"]');
      if (!img) return;
      img.alt = p.alt || '';
      img.loading = 'lazy';
      img.decoding = 'async';
      img.style.objectFit = 'cover';
      var at = function (v) { v = Number(v); return isFinite(v) ? Math.max(0, Math.min(100, v)) : 50; };
      img.style.objectPosition = at(p.fx) + '% ' + at(p.fy) + '%';
      img.addEventListener('load', function () {
        if (img.naturalWidth && img.naturalWidth < 640) { node.remove(); recount(); }
      });
      img.addEventListener('error', function () { node.remove(); recount(); });
      img.src = p.url;
      list.appendChild(node);
      shown += 1;
    });
    recount();
    if (shown) sec.hidden = false;
  });
})();
