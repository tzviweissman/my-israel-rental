// The parts every page of M and N Jewelry shares (page rules 3k): the menu bar and its phone menu, the bar on scroll,
// the first screen arriving, the reveals, the pieces (one place for names and prices) and a basket kept between pages.
document.body.classList.remove('no-js');
(function () {
  var BASKET_KEY = 'mn-jewelry-basket-v1';
  // Their pieces, from their listing (src/record.json): four products, each $2,000, with the photos the owner put on each.
  var ITEMS = __ITEMS__;
  window.MN = {
    ITEMS: ITEMS,
    money: function (n) { return '$' + Number(n).toLocaleString('en-US'); },
    unit: function (k) { var it = ITEMS[k.split('|')[0]]; return it ? it.price : 0; }
  };
  window.siteBasket = {
    get: function () { try { return JSON.parse(localStorage.getItem(BASKET_KEY)) || {}; } catch (e) { return {}; } },
    set: function (b) { try { localStorage.setItem(BASKET_KEY, JSON.stringify(b)); } catch (e) {} showCount(b); }
  };
  function totals(b) { var n = 0, t = 0; for (var k in b) { n += +b[k] || 0; t += (+b[k] || 0) * MN.unit(k); } return { n: n, t: t }; }
  function showCount(b) {
    var s = totals(b), c = document.getElementById('count');
    if (c) { c.hidden = !s.n; c.textContent = s.n; c.setAttribute('aria-label', s.n + ' in your basket'); }
    var bp = document.querySelector('#bar .p');
    if (bp) bp.innerHTML = s.n ? '<b>Basket, ' + MN.money(s.t) + '</b>' + s.n + (s.n > 1 ? ' pieces' : ' piece') : '<b>Natural and lab diamonds</b>By appointment in Jerusalem';
    // on the shop, with something in the basket, the bar's button goes to the order and says so
    var bb = document.querySelector('#bar .btn');
    if (bb && document.body.dataset.page === 'shop') { bb.textContent = s.n ? 'Go to your order' : 'Choose your piece'; bb.setAttribute('href', s.n ? '#order' : '#items'); }
  }
  showCount(window.siteBasket.get());

  // the first screen arrives in order (rules 3u.5): bar, headline, line, picture, button; once, and only with motion on
  var calm = matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (!calm && document.querySelector('[data-arrive]') && scrollY < 40) document.documentElement.classList.add('arrive-go');

  var nav = document.getElementById('nav'), btn = document.getElementById('menu-btn');
  function setMenu(open) { nav.classList.toggle('shown', open); btn.setAttribute('aria-expanded', open); btn.textContent = open ? 'Close' : 'Menu'; }
  btn.addEventListener('click', function () { setMenu(!nav.classList.contains('shown')); });
  addEventListener('keydown', function (e) { if (e.key === 'Escape') setMenu(false); });
  nav.addEventListener('click', function (e) { if (e.target.closest('a')) setMenu(false); });

  // the phone bar waits for the first screen and is gone while something with its own price and button is on screen
  var top = document.getElementById('top'), bar = document.getElementById('bar'), form = document.getElementById('order'), tick = 0;
  var hideWhile = ['open', 'items'].map(function (id) { return document.getElementById(id); }).filter(Boolean), cl = document.querySelector('.close');
  function frame() {
    tick = 0;
    var vh = innerHeight;
    top.classList.toggle('solid', scrollY > 10);
    var busy = hideWhile.some(function (e) { var r = e.getBoundingClientRect(); return r.top < vh * .6 && r.bottom > vh * .4; });
    if (bar) bar.classList.toggle('on', scrollY > vh * .5 && !busy && (!form || form.getBoundingClientRect().top > vh * .75) && (!cl || cl.getBoundingClientRect().top > vh));
  }
  addEventListener('scroll', function () { if (!tick) tick = requestAnimationFrame(frame); }, { passive: true });
  frame();

  // reveals fade in place (R6); the stone dividers light as they come into view (the touch)
  var io = new IntersectionObserver(function (es) { es.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } }); }, { rootMargin: '0px 0px -10% 0px' });
  [].forEach.call(document.querySelectorAll('.rev, .stone'), function (el) { io.observe(el); });

  // An Add link anywhere (data-add="<piece>") puts it in the basket; its href opens the shop.
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
