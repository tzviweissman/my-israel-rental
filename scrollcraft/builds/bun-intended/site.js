/* Shared by every page: their price list (one set of numbers for the box builder and the price page) and the phone menu. */
var BUN = {
  F: [
    { id: 'cinnamon', name: 'Classic cinnamon', p4: 55, p8: 100, c: 'cinnamon' },
    { id: 'espresso', name: 'Espresso', p4: 55, p8: 100, c: 'espresso' },
    { id: 'lotus', name: 'Lotus', p4: 65, p8: 120, c: 'lotus' },
    { id: 'chocolate', name: 'Chocolate', p4: 65, p8: 120, c: 'choc' }
  ],
  MIX8: 120,
  SW: { cinnamon: 'var(--icing)', espresso: 'var(--espresso)', lotus: 'var(--lotus)', choc: 'var(--choc)' }
};
// Two boxes of 4 beat the mix only for some pairs; say so, from the price list's own numbers.
BUN.cheaperPair = function () {
  var F = BUN.F, best = null;
  for (var i = 0; i < F.length; i++) for (var j = i + 1; j < F.length; j++) { var t = F[i].p4 + F[j].p4; if (t < BUN.MIX8 && (!best || t < best.t)) best = { t: t, a: F[i].name, b: F[j].name }; }
  return best;
};

// The phone menu: opens a panel, closes on Escape or a tap on a link.
(function () {
  var tb = document.getElementById('top'), mb = document.getElementById('mbtn');
  if (!tb || !mb) return;
  function menu(o) { tb.classList.toggle('is-open', o); mb.setAttribute('aria-expanded', String(o)); mb.textContent = o ? 'Close' : 'Menu'; }
  mb.addEventListener('click', function () { menu(!tb.classList.contains('is-open')); });
  tb.querySelectorAll('.mpanel a').forEach(function (a) { a.addEventListener('click', function () { menu(false); }); });
  addEventListener('keydown', function (e) { if (e.key === 'Escape') menu(false); });
})();
