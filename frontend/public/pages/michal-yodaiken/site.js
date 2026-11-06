/* Shared by every page: the session clock in the bar, the phone bar, the phone menu. */
(function () {
  // The session clock: her session is 30 minutes, and the scroll runs it, reaching 30:00 as the closing
  // section arrives (the end of the page where a page has none). Then the bar turns pink.
  var bar = document.getElementById('bar'), clock = document.getElementById('clock');
  if (!bar || !clock) return;
  var heroBtn = document.querySelector('.hero .btn'), endEl = document.querySelector('[data-end]'), endBtn = endEl && endEl.querySelector('.btn'),
      foot = document.querySelector('.foot .last'), onBook = document.body.classList.contains('page-book'), last = '';
  function phoneNow() { return matchMedia('(max-width: 860px)').matches; }
  function tick() {
    var end = endEl ? endEl.offsetTop - innerHeight * 0.35 : document.documentElement.scrollHeight - innerHeight;
    var f = Math.max(0, Math.min(1, scrollY / Math.max(1, end)));
    var s = Math.round(f * 1800), txt = String(Math.floor(s / 60)).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0');
    if (txt !== last) { clock.textContent = txt; last = txt; }
    bar.classList.toggle('is-done', f >= 1);
    var phone = phoneNow();
    bar.classList.toggle('is-foot', phone && foot.getBoundingClientRect().top < innerHeight - 40);
    // phones: the bar is always there. Once a "Message to book" button is on screen the bar's own button steps
    // aside (never two at once), but the clock stays. On the booking page the page is the booking, so no bar button.
    bar.classList.toggle('is-end', phone && (onBook || (heroBtn && heroBtn.getBoundingClientRect().bottom > 0) || (endBtn && endBtn.getBoundingClientRect().top < innerHeight)));
    requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);

  // the phone menu: opens a list of the pages, closes on Escape, on the button again or on a tap on a link
  var mb = document.getElementById('mbtn');
  if (mb) {
    var menu = function (o) { document.body.classList.toggle('menu-open', o); mb.setAttribute('aria-expanded', String(o)); mb.textContent = o ? 'Close' : 'Menu'; };
    mb.addEventListener('click', function () { menu(!document.body.classList.contains('menu-open')); });
    document.querySelectorAll('#mpanel a').forEach(function (a) { a.addEventListener('click', function () { menu(false); }); });
    addEventListener('keydown', function (e) { if (e.key === 'Escape') menu(false); });
  }
})();
