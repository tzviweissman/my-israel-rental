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
    if (bar) bar.classList.toggle('on', scrollY > vh * .5 && (!book || book.getBoundingClientRect().top > vh * .75));
  }
  addEventListener('scroll', function () { if (!tick) tick = requestAnimationFrame(frame); }, { passive: true });
  frame();
  var io = new IntersectionObserver(function (es) { es.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } }); }, { rootMargin: '0px 0px -8% 0px' });
  [].forEach.call(document.querySelectorAll('.rev'), function (el) { io.observe(el); });
  // the label that rolls up on hover (effects B7)
  [].forEach.call(document.querySelectorAll('.btn'), function (b) {
    var t = b.firstChild; if (!t || t.nodeType !== 3 || !t.nodeValue.trim()) return;
    var w = t.nodeValue.trim(), s = document.createElement('span'); s.className = 'lbl';
    s.innerHTML = '<i></i>'; s.firstChild.textContent = w;  // the copy that rolls in is a text-shadow
    b.replaceChild(s, t); if (/\s$/.test(t.nodeValue)) b.insertBefore(document.createTextNode(' '), s.nextSibling);
  });
})();
