// The parts every page of a designed site shares (page rules 3k): the menu
// bar and its phone menu, the header and phone bar on scroll, the reveals,
// and a basket kept between pages. From scrollcraft/starter: copy into the
// build, set BASKET_KEY, and keep business-only code in the page itself.
document.body.classList.remove('no-js');
(function () {
  var BASKET_KEY = 'amc-basket-v1';   // one per site, e.g. 'twc-basket-v1'
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
    // the bar waits for the first screen and is gone while the order form, the closing band or the shop stage's own buttons are on screen, so it never covers a price or button
    var cl = document.querySelector('.close'), st = document.getElementById('doughs');
    if (bar) bar.classList.toggle('on', scrollY > vh * .5 && (!form || form.getBoundingClientRect().top > vh) && (!cl || cl.getBoundingClientRect().top > vh) && (!st || st.getBoundingClientRect().bottom < vh * .35));
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

// a short note that slides in at the top and leaves by itself
window.siteToast = (function () {
  var el = document.createElement('div'), t = 0; el.className = 'toast'; el.setAttribute('role', 'status');
  el.innerHTML = '<span class="tk" aria-hidden="true"></span><span class="tt"></span>'; document.body.appendChild(el);
  return function (msg) { el.lastChild.textContent = msg; el.classList.add('show'); clearTimeout(t); t = setTimeout(function () { el.classList.remove('show'); }, 2200); };
})();
