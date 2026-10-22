/*
 * KasherMyBnb: what every page shares. The order is kept in this tab
 * (sessionStorage) as it moves through Choose, Details and Review, so a
 * visitor can go back a step without losing anything and never signs in.
 * Prices are theirs (their listing): whole kitchen $350, pots, cutlery and
 * utensils $180, oven cleaning and kashering +$40, a new frying pan $15.
 * The order is sent as a WhatsApp message to their number, which is how
 * their listing takes bookings; they confirm the day and time there.
 */
(function () {
  'use strict';
  var WA = '972584031989';
  var KEY = 'kmb-order';
  var PRICE = { kitchen: 350, pots: 180, oven: 40, pan: 15 };
  // The live prices from their listing, when the site server adds them
  // (frontend/server.js, #mir-live-prices), so a price changed in their
  // dashboard is the price this order adds up.
  try {
    var live = JSON.parse((document.getElementById('mir-live-prices') || {}).textContent || '{}');
    if (live['Kashering Kitchen'] > 0) PRICE.kitchen = live['Kashering Kitchen'];
    if (live['Kashering of Pots, Cutlery & Utensils'] > 0) PRICE.pots = live['Kashering of Pots, Cutlery & Utensils'];
  } catch (e) { /* the prices as written */ }
  var NAMES = { kitchen: 'Whole kitchen', pots: 'Pots, cutlery and utensils', oven: 'Oven cleaning and kashering', pan: 'New frying pan' };
  var TIMES = { any: 'Any time', morning: 'Morning', afternoon: 'Afternoon', evening: 'Evening' };
  var EMPTY = { kitchen: false, pots: false, oven: false, pans: 0, date: '', time: 'any', place: '', city: '', address: '', name: '', phone: '', notes: '' };

  function load() {
    var o = {};
    try { o = JSON.parse(sessionStorage.getItem(KEY) || '{}') || {}; } catch (e) { o = {}; }
    var out = {};
    Object.keys(EMPTY).forEach(function (k) { out[k] = o[k] !== undefined ? o[k] : EMPTY[k]; });
    return out;
  }
  function save(o) { try { sessionStorage.setItem(KEY, JSON.stringify(o)); } catch (e) { /* private window: the page still works */ } }

  function lines(o) {
    var l = [];
    if (o.kitchen) l.push([NAMES.kitchen, PRICE.kitchen, 'kitchen']);
    if (o.kitchen && o.oven) l.push([NAMES.oven, PRICE.oven, 'oven']);
    if (o.pots) l.push([NAMES.pots, PRICE.pots, 'pots']);
    if (o.pans > 0) l.push([NAMES.pan + (o.pans > 1 ? ' × ' + o.pans : ''), PRICE.pan * o.pans, 'pan']);
    return l;
  }
  function total(o) { return lines(o).reduce(function (s, x) { return s + x[1]; }, 0); }
  function money(n) { return '$' + n; }
  function when(o) {
    if (!o.date) return o.time && o.time !== 'any' ? TIMES[o.time] : '';
    var d = new Date(o.date + 'T12:00:00');
    var day = d.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' });
    return day + (o.time && o.time !== 'any' ? ', ' + TIMES[o.time].toLowerCase() : '');
  }
  function where(o) {
    if (o.place === 'jerusalem') return 'Jerusalem' + (o.address ? ', ' + o.address : '');
    if (o.place === 'elsewhere') return (o.city || 'Elsewhere in Israel') + (o.address ? ', ' + o.address : '');
    return '';
  }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }

  // The summary on every order page, and the phone's bottom bar.
  function paintSummary(o) {
    var l = lines(o), t = total(o);
    document.querySelectorAll('[data-lines]').forEach(function (ul) {
      var had = ul._kmbKeys, keys = {};
      var html = l.length ? l.map(function (x) {
        keys[x[2]] = 1;
        var fresh = had && !had[x[2]] ? ' class="is-new"' : '';
        var pic = x[2] === 'kitchen' ? 'kitchen' : x[2] === 'pots' ? 'pots' : '';
        return '<li' + fresh + '>' + (pic ? '<img class="th" src="assets/' + pic + '.webp" alt="" width="44" height="44">' : '<span class="th th--none"></span>') +
          '<span class="nm">' + esc(x[0]) + '</span><span class="pr">' + money(x[1]) + '</span>' +
          '<button type="button" class="rm" data-rm="' + x[2] + '" aria-label="Remove ' + esc(x[0]) + ' from the booking"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M10 11v6M14 11v6M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12M9 7V4h6v3"/></svg></button></li>';
      }).join('')
        : '<li class="empty">Nothing chosen yet</li>';
      var w = when(o), p = where(o);
      if (w) html += '<li class="meta"><span>When</span><span>' + esc(w) + '</span></li>';
      if (p) html += '<li class="meta"><span>Where</span><span>' + esc(p) + '</span></li>';
      ul._kmbKeys = keys;
      ul.innerHTML = html;
    });
    document.querySelectorAll('[data-total]').forEach(function (b) { b.textContent = money(t); });
    document.querySelectorAll('[data-fee]').forEach(function (p) { p.hidden = o.place !== 'elsewhere'; });
  }

  function message(o) {
    var m = ['Hi KasherMyBnb, I would like to book:'];
    lines(o).forEach(function (x) { m.push('• ' + x[0] + ' (' + money(x[1]) + ')'); });
    m.push('Total: ' + money(total(o)) + (o.place === 'elsewhere' ? ', plus any travel fee you tell me' : ''));
    if (when(o)) m.push('When: ' + when(o));
    if (where(o)) m.push('Where: ' + where(o));
    if (o.notes) m.push('Notes: ' + o.notes);
    m.push('Name: ' + o.name);
    if (o.phone) m.push('Phone: ' + o.phone);
    return m.join('\n');
  }
  function waLink(o) { return 'https://wa.me/' + WA + '?text=' + encodeURIComponent(message(o)); }

  // The bar's own link to this page is marked as the current one.
  var here = location.pathname.replace(/\/$/, '').split('/').pop().replace(/\.html$/, '');
  document.querySelectorAll('.menu a').forEach(function (a) {
    var to = (a.getAttribute('href') || '').replace(/\/$/, '').split('/').pop().replace(/\.html$/, '');
    if (to && to === here) a.setAttribute('aria-current', 'page');
  });

  // The summary thumbnails are drawn when a choice is made; load them first so none pops in late.
  ['kitchen', 'pots'].forEach(function (n) { var i = new Image(); i.src = 'assets/' + n + '.webp'; });

  // Remove one line from the booking: the kitchen takes its oven add-on with it.
  document.addEventListener('click', function (e) {
    var b = e.target.closest && e.target.closest('[data-rm]');
    if (!b) return;
    var o = load(), k = b.getAttribute('data-rm');
    if (k === 'kitchen') { o.kitchen = false; o.oven = false; }
    else if (k === 'oven') o.oven = false;
    else if (k === 'pots') o.pots = false;
    else if (k === 'pan') o.pans = 0;
    save(o);
    if (document.querySelector('[data-svc]')) document.dispatchEvent(new Event('kmb-change'));
    else location.reload();
  });

  window.KMB = { load: load, save: save, lines: lines, total: total, money: money, when: when, where: where, paint: paintSummary, waLink: waLink, message: message, PRICE: PRICE, NAMES: NAMES, TIMES: TIMES };
})();
// the phone's booking dock steps aside while the footer is on screen, so it never covers the footer text
(function () {
  var f = document.querySelector('.foot.big'), d = document.querySelector('.dock');
  if (!f || !d || !('IntersectionObserver' in window)) return;
  new IntersectionObserver(function (e) { d.style.visibility = e[0].isIntersecting ? 'hidden' : ''; }, { threshold: 0.05 }).observe(f);
})();
