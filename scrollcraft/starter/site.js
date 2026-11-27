// The parts every page of a designed site shares (page rules 3k): the menu
// bar and its phone menu, the header and phone bar on scroll, the reveals,
// and a basket kept between pages. From scrollcraft/starter: copy into the
// build, set BASKET_KEY, and keep business-only code in the page itself.
document.body.classList.remove('no-js');
(function () {
  var BASKET_KEY = 'CHANGE-ME-basket-v1';   // one per site, e.g. 'twc-basket-v1'
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
  var shop = !!document.getElementById('cat');
  function frame() {
    tick = 0;
    var vh = innerHeight, has = document.body.classList.contains('has-basket');
    top.classList.toggle('solid', scrollY > 10);
    // once something is in the basket the bar stays, as the phone's way to the basket (review 12 Nov, Gremier).
    // On the shop page it shows only then: an empty basket bar there says nothing (shop research, 13 Nov 2026).
    if (bar) bar.classList.toggle('on', (has || (!shop && scrollY > vh * .5)) && (!form || form.getBoundingClientRect().top > vh * .75));
  }
  addEventListener('scroll', function () { if (!tick) tick = requestAnimationFrame(frame); }, { passive: true });
  frame();

  var io = new IntersectionObserver(function (es) { es.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } }); }, { rootMargin: '0px 0px -8% 0px' });
  [].forEach.call(document.querySelectorAll('.rev'), function (el) { io.observe(el); });

  // An Add link anywhere (data-add="<item>") puts one in the basket; its href opens the order page.
  [].forEach.call(document.querySelectorAll('[data-add]'), function (a) {
    a.addEventListener('click', function () { if (window.CAT) return;   // a shop page's catalog.js adds it, with a toast
      var b = window.siteBasket.get(); if (!b[a.dataset.add]) b[a.dataset.add] = 1; window.siteBasket.set(b); });
  });
})();
// Weighted smooth scrolling on a laptop (rules 3an.1; 30 of 40 Awwwards Sites of the Day use Lenis for this,
// docs/inspo/awwwards-2026-11-27). The wheel sets a target and the page eases to it, moving the real scroll
// position, so film.js and every scroll listener read it as usual. Off on touch screens and with reduced motion;
// the keyboard, the scrollbar, links and pinch zoom stay the browser's own; a wheel over a box that scrolls itself
// (the basket, a menu) is left alone.
(function () {
  if (!matchMedia('(pointer: fine)').matches || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  // cur is kept as a fraction: the browser rounds scrollY to whole pixels, and easing from the rounded value
  // stalled 4 px short of the target and never stopped (27 Nov 2026)
  var target = scrollY, cur = scrollY, moving = false, EASE = 0.12;
  var max = function () { return document.documentElement.scrollHeight - innerHeight; };
  function scrollsItself(el) {
    for (; el && el !== document.body && el !== document.documentElement; el = el.parentElement) {
      var o = getComputedStyle(el).overflowY;
      if ((o === 'auto' || o === 'scroll') && el.scrollHeight > el.clientHeight + 1) return true;
    }
    return false;
  }
  function step() {
    if (!moving) return;
    // something else moved the page while gliding (a key, the scrollbar, a link): stop and let it be
    if (Math.abs(scrollY - cur) > 2) { moving = false; target = cur = scrollY; return; }
    cur += (target - cur) * EASE;
    if (Math.abs(target - cur) < 0.5) { cur = target; moving = false; }
    window.scrollTo({ top: cur, behavior: 'instant' });
    if (moving) requestAnimationFrame(step);
  }
  addEventListener('wheel', function (e) {
    if (e.ctrlKey || e.defaultPrevented || scrollsItself(e.target) || document.body.style.overflow === 'hidden') return;
    e.preventDefault();
    var d = e.deltaMode === 1 ? e.deltaY * 40 : e.deltaMode === 2 ? e.deltaY * innerHeight : e.deltaY;
    if (!moving) cur = target = scrollY;
    target = Math.max(0, Math.min(max(), target + d));
    if (!moving) { moving = true; requestAnimationFrame(step); }
  }, { passive: false });
  // a key or a press on the scrollbar hands the page back at once (Home during a glide stopped at 296 px, not 0)
  var stop = function () { moving = false; };
  addEventListener('keydown', stop); addEventListener('mousedown', stop);
  document.documentElement.dataset.smooth = 'on';
})();
// a short confirmation after an Add ("Added: <name>"), used by catalog.js. It never floats over the page (a toast
// covered the cards' prices and Add buttons, review 12 Nov): screen readers hear it, and catalog.js shows it in the
// menu bar's basket button on a laptop and in the phone bar.
window.siteToast = (function () {
  var el = document.createElement('div'); el.className = 'sr-only'; el.setAttribute('role', 'status'); document.body.appendChild(el);
  return function (msg) { el.textContent = msg; document.dispatchEvent(new CustomEvent('site:added', { detail: msg })); };
})();
