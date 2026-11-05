// The parts every page of a designed site shares (page rules 3k): the menu
// bar and its phone menu, the header and phone bar on scroll, the reveals,
// and a basket kept between pages. From scrollcraft/starter: copy into the
// build, set BASKET_KEY, and keep business-only code in the page itself.
document.body.classList.remove('no-js');
(function () {
  var BASKET_KEY = 'aaron-basket-v1';   // one per site, e.g. 'twc-basket-v1'
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
    if (bar) bar.classList.toggle('on', scrollY > vh * .5 && (!form || form.getBoundingClientRect().top > vh * .75));
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
// the first screen arrives in order, once (kit 3u.5), and the one rotating word in the headline (kit 3u.7)
(function () {
  var still = matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (!still && document.querySelector('[data-arrive]')) document.documentElement.classList.add('arrive-go');
  [].forEach.call(document.querySelectorAll('.rot[data-words]'), function (rot) {
    var words = rot.dataset.words.split('|');
    rot.setAttribute('aria-hidden', 'true');
    var sr = document.createElement('span'); sr.className = 'sr-only'; sr.textContent = words.join(', '); rot.after(sr);
    rot.textContent = '';
    var spans = words.map(function (w, k) { var s = document.createElement('span'); s.textContent = w; if (k) s.setAttribute('aria-hidden', 'true'); rot.appendChild(s); return s; });
    function fit(s) { rot.style.width = 'calc(' + s.getBoundingClientRect().width + 'px + .4em)'; }
    requestAnimationFrame(function () { fit(spans[0]); }); if (document.fonts) document.fonts.ready.then(function () { fit(spans.filter(function (x) { return !x.hasAttribute('aria-hidden'); })[0] || spans[0]); });
    if (still || words.length < 2) return;
    var k = 0;
    setInterval(function () {
      if (document.hidden) return;
      var a = spans[k]; k = (k + 1) % spans.length; var b = spans[k];
      a.classList.add('out'); a.setAttribute('aria-hidden', 'true');
      b.classList.remove('out'); b.removeAttribute('aria-hidden'); fit(b);
      setTimeout(function () { a.classList.remove('out'); }, 460);
    }, 2400);
  });
})();
