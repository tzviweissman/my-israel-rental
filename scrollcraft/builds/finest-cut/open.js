// The opening is the film (film.js). Here: what follows it, the end button's focus, the scroll-tied line and the whose-table choice.
(function () {
  var still = matchMedia('(prefers-reduced-motion: reduce)');
  var sec = document.getElementById('board'), end = document.querySelector('#w6 .btn');
  // the phone's order bar waits while the film plays (nothing sits over the film: rules 3h.5); the words and button before and after it stay
  function ends() { var on = sec.classList.contains('c7'), playing = sec.classList.contains('c2') && !on; document.body.classList.toggle('at-end', on || playing); end.tabIndex = on ? 0 : -1; }
  new MutationObserver(ends).observe(sec, { attributes: true, attributeFilter: ['class'] });

  // a detail tied to the scroll: the light line under the three numbers, finished by the time they are mid-screen
  var nums = document.getElementById('nums'), line = document.getElementById('numline'), t2 = 0;
  function numline() {
    t2 = 0;
    var r = nums.getBoundingClientRect(), h = innerHeight, from = h * .85, to = h * .5 - r.height / 2;
    line.style.transform = 'scaleX(' + Math.max(0, Math.min(1, (from - r.top) / (from - to))) + ')';
  }
  if (still.matches) line.style.transform = 'none';
  else { addEventListener('scroll', function () { if (!t2) t2 = requestAnimationFrame(numline); }, { passive: true }); numline(); }

  // whose table: the picture, words, ground and button follow the choice, and the choice reaches the order form
  var who = document.getElementById('who'), go = document.getElementById('who-go');
  who.querySelector('.seg').addEventListener('click', function (e) {
    var b = e.target.closest('button'); if (!b) return;
    var w = b.dataset.w; who.dataset.who = w;
    [].forEach.call(who.querySelectorAll('.seg button'), function (x) { x.setAttribute('aria-pressed', x === b ? 'true' : 'false'); });
    [].forEach.call(who.querySelectorAll('.who-ph img, .who-c > div'), function (x) { x.classList.toggle('on', x.dataset.w === w); });
    go.href = w === 'else' ? 'shop.html?add=feast&for=else#order' : 'shop.html?add=feast#order';
  });
})();
