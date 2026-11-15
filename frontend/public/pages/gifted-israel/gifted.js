// Gifted Israel: the catalogue helpers every page shares, and the engraving (GI-X1).
// A basket line's key is "id|finish|nusach|engraving"; window.GI comes from assets/catalog.js.
(function () {
  var GI = window.GI, by = {};
  GI.items.forEach(function (it) { by[it.id] = it; });
  // live prices and stock from their shop, when the page is served with them (frontend/server.js #mir-live-products)
  try {
    var live = JSON.parse((document.getElementById('mir-live-products') || {}).textContent || '[]');
    live.forEach(function (p) { var it = by[p.id]; if (it) { it.price = Number(p.price) || it.price; it.out = p.in_stock === false; } });
  } catch (e) { /* the typed-in catalogue stays */ }
  GI.by = by;
  GI.money = function (n) { return '₪' + (Math.round(n * 100) / 100); };
  GI.split = function (key) { var p = key.split('|'); return { id: p[0], finish: p[1] || '', nusach: p[2] || '', engr: decodeURIComponent(p[3] || '') }; };
  GI.key = function (id, finish, nusach, engr) { return [id, finish || '', nusach || '', encodeURIComponent(engr || '')].join('|'); };
  GI.label = function (key) {
    var k = GI.split(key), it = by[k.id]; if (!it) return '';
    var extra = [k.finish, k.nusach].filter(Boolean).join(', ');
    return it.name + (extra ? ' (' + extra + ')' : '');
  };
  GI.unit = function (key) { var it = by[GI.split(key).id]; return it ? it.price : 0; };
  GI.add = function (key, n) {
    var b = window.siteBasket.get(); b[key] = Math.min(20, (+b[key] || 0) + (n || 1)); window.siteBasket.set(b);
    window.siteToast('Added: ' + GI.label(key));
  };

  // once something is in the basket the menu bar's button goes to it, and the phone bar becomes the basket:
  // "2 items · ₪140 · View basket" (shop research, 13 Nov 2026). Empty, it shows nothing on the shop page.
  function barBtn() {
    var b = window.siteBasket.get(), n = 0, tot = 0; for (var k in b) { n += +b[k] || 0; tot += (+b[k] || 0) * GI.unit(k); }
    document.body.classList.toggle('has-basket', n > 0);
    var a = document.querySelector('.top .btn-line');
    if (a && !a.classList.contains('just')) {
      a.firstChild.textContent = n ? 'Basket' : 'Shop the collection';
      a.setAttribute('href', n ? 'shop.html#order' : 'shop.html');
    }
    var bar = document.getElementById('bar'), p = bar && bar.querySelector('.p'), go = bar && bar.querySelector('.btn');
    if (p && !p.dataset.was) { p.dataset.was = p.innerHTML; go.dataset.was = go.textContent; go.dataset.href = go.getAttribute('href'); }
    if (p && !bar.classList.contains('just')) {
      if (n) { p.innerHTML = '<b>' + n + (n === 1 ? ' item' : ' items') + '</b>' + GI.money(tot); go.textContent = 'View basket'; go.setAttribute('href', 'shop.html#order'); }
      else { p.innerHTML = p.dataset.was; go.textContent = go.dataset.was; go.setAttribute('href', go.dataset.href); }
    }
    dispatchEvent(new Event('scroll'));   // site.js shows or hides the bar for the new basket
  }
  // "Added: <name>" shows for a moment in the basket button and the phone bar, never over the page
  var tAdd = 0;
  document.addEventListener('site:added', function (e) {
    var a = document.querySelector('.top .btn-line'), bar = document.getElementById('bar'), p = bar && bar.querySelector('.p');
    if (a) { a.classList.add('just'); a.firstChild.textContent = 'Added ✓'; }
    if (p) { bar.classList.add('just'); p.innerHTML = '<b>Added</b>' + String(e.detail).replace(/^Added: /, '').replace(/</g, '&lt;'); }
    clearTimeout(tAdd);
    tAdd = setTimeout(function () { if (a) a.classList.remove('just'); if (bar) bar.classList.remove('just'); barBtn(); }, 1600);
  });
  var set0 = window.siteBasket.set; window.siteBasket.set = function (b) { set0(b); barBtn(); }; barBtn();

  // the phone bar steps aside at the closing band, which has its own button
  var cl = document.querySelector('.close'), br = document.getElementById('bar');
  if (cl && br && 'IntersectionObserver' in window) new IntersectionObserver(function (es) { br.classList.toggle('off', es[0].isIntersecting); }).observe(cl);

  // the engraving: letters cut in one by one behind a point of light, then whatever the visitor types
  GI.engrave = function (piece, text, animate) {
    var el = piece.querySelector('.engr'), sp = piece.querySelector('.spark');
    el.innerHTML = ''; el.style.fontSize = el.dataset.fs || '';
    text.split('').forEach(function (c) { var s = document.createElement('span'); s.className = 'ch'; s.textContent = c; el.appendChild(s); });
    // long words shrink to stay on the base's face
    var fs = parseFloat(getComputedStyle(el).fontSize);
    while (el.scrollWidth > el.clientWidth && fs > 6) { fs -= .5; el.style.fontSize = fs + 'px'; }
    if (!animate || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    el.classList.add('cutting'); sp.classList.add('on');
    var chs = el.querySelectorAll('.ch'), i = 0, box = piece.getBoundingClientRect();
    (function next() {
      if (i >= chs.length) { sp.classList.remove('on'); el.classList.remove('cutting'); return; }
      var r = chs[i].getBoundingClientRect();
      sp.style.left = (r.right - box.left) + 'px';
      chs[i].classList.add('cut'); i++;
      setTimeout(next, chs[i - 1].textContent === ' ' ? 40 : 95);
    })();
  };
})();
