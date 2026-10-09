/*
 * The editor inside a hand-built business page (Tzvi, 9 Oct 2026: "easy to
 * move text or change text like I can on Claude design ... or photos").
 *
 * Loaded only when the dashboard frames the page with ?mir-edit=1
 * (frontend/server.js adds it, with the saved edits as JSON). Everything
 * publish-page.mjs marked with data-mir-key can be:
 *   - clicked to select it, clicked again (or double-clicked) to type in it
 *   - dragged to move it (separately on laptop and on phone)
 *   - made bigger or smaller, aligned, hidden
 *   - a photo: replaced (the dashboard uploads it)
 * Each change is sent to the dashboard (src/pages/PageEditor.jsx), which
 * keeps undo/redo and saves. Nothing here saves on its own.
 */
(function () {
  'use strict';
  if (window.parent === window) return;
  var dataEl = document.getElementById('mir-edits-data');
  var edits = { text: {}, img: {}, style: {} };
  try { var d = JSON.parse(dataEl ? dataEl.textContent : '{}'); edits.text = d.text || {}; edits.img = d.img || {}; edits.style = d.style || {}; } catch (e) { /* none */ }

  var post = function (msg) { window.parent.postMessage(Object.assign({ source: 'mir-editor' }, msg), location.origin); };
  var device = function () { return window.innerWidth < 768 ? 'm' : 'd'; };
  var all = function () { return Array.prototype.slice.call(document.querySelectorAll('[data-mir-key]')); };
  var keyOf = function (el) { return el.getAttribute('data-mir-key'); };
  var isImg = function (el) { return el.tagName === 'IMG'; };
  var loaded = {};
  all().forEach(function (el) { loaded[keyOf(el)] = isImg(el) ? el.getAttribute('src') : el.innerHTML; });
  // The same words twice in one place (a flip button's two faces) change together.
  var twins = function (el) {
    var k = keyOf(el), base = k.replace(/-\d+$/, '');
    return all().filter(function (o) { return o === el || (o.parentElement === el.parentElement && keyOf(o).replace(/-\d+$/, '') === base); });
  };

  /* ---- look ------------------------------------------------------------ */
  var ui = document.createElement('style');
  ui.textContent = [
    'html.mir-on img{-webkit-user-drag:none;user-select:none}',
    'html.mir-on [data-mir-key]{cursor:pointer;touch-action:none;outline:1px dashed transparent;outline-offset:3px;transition:outline-color .15s}',
    'html.mir-on [data-mir-key]:hover{outline-color:rgba(22,122,184,.7)}',
    'html.mir-on [data-mir-key].mir-sel{outline:2px solid #167AB8 !important;outline-offset:3px}',
    'html.mir-on [data-mir-key].mir-typing{outline:2px solid #111827 !important;cursor:text;background:rgba(255,255,255,.08)}',
    'html.mir-on [data-mir-key].mir-drag{cursor:grabbing !important;opacity:.92}',
    'html.mir-on [data-mir-key].mir-hidden{opacity:.25 !important;display:revert !important}',
    '#mir-bar{position:fixed;z-index:2147483646;display:flex;gap:4px;align-items:center;padding:6px;border-radius:12px;background:#111827;box-shadow:0 10px 30px -10px rgba(0,0,0,.5);font:600 13px/1 system-ui,sans-serif;color:#fff;user-select:none}',
    '#mir-bar button{all:unset;cursor:pointer;padding:8px 10px;border-radius:8px;color:#fff;white-space:nowrap}',
    '#mir-bar button:hover{background:rgba(255,255,255,.14)}',
    '#mir-bar button:focus-visible{outline:2px solid #24AFEB}',
    '#mir-bar .sep{width:1px;align-self:stretch;background:rgba(255,255,255,.2);margin:2px 2px}',
    '#mir-tip{position:fixed;z-index:2147483646;left:50%;bottom:16px;translate:-50% 0;padding:10px 16px;border-radius:999px;background:#111827;color:#fff;font:500 13px/1.2 system-ui,sans-serif;box-shadow:0 10px 30px -10px rgba(0,0,0,.5);pointer-events:none}'
  ].join('\n');
  document.head.appendChild(ui);
  document.documentElement.classList.add('mir-on');

  /* ---- the edits on the page --------------------------------------------- */
  var styleEl = document.getElementById('mir-edits');
  if (!styleEl) { styleEl = document.createElement('style'); styleEl.id = 'mir-edits'; document.head.appendChild(styleEl); }
  function css() {
    var out = { d: [], m: [] };
    Object.keys(edits.style).forEach(function (k) {
      ['d', 'm'].forEach(function (dev) {
        var v = (edits.style[k] || {})[dev];
        if (!v) return;
        var decl = [];
        if (v.x || v.y) decl.push('translate:' + (v.x || 0) + 'px ' + (v.y || 0) + 'px');
        if (v.s && v.s !== 1) decl.push('scale:' + v.s);
        if (v.a) decl.push('text-align:' + ({ l: 'left', c: 'center', r: 'right' })[v.a]);
        if (decl.length) out[dev].push('[data-mir-key="' + k + '"]{' + decl.map(function (x) { return x + ' !important'; }).join(';') + '}');
      });
    });
    styleEl.textContent = out.d.join('') + '@media (max-width:767px){' + out.m.join('') + '}';
    // Hidden things stay visible here, faint, so they can be brought back.
    all().forEach(function (el) { var v = (edits.style[keyOf(el)] || {})[device()]; el.classList.toggle('mir-hidden', Boolean(v && v.h)); });
  }
  function paint() {
    all().forEach(function (el) {
      var k = keyOf(el);
      if (isImg(el)) {
        var src = edits.img[k] || loaded[k];
        if (el.getAttribute('src') !== src) { el.removeAttribute('srcset'); el.removeAttribute('sizes'); el.setAttribute('src', src); }
      } else if (!el.classList.contains('mir-typing')) {
        var html = edits.text[k] !== undefined ? edits.text[k] : loaded[k];
        if (el.innerHTML !== html) el.innerHTML = html;
      }
    });
    css();
    place();
  }
  function changed() { post({ type: 'mir:change', edits: JSON.parse(JSON.stringify(edits)) }); }
  function st(el) {
    var k = keyOf(el), dev = device();
    edits.style[k] = edits.style[k] || {};
    edits.style[k][dev] = edits.style[k][dev] || {};
    return edits.style[k][dev];
  }
  function tidy(k) {
    var s = edits.style[k];
    if (!s) return;
    ['d', 'm'].forEach(function (dev) {
      var v = s[dev];
      if (!v) return;
      if (!v.x) delete v.x; if (!v.y) delete v.y; if (v.s === 1) delete v.s; if (!v.a) delete v.a; if (!v.h) delete v.h;
      if (!Object.keys(v).length) delete s[dev];
    });
    if (!Object.keys(s).length) delete edits.style[k];
  }

  /* ---- selection and the bar --------------------------------------------- */
  var sel = null, bar = null;
  var tip = document.createElement('div');
  tip.id = 'mir-tip';
  tip.textContent = 'Click text or a photo to change it. Drag it to move it.';
  document.body.appendChild(tip);
  setTimeout(function () { tip.style.transition = 'opacity .4s'; tip.style.opacity = '0'; }, 6000);

  function button(label, fn, title) {
    var b = document.createElement('button');
    b.type = 'button'; b.textContent = label; if (title) b.title = title;
    b.addEventListener('pointerdown', function (e) { e.stopPropagation(); });
    b.addEventListener('click', function (e) { e.preventDefault(); e.stopPropagation(); fn(); });
    return b;
  }
  function sep() { var s = document.createElement('span'); s.className = 'sep'; return s; }
  function select(el) {
    if (sel === el) return;
    stopTyping();
    if (sel) sel.classList.remove('mir-sel');
    sel = el;
    if (bar) { bar.remove(); bar = null; }
    if (!el) { post({ type: 'mir:select', key: null }); return; }
    el.classList.add('mir-sel');
    bar = document.createElement('div');
    bar.id = 'mir-bar';
    if (isImg(el)) bar.appendChild(button('Replace photo', function () { post({ type: 'mir:pick', key: keyOf(el) }); }));
    else bar.appendChild(button('Edit text', function () { startTyping(el); }));
    bar.appendChild(sep());
    bar.appendChild(button('A−', function () { var v = st(el); v.s = Math.max(0.4, Math.round(((v.s || 1) - 0.1) * 100) / 100); tidy(keyOf(el)); css(); place(); changed(); }, 'Smaller'));
    bar.appendChild(button('A+', function () { var v = st(el); v.s = Math.min(3, Math.round(((v.s || 1) + 0.1) * 100) / 100); tidy(keyOf(el)); css(); place(); changed(); }, 'Bigger'));
    if (!isImg(el)) {
      bar.appendChild(sep());
      [['⟸', 'l', 'Align left'], ['≡', 'c', 'Centre'], ['⟹', 'r', 'Align right']].forEach(function (a) {
        bar.appendChild(button(a[0], function () { var v = st(el); v.a = v.a === a[1] ? undefined : a[1]; tidy(keyOf(el)); css(); changed(); }, a[2]));
      });
    }
    bar.appendChild(sep());
    bar.appendChild(button('Hide', function () { var v = st(el); v.h = !v.h; tidy(keyOf(el)); css(); changed(); }, 'Hide or show'));
    bar.appendChild(button('Reset', function () {
      var k = keyOf(el), s = edits.style[k];
      if (s) { delete s[device()]; tidy(k); }
      css(); place(); changed();
    }, 'Back to where it was'));
    document.body.appendChild(bar);
    place();
    post({ type: 'mir:select', key: keyOf(el) });
  }
  function place() {
    if (!bar || !sel) return;
    var r = sel.getBoundingClientRect(), b = bar.getBoundingClientRect();
    var top = r.top - b.height - 10;
    if (top < 8) top = r.bottom + 10;
    var left = Math.min(Math.max(8, r.left), window.innerWidth - b.width - 8);
    bar.style.top = top + 'px'; bar.style.left = left + 'px';
  }
  window.addEventListener('scroll', place, true);
  window.addEventListener('resize', function () { css(); place(); });

  /* ---- typing ------------------------------------------------------------ */
  var typing = null;
  // The cursor goes where they clicked; from the bar's "Edit text", the
  // whole text is selected, ready to type over.
  function startTyping(el, x, y) {
    if (isImg(el)) return;
    stopTyping();
    typing = el;
    el.classList.add('mir-typing');
    el.setAttribute('contenteditable', 'true');
    el.focus();
    var range = null;
    if (x !== undefined && document.caretRangeFromPoint) range = document.caretRangeFromPoint(x, y);
    else if (x !== undefined && document.caretPositionFromPoint) {
      var pos = document.caretPositionFromPoint(x, y);
      if (pos) { range = document.createRange(); range.setStart(pos.offsetNode, pos.offset); range.collapse(true); }
    }
    if (!range || !el.contains(range.startContainer)) { range = document.createRange(); range.selectNodeContents(el); }
    var s = window.getSelection(); s.removeAllRanges(); s.addRange(range);
  }
  function stopTyping() {
    if (!typing) return;
    var el = typing; typing = null;
    el.removeAttribute('contenteditable');
    el.classList.remove('mir-typing');
    var html = el.innerHTML.replace(/<div>/g, '<br>').replace(/<\/div>/g, '').replace(/&nbsp;/g, ' ');
    var k = keyOf(el);
    var before = edits.text[k] !== undefined ? edits.text[k] : loaded[k];
    if (html === before) return;
    twins(el).forEach(function (t) { edits.text[keyOf(t)] = html; if (t !== el) t.innerHTML = html; });
    changed();
  }
  document.addEventListener('paste', function (e) {
    if (!typing) return;
    e.preventDefault();
    var text = (e.clipboardData || window.clipboardData).getData('text/plain');
    document.execCommand('insertText', false, text);
  }, true);
  document.addEventListener('keydown', function (e) {
    if (typing) {
      if (e.key === 'Escape' || (e.key === 'Enter' && !e.shiftKey)) { e.preventDefault(); stopTyping(); }
      return;
    }
    if (e.key === 'Escape') select(null);
    var z = (e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z';
    if (z || ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y')) {
      e.preventDefault();
      post({ type: (z && !e.shiftKey) ? 'mir:undo' : 'mir:redo' });
    }
  }, true);

  /* ---- clicking and dragging ------------------------------------------------ */
  var drag = null;
  document.addEventListener('pointerdown', function (e) {
    if (bar && bar.contains(e.target)) return;
    var el = e.target.closest && e.target.closest('[data-mir-key]');
    if (typing && el === typing) return;
    if (!el) { select(null); return; }
    e.preventDefault();
    var v = st(el);
    drag = { el: el, cx: e.clientX, cy: e.clientY, x0: e.clientX, y0: e.clientY, x: v.x || 0, y: v.y || 0, moved: false, wasSel: sel === el };
    tidy(keyOf(el));
    try { el.setPointerCapture(e.pointerId); } catch (err) { /* fine */ }
  }, true);
  document.addEventListener('pointermove', function (e) {
    if (!drag) return;
    var dx = e.clientX - drag.x0, dy = e.clientY - drag.y0;
    if (!drag.moved && Math.abs(dx) + Math.abs(dy) < 5) return;
    if (!drag.moved) { drag.moved = true; select(drag.el); drag.el.classList.add('mir-drag'); }
    var v = st(drag.el);
    v.x = Math.round(drag.x + dx); v.y = Math.round(drag.y + dy);
    css(); place();
  }, true);
  document.addEventListener('pointerup', function () {
    if (!drag) return;
    var d = drag; drag = null;
    d.el.classList.remove('mir-drag');
    if (d.moved) { tidy(keyOf(d.el)); changed(); return; }
    tidy(keyOf(d.el));
    if (d.wasSel && !isImg(d.el)) startTyping(d.el, d.cx, d.cy); else select(d.el);
  }, true);
  document.addEventListener('dblclick', function (e) {
    var el = e.target.closest && e.target.closest('[data-mir-key]');
    if (el && !isImg(el)) { e.preventDefault(); select(el); startTyping(el, e.clientX, e.clientY); }
  }, true);
  // In the editor nothing on the page navigates, submits or opens WhatsApp.
  document.addEventListener('click', function (e) {
    if (bar && bar.contains(e.target)) return;
    if (e.target.closest && e.target.closest('a, button, form, label, [role="button"]')) { e.preventDefault(); e.stopPropagation(); }
  }, true);
  document.addEventListener('submit', function (e) { e.preventDefault(); }, true);
  // The browser's own image and link dragging would take the pointer away.
  document.addEventListener('dragstart', function (e) { e.preventDefault(); }, true);

  /* ---- the dashboard talks back ------------------------------------------- */
  window.addEventListener('message', function (e) {
    if (e.origin !== location.origin || !e.data || e.data.source !== 'mir-dashboard') return;
    if (e.data.type === 'mir:load') {
      var n = e.data.edits || {};
      edits = { text: n.text || {}, img: n.img || {}, style: n.style || {} };
      paint();
    } else if (e.data.type === 'mir:image' && e.data.key && e.data.url) {
      edits.img[e.data.key] = e.data.url;
      paint();
      changed();
    } else if (e.data.type === 'mir:deselect') {
      select(null);
    }
  });

  paint();
  post({ type: 'mir:ready', edits: JSON.parse(JSON.stringify(edits)), device: device() });
})();
