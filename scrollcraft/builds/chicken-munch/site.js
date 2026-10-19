// Chicken Munch, the parts every page shares (page rules 3k): the menu bar
// (and its phone menu), the header and phone bar on scroll, the reveals, and
// the basket, kept in this browser between pages.
document.body.classList.remove('no-js');
(function () {
  var KEY = 'cm-basket-v1';
  window.cmBasket = {
    get: function () { try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch (e) { return {}; } },
    set: function (b) { try { localStorage.setItem(KEY, JSON.stringify(b)); } catch (e) {} showCount(b); }
  };
  function showCount(b) {
    var n = 0; for (var k in b) n += b[k] || 0;
    var c = document.getElementById('count'); if (!c) return;
    c.hidden = !n; c.textContent = n; c.setAttribute('aria-label', n + ' in your order');
  }
  showCount(window.cmBasket.get());

  var nav = document.getElementById('nav'), btn = document.getElementById('menu-btn');
  function setMenu(open) { nav.classList.toggle('shown', open); btn.setAttribute('aria-expanded', open); btn.textContent = open ? 'Close' : 'Menu'; }
  btn.addEventListener('click', function () { setMenu(!nav.classList.contains('shown')); });
  addEventListener('keydown', function (e) { if (e.key === 'Escape') setMenu(false); });
  nav.addEventListener('click', function (e) { if (e.target.closest('a')) setMenu(false); });

  var top = document.getElementById('top'), bar = document.getElementById('bar'), order = document.getElementById('order'), tick = 0;
  function frame() {
    tick = 0;
    var vh = innerHeight, past = scrollY > vh * .5;
    top.classList.toggle('solid', past);
    if (bar) bar.classList.toggle('on', past && (!order || order.getBoundingClientRect().top > vh * .75));
  }
  addEventListener('scroll', function () { if (!tick) tick = requestAnimationFrame(frame); }, { passive: true });
  frame();

  var io = new IntersectionObserver(function (es) { es.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } }); }, { rootMargin: '0px 0px -8% 0px' });
  [].forEach.call(document.querySelectorAll('.rev'), function (el) { io.observe(el); });

  // An Add button anywhere puts the item in the basket; its link then opens the order page.
  [].forEach.call(document.querySelectorAll('[data-add]'), function (a) {
    a.addEventListener('click', function () { var b = window.cmBasket.get(); if (!b[a.dataset.add]) b[a.dataset.add] = 1; window.cmBasket.set(b); });
  });
})();
