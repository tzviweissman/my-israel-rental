/*
 * Cards and lines an owner added, removed or put in another order on a designed page (Tzvi, 28 Oct 2026: a new store
 * for American Crust, then "make sure its easy for them to add things evenly like they can in ... canva").
 *
 * An item is the repeated thing that holds an editable element (itemOf): a line of a list, or one of several cards that
 * look alike (same tag, same classes, side by side). A copy sits in the page's own flow, so it lines up and spaces
 * exactly like the others. edits.items[group] is the group's whole order, the group named by its first item's key:
 *   {k: key}                               one of the page's own items, by the first editable key in it
 *   {from: key, t: {key: html}, i: {key: url}}   a copy of one, with its own words and photos
 * An item of the page left out of the list is removed. frontend/server.js runs this before the page's own scripts, so
 * those (scroll reveals, buttons) see the copies too; public/pages/mir-editor.js uses the same functions.
 */
(function () {
  'use strict';
  var STOP = /^(BODY|MAIN|SECTION|HEADER|FOOTER|NAV|FORM)$/;
  var MAX_KEYS = 12;
  var slice = function (l) { return Array.prototype.slice.call(l); };
  // Cards alike share a tag and their first class ("room black" and "room gold" are both rooms); classes that come and
  // go (a reveal's "in", the editor's own) never count.
  var sig = function (n) {
    return n.tagName + '.' + (slice(n.classList).filter(function (c) { return !/^(mir-|in$|is-|visible$|shown$|active$|on$)/.test(c); })[0] || '');
  };
  var keysIn = function (n) { return (n.hasAttribute('data-mir-key') ? 1 : 0) + n.querySelectorAll('[data-mir-key]').length; };
  function anchorOf(n) {
    if (n.hasAttribute('data-mir-key')) return n.getAttribute('data-mir-key');
    var k = n.querySelector('[data-mir-key]');
    return k ? k.getAttribute('data-mir-key') : null;
  }
  // The page's own items like n beside it (not copies), in page order.
  function own(n) {
    var s = sig(n);
    return n.parentElement ? slice(n.parentElement.children).filter(function (c) { return sig(c) === s && !c.hasAttribute('data-mir-copy') && anchorOf(c); }) : [];
  }
  // A list line wins; otherwise the nearest repeated thing that is a card (a photo, or more than one text) and, failing
  // that, the nearest repeated thing at all (a paragraph among paragraphs).
  function itemOf(el) {
    if (el.closest('[data-mir-copy]')) return el.closest('[data-mir-copy]');
    var li = el.closest('li');
    if (li && li.parentElement && /^(UL|OL)$/.test(li.parentElement.tagName) && keysIn(li) <= MAX_KEYS) return li;
    var first = null;
    for (var n = el; n && n.parentElement && !STOP.test(n.tagName); n = n.parentElement) {
      if (keysIn(n) > MAX_KEYS) break;
      if (own(n).length >= 2) {
        if (n.querySelector('img') || keysIn(n) >= 2) return n;
        if (!first) first = n;
      }
    }
    return first;
  }
  function groupOf(item) {
    if (item.hasAttribute('data-mir-copy')) return item.getAttribute('data-mir-copy').split(' ')[0];
    // Named by the first item as the page had it, whatever the order now.
    for (var g in home) if (home[g].nodes.indexOf(item) >= 0) return g;
    var o = own(item);
    return o.length ? anchorOf(o[0]) : null;
  }

  // Each group's items as the page had them, and a marker after the last, so a new order (or an undo) starts from there.
  var home = {};
  function homeOf(g, item) {
    if (home[g]) return home[g];
    var nodes = own(item), mark = document.createComment('mir-items');
    nodes[nodes.length - 1].after(mark);
    return (home[g] = { nodes: nodes, mark: mark });
  }
  // The group's keys as the page had them (its order when nothing is changed).
  function homeKeys(g, item) { return (home[g] ? home[g].nodes : own(item)).map(anchorOf); }
  function copyOf(src, e, g, i, editor) {
    var c = src.cloneNode(true);
    c.setAttribute('data-mir-copy', g + ' ' + i);
    c.removeAttribute('id');
    [c].concat(slice(c.querySelectorAll('[data-mir-key], [id]'))).forEach(function (n) {
      if (n !== c) n.removeAttribute('id');
      n.classList.remove('mir-sel', 'mir-typing', 'mir-hidden', 'mir-dropped', 'mir-drag');
      var k = n.getAttribute('data-mir-key');
      if (!k) return;
      n.removeAttribute('data-mir-key');
      if (n.tagName === 'IMG') {
        if (e.i && e.i[k]) { n.removeAttribute('srcset'); n.removeAttribute('sizes'); n.setAttribute('src', e.i[k]); }
      } else if (e.t && typeof e.t[k] === 'string') n.innerHTML = e.t[k];
      // A two-language page swaps data-en / data-he in: a copy has its own, not its original's.
      var alt = n.hasAttribute('data-en') ? 'data-en' : n.hasAttribute('data-he') ? 'data-he' : null;
      if (alt && e.a && typeof e.a[k] === 'string') n.setAttribute(alt, e.a[k]);
      if (editor) n.setAttribute('data-mir-field', k);
    });
    // A copied "Add" button would order the card it was copied from: a copy has none (a link, WhatsApp or a page,
    // stays). A copied choice in a form sends its own words, not the original's.
    slice(c.querySelectorAll('button, [role="button"]')).concat(c.matches('button') ? [c] : []).forEach(function (b) { b.hidden = true; b.style.display = 'none'; });
    slice(c.querySelectorAll('input[type="checkbox"], input[type="radio"]')).forEach(function (i) { i.value = (c.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 80); });
    return c;
  }
  function render(items, editor) {
    Object.keys(home).forEach(function (g) {
      var h = home[g];
      slice(h.mark.parentNode ? h.mark.parentNode.children : []).forEach(function (c) { if (c.hasAttribute('data-mir-copy')) c.remove(); });
      h.nodes.forEach(function (n) { n.classList.remove('mir-dropped'); h.mark.before(n); });
    });
    Object.keys(items || {}).forEach(function (g) {
      var list = items[g], gEl = document.querySelector('[data-mir-key="' + g + '"]'), item = gEl && itemOf(gEl);
      if (!Array.isArray(list) || !item || item.hasAttribute('data-mir-copy')) return;
      var h = homeOf(g, item), by = {}, used = {};
      h.nodes.forEach(function (n) { by[anchorOf(n)] = n; });
      list.forEach(function (e, i) {
        if (!e) return;
        var node = null;
        if (e.k && by[e.k] && !used[e.k]) { node = by[e.k]; used[e.k] = 1; } else if (e.from && by[e.from]) node = copyOf(by[e.from], e, g, i, editor);
        if (node) h.mark.before(node);
      });
      // Left out: gone for visitors; in the editor faint at the end, to be put back.
      h.nodes.forEach(function (n) {
        if (used[anchorOf(n)]) return;
        if (editor) { n.classList.add('mir-dropped'); h.mark.before(n); } else n.remove();
      });
    });
  }
  window.mirItems = { itemOf: itemOf, groupOf: groupOf, anchorOf: anchorOf, own: own, homeKeys: homeKeys, render: render };
  var data = document.getElementById('mir-items-data');
  if (data) { try { render(JSON.parse(data.textContent || '{}'), false); } catch (err) { /* the page as designed */ } }
})();
