/* "Back to businesses" on a hand-built business site (Tzvi, 12 Nov 2026: "theres no back button to take them back
   to the business page with the rest of the businesses"). server.js adds this script to every hand-built page.
   It shows only to a visitor who came from one of our own pages (the businesses list, the home page, a search), so
   the site itself is unchanged for everyone else, on its own domain and in the owner's editor. It returns to the
   exact page they left, filters included. A small pill in the bottom-left corner, lifted above any bar fixed to
   the bottom of the screen (a phone order bar). */
(function () {
  try {
    var KEY = 'mir_back';
    var ref = document.referrer ? new URL(document.referrer) : null;
    var own = /^\/business\/[^/]+/.exec(location.pathname);
    var fromUs = ref && ref.origin === location.origin && !(own && ref.pathname.indexOf(own[0]) === 0);
    if (fromUs) sessionStorage.setItem(KEY, ref.pathname + ref.search);
    var back = sessionStorage.getItem(KEY);
    if (!back) return;
    var he = /^he/i.test(document.documentElement.lang || '');
    var a = document.createElement('a');
    a.href = back;
    a.textContent = he ? '→ לעסקים' : '← Businesses';
    a.setAttribute('aria-label', he ? 'חזרה לעסקים' : 'Back to businesses');
    a.setAttribute('data-mir-back', '');
    a.style.cssText = 'position:fixed;' + (he ? 'right' : 'left') + ':12px;bottom:12px;z-index:2147483000;' +
      'padding:5px 10px;border-radius:999px;background:rgba(255,255,255,.92);color:#111827;font:600 12px/1.2 system-ui,sans-serif;' +
      'text-decoration:none;border:1px solid #E3E3E3;box-shadow:0 2px 8px rgba(0,0,0,.2);white-space:nowrap';
    a.addEventListener('click', function () { sessionStorage.removeItem(KEY); });
    var lift = function () {
      var h = 0;
      document.querySelectorAll('body *').forEach(function (el) {
        if (el === a || getComputedStyle(el).position !== 'fixed') return;
        var r = el.getBoundingClientRect();
        if (r.width > innerWidth * 0.5 && r.bottom >= innerHeight - 2 && r.top > innerHeight * 0.5) h = Math.max(h, innerHeight - r.top);
      });
      a.style.bottom = (12 + h) + 'px';
    };
    // Out of the way while reading (Tzvi: "can we make it block less?"): it slides away while the visitor scrolls
    // down and comes back when they scroll up or reach the top, as a phone browser's own bar does.
    a.style.transition = 'opacity .25s, transform .25s';
    var lastY = scrollY;
    var onScroll = function () {
      var y = scrollY, hide = y > 80 && y > lastY + 2;
      if (Math.abs(y - lastY) > 2) {
        a.style.opacity = hide ? '0' : '1';
        a.style.transform = hide ? 'translateY(12px)' : 'none';
        a.style.pointerEvents = hide ? 'none' : 'auto';
        lastY = y;
      }
    };
    var add = function () { document.body.appendChild(a); lift(); setTimeout(lift, 1500); addEventListener('resize', lift); addEventListener('scroll', onScroll, { passive: true }); };
    if (document.body) add(); else addEventListener('DOMContentLoaded', add);
  } catch (e) { /* storage blocked: no button, the page is unchanged */ }
})();
