// The catalogue helpers every page of a shop site shares, from the starter (12 Nov 2026; tested on Gremier Coffee).
// A basket line's key is the product id; window.CAT comes from assets/catalog.js, written by sitekit.catalog_js().
(function () {
  var CAT = window.CAT, by = {};
  CAT.items.forEach(function (it) { by[it.id] = it; });
  // Every price comes from the listing (rules 3j.14). frontend/server.js puts the listing's prices, by product name, in
  // window.MIR_PRICES in <head>, so they are here before this runs; its #mir-live-products (stock) comes at the end of
  // <body>, after this script, so it is read once the page has loaded. A "was" of form "6 x classic" is worked out from
  // the live price of that item, never typed (sitekit.catalog_js writes it from the build's was_of).
  CAT.money = function (n) { return '₪' + (Math.round(n * 100) / 100); };
  function livePrices() {
    var P = window.MIR_PRICES || {};
    try { JSON.parse((document.getElementById('mir-live-prices') || {}).textContent || '{}', function (k, v) { if (k && typeof v === 'number' && !(k in P)) P[k] = v; return v; }); } catch (e) { /* none */ }
    CAT.items.forEach(function (it) { var p = Number(P[it.name]); if (p > 0) it.price = p; });
    CAT.items.forEach(function (it) { if (it.was_of && by[it.was_of[1]]) it.was = it.was_of[0] * by[it.was_of[1]].price; });
  }
  function liveStock() {
    try {
      JSON.parse((document.getElementById('mir-live-products') || {}).textContent || '[]').forEach(function (p) {
        var it = by[p.id]; if (it) { if (Number(p.price) > 0) it.price = Number(p.price); it.out = p.in_stock === false; }
      });
    } catch (e) { /* the typed-in catalogue stays */ }
  }
  // the price rows already on the page (sitekit wrote them with the build's prices) follow the live ones
  function paint() {
    [].forEach.call(document.querySelectorAll('[data-id]'), function (a) {
      var it = by[a.dataset.id], row = a.querySelector('.pr-row'); if (!it || !row) return;
      var pr = row.querySelector('.pr'), s = row.querySelector('s'), off = row.querySelector('.off');
      if (pr) pr.textContent = CAT.money(it.price);
      var pct = it.was ? Math.round((1 - it.price / it.was) * 100) : 0;
      if (s) { s.hidden = pct < 1; s.textContent = CAT.money(it.was || 0); s.setAttribute('aria-label', 'was ' + (it.was || 0)); }
      if (off) { off.hidden = pct < 1; off.textContent = pct + '% off'; }
    });
    [].forEach.call(document.querySelectorAll('button[data-add]'), function (b) {
      var it = by[b.dataset.add]; if (it && b.getAttribute('aria-label')) b.setAttribute('aria-label', b.getAttribute('aria-label').replace(/, [\d.]+$/, ', ' + it.price));
    });
  }
  livePrices();
  CAT.by = by;
  CAT.paint = paint;
  if (window.MIR_PRICES) paint();
  addEventListener('DOMContentLoaded', function () { if (document.getElementById('mir-live-products')) { liveStock(); livePrices(); paint(); } });
  CAT.label = function (id) { var it = by[id]; return it ? it.name : ''; };
  CAT.unit = function (id) { var it = by[id]; return it ? it.price : 0; };
  CAT.add = function (id, n) {
    var b = window.siteBasket.get(); b[id] = Math.min(20, (+b[id] || 0) + (n || 1)); window.siteBasket.set(b);
    window.siteToast('Added: ' + CAT.label(id));
  };
  // every Add button on any page: <button data-add="classic">
  document.addEventListener('click', function (e) {
    var b = e.target.closest('[data-add]'); if (!b || !by[b.dataset.add]) return;
    e.preventDefault(); CAT.add(b.dataset.add, 1);
    b.classList.remove('added'); void b.offsetWidth; b.classList.add('added');
  });
  // A card's Add becomes − 1 + once that item is in the basket, so nobody adds it twice by mistake (Baymard; shop
  // research step 2, 13 Nov 2026). Only cards (.pc): the "most popular" and add-on buttons stay plain Adds.
  var HE = (document.documentElement.lang || '').indexOf('he') === 0;
  function steppers() {
    var b = window.siteBasket.get();
    [].forEach.call(document.querySelectorAll('.pc button[data-add]'), function (btn) {
      var id = btn.dataset.add, n = +b[id] || 0, st = btn.nextElementSibling;
      if (!st || !st.classList.contains('pc-step')) {
        var nm = CAT.label(id);
        st = document.createElement('span'); st.className = 'step sm pc-step'; st.dataset.k = id; st.hidden = true;
        st.innerHTML = '<button type="button" data-d="-1"></button><output></output><button type="button" data-d="1"></button>';
        st.firstChild.setAttribute('aria-label', (HE ? 'אחד פחות: ' : 'One fewer ') + nm); st.firstChild.textContent = '−';
        st.lastChild.setAttribute('aria-label', (HE ? 'עוד אחד: ' : 'One more ') + nm); st.lastChild.textContent = '+';
        btn.after(st);
      }
      var had = !st.hidden;
      btn.hidden = n > 0; st.hidden = !n; st.querySelector('output').textContent = n;
      st.querySelector('output').setAttribute('aria-label', n + (HE ? ' בסל' : ' in your basket'));
      // focus follows the control that took the button's place
      if (document.activeElement === btn && n) st.lastChild.focus();
      if (had && !n && st.contains(document.activeElement)) btn.focus();
    });
  }
  document.addEventListener('click', function (e) {
    var d = e.target.closest('.pc-step button'); if (!d) return;
    var id = d.parentNode.dataset.k, b = window.siteBasket.get();
    b[id] = Math.max(0, Math.min(20, (+b[id] || 0) + (+d.dataset.d)));
    if (!b[id]) delete b[id];
    window.siteBasket.set(b);
    document.dispatchEvent(new Event('site:basket'));   // shop.js redraws the order
  });
  CAT.steppers = steppers;   // shop.js calls it after the live catalogue redraws the cards
  // once something is in the basket the menu bar's button goes to it
  function barBtn() {
    var b = window.siteBasket.get(), n = 0; for (var k in b) n += +b[k] || 0;
    var tot = 0; for (var k2 in b) tot += (+b[k2] || 0) * CAT.unit(k2);
    document.body.classList.toggle('has-basket', n > 0);
    steppers();
    var a = document.querySelector('.top .btn-line');
    if (a && !a.classList.contains('just')) {
      a.firstChild.textContent = n ? 'Basket' : a.dataset.label || 'Shop';   // the count is sitekit's own badge
      a.setAttribute('href', n ? 'shop.html#order' : 'shop.html');
    }
    // the phone bar becomes the basket (the phone's menu bar has no basket button)
    var bar = document.getElementById('bar'), p = bar && bar.querySelector('.p'), go = bar && bar.querySelector('.btn');
    if (p && !p.dataset.was) { p.dataset.was = p.innerHTML; go.dataset.was = go.textContent; go.dataset.href = go.getAttribute('href'); }
    if (p && !bar.classList.contains('just')) {
      // "2 items · ₪140 · View basket", as the food apps people already order from (shop research, 13 Nov 2026)
      var he = (document.documentElement.lang || '').indexOf('he') === 0;
      if (n) {
        p.innerHTML = '<b>' + (he ? (n === 1 ? 'פריט אחד' : n + ' פריטים') : n + (n === 1 ? ' item' : ' items')) + '</b>' + CAT.money(tot);
        go.textContent = he ? 'לסל' : 'View basket'; go.setAttribute('href', 'shop.html#order');
      } else { p.innerHTML = p.dataset.was; go.textContent = go.dataset.was; go.setAttribute('href', go.dataset.href); }
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
})();
