/* Shared by every page: the language switch (Hebrew first, English kept in data-en), the slow reveal, the phone bar. */
(function () {
  var still = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var small = window.matchMedia('(max-width: 760px)').matches;
  var clamp = function (x) { return x < 0 ? 0 : x > 1 ? 1 : x; };
  var seg = function (p, a, b) { return clamp((p - a) / (b - a)); };
  var EN = false, hooks = [];
  window.MB = { still: still, small: small, clamp: clamp, seg: seg, onLang: function (f) { hooks.push(f); } };

  // language: Hebrew first; English kept in data-en, the Hebrew remembered on first switch
  function setLang(en) {
    EN = en;
    document.documentElement.lang = en ? 'en' : 'he';
    document.documentElement.dir = en ? 'ltr' : 'rtl';
    document.querySelectorAll('[data-en]').forEach(function (el) {
      if (el.dataset.he == null) el.dataset.he = el.textContent;
      el.textContent = en ? el.dataset.en : el.dataset.he;
    });
    document.querySelectorAll('[data-en-html]').forEach(function (el) {
      if (el.dataset.heHtml == null) el.dataset.heHtml = el.innerHTML;
      el.innerHTML = en ? el.dataset.enHtml : el.dataset.heHtml;
    });
    document.querySelectorAll('[data-en-alt]').forEach(function (el) {
      if (el.dataset.heAlt == null) el.dataset.heAlt = el.alt;
      el.alt = en ? el.dataset.enAlt : el.dataset.heAlt;
    });
    document.querySelectorAll('[data-en-label]').forEach(function (el) {
      if (el.dataset.heLabel == null) el.dataset.heLabel = el.getAttribute('aria-label');
      el.setAttribute('aria-label', en ? el.dataset.enLabel : el.dataset.heLabel);
    });
    var root = document.documentElement;
    if (root.dataset.titleHe == null) root.dataset.titleHe = document.title;
    document.title = en ? root.dataset.titleEn : root.dataset.titleHe;
    document.getElementById('lang').textContent = en ? 'עברית' : 'English';
    try { localStorage.setItem('mb-lang', en ? 'en' : 'he'); } catch (e) {}
    hooks.forEach(function (f) { f(en); });
  }
  document.getElementById('lang').addEventListener('click', function () { setLang(!EN); });

  if (!still) {
    var io = new IntersectionObserver(function (es) {
      es.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } });
    }, { rootMargin: '0px 0px -10% 0px' });
    document.querySelectorAll('[data-rev]').forEach(function (el) { io.observe(el); });
  }

  // phone bar: after the opening (or the first screen), until the close (or the footer)
  var dock = document.getElementById('dock');
  if (dock) {
    var open = document.getElementById('open'), end = document.getElementById('close') || document.querySelector('footer');
    var onDock = function () {
      var past = open ? open.getBoundingClientRect().bottom < 0 : window.scrollY > window.innerHeight * .5;
      var on = past && end.getBoundingClientRect().top > window.innerHeight * .8;
      dock.classList.toggle('on', on);
      dock.setAttribute('aria-hidden', on ? 'false' : 'true');
      dock.querySelector('a').tabIndex = on ? 0 : -1;
    };
    window.addEventListener('scroll', onDock, { passive: true }); window.addEventListener('resize', onDock); onDock();
  }

  // the phone menu: opens a panel, closes on Escape, on a tap on a link or on the button again
  var bar = document.querySelector('.bar'), mb = document.getElementById('mbtn');
  if (bar && mb) {
    var menu = function (o) {
      bar.classList.toggle('is-open', o); mb.setAttribute('aria-expanded', String(o));
      mb.firstElementChild.textContent = o ? (EN ? 'Close' : 'סגירה') : (EN ? 'Menu' : 'תפריט');
      mb.setAttribute('aria-label', o ? (EN ? 'Close the menu' : 'לסגור את התפריט') : (EN ? 'Menu' : 'תפריט'));
    };
    mb.addEventListener('click', function () { menu(!bar.classList.contains('is-open')); });
    bar.querySelectorAll('.mpanel a').forEach(function (a) { a.addEventListener('click', function () { menu(false); }); });
    addEventListener('keydown', function (e) { if (e.key === 'Escape') menu(false); });
    hooks.push(function () { menu(bar.classList.contains('is-open')); });
  }

  document.addEventListener('DOMContentLoaded', function () {
    var saved = null; try { saved = localStorage.getItem('mb-lang'); } catch (e) {}
    if (saved === 'en') setLang(true);
  });
})();
