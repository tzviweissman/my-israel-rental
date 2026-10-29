// The parts every page of Krysp shares (page rules 3k): the menu bar and its phone menu, the header and phone bar on scroll,
// the reveals, her menu (one place for names and prices) and a basket kept between pages.
document.body.classList.remove('no-js');
(function () {
  var BASKET_KEY = 'krysp-basket-v1';
  // Her shop, from her listing (src/record.json): the one board today. Other products she adds are read from the shop by shop.js.
  var ITEMS = { luxe: { id: '827fb8e8720d', name: 'Luxe', one: 'Luxe board', price: 38 } };
  window.KR = {
    ITEMS: ITEMS,
    money: function (n) { return '$' + n; },
    unit: function (k) { var it = ITEMS[k]; return it ? it.price : 0; },
    label: function (k) { var it = ITEMS[k]; return it ? it.one : k; }
  };
  window.siteBasket = {
    get: function () { try { return JSON.parse(localStorage.getItem(BASKET_KEY)) || {}; } catch (e) { return {}; } },
    set: function (b) { try { localStorage.setItem(BASKET_KEY, JSON.stringify(b)); } catch (e) {} showCount(b); }
  };
  function totals(b) { var n = 0, t = 0; for (var k in b) { n += +b[k] || 0; t += (+b[k] || 0) * KR.unit(k); } return { n: n, t: t }; }
  function showCount(b) {
    var s = totals(b), c = document.getElementById('count');
    if (c) { c.hidden = !s.n; c.textContent = s.n; c.setAttribute('aria-label', s.n + ' in your order'); }
    var bp = document.querySelector('#bar .p');
    if (bp) bp.innerHTML = s.n ? '<b>Basket, $' + s.t + '</b>' + s.n + (s.n > 1 ? ' items' : ' item') : '<b>Luxe, $38</b>Deluxe peanut chew board';
  }
  showCount(window.siteBasket.get());

  var nav = document.getElementById('nav'), btn = document.getElementById('menu-btn');
  function setMenu(open) { nav.classList.toggle('shown', open); btn.setAttribute('aria-expanded', open); btn.textContent = open ? 'Close' : 'Menu'; }
  btn.addEventListener('click', function () { setMenu(!nav.classList.contains('shown')); });
  addEventListener('keydown', function (e) { if (e.key === 'Escape') setMenu(false); });
  nav.addEventListener('click', function (e) { if (e.target.closest('a')) setMenu(false); });

  // the phone bar waits for the first screen and is gone while something with its own price and button is on screen
  var top = document.getElementById('top'), bar = document.getElementById('bar'), form = document.getElementById('order') || document.getElementById('book'), tick = 0;
  var hideWhile = ['film', 'items'].map(function (id) { return document.getElementById(id); }).filter(Boolean), cl = document.querySelector('.close');
  function frame() {
    tick = 0;
    var vh = innerHeight;
    top.classList.toggle('solid', scrollY > 10);
    var busy = hideWhile.some(function (e) { var r = e.getBoundingClientRect(); return r.top < vh * .6 && r.bottom > vh * .4; });
    if (bar) bar.classList.toggle('on', scrollY > vh * .5 && !busy && (!form || form.getBoundingClientRect().top > vh * .75) && (!cl || cl.getBoundingClientRect().top > vh));
  }
  addEventListener('scroll', function () { if (!tick) tick = requestAnimationFrame(frame); }, { passive: true });
  frame();

  var io = new IntersectionObserver(function (es) { es.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } }); }, { rootMargin: '0px 0px -8% 0px' });
  [].forEach.call(document.querySelectorAll('.rev, .crack'), function (el) { io.observe(el); });

  // the site's one touch: pressing an order button cracks its face with a thin line. A link waits a moment so the crack is seen.
  var calm = matchMedia('(prefers-reduced-motion: reduce)').matches;
  document.addEventListener('click', function (e) {
    var b = e.target.closest('.btn, .btn-line'); if (!b) return;
    b.classList.remove('cracked'); void b.offsetWidth; b.classList.add('cracked');
    setTimeout(function () { b.classList.remove('cracked'); }, 950);
    var href = b.tagName === 'A' && b.getAttribute('href');
    if (!href || calm || e.defaultPrevented || e.metaKey || e.ctrlKey || e.shiftKey || b.target === '_blank' || href.charAt(0) === '#' || /^(https?:|mailto:|tel:)/.test(href)) return;
    e.preventDefault(); setTimeout(function () { location.href = b.href; }, 260);
  });

  // a light that follows the pointer on the board tile (T5); on touch it simply stays off
  document.addEventListener('pointermove', function (e) {
    var li = e.target.closest && e.target.closest('.cat li'); if (!li) return;
    var r = li.getBoundingClientRect(); li.style.setProperty('--mx', (e.clientX - r.left) + 'px'); li.style.setProperty('--my', (e.clientY - r.top) + 'px');
  }, { passive: true });

  // An Add link anywhere (data-add="<item>") puts one in the basket; its href opens the order page.
  [].forEach.call(document.querySelectorAll('[data-add]'), function (a) {
    a.addEventListener('click', function () { var b = window.siteBasket.get(); if (!b[a.dataset.add]) b[a.dataset.add] = 1; window.siteBasket.set(b); });
  });
})();

// a short note that slides in at the top and leaves by itself
window.siteToast = (function () {
  var el = document.createElement('div'), t = 0; el.className = 'toast'; el.setAttribute('role', 'status');
  el.innerHTML = '<span class="tk" aria-hidden="true"></span><span class="tt"></span>'; document.body.appendChild(el);
  return function (msg) { el.lastChild.textContent = msg; el.classList.add('show'); clearTimeout(t); t = setTimeout(function () { el.classList.remove('show'); }, 2200); };
})();
