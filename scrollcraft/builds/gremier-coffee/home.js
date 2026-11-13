// Gremier Coffee home: the coffee bar's place choice (the opening film is film.js).
(function () {
  var reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;

  // ── the coffee bar: where is your event? each choice shows their own photo of a bar there
  var bars = document.getElementById('bars');
  if (bars) bars.querySelector('.seg').addEventListener('click', function (e) {
    var b = e.target.closest('button[data-p]'); if (!b) return;
    bars.dataset.place = b.dataset.p;
    [].forEach.call(bars.querySelectorAll('.seg button'), function (x) { x.setAttribute('aria-pressed', x === b ? 'true' : 'false'); });
    var next = bars.querySelector('.bar-ph img[data-p="' + b.dataset.p + '"]');
    // the new photo crossfades in only once it is decoded, so the change is never a blank or a jump
    (next.decode ? next.decode() : Promise.resolve()).catch(function () {}).then(function () {
      [].forEach.call(bars.querySelectorAll('.bar-ph img'), function (im) { im.classList.toggle('on', im === next); });
    });
  });
  // the four photos are lazy, and all load as the section comes near, before anyone can tap a place
  if (bars && 'IntersectionObserver' in window) new IntersectionObserver(function (es, o) {
    if (!es[0].isIntersecting) return; o.disconnect();
    [].forEach.call(bars.querySelectorAll('.bar-ph img'), function (im) { im.loading = 'eager'; });
  }, { rootMargin: '900px 0px' }).observe(bars);
})();
// the phone bar waits until the opening film has played, so nothing covers the film (3h.25)
(function () {
  var film = document.getElementById('film'), bar = document.getElementById('bar'), t = 0;
  if (!film || !bar) return;
  function check() { t = 0; bar.classList.toggle('in-film', film.getBoundingClientRect().bottom > innerHeight * 1.02); }
  addEventListener('scroll', function () { if (!t) t = requestAnimationFrame(check); }, { passive: true }); check();
})();
