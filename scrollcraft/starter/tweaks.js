// Tweaks panel for the design board (rules 3am.3; Chase AI, 25 Nov 2026). Build preview only, never published:
// add <script src="tweaks.js"></script> to the board's first screens (gen/board/first-*.html, copied beside them).
// Every custom property on :root becomes a control: colours get a picker, plain lengths a slider, fonts a text box
// (a Google font named there is loaded), anything else a text box. "Copy values" puts only the changed lines on the
// clipboard as a :root block, for Tzvi to send back; the builder pastes them into site.css.
(function () {
  var root = document.documentElement, KEY = 'tweaks:' + location.pathname, saved = {};
  try { saved = JSON.parse(localStorage.getItem(KEY) || '{}'); } catch (e) {}
  var vars = {};
  [].forEach.call(document.styleSheets, function (s) {
    var rules; try { rules = s.cssRules; } catch (e) { return; }   // a stylesheet from another site cannot be read
    [].forEach.call(rules || [], function (r) {
      if (r.selectorText !== ':root') return;
      for (var i = 0; i < r.style.length; i++) { var n = r.style[i]; if (n.indexOf('--') === 0) vars[n] = r.style.getPropertyValue(n).trim(); }
    });
  });
  var names = Object.keys(vars); if (!names.length) return;
  function set(n, v) {
    if (v === vars[n]) { root.style.removeProperty(n); delete saved[n]; } else { root.style.setProperty(n, v); saved[n] = v; }
    try { localStorage.setItem(KEY, JSON.stringify(saved)); } catch (e) {}
    if (/font/.test(n)) loadFont(v);
  }
  function loadFont(v) {
    var fam = v.split(',')[0].replace(/["']/g, '').trim();
    if (!fam || /^(serif|sans-serif|monospace|system-ui|georgia|arial)$/i.test(fam) || document.querySelector('link[data-tw="' + fam + '"]')) return;
    var l = document.createElement('link'); l.rel = 'stylesheet'; l.dataset.tw = fam;
    l.href = 'https://fonts.googleapis.com/css2?family=' + encodeURIComponent(fam) + ':wght@400;500;700&display=swap';
    document.head.appendChild(l);
  }
  var box = document.createElement('div');
  box.setAttribute('style', 'position:fixed;right:12px;bottom:12px;z-index:2147483647;font:13px/1.3 system-ui,sans-serif;color:#111');
  box.innerHTML = '<button type="button" style="padding:8px 14px;border-radius:99px;border:1px solid #bbb;background:#fff;cursor:pointer">Tweaks</button>' +
    '<div hidden style="width:300px;max-height:70vh;overflow:auto;margin-top:8px;padding:12px;background:#fff;border:1px solid #ccc;border-radius:12px;box-shadow:0 8px 30px rgba(0,0,0,.18)"></div>';
  var btn = box.firstChild, panel = box.lastChild;
  btn.onclick = function () { panel.hidden = !panel.hidden; };
  names.forEach(function (n) {
    var v = saved[n] || vars[n], row = document.createElement('label'), m = /^(-?[\d.]+)(px|rem|em|vw|vh|%|s|ms)$/.exec(vars[n]), inp;
    row.setAttribute('style', 'display:grid;grid-template-columns:110px 1fr;gap:6px;align-items:center;margin:0 0 6px');
    row.appendChild(document.createTextNode(n));
    if (/^#[0-9a-f]{6}$/i.test(vars[n])) { inp = document.createElement('input'); inp.type = 'color'; inp.value = v; }
    else if (m) {
      inp = document.createElement('input'); inp.type = 'range'; inp.min = 0; inp.max = Math.max(+m[1] * 4, m[2] === 'px' ? 64 : 4);
      inp.step = m[2] === 'px' || m[2] === 'ms' ? 1 : 0.05; inp.value = parseFloat(v); inp.dataset.u = m[2]; inp.title = v;
    } else { inp = document.createElement('input'); inp.type = 'text'; inp.value = v; }
    inp.style.width = '100%';
    inp.oninput = function () { var val = inp.dataset.u ? inp.value + inp.dataset.u : inp.value; inp.title = val; set(n, val); };
    if (saved[n]) { root.style.setProperty(n, saved[n]); if (/font/.test(n)) loadFont(saved[n]); }
    row.appendChild(inp); panel.appendChild(row);
  });
  var copy = document.createElement('button'), reset = document.createElement('button');
  copy.type = reset.type = 'button'; copy.textContent = 'Copy values'; reset.textContent = 'Reset';
  copy.onclick = function () {
    var css = ':root {\n' + Object.keys(saved).map(function (n) { return '  ' + n + ': ' + saved[n] + ';'; }).join('\n') + '\n}';
    (navigator.clipboard ? navigator.clipboard.writeText(css) : Promise.reject()).then(function () { copy.textContent = 'Copied'; }, function () { prompt('Copy these values', css); });
  };
  reset.onclick = function () { try { localStorage.removeItem(KEY); } catch (e) {} location.reload(); };
  panel.appendChild(copy); panel.appendChild(reset);
  document.body.appendChild(box);
})();
