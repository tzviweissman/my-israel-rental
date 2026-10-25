// Nails by Elisheva, the parts every page shares (page rules 3k): the menu
// bar (and its phone menu), the header and phone bar on scroll, the reveals.
document.body.classList.remove('no-js');
(function () {
  var nav = document.getElementById('nav'), btn = document.getElementById('menu-btn');
  function setMenu(open) { nav.classList.toggle('shown', open); btn.setAttribute('aria-expanded', open); btn.textContent = open ? 'Close' : 'Menu'; }
  btn.addEventListener('click', function () { setMenu(!nav.classList.contains('shown')); });
  addEventListener('keydown', function (e) { if (e.key === 'Escape') setMenu(false); });
  nav.addEventListener('click', function (e) { if (e.target.closest('a')) setMenu(false); });
  var top = document.getElementById('top'), bar = document.getElementById('bar'), book = document.getElementById('book'), tick = 0;
  function frame() {
    tick = 0;
    var vh = innerHeight;
    top.classList.toggle('solid', scrollY > 10);
    // on the booking page the page itself is the booking: no bar with a fixed price over it (the review)
    if (bar) bar.classList.toggle('on', document.body.dataset.page !== 'book' && scrollY > vh * .5 && (!book || book.getBoundingClientRect().top > vh * .75));
  }
  addEventListener('scroll', function () { if (!tick) tick = requestAnimationFrame(frame); }, { passive: true });
  frame();
  var io = new IntersectionObserver(function (es) { es.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } }); }, { rootMargin: '0px 0px -8% 0px' });
  // each block's sweep comes from its own side: words from the left or right, photos and cards from
  // above or below, varied so no two neighbours match
  var DIRS = { text: ['l', 'r'], box: ['d', 'u', 'r', 'l'] }, k = 0;
  [].forEach.call(document.querySelectorAll('.rev'), function (el) {
    var text = /^(H1|H2|H3|P)$/.test(el.tagName), set = text ? DIRS.text : DIRS.box;
    el.dataset.dir = set[k++ % set.length]; io.observe(el);
  });
  // the label that rolls up on hover (effects B7)
  [].forEach.call(document.querySelectorAll('.btn'), function (b) {
    var t = b.firstChild; if (!t || t.nodeType !== 3 || !t.nodeValue.trim()) return;
    var w = t.nodeValue.trim(), s = document.createElement('span'); s.className = 'lbl';
    s.innerHTML = '<i></i>'; s.firstChild.textContent = w;  // the copy that rolls in is a text-shadow
    b.replaceChild(s, t); if (/\s$/.test(t.nodeValue)) b.insertBefore(document.createTextNode(' '), s.nextSibling);
  });
})();
// photos fade in over 200 ms once loaded, into space already kept for them
(function () {
  function ld(i) { i.classList.add('ld'); }
  document.addEventListener('load', function (e) { if (e.target.tagName === 'IMG') ld(e.target); }, true);
  [].forEach.call(document.images, function (i) { if (i.complete) ld(i); });
})();
