/*
 * The editor inside a hand-built business page (Tzvi, 9 Oct 2026: "easy to
 * move text or change text like I can on Claude design ... or photos";
 * 28 Oct 2026: "easy for them to add things evenly like they can in ... canva").
 *
 * Loaded only when the dashboard frames the page with ?mir-edit=1
 * (frontend/server.js adds it, with the saved edits as JSON, after
 * public/pages/mir-items.js). Everything publish-page.mjs marked with
 * data-mir-key can be:
 *   - clicked to select it, clicked again (or double-clicked) to type in it
 *   - dragged to move it (separately on laptop and on phone), snapping to the
 *     page's centre, its old place and the edges and middles of what is near
 *   - made bigger or smaller, aligned, hidden
 *   - a photo: replaced (the dashboard uploads it)
 *   - linked to the opening hours or a price set in the dashboard
 *   - on a two-language page, given its words in the other language
 * A line of a list or one of a row of cards (mir-items.js) can be copied,
 * removed, put back, and dragged into another place in its row, so a new
 * store or a new product sits in line and spaced like the others.
 * Each change is sent to the dashboard (src/pages/PageEditor.jsx), which
 * keeps undo/redo and saves. Nothing here saves on its own.
 */
(function () {
  'use strict';
  if (window.parent === window || !window.mirItems) return;
  var M = window.mirItems;
  var dataEl = document.getElementById('mir-edits-data');
  var edits;
  function setEdits(d) {
    d = d || {};
    edits = { text: d.text || {}, img: d.img || {}, style: d.style || {}, items: d.items || {}, bind: d.bind || {}, alt: d.alt || {} };
  }
  try { setEdits(JSON.parse(dataEl ? dataEl.textContent : '{}')); } catch (e) { setEdits({}); }
  // The dashboard's own figures, for linked words (mir:live).
  var live = { hours: null, prices: {}, soldOut: {} };

  // The editor speaks the dashboard's language (the dashboard frames this page, same origin).
  var heUI = false;
  try { heUI = /^he/i.test(window.parent.document.documentElement.lang || ''); } catch (e) { /* stays English */ }
  var HE = {
    'Edit text': 'עריכת טקסט', 'Link': 'קישור', 'Replace photo': 'החלפת תמונה', 'Change': 'שינוי',
    'Shows your opening hours': 'מציג את שעות הפתיחה', 'Shows the price of ': 'מציג את המחיר של ',
    '+ Add a line': '+ הוספת שורה', '+ Add a card': '+ הוספת כרטיס', '+ Add another': '+ הוספת עוד אחד',
    'Remove line': 'הסרת שורה', 'Remove card': 'הסרת כרטיס', 'Remove ': 'הסרה', 'Removed': 'הוסר', 'Put back': 'החזרה',
    'Smaller': 'קטן יותר', 'Bigger': 'גדול יותר', 'Align left': 'יישור לשמאל', 'Centre': 'מרכוז', 'Align right': 'יישור לימין',
    'Hide': 'הסתרה', 'Hide or show': 'הסתרה או הצגה', 'Reset': 'איפוס', 'Back to where it was': 'חזרה למקום המקורי', 'Done': 'סיום',
    'In Hebrew': 'בעברית', 'In English': 'באנגלית', 'Earlier': 'מוקדם יותר', 'Later': 'מאוחר יותר',
    'Drag to put it somewhere else in the row': 'גררו כדי להעביר למקום אחר בשורה', 'Remove it from the page': 'הסרה מהדף',
    'Put it back on the page': 'החזרה לדף', 'Add another just like this, in line with the others': 'הוספת עוד אחד בדיוק כזה, בשורה עם האחרים',
    'Show your opening hours or a price from your dashboard here, so it changes when you change it there': 'הצגת שעות הפתיחה או מחיר מלוח הבקרה, כך שישתנה כשתשנו אותו שם',
    'The same words in Hebrew': 'אותן מילים בעברית', 'The same words in English': 'אותן מילים באנגלית',
    'Click text or a photo to change it. Drag it to move it. Click a line or a card to add another just like it.': 'לחצו על טקסט או תמונה כדי לשנות. גררו כדי להזיז. לחצו על שורה או כרטיס כדי להוסיף עוד אחד בדיוק כמוהו.'
  };
  var T = function (s) { return heUI && HE[s] ? HE[s] : s; };
  var post = function (msg) { window.parent.postMessage(Object.assign({ source: 'mir-editor' }, msg), location.origin); };
  var device = function () { return window.innerWidth < 768 ? 'm' : 'd'; };
  var slice = function (l) { return Array.prototype.slice.call(l); };
  var all = function () { return slice(document.querySelectorAll('[data-mir-key]')); };
  var keyOf = function (el) { return el.getAttribute('data-mir-key'); };
  var isImg = function (el) { return el.tagName === 'IMG'; };
  var isField = function (el) { return el.hasAttribute('data-mir-field'); };
  var he = /^he/i.test(document.documentElement.lang || '');
  var loaded = {}, loadedAlt = {};
  var altAttr = function (el) { return el.hasAttribute('data-en') ? 'data-en' : el.hasAttribute('data-he') ? 'data-he' : null; };
  all().forEach(function (el) {
    var k = keyOf(el), a = altAttr(el);
    loaded[k] = isImg(el) ? el.getAttribute('src') : el.innerHTML;
    if (a) loadedAlt[k] = el.getAttribute(a);
  });
  // The same words twice in one place (a flip button's two faces) change together.
  var twins = function (el) {
    var k = keyOf(el), base = k.replace(/-\d+$/, '');
    return all().filter(function (o) { return o === el || (o.parentElement === el.parentElement && keyOf(o).replace(/-\d+$/, '') === base); });
  };
  var escText = function (v) { return String(v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); };
  // frontend/server.js boundText, the same for the editor's view.
  function boundText(inner, bind) {
    if (bind === 'hours') return live.hours ? escText(live.hours) : inner;
    var m = /^price:(.+)$/.exec(bind), out = inner;
    if (!m) return inner;
    var p = Number(live.prices[m[1]]);
    if (live.prices[m[1]] != null && isFinite(p) && p >= 0) {
      var fmt = p % 1 === 0 ? String(p) : p.toFixed(2), done = false;
      out = out.replace(/(^|>)([^<]*?)(\d+(?:[.,]\d+)?)/, function (x, a, b) { done = true; return a + b + fmt; });
      if (!done) out += ' ₪' + fmt;
    }
    if (live.soldOut[m[1]]) out += he ? ' · אזל' : ' · Sold out';
    return out;
  }

  /* ---- cards and lines (mir-items.js) ------------------------------------ */
  // Where el sits in its row: the item, its group, the group's order (as edits.items has it, or the page's own),
  // its place in that order (-1 when removed), and whether the row runs across or down.
  function info(el) {
    var item = M.itemOf(el);
    if (!item) return null;
    var g = M.groupOf(item);
    if (!g) return null;
    var list = edits.items[g] ? edits.items[g].slice() : M.homeKeys(g, item).map(function (k) { return { k: k }; });
    var idx = item.hasAttribute('data-mir-copy') ? +item.getAttribute('data-mir-copy').split(' ')[1]
      : list.findIndex(function (e) { return e.k === M.anchorOf(item); });
    var row = visible(item), across = row.length > 1 && Math.abs(row[0].getBoundingClientRect().top - row[1].getBoundingClientRect().top) < 8;
    return { item: item, g: g, list: list, idx: idx, line: item.tagName === 'LI', across: across, field: isField(el) ? el.getAttribute('data-mir-field') : keyOf(el) };
  }
  // The row as it shows: the page's own items and copies, not the removed ones.
  function visible(item) {
    var s = item.parentElement;
    return slice(s.children).filter(function (c) {
      return !c.classList.contains('mir-dropped') && (c.hasAttribute('data-mir-copy') || (M.anchorOf(c) && M.itemOf(c.hasAttribute('data-mir-key') ? c : c.querySelector('[data-mir-key]')) === c));
    });
  }
  function commit(i, list) {
    var homeK = M.homeKeys(i.g, i.item);
    var plain = list.length === homeK.length && list.every(function (e, n) { return e.k === homeK[n]; });
    if (plain) delete edits.items[i.g]; else edits.items[i.g] = list;
  }
  // After a new order the copies are new nodes: find the one at place idx again, and the same field in it.
  function find(g, idx, field) {
    var e = (edits.items[g] || [])[idx], node = null;
    if (e && e.k) {
      var k = document.querySelector('[data-mir-key="' + e.k + '"]');
      node = k && M.itemOf(k);
    } else node = document.querySelector('[data-mir-copy="' + g + ' ' + idx + '"]');
    if (!node || !field) return node;
    var sel1 = '[data-mir-key="' + field + '"], [data-mir-field="' + field + '"]';
    return node.matches(sel1) ? node : node.querySelector(sel1) || node;
  }
  function renderItems() {
    var keep = sel && sel.closest('[data-mir-copy]') ? { g: sel.closest('[data-mir-copy]').getAttribute('data-mir-copy').split(' ')[0], idx: +sel.closest('[data-mir-copy]').getAttribute('data-mir-copy').split(' ')[1], f: sel.getAttribute('data-mir-field') } : null;
    if (keep) select(null);
    M.render(edits.items, true);
    if (keep && edits.items[keep.g] && edits.items[keep.g][keep.idx] && !edits.items[keep.g][keep.idx].k) select(find(keep.g, keep.idx, keep.f));
  }
  // A copy keeps the words and photos it has now, so changing one card later leaves its twin alone.
  function snapshot(i) {
    if (i.item.hasAttribute('data-mir-copy')) {
      var e = i.list[i.idx], t = {}, im = Object.assign({}, e.i || {});
      slice(i.item.querySelectorAll('[data-mir-field]')).concat(isField(i.item) ? [i.item] : []).forEach(function (n) { if (!isImg(n)) t[n.getAttribute('data-mir-field')] = n.innerHTML; });
      return { from: e.from, t: t, i: im };
    }
    var out = { from: M.anchorOf(i.item), t: {}, i: {} };
    [i.item].concat(slice(i.item.querySelectorAll('[data-mir-key]'))).forEach(function (n) {
      var k = keyOf(n);
      if (!k) return;
      if (isImg(n)) { if (edits.img[k]) out.i[k] = edits.img[k]; } else if (!edits.bind[k]) out.t[k] = n.innerHTML;
    });
    return out;
  }
  function duplicate(el) {
    stopTyping();
    var i = info(el);
    if (!i || i.idx < 0 || i.list.length >= 40) return;
    i.list.splice(i.idx + 1, 0, snapshot(i));
    commit(i, i.list);
    select(null); renderItems(); changed();
    var n = find(i.g, i.idx + 1, i.field);
    if (!n) return;
    n.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    select(n);
    if (i.line && !isImg(n)) startTyping(n);
  }
  function removeItem(el) {
    stopTyping();
    var i = info(el);
    if (!i || i.idx < 0) return;
    i.list.splice(i.idx, 1);
    commit(i, i.list);
    select(null); renderItems(); changed();
  }
  function putBack(el) {
    var i = info(el);
    if (!i || i.idx >= 0) return;
    i.list.push({ k: M.anchorOf(i.item) });
    commit(i, i.list);
    select(null); renderItems(); changed();
  }
  function moveItem(el, to) {
    var i = info(el);
    if (!i || i.idx < 0 || to < 0 || to >= i.list.length || to === i.idx) return el;
    var e = i.list.splice(i.idx, 1)[0];
    i.list.splice(to, 0, e);
    commit(i, i.list);
    var wasSel = sel === el;
    if (wasSel) select(null);
    renderItems();
    var n = find(i.g, to, i.field) || el;
    if (wasSel) select(n);
    return n;
  }

  /* ---- look ------------------------------------------------------------ */
  var ui = document.createElement('style');
  ui.textContent = [
    'html.mir-on img{-webkit-user-drag:none;user-select:none}',
    'html.mir-on [data-mir-key],html.mir-on [data-mir-field]{cursor:pointer;touch-action:none;outline:1px dashed transparent;outline-offset:3px;transition:outline-color .15s}',
    'html.mir-on [data-mir-key]:hover,html.mir-on [data-mir-field]:hover{outline-color:rgba(22,122,184,.7)}',
    'html.mir-on .mir-sel{outline:2px solid #167AB8 !important;outline-offset:3px}',
    'html.mir-on .mir-typing{outline:2px solid #111827 !important;cursor:text;background:rgba(255,255,255,.08)}',
    'html.mir-on .mir-drag{cursor:grabbing !important;opacity:.92}',
    'html.mir-on .mir-lift{box-shadow:0 18px 40px -12px rgba(17,24,39,.45) !important;outline:2px solid #167AB8 !important;outline-offset:2px;position:relative;z-index:5}',
    'html.mir-on [data-mir-key].mir-hidden{opacity:.25 !important;display:revert !important}',
    'html.mir-on .mir-dropped{opacity:.3 !important;filter:grayscale(1)}',
    'html.mir-on [data-mir-copy]{animation:mir-in .35s ease-out}',
    '@keyframes mir-in{from{opacity:0;transform:translateY(6px)}}',
    '@media (prefers-reduced-motion:reduce){html.mir-on [data-mir-copy]{animation:none}}',
    '.mir-guide{position:fixed;z-index:2147483645;background:#E5398F;pointer-events:none}',
    '#mir-bar{position:fixed;z-index:2147483646;display:flex;flex-wrap:wrap;max-width:calc(100vw - 16px);gap:4px;align-items:center;padding:6px;border-radius:12px;background:#111827;box-shadow:0 10px 30px -10px rgba(0,0,0,.5);font:600 13px/1 system-ui,sans-serif;color:#fff;user-select:none}',
    '#mir-bar button{all:unset;cursor:pointer;padding:8px 10px;border-radius:8px;color:#fff;white-space:nowrap}',
    '#mir-bar button:hover{background:rgba(255,255,255,.14)}',
    '#mir-bar button:focus-visible{outline:2px solid #24AFEB}',
    '#mir-bar button.mir-grip{cursor:grab;touch-action:none}',
    '#mir-bar .sep{width:1px;align-self:stretch;background:rgba(255,255,255,.2);margin:2px 2px}',
    '#mir-bar .note{padding:0 8px;color:#9CA3AF;font-weight:500}',
    '#mir-bar input{all:unset;min-width:220px;padding:8px 10px;border-radius:8px;background:#fff;color:#111827;font:500 14px/1.2 system-ui,sans-serif}',
    '#mir-tip{position:fixed;z-index:2147483646;left:50%;bottom:16px;translate:-50% 0;max-width:calc(100vw - 32px);text-align:center;padding:10px 16px;border-radius:999px;background:#111827;color:#fff;font:500 13px/1.3 system-ui,sans-serif;box-shadow:0 10px 30px -10px rgba(0,0,0,.5);pointer-events:none}'
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
    // Words and photos first: a copy made below starts from them.
    all().forEach(function (el) {
      var k = keyOf(el);
      if (isImg(el)) {
        var src = edits.img[k] || loaded[k];
        if (el.getAttribute('src') !== src) { el.removeAttribute('srcset'); el.removeAttribute('sizes'); el.setAttribute('src', src); }
      } else if (!el.classList.contains('mir-typing')) {
        var html = edits.text[k] !== undefined ? edits.text[k] : loaded[k];
        if (edits.bind[k]) html = boundText(html, edits.bind[k]);
        if (el.innerHTML !== html) el.innerHTML = html;
        var a = altAttr(el);
        if (a) el.setAttribute(a, edits.alt[k] !== undefined ? edits.alt[k] : loadedAlt[k]);
      }
    });
    if (!typing) renderItems();
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
  tip.textContent = T('Click text or a photo to change it. Drag it to move it. Click a line or a card to add another just like it.');
  if (heUI) tip.dir = 'rtl';
  document.body.appendChild(tip);
  setTimeout(function () { tip.style.transition = 'opacity .4s'; tip.style.opacity = '0'; }, 7000);

  function button(label, fn, title, cls) {
    var b = document.createElement('button');
    b.type = 'button'; b.textContent = T(label); if (title) { b.title = T(title); b.setAttribute('aria-label', T(title)); }
    if (cls) b.className = cls;
    b.addEventListener('pointerdown', function (e) { e.stopPropagation(); });
    b.addEventListener('click', function (e) { e.preventDefault(); e.stopPropagation(); fn(); });
    return b;
  }
  function sep() { var s = document.createElement('span'); s.className = 'sep'; return s; }
  function note(text) { var s = document.createElement('span'); s.className = 'note'; s.textContent = T(text); return s; }
  // Where an element's other-language words live: edits.alt by key, or a copy's own "a".
  function altSlot(el) {
    if (!isField(el)) return { get: function () { return edits.alt[keyOf(el)]; }, set: function (v) { if (v == null) delete edits.alt[keyOf(el)]; else edits.alt[keyOf(el)] = v; }, base: loadedAlt[keyOf(el)] };
    var c = el.closest('[data-mir-copy]').getAttribute('data-mir-copy').split(' '), e = (edits.items[c[0]] || [])[+c[1]] || {}, f = el.getAttribute('data-mir-field');
    return { get: function () { return (e.a || {})[f]; }, set: function (v) { e.a = e.a || {}; if (v == null) delete e.a[f]; else e.a[f] = v; if (!Object.keys(e.a).length) delete e.a; }, base: null };
  }
  // After the owner types, the other language follows (the dashboard asks the API, mir:translate); they can correct it.
  var asked = 0, pending = {};
  function translate(el) {
    var a = altAttr(el);
    if (!a) return;
    var text = el.textContent.replace(/\s+/g, ' ').trim();
    if (!text) return;
    asked += 1;
    pending[asked] = altSlot(el);
    post({ type: 'mir:translate', id: asked, texts: [text], to: a === 'data-he' ? 'he' : 'en' });
  }
  function askAlt(el) {
    var slot = altSlot(el), a = altAttr(el);
    bar.innerHTML = '';
    var input = document.createElement('input');
    input.value = slot.get() !== undefined ? slot.get() : (slot.base || el.getAttribute(a) || '');
    input.dir = a === 'data-he' ? 'rtl' : 'ltr';
    input.setAttribute('aria-label', a === 'data-he' ? 'In Hebrew' : 'In English');
    var done = function (keepIt) {
      if (keepIt) {
        var v = input.value.replace(/\s+/g, ' ').trim();
        slot.set(!v || v === slot.base ? null : v);
        if (isField(el)) renderItems(); else paint();
        changed();
      }
      var s = sel; select(null); select(s);
    };
    input.addEventListener('keydown', function (e) { e.stopPropagation(); if (e.key === 'Enter') { e.preventDefault(); done(true); } if (e.key === 'Escape') done(false); });
    input.addEventListener('pointerdown', function (e) { e.stopPropagation(); });
    bar.appendChild(note(a === 'data-he' ? 'In Hebrew' : 'In English'));
    bar.appendChild(input);
    bar.appendChild(button('Done', function () { done(true); }));
    place();
    input.focus(); input.select();
  }
  function itemButtons(el, i) {
    var noun = i.line ? 'line' : (M.itemOf(el).querySelector('img') ? 'card' : 'one');
    bar.appendChild(sep());
    if (i.idx < 0) {
      bar.appendChild(note('Removed'));
      bar.appendChild(button('Put back', function () { putBack(el); }, 'Put it back on the page'));
      return;
    }
    bar.appendChild(button({ line: '+ Add a line', card: '+ Add a card', one: '+ Add another' }[noun], function () { duplicate(el); }, 'Add another just like this, in line with the others'));
    if (i.list.length > 1) {
      // Across a right-to-left row, earlier is to the right.
      var rtl = getComputedStyle(i.item).direction === 'rtl';
      bar.appendChild(button(i.across ? (rtl ? '→' : '←') : '↑', function () { moveItem(el, i.idx - 1); }, 'Earlier'));
      bar.appendChild(button(i.across ? (rtl ? '←' : '→') : '↓', function () { moveItem(el, i.idx + 1); }, 'Later'));
      var grip = button('⠿', function () {}, 'Drag to put it somewhere else in the row', 'mir-grip');
      grip.addEventListener('pointerdown', function (e) { e.preventDefault(); startOrder(el, e); });
      bar.appendChild(grip);
    }
    bar.appendChild(button({ line: 'Remove line', card: 'Remove card', one: 'Remove ' }[noun], function () { removeItem(el); }, 'Remove it from the page'));
  }
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
    if (heUI) bar.dir = 'rtl';
    var i = info(el), k = isField(el) ? null : keyOf(el);
    if (i && i.idx < 0) {
      itemButtons(el, i);
      bar.firstChild.remove();
    } else if (isField(el)) {
      if (isImg(el)) bar.appendChild(button('Replace photo', function () { var c = el.closest('[data-mir-copy]').getAttribute('data-mir-copy').split(' '); post({ type: 'mir:pick', key: '@' + c[0] + ' ' + c[1] + ' ' + el.getAttribute('data-mir-field') }); }));
      else bar.appendChild(button('Edit text', function () { startTyping(el); }));
      if (!isImg(el) && altAttr(el)) bar.appendChild(button(altAttr(el) === 'data-he' ? 'עברית' : 'English', function () { askAlt(el); }, altAttr(el) === 'data-he' ? 'The same words in Hebrew' : 'The same words in English'));
      if (i) itemButtons(el, i);
    } else {
      if (isImg(el)) bar.appendChild(button('Replace photo', function () { post({ type: 'mir:pick', key: k }); }));
      else if (edits.bind[k]) {
        bar.appendChild(note(edits.bind[k] === 'hours' ? 'Shows your opening hours' : T('Shows the price of ') + edits.bind[k].slice(6)));
        bar.appendChild(button('Change', function () { post({ type: 'mir:link', key: k, bind: edits.bind[k] }); }));
      } else bar.appendChild(button('Edit text', function () { startTyping(el); }));
      if (!isImg(el) && !edits.bind[k]) bar.appendChild(button('Link', function () { post({ type: 'mir:link', key: k, bind: null }); }, 'Show your opening hours or a price from your dashboard here, so it changes when you change it there'));
      if (!isImg(el) && altAttr(el)) bar.appendChild(button(altAttr(el) === 'data-he' ? 'עברית' : 'English', function () { askAlt(el); }, altAttr(el) === 'data-he' ? 'The same words in Hebrew' : 'The same words in English'));
      if (i) itemButtons(el, i);
      bar.appendChild(sep());
      bar.appendChild(button('A−', function () { var v = st(el); v.s = Math.max(0.4, Math.round(((v.s || 1) - 0.1) * 100) / 100); tidy(k); css(); place(); changed(); }, 'Smaller'));
      bar.appendChild(button('A+', function () { var v = st(el); v.s = Math.min(3, Math.round(((v.s || 1) + 0.1) * 100) / 100); tidy(k); css(); place(); changed(); }, 'Bigger'));
      if (!isImg(el)) {
        bar.appendChild(sep());
        [['⟸', 'l', 'Align left'], ['≡', 'c', 'Centre'], ['⟹', 'r', 'Align right']].forEach(function (a) {
          bar.appendChild(button(a[0], function () { var v = st(el); v.a = v.a === a[1] ? undefined : a[1]; tidy(k); css(); changed(); }, a[2]));
        });
      }
      bar.appendChild(sep());
      bar.appendChild(button('Hide', function () { var v = st(el); v.h = !v.h; tidy(k); css(); changed(); }, 'Hide or show'));
      bar.appendChild(button('Reset', function () {
        var s = edits.style[k];
        if (s) { delete s[device()]; tidy(k); }
        css(); place(); changed();
      }, 'Back to where it was'));
    }
    document.body.appendChild(bar);
    place();
    post({ type: 'mir:select', key: k });
  }
  function place() {
    if (!bar || !sel) return;
    var r = sel.getBoundingClientRect(), b = bar.getBoundingClientRect();
    var top = r.top - b.height - 10;
    if (top < 8) top = r.bottom + 10;
    var left = Math.min(Math.max(8, r.left), window.innerWidth - b.width - 8);
    bar.style.top = top + 'px'; bar.style.left = Math.max(8, left) + 'px';
  }
  window.addEventListener('scroll', place, true);
  window.addEventListener('resize', function () { css(); place(); });

  /* ---- typing ------------------------------------------------------------ */
  var typing = null;
  // The cursor goes where they clicked; from the bar's "Edit text", the
  // whole text is selected, ready to type over.
  function startTyping(el, x, y) {
    if (isImg(el) || (!isField(el) && edits.bind[keyOf(el)])) return;
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
    if (isField(el)) {
      var c = el.closest('[data-mir-copy]').getAttribute('data-mir-copy').split(' '), e = (edits.items[c[0]] || [])[+c[1]];
      if (!e) return;
      // An emptied line goes, as it would in a list anywhere.
      if (!html.replace(/<br>/g, '').trim() && el.closest('[data-mir-copy]').tagName === 'LI') { removeItem(el); return; }
      e.t = e.t || {};
      if (e.t[el.getAttribute('data-mir-field')] !== html) { e.t[el.getAttribute('data-mir-field')] = html; changed(); translate(el); }
      return;
    }
    var k = keyOf(el);
    var before = edits.text[k] !== undefined ? edits.text[k] : loaded[k];
    if (html === before) return;
    twins(el).forEach(function (t) { edits.text[keyOf(t)] = html; if (t !== el) t.innerHTML = html; });
    changed();
    translate(el);
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
    if (e.target && e.target.tagName === 'INPUT') return;
    if (e.key === 'Escape') select(null);
    var mod = e.ctrlKey || e.metaKey, key = e.key.toLowerCase();
    // Ctrl+D copies the selected line or card, as in Canva.
    if (mod && key === 'd' && sel && info(sel)) { e.preventDefault(); duplicate(sel); return; }
    var z = mod && key === 'z';
    if (z || (mod && key === 'y')) {
      e.preventDefault();
      post({ type: (z && !e.shiftKey) ? 'mir:undo' : 'mir:redo' });
    }
  }, true);

  /* ---- moving: snap guides, and a new place in a row ---------------------- */
  var SNAP = 6, guides = [];
  function guide(vertical, at) {
    var g = document.createElement('div');
    g.className = 'mir-guide';
    g.style.cssText = vertical ? 'left:' + at + 'px;top:0;bottom:0;width:1px' : 'top:' + at + 'px;left:0;right:0;height:1px';
    document.body.appendChild(g); guides.push(g);
  }
  function clearGuides() { guides.forEach(function (g) { g.remove(); }); guides = []; }
  // What a moved element lines up with: the page's centre and the edges and middles of what is on screen.
  function targets(el) {
    var xs = [window.innerWidth / 2], ys = [];
    all().forEach(function (o) {
      if (o === el || el.contains(o) || o.contains(el)) return;
      var r = o.getBoundingClientRect();
      if (!r.width || r.bottom < -200 || r.top > window.innerHeight + 200) return;
      xs.push(r.left, r.left + r.width / 2, r.right); ys.push(r.top, r.top + r.height / 2, r.bottom);
    });
    return { xs: xs, ys: ys };
  }
  function snapAxis(edges, list) {
    var best = null;
    edges.forEach(function (p) { list.forEach(function (t) { var d = t - p; if (Math.abs(d) <= SNAP && (!best || Math.abs(d) < Math.abs(best.d))) best = { d: d, at: t }; }); });
    return best;
  }
  var drag = null;
  function startOrder(el, e) {
    var i = info(el);
    if (!i || i.idx < 0) return;
    drag = { order: true, el: el, moved: true, x0: e.clientX, y0: e.clientY };
    i.item.classList.add('mir-lift');
    try { document.documentElement.setPointerCapture(e.pointerId); } catch (err) { /* fine */ }
  }
  function orderMove(e) {
    var i = info(drag.el);
    if (!i || i.idx < 0) return;
    var row = visible(i.item), best = null, bestD = Infinity;
    row.forEach(function (n, at) {
      var r = n.getBoundingClientRect(), dx = e.clientX - (r.left + r.width / 2), dy = e.clientY - (r.top + r.height / 2), d = dx * dx + dy * dy;
      if (e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom) d = -1;
      if (d < bestD) { bestD = d; best = at; }
    });
    if (best === null || best === i.idx) return;
    i.item.classList.remove('mir-lift');
    drag.el = moveItem(drag.el, best);
    var again = info(drag.el);
    if (again) again.item.classList.add('mir-lift');
  }
  document.addEventListener('pointerdown', function (e) {
    if (bar && bar.contains(e.target)) return;
    var el = e.target.closest && e.target.closest('[data-mir-key], [data-mir-field]');
    if (typing && el === typing) return;
    if (!el) { select(null); return; }
    e.preventDefault();
    var i = info(el);
    // In a row of cards or lines, dragging gives it another place in the row, so the row stays even.
    if (i || isField(el)) {
      drag = { el: el, item: !!i && i.idx >= 0, cx: e.clientX, cy: e.clientY, x0: e.clientX, y0: e.clientY, moved: false, wasSel: sel === el };
    } else {
      var v = st(el), r = el.getBoundingClientRect();
      drag = { el: el, free: true, cx: e.clientX, cy: e.clientY, x0: e.clientX, y0: e.clientY, x: v.x || 0, y: v.y || 0, r: r, t: targets(el), moved: false, wasSel: sel === el };
      tidy(keyOf(el));
    }
    try { el.setPointerCapture(e.pointerId); } catch (err) { /* fine */ }
  }, true);
  document.addEventListener('pointermove', function (e) {
    if (!drag) return;
    var dx = e.clientX - drag.x0, dy = e.clientY - drag.y0;
    if (!drag.moved && Math.abs(dx) + Math.abs(dy) < 5) return;
    if (drag.order) { orderMove(e); return; }
    if (!drag.moved) {
      drag.moved = true;
      if (drag.item) { select(drag.el); startOrder(drag.el, e); orderMove(e); return; }
      if (!drag.free) return;
      select(drag.el); drag.el.classList.add('mir-drag');
    }
    if (!drag.free) return;
    var nx = drag.x + dx, ny = drag.y + dy;
    clearGuides();
    if (!e.altKey) {
      // Its old place first, then lines shared with what is around it.
      if (Math.abs(nx) <= SNAP) nx = 0;
      if (Math.abs(ny) <= SNAP) ny = 0;
      var l = drag.r.left + (nx - drag.x), t = drag.r.top + (ny - drag.y), w = drag.r.width, h = drag.r.height;
      var sx = snapAxis([l, l + w / 2, l + w], drag.t.xs), sy = snapAxis([t, t + h / 2, t + h], drag.t.ys);
      if (sx) { nx += sx.d; guide(true, sx.at); }
      if (sy) { ny += sy.d; guide(false, sy.at); }
    }
    var v = st(drag.el);
    v.x = Math.round(nx); v.y = Math.round(ny);
    css(); place();
  }, true);
  document.addEventListener('pointerup', function () {
    if (!drag) return;
    var d = drag; drag = null;
    clearGuides();
    d.el.classList.remove('mir-drag');
    slice(document.querySelectorAll('.mir-lift')).forEach(function (n) { n.classList.remove('mir-lift'); });
    if (d.order || (d.moved && d.item)) { changed(); place(); return; }
    if (d.free) tidy(keyOf(d.el));
    if (d.moved) { changed(); return; }
    if (d.wasSel && !isImg(d.el)) startTyping(d.el, d.cx, d.cy); else select(d.el);
  }, true);
  document.addEventListener('dblclick', function (e) {
    var el = e.target.closest && e.target.closest('[data-mir-key], [data-mir-field]');
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
    var d = e.data;
    if (d.type === 'mir:load') {
      stopTyping(); select(null);
      setEdits(d.edits);
      paint();
    } else if (d.type === 'mir:live') {
      live = { hours: d.hours || null, prices: d.prices || {}, soldOut: d.soldOut || {} };
      paint();
    } else if (d.type === 'mir:image' && d.key && d.url) {
      if (d.key.charAt(0) === '@') {
        var p = d.key.slice(1).split(' '), entry = (edits.items[p[0]] || [])[+p[1]];
        if (!entry || entry.k) return;
        entry.i = entry.i || {}; entry.i[p[2]] = d.url;
        renderItems();
      } else {
        edits.img[d.key] = d.url;
        paint();
      }
      changed();
    } else if (d.type === 'mir:bind' && d.key) {
      if (d.bind) edits.bind[d.key] = d.bind; else delete edits.bind[d.key];
      var s = sel; select(null);
      paint(); changed();
      if (s) select(s);
    } else if (d.type === 'mir:translated' && pending[d.id]) {
      var slot = pending[d.id];
      delete pending[d.id];
      if (!d.texts || !d.texts[0]) return;
      slot.set(d.texts[0]);
      paint(); changed();
    } else if (d.type === 'mir:deselect') {
      select(null);
    }
  });

  paint();
  post({ type: 'mir:ready', edits: JSON.parse(JSON.stringify(edits)), device: device() });
})();
