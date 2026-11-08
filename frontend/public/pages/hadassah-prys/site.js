// The parts every page of a designed site shares (page rules 3k): the menu
// bar and its phone menu, the header and phone bar on scroll, the reveals,
// and a basket kept between pages. From scrollcraft/starter: copy into the
// build, set BASKET_KEY, and keep business-only code in the page itself.
document.body.classList.remove('no-js');
(function () {
  var BASKET_KEY = 'hadassah-basket-v1';   // one per site, e.g. 'twc-basket-v1'
  window.siteBasket = {
    get: function () { try { return JSON.parse(localStorage.getItem(BASKET_KEY)) || {}; } catch (e) { return {}; } },
    set: function (b) { try { localStorage.setItem(BASKET_KEY, JSON.stringify(b)); } catch (e) {} showCount(b); }
  };
  function showCount(b) {
    var n = 0; for (var k in b) n += +b[k] || 0;
    var c = document.getElementById('count'); if (!c) return;
    c.hidden = !n; c.textContent = n; c.setAttribute('aria-label', n + ' in your order');
  }
  showCount(window.siteBasket.get());

  var nav = document.getElementById('nav'), btn = document.getElementById('menu-btn');
  function setMenu(open) { nav.classList.toggle('shown', open); btn.setAttribute('aria-expanded', open); btn.textContent = open ? 'Close' : 'Menu'; }
  btn.addEventListener('click', function () { setMenu(!nav.classList.contains('shown')); });
  addEventListener('keydown', function (e) { if (e.key === 'Escape') setMenu(false); });
  nav.addEventListener('click', function (e) { if (e.target.closest('a')) setMenu(false); });

  // the phone bar shows after the first screen and hides at the order form (#order or #book)
  var top = document.getElementById('top'), bar = document.getElementById('bar'), form = document.getElementById('order') || document.getElementById('book'), tick = 0;
  function frame() {
    tick = 0;
    var vh = innerHeight;
    top.classList.toggle('solid', scrollY > 10);
    var cl = document.querySelector('.close'); // the closing band has its own Book, so the bar leaves before two show at once
    if (bar) bar.classList.toggle('on', scrollY > vh * .5 && (!form || form.getBoundingClientRect().top > vh * .75) && (!cl || cl.getBoundingClientRect().top > vh * .8));
  }
  addEventListener('scroll', function () { if (!tick) tick = requestAnimationFrame(frame); }, { passive: true });
  frame();

  var io = new IntersectionObserver(function (es) { es.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } }); }, { rootMargin: '0px 0px -8% 0px' });
  [].forEach.call(document.querySelectorAll('.rev'), function (el) { io.observe(el); });

  // An Add link anywhere (data-add="<item>") puts one in the basket; its href opens the order page.
  [].forEach.call(document.querySelectorAll('[data-add]'), function (a) {
    a.addEventListener('click', function () { var b = window.siteBasket.get(); if (!b[a.dataset.add]) b[a.dataset.add] = 1; window.siteBasket.set(b); });
  });
})();

// The closing band's row of bulbs comes on when it is reached, the payoff of the opening.
(function () {
  var close = document.querySelector('.close'); if (!close) return;
  var row = document.createElement('div'); row.className = 'bulbs'; row.setAttribute('aria-hidden', 'true');
  for (var i = 0; i < 9; i++) { var b = document.createElement('i'); b.style.setProperty('--i', i); row.appendChild(b); }
  close.insertBefore(row, close.firstChild);
  if (!('IntersectionObserver' in window)) { row.classList.add('on'); return; }
  new IntersectionObserver(function (es, o) { if (es[0].isIntersecting) { row.classList.add('on'); o.disconnect(); } }, { threshold: .6 }).observe(row);
})();
