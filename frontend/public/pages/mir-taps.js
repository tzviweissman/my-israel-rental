/* Every button and link pressed on a hand-built business site (Tzvi, 12 Nov 2026: "track clicks on the business
   pages too"). server.js adds it with the business's slug and the page name. WhatsApp, phone, email, directions and
   the socials keep their own names; order and basket buttons count as "order"; anything else as "button" with the
   words on it, so the owner sees which ones people press. The same rule is in frontend/src/utils/tapKind.js for the
   standard business page: change both together. Never a path or what was typed, only the button's own words. */
(function () {
  try {
    var me = document.currentScript, slug = me.getAttribute('data-slug'), page = me.getAttribute('data-page');
    var kindOf = function (u, label) {
      return /wa\.me|whatsapp/i.test(u) ? 'whatsapp' : /^tel:/i.test(u) ? 'phone' : /^mailto:/i.test(u) ? 'email'
        : /waze|maps\.|\/maps/i.test(u) ? 'directions' : /instagram/i.test(u) ? 'instagram'
        : /facebook|fb\.com/i.test(u) ? 'facebook' : /tiktok/i.test(u) ? 'tiktok'
        : /order|basket|cart|checkout/i.test(u) || /order|basket|cart|checkout|\bbuy\b|הזמ|לסל|הסל|בסל|לקנות|קנו/i.test(label) ? 'order'
        : label ? 'button' : '';
    };
    document.addEventListener('click', function (e) {
      var el = e.target.closest && e.target.closest('a[href],button,[role=button],summary,input[type=submit]');
      if (!el) return;
      var label = String(el.getAttribute('aria-label') || el.textContent || el.value || '').replace(/\s+/g, ' ').trim().slice(0, 40);
      var kind = kindOf(el.href || '', label);
      if (!kind) return;
      fetch('/api/marketplace/business/' + slug + '/tap', {
        method: 'POST', keepalive: true,
        headers: { 'content-type': 'application/json', 'X-Visit-Source': sessionStorage.getItem('mir_src') || '', 'X-Visit-Lang': document.documentElement.lang || '' },
        body: JSON.stringify({ kind: kind, page: page, label: label || null }),
      }).catch(function () {});
    }, true);
  } catch (e) { /* no counting, the page is unchanged */ }
})();
