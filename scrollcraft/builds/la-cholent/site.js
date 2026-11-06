/* Shared by both pages. A style value is written only when it changes (26 Oct 2026): rewriting a custom property every frame restyles everything under it, and these frames run even while nobody scrolls */
function setCss(el, k, v) { v = String(v); var c = el.__css || (el.__css = {}); if (c[k] !== v) { c[k] = v; el.style.setProperty(k, v); } }
/* one knob, drawn the same way wherever it is used */
// A slow-cooker dial: a dark face, a brushed steel ring, a grip with a
// pointer that turns with --a, the settings printed around it, the lamp.
function buildKnob(svg, marks) {
  var t = marks.map(function (m) {
    var r = m[1] * Math.PI / 180;
    return '<text x="' + (100 + 90 * Math.sin(r)).toFixed(1) + '" y="' + (104 - 90 * Math.cos(r)).toFixed(1) + '" text-anchor="middle">' + m[0] + '</text>';
  }).join('');
  svg.insertAdjacentHTML('beforeend',
    '<circle class="face" cx="100" cy="100" r="128"/>' + t +
    '<circle class="lamp" cx="100" cy="190" r="6"/>' +
    '<circle class="ring" cx="100" cy="100" r="62"/><circle class="ring-shade" cx="100" cy="100" r="58"/>' +
    '<g class="rot"><circle class="grip" cx="100" cy="100" r="46"/><rect class="grip" x="91" y="44" width="18" height="112" rx="9"/>' +
    '<line class="pointer" x1="100" y1="96" x2="100" y2="54"/></g>');
}

/* the phone menu: a button that opens a panel; closes on Escape, a tap on a link, or the button again */
(function () {
  var bar = document.getElementById('topbar'), mb = document.getElementById('mbtn');
  if (!bar || !mb) return;
  window.siteMenu = function (o) {
    bar.classList.toggle('is-open', o); mb.setAttribute('aria-expanded', String(o));
    mb.firstElementChild.textContent = o ? 'Close' : 'Menu';
    mb.setAttribute('aria-label', o ? 'Close the menu' : 'Menu');
  };
  mb.addEventListener('click', function () { window.siteMenu(!bar.classList.contains('is-open')); });
  bar.querySelectorAll('.mpanel a').forEach(function (a) { a.addEventListener('click', function () { window.siteMenu(false); }); });
  addEventListener('keydown', function (e) { if (e.key === 'Escape') window.siteMenu(false); });
}());
