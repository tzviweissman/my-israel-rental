// The parts every page of the site shares (page rules 3k): the menu bar and its phone menu, the phone bar,
// the reveals, the scroll bar made of her platter, the shutter slats and a basket kept between pages.
document.body.classList.remove('no-js');
(function () {
  var BASKET_KEY = 'lsfp-basket-v1';
  var reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
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

  // the touch: the bar across the top is a strip cut from her real extra large platter, and it fills as you read
  var sbar = document.createElement('div'); sbar.className = 'sbar'; sbar.setAttribute('aria-hidden', 'true'); sbar.innerHTML = '<i></i>'; document.body.appendChild(sbar);
  var sfill = sbar.firstChild;

  var top = document.getElementById('top'), bar = document.getElementById('bar'), form = document.getElementById('order') || document.getElementById('book'), hero = document.querySelector('.hero, .film'), tick = 0;
  function frame() {
    tick = 0;
    var vh = innerHeight, max = document.documentElement.scrollHeight - vh;
    top.classList.toggle('solid', scrollY > 10);
    sfill.style.clipPath = 'inset(0 ' + (100 - Math.max(0, Math.min(1, max > 0 ? scrollY / max : 0)) * 100).toFixed(2) + '% 0 0)';
    var heroDone = !hero || hero.getBoundingClientRect().bottom < vh * .9;
    if (bar) bar.classList.toggle('on', scrollY > vh * .5 && heroDone && (!form || form.getBoundingClientRect().top > vh * .75));
  }
  addEventListener('scroll', function () { if (!tick) tick = requestAnimationFrame(frame); }, { passive: true });
  addEventListener('resize', frame);
  frame();

  var io = new IntersectionObserver(function (es) { es.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } }); }, { rootMargin: '0px 0px -8% 0px' });
  [].forEach.call(document.querySelectorAll('.rev, .shut, .hl'), function (el) { io.observe(el); });

  // An Add link anywhere (data-add="<size>") puts one in the basket; its href opens the order page.
  [].forEach.call(document.querySelectorAll('[data-add]'), function (a) {
    a.addEventListener('click', function () { var b = window.siteBasket.get(); if (!b[a.dataset.add]) b[a.dataset.add] = 1; window.siteBasket.set(b); });
  });

  // ── shutter slats (X30): one photo is replaced by the next as seven vertical slats swing open, left to right
  var N = 7;
  function poly(fs) {
    var pts = [];
    for (var i = 0; i < N; i++) {
      var x = i * 100 / N, w = 100 / N * fs[i];
      pts.push([x, 0], [x + w, 0], [x + w, 100], [x, 100], [x, 0]);
    }
    return 'polygon(' + pts.map(function (p) { return p[0].toFixed(3) + '% ' + p[1] + '%'; }).join(',') + ')';
  }
  // frame: an element holding the photos (.sl). go(i) shows photo i; later calls wait for the one running, and the last wins.
  window.lsBlinds = function (frameEl) {
    var imgs = [].slice.call(frameEl.querySelectorAll('.sl')), cur = 0, target = 0, running = false, MS = 900;
    imgs.forEach(function (im, i) { im.style.zIndex = i === 0 ? 2 : 0; im.style.visibility = i === 0 ? 'visible' : 'hidden'; });
    function ease(t) { return 1 - Math.pow(1 - t, 3); }
    function run() {
      if (running || target === cur) return;
      var from = imgs[cur], to = imgs[target], t0 = performance.now(), idx = target;
      if (reduce) { from.style.visibility = 'hidden'; to.style.visibility = 'visible'; to.style.zIndex = 2; from.style.zIndex = 0; cur = idx; return; }
      running = true;
      to.style.clipPath = poly([0, 0, 0, 0, 0, 0, 0]); to.style.zIndex = 3; to.style.visibility = 'visible'; from.style.zIndex = 2;
      // the next photo is ready to draw before its first slat opens, so no blank frame shows
      (to.decode ? to.decode().catch(function () {}) : Promise.resolve()).then(function () { t0 = performance.now(); requestAnimationFrame(step); });
      function step(now) {
        var p = Math.min(1, (now - t0) / MS), fs = [];
        for (var s = 0; s < N; s++) fs.push(ease(Math.max(0, Math.min(1, (p - s * .06) / .64))));
        to.style.clipPath = poly(fs);
        if (p < 1) return requestAnimationFrame(step);
        to.style.clipPath = ''; to.style.zIndex = 2; from.style.visibility = 'hidden'; from.style.zIndex = 0; cur = idx; running = false;
        if (target !== cur) run();
      }
    }
    return {
      go: function (i) { target = i; run(); },
      at: function () { return target; },
      first: function (ms) { // the opening: the first photo's slats open on load
        if (reduce) return; var im = imgs[0], t0 = performance.now(); running = true; im.style.clipPath = poly([0, 0, 0, 0, 0, 0, 0]);
        (function step(now) {
          var p = Math.min(1, (now - t0) / (ms || 1300)), fs = [];
          for (var s = 0; s < N; s++) fs.push(ease(Math.max(0, Math.min(1, (p - s * .07) / .58))));
          im.style.clipPath = poly(fs);
          if (p < 1) return requestAnimationFrame(step);
          im.style.clipPath = ''; running = false; if (target !== cur) run();
        })(t0);
      }
    };
  };

  // ── the add touch (X31): a small photo of the platter flies in an arc to the basket
  window.lsFly = function (srcImg) {
    if (reduce || !srcImg) return;
    if (srcImg.tagName !== 'IMG') srcImg = srcImg.querySelector('img'); if (!srcImg) return;
    var targets = [document.querySelector('#top .btn-line'), document.querySelector('#bar .btn')].filter(function (e) { return e && e.getBoundingClientRect().width && getComputedStyle(e).visibility !== 'hidden'; });
    var t = targets[0]; if (!t) return;
    var a = srcImg.getBoundingClientRect(), b = t.getBoundingClientRect();
    var f = document.createElement('img'); f.className = 'fly'; f.alt = ''; f.src = srcImg.currentSrc || srcImg.src; document.body.appendChild(f);
    var x0 = a.left + a.width / 2 - 36, y0 = a.top + a.height / 2 - 36, x1 = b.left + b.width / 2 - 36, y1 = b.top + b.height / 2 - 36;
    var mx = (x0 + x1) / 2, my = Math.min(y0, y1) - 90;
    var an = f.animate([
      { transform: 'translate(' + x0 + 'px,' + y0 + 'px) scale(1)', opacity: 1 },
      { transform: 'translate(' + mx + 'px,' + my + 'px) scale(.75)', opacity: 1, offset: .5 },
      { transform: 'translate(' + x1 + 'px,' + y1 + 'px) scale(.2)', opacity: .2 }
    ], { duration: 700, easing: 'cubic-bezier(.4,.1,.3,1)' });
    f.style.left = '0'; f.style.top = '0';
    an.onfinish = function () { f.remove(); };
  };
})();
