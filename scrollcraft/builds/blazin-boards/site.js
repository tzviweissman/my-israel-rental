/*
 * Blazin' Boards: what every page of the site shares (Tzvi, 12 Oct 2026).
 *
 * The boards, their prices and the bottles come from the site's order-form
 * API for their store listing, so what is ordered and charged is exactly
 * what the listing says. The listing names its boards loosely and carries
 * no sizes or contents, so each is matched by its words to their own price
 * list (KNOWN), which supplies the name, size and contents shown.
 * The order is kept in this tab (sessionStorage) across the steps and is
 * placed as a real order on their board, with a track link. No sign-in;
 * the site takes no payment, the customer pays them directly.
 */
(function () {
  'use strict';
  var LOCAL = /^(localhost|127\.0\.0\.1)$/.test(location.hostname) && /\.html$/.test(location.pathname);
  var API = LOCAL ? 'http://localhost:8001/api' : '/api';
  var APP = LOCAL ? 'http://localhost:3210' : location.origin;
  var SLUG = 'blazin-boards';
  var KEY = 'bb-order', FORM = 'bb-form';
  var SYM = { USD: '$', ILS: '₪', EUR: '€', GBP: '£' };
  var KNOWN = [
    { re: /mini/i, name: 'Mini Board', cm: [15, 20], line: 'special', what: 'Entrecote steak, candied pastrami, salami chips, sometimes brisket or London broil, beef jerky.' },
    { re: /small.*blazin/i, name: "Small Blazin' Board", cm: [20, 30], line: 'blazin', what: 'Salami chips, sticky beef bites, candied pastrami, brisket, London broil, beef jerky.' },
    { re: /small.*premium/i, name: 'Small Premium Steak Board', cm: [20, 30], line: 'premium', what: 'Oyster steak, entrecote, candied pastrami, brisket, skirt or hanger steak, beef jerky.' },
    { re: /med[iu]*m.*blazin/i, name: "Medium Blazin' Board", cm: [24, 35], line: 'blazin', what: 'Sliced entrecote, maple herb baby chicken, salami chips, sticky beef bites, candied pastrami, brisket, London broil, beef jerky.' },
    { re: /med[iu]*m.*premium/i, name: 'Medium Premium Steak Board', cm: [24, 35], line: 'premium', what: 'Oyster steak, entrecote, candied pastrami, brisket, skirt or hanger steak, beef jerky.' },
    { re: /large.*blazin/i, name: "Large Blazin' Board", cm: [33, 47], line: 'blazin', what: 'Sliced entrecote, maple herb baby chicken, salami chips, sticky beef bites, candied pastrami, London broil, brisket, beef jerky.' },
    { re: /large.*premium/i, name: 'Large Premium Steak Board', cm: [33, 47], line: 'premium', what: 'Oyster steak, entrecote, candied pastrami, brisket, skirt or hanger steak, beef jerky.' },
    { re: /vip/i, name: 'Extra Large VIP Board', cm: [37, 57], line: 'special', what: 'Rib steak, oyster steak, sliced entrecote, salami chips, sticky beef bites, candied pastrami, London broil, brisket, beef facon, beef jerky.' },
    { re: /party/i, name: 'The Party Board', cm: null, line: 'special', what: 'Two rib steaks, oyster steak, entrecote, candied pastrami, brisket, London broil, skirt or hanger steak, beef jerky.' },
    { re: /jerky/i, name: 'The All Jerky Board', cm: [20, 30], line: 'special', what: '' }
  ];
  var LINES = { blazin: "Blazin' line", premium: 'Premium Steak line', special: 'Specials' };

  function tidy(p) {
    var k = KNOWN.filter(function (x) { return x.re.test(p.name); })[0];
    var board = (p.group || 'Boards') === 'Boards' || !!k;
    if (!k) return Object.assign({}, p, { board: board, short: p.name, cm: null, line: board ? 'special' : null });
    return Object.assign({}, p, {
      board: true, short: k.name, cm: k.cm, line: k.line,
      what: p.description && p.description.length > 12 ? p.description : k.what
    });
  }
  function form() {
    try {
      var c = JSON.parse(sessionStorage.getItem(FORM) || 'null');
      if (c && Date.now() - c.at < 5 * 60 * 1000) return Promise.resolve(c.form);
    } catch (e) { /* fetch it */ }
    return fetch(API + '/marketplace/business/' + SLUG).then(function (r) { return r.json(); }).then(function (d) {
      var gigs = d.listings || d.gigs || [];
      var store = gigs.filter(function (g) { return g.gig_type === 'store'; })[0] || gigs[0];
      if (!store) throw new Error('no store listing');
      return fetch(API + '/marketplace/order-form/' + store.id).then(function (r) { return r.json(); });
    }).then(function (f) {
      f.products = (f.products || []).filter(function (p) { return p.in_stock !== false; }).map(tidy);
      var ways = ((f.business || {}).payment_note || 'card, Zelle, bank transfer').split(/,|·/).map(function (s) { return s.replace(/\s+/g, ' ').trim().replace(/zelle/i, 'Zelle'); }).filter(Boolean);
      f.ways = ways;
      try { sessionStorage.setItem(FORM, JSON.stringify({ at: Date.now(), form: f })); } catch (e) { /* fine */ }
      return f;
    });
  }

  var EMPTY = { cart: {}, ful: 'pickup', date: '', window: '', address: '', city: '', name: '', phone: '', email: '', notes: '', payBy: '' };
  function load() {
    var o = {};
    try { o = JSON.parse(sessionStorage.getItem(KEY) || '{}') || {}; } catch (e) { o = {}; }
    var out = {};
    Object.keys(EMPTY).forEach(function (k) { out[k] = o[k] !== undefined ? o[k] : (k === 'cart' ? {} : EMPTY[k]); });
    return out;
  }
  function save(o) { try { sessionStorage.setItem(KEY, JSON.stringify(o)); } catch (e) { /* fine */ } paintCart(o); }

  function money(n, cur) { return (SYM[cur || 'USD'] || ((cur || '') + ' ')) + (Math.round(n * 100) / 100).toLocaleString('en-US'); }
  function lines(f, o) {
    var out = [];
    (f.products || []).forEach(function (p) { var q = o.cart[p.id] || 0; if (q > 0) out.push({ p: p, qty: q }); });
    out.sort(function (a, b) { return (b.p.board ? 1 : 0) - (a.p.board ? 1 : 0); });
    return out;
  }
  function total(f, o) { return lines(f, o).reduce(function (s, l) { return s + l.p.price * l.qty; }, 0); }
  function count(o) { return Object.keys(o.cart).reduce(function (s, k) { return s + (o.cart[k] || 0); }, 0); }
  function cur(f) { return ((f.products || [])[0] || {}).currency || 'USD'; }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function when(o) {
    if (!o.date) return '';
    var d = new Date(o.date + 'T12:00:00').toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' });
    if (o.window) { var w = o.window.split('|'); d += ', ' + w[0] + ' to ' + w[1]; }
    return d;
  }
  function where(o) { return o.ful === 'delivery' ? 'Delivery' + (o.address ? ' to ' + o.address : '') + ', fee confirmed on WhatsApp' : 'Collect in Jerusalem'; }

  function paint(f, o) {
    var ls = lines(f, o), c = cur(f), t = total(f, o);
    document.querySelectorAll('[data-lines]').forEach(function (ul) {
      var h = ls.length ? ls.map(function (l) { return '<li><span>' + (l.qty > 1 ? l.qty + ' × ' : '') + esc(l.p.short) + '</span><span>' + money(l.p.price * l.qty, c) + '</span></li>'; }).join('')
        : '<li class="empty">Nothing chosen yet</li>';
      if (o.date || ul.hasAttribute('data-full')) {
        if (o.date) h += '<li class="meta"><span>When</span><span>' + esc(when(o)) + '</span></li>';
        h += '<li class="meta"><span>How</span><span>' + esc(where(o)) + '</span></li>';
      }
      ul.innerHTML = h;
    });
    document.querySelectorAll('[data-total]').forEach(function (b) { b.textContent = money(t, c); });
    document.querySelectorAll('[data-ways]').forEach(function (s) {
      var w = f.ways || [];
      s.textContent = w.length > 1 ? w.slice(0, -1).join(', ') + ' or ' + w[w.length - 1] : w.join('');
    });
  }
  function paintCart(o) {
    var n = count(o);
    document.querySelectorAll('[data-count]').forEach(function (b) { b.textContent = n; b.hidden = !n; });
  }
  var toastT = 0;
  function toast(msg, href, label) {
    var el = document.getElementById('toast');
    if (!el) { el = document.createElement('div'); el.id = 'toast'; el.className = 'toast'; el.setAttribute('role', 'status'); document.body.appendChild(el); }
    el.innerHTML = '<span>' + esc(msg) + '</span>' + (href ? '<a href="' + href + '">' + esc(label) + '</a>' : '');
    el.classList.add('is-on');
    clearTimeout(toastT); toastT = setTimeout(function () { el.classList.remove('is-on'); }, 3800);
    var c = document.querySelector('.cart'); if (c) { c.classList.remove('is-bump'); void c.offsetWidth; c.classList.add('is-bump'); }
  }

  // The bar's link to this page is the current one.
  var here = location.pathname.replace(/\/$/, '').split('/').pop().replace(/\.html$/, '');
  document.querySelectorAll('.menu a').forEach(function (a) {
    var to = (a.getAttribute('href') || '').split('?')[0].replace(/\/$/, '').split('/').pop().replace(/\.html$/, '');
    if (to && (to === here || (here.indexOf('order') === 0 && to === 'order'))) a.setAttribute('aria-current', 'page');
  });
  paintCart(load());

  window.BB = { API: API, APP: APP, form: form, load: load, save: save, lines: lines, total: total, money: money, cur: cur, count: count, when: when, where: where, paint: paint, toast: toast, esc: esc, LINES: LINES, NOTICE_DAYS: 2 };
})();
