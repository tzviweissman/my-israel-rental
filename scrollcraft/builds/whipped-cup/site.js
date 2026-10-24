// The Whipped Cup, the parts every page shares (page rules 3k): the menu bar
// (and its phone menu), the header and phone bar on scroll, the reveals, and
// the basket, kept in this browser between pages.
document.body.classList.remove('no-js');
(function () {
  var KEY = 'twc-basket-v1';
  window.twcBasket = {
    get: function () { try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch (e) { return {}; } },
    set: function (b) { try { localStorage.setItem(KEY, JSON.stringify(b)); } catch (e) {} showCount(b); }
  };
  function showCount(b) {
    var n = 0; for (var k in (b.jars || {})) n += b.jars[k] || 0; if (b.pack) n += 1;
    var c = document.getElementById('count'); if (!c) return;
    c.hidden = !n; c.textContent = n; c.setAttribute('aria-label', n + ' in your order');
  }
  showCount(window.twcBasket.get());

  var nav = document.getElementById('nav'), btn = document.getElementById('menu-btn');
  function setMenu(open) { nav.classList.toggle('shown', open); btn.setAttribute('aria-expanded', open); btn.textContent = open ? 'Close' : 'Menu'; }
  btn.addEventListener('click', function () { setMenu(!nav.classList.contains('shown')); });
  addEventListener('keydown', function (e) { if (e.key === 'Escape') setMenu(false); });
  nav.addEventListener('click', function (e) { if (e.target.closest('a')) setMenu(false); });

  var top = document.getElementById('top'), bar = document.getElementById('bar'), order = document.getElementById('order'), tick = 0;
  function frame() {
    tick = 0;
    var vh = innerHeight, past = scrollY > vh * .5;
    top.classList.toggle('solid', scrollY > 10);
    // the bar steps aside while the page itself shows an Order button: the opening's end, the
    // closing band, and the order form (the review, 20 Oct 2026: it sat over "Order your jars")
    var open = document.getElementById('open'), close = document.querySelector('.close'), ob = open && open.getBoundingClientRect(), cb = close && close.getBoundingClientRect();
    var busy = (ob && ob.bottom > vh * .4) || (cb && cb.top < vh) || (order && order.getBoundingClientRect().top < vh * .75);
    if (bar) bar.classList.toggle('on', past && !busy);
  }
  addEventListener('scroll', function () { if (!tick) tick = requestAnimationFrame(frame); }, { passive: true });
  frame();

  var io = new IntersectionObserver(function (es) { es.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } }); }, { rootMargin: '0px 0px -8% 0px' });
  [].forEach.call(document.querySelectorAll('.rev'), function (el) { io.observe(el); });

  // An Add button anywhere puts a jar or a package in the basket; its link then opens the order page.
  [].forEach.call(document.querySelectorAll('[data-jar], [data-pack]'), function (a) {
    a.addEventListener('click', function () {
      var b = window.twcBasket.get(); b.jars = b.jars || {};
      if (a.dataset.jar) { if (!b.jars[a.dataset.jar]) b.jars[a.dataset.jar] = 1; } else b.pack = a.dataset.pack;
      window.twcBasket.set(b);
    });
  });
})();
// a photo that arrives late fades in over 300 ms instead of popping in (rule 3s.2; check-motion caught the
// "How many coffees?" photo landing in one frame while a choice was being tapped, 24 Oct 2026)
(function () {
  [].forEach.call(document.querySelectorAll('img[loading="lazy"]'), function (i) {
    if (i.complete && i.naturalWidth) return;
    i.classList.add('lz');
    var done = function () { i.classList.add('lz-in'); };
    i.addEventListener('load', done, { once: true }); i.addEventListener('error', done, { once: true });
  });
})();
