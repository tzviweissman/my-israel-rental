/*
 * "Have a discount code?" on a designed site's own order form (Tzvi, 6 Nov 2026: American Crust turned on a code for
 * first-time customers and no customer could type it). The same rules and server check as the standard order page
 * (frontend/src/components/forms/DiscountCodeInput.jsx, backend routes/marketplace/discounts.py).
 *
 *   <div id="mir-code"></div>   frontend/server.js puts this script straight after it; the page keeps a stub of
 *   MirCode beside it, so the order form still works if the script never arrives (and in a local build).
 *   MirCode.mount({ el, api, gig, goods, money, phone, field, onChange })
 *     gig     the listing id, or a function that gives it once one is known
 *     goods   function: the price of the goods before any code. A code never comes off delivery
 *     money   function: a number as the page writes it; '' leaves the amount out (a basket in two currencies)
 *     phone   id of the phone input: a first-time code depends on who is ordering, so it is checked again when it changes
 *     field   the page's own class for inputs
 *   MirCode.after(n) the price after the code, MirCode.code() to send, MirCode.text(n) for the WhatsApp message.
 *   MirCode.refresh() from the page's own redraw, so a changed basket is checked again (a minimum order, a percentage).
 *
 * The box stays away unless the business has a code customers could be holding (has_codes, or ?ref= from a friend's link).
 * ponytail: a code refused in the moment between the last check and the tap still fails the order save. The page's own
 * rule then applies (WhatsApp opens anyway) and the business sees the code named in the message.
 */
(function () {
  'use strict';
  var he = document.documentElement.lang === 'he';
  var T = he
    ? { open: 'יש לך קוד הנחה?', ph: 'קוד', apply: 'הפעלה', code: 'קוד הנחה', remove: 'הסרה', on: 'הקוד הופעל', off: 'הנחה', fail: 'לא הצלחנו לבדוק את הקוד. נסו שוב.', paused: 'איננו מקבלים הזמנות כרגע.', back: 'איננו מקבלים הזמנות עד ' }
    : { open: 'Have a discount code?', ph: 'Code', apply: 'Apply', code: 'Discount code', remove: 'Remove', on: 'applied', off: 'Discount', fail: 'Could not check the code. Try again.', paused: 'We are not taking orders right now.', back: 'We are not taking orders until ' };
  var o = null, box = null, business = null, askedGig = '', applied = null, opened = false, error = '', busy = false, lastKey = '', timer = 0, pausedNow = null;

  var esc = function (s) { var d = document.createElement('div'); d.textContent = s; return d.innerHTML; };
  var phone = function () { var p = o.phone && document.getElementById(o.phone); return p ? p.value.trim() : ''; };
  var moneyOf = function (n) { return o.money ? o.money(n) : '₪' + n; };
  // An amount off is in one currency and the server refuses it on another. The page's own money() says which this
  // basket is; '' is a basket in two currencies, where the server cannot be asked until the order says.
  var currency = function () { var m = moneyOf(1); return !m ? null : m.indexOf('$') >= 0 ? 'USD' : 'ILS'; };
  var round = function (n) { return Math.round(n * 100) / 100; };

  function off(amount) {
    if (!applied) return 0;
    return round(Math.max(0, Math.min(applied.kind === 'percent' ? amount * applied.value / 100 : applied.value, amount)));
  }

  // Orders paused for a holiday (dashboard, PauseOrders.jsx): the form says so and its send button stops, WhatsApp
  // included, since the server refuses the order and the page would otherwise open WhatsApp anyway.
  // ponytail: only while the pause is in force. Before it, a day inside it is refused by the server and the page's
  // own rule applies (WhatsApp opens); greying those days needs each site's date picker.
  var SEND = '#send,#place,#placeBar,#order-send,.send';
  function pauseForm(p) {
    if (pausedNow) return;
    pausedNow = p;
    var back = p.back_on && new Date(p.back_on + 'T12:00:00').toLocaleDateString(he ? 'he-IL' : 'en-GB', { day: 'numeric', month: 'long' });
    var text = p.note || (back ? T.back + back : T.paused);
    var stop = function (e) {
      var form = box.closest('form');
      if ((e.type === 'submit' && form && e.target === form) || (e.target.closest && e.target.closest(SEND))) {
        e.preventDefault(); e.stopImmediatePropagation();
        box.scrollIntoView({ block: 'center' });
      }
    };
    document.addEventListener('click', stop, true);
    document.addEventListener('submit', stop, true);
    var css = document.createElement('style');
    css.textContent = SEND.split(',').map(function (x) { return x + '{opacity:.45}'; }).join('');
    document.head.appendChild(css);
    box.innerHTML = '<p class="mirc-err" role="status" data-testid="mir-paused">' + esc(text) + '</p>';
  }

  function draw() {
    if (!box || pausedNow) return;
    if (!business) { box.innerHTML = ''; return; }
    if (applied) {
      var m = moneyOf(off(o.goods()));
      box.innerHTML = '<p class="mirc-on" data-testid="mir-code-applied"><span>' + (he ? T.on + ' ' + esc(applied.code) : 'Code ' + esc(applied.code) + ' ' + T.on) + (m ? ', −' + esc(m) : '') + '</span> <button type="button" class="mirc-link" data-a="remove">' + T.remove + '</button></p>';
    } else if (!opened) {
      box.innerHTML = '<button type="button" class="mirc-link mirc-open" data-a="open" data-testid="mir-code-open"><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 12 12 20l-9-9V3h8z"/><circle cx="7.5" cy="7.5" r="1.2"/></svg>' + T.open + '</button>';
    } else {
      var had = box.querySelector('input'), val = had ? had.value : (o.first || '');
      box.innerHTML = '<div class="mirc-row"><input class="mirc-in ' + (o.field || '') + '" maxlength="24" autocapitalize="characters" autocomplete="off" dir="ltr" placeholder="' + T.ph + '" aria-label="' + T.code + '" data-testid="mir-code-input"><button type="button" class="mirc-go" data-a="apply" data-testid="mir-code-apply"' + (busy ? ' disabled aria-busy="true"' : '') + '>' + T.apply + '</button></div>' + (error ? '<p class="mirc-err" role="alert" data-testid="mir-code-error">' + esc(error) + '</p>' : '');
      box.querySelector('input').value = val;
    }
  }

  function changed() { if (o.onChange) o.onChange(); draw(); }

  // The server's answer is the only one that counts; here it is a preview of the order's own check.
  function check(code) {
    busy = true; error = ''; draw();
    lastKey = key();
    return fetch(o.api + '/marketplace/businesses/' + business + '/discount-codes/check', { method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ code: code, form: 'orders', amount: o.goods() || 0, phone: phone() || null, currency: currency() }) })
      .then(function (r) { return r.json(); })
      .then(function (d) {
        busy = false;
        if (d.ok) { applied = { code: d.code, kind: d.kind, value: d.value }; opened = false; }
        else { applied = null; opened = true; error = d.reason || T.fail; o.first = code; }
        changed();
      })
      .catch(function () { busy = false; error = applied ? '' : T.fail; draw(); });
  }

  function key() { return o.goods() + '|' + phone() + '|' + currency(); }

  // Finds the business from the listing; a page that only knows its listing after a pick asks again on its next redraw.
  function find() {
    var gig = typeof o.gig === 'function' ? o.gig() : o.gig;
    if (!gig || gig === askedGig || business) return;
    askedGig = gig;
    fetch(o.api + '/marketplace/order-form/' + gig).then(function (r) { return r.ok ? r.json() : null; }).then(function (d) {
      if (!d) return;
      if (d.paused && d.paused.active) { pauseForm(d.paused); return; }
      if (d.has_codes || o.first) business = d.business.id;
      if (business && o.first) { opened = true; check(o.first); } else draw();
    }).catch(function () { /* no box; the order form works without it */ });
  }

  function refresh() {
    if (!o) return;
    find();
    if (!applied || key() === lastKey) { draw(); return; }
    clearTimeout(timer);
    timer = setTimeout(function () { if (applied && key() !== lastKey) check(applied.code); }, 500);
    draw();
  }

  window.MirCode = {
    mount: function (opts) {
      o = opts;
      box = document.getElementById(o.el || 'mir-code');
      if (!box) return;
      try { o.first = (new URLSearchParams(location.search).get('ref') || '').toUpperCase(); } catch (e) { o.first = ''; }
      var css = document.createElement('style');
      css.textContent = '.mirc{margin:.5rem 0;font-size:.95rem}.mirc-link{background:none;border:0;padding:0;color:inherit;font:inherit;text-decoration:underline;text-underline-offset:3px;cursor:pointer;min-height:44px}.mirc-open{display:inline-flex;align-items:center;gap:.45rem;font-weight:600}.mirc-row{display:flex;gap:.5rem}.mirc-in{flex:1;min-width:0;min-height:48px;padding:.6rem .85rem;border:1.5px solid currentColor;border-radius:12px;background:transparent;color:inherit;font:inherit;font-size:16px;letter-spacing:.06em;text-transform:uppercase}.mirc-in::placeholder{text-transform:none;letter-spacing:0;opacity:.6}.mirc-go{flex:none;min-height:48px;padding:0 1.1rem;border:1.5px solid currentColor;border-radius:999px;background:transparent;color:inherit;font:inherit;font-weight:600;cursor:pointer}.mirc-go:disabled{opacity:.5}.mirc-err{margin:.45rem 0 0;padding:.4rem .7rem;border-radius:10px;background:#FCE8E6;color:#8C1D18;font-size:.9rem}.mirc-on{display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:.25rem .75rem;margin:0;font-weight:600}.mirc-on>span::before{content:"\\2713\\00a0"}.mirc-on .mirc-link{font-weight:400}';
      document.head.appendChild(css);
      box.classList.add('mirc');
      box.addEventListener('click', function (e) {
        var a = e.target.closest && e.target.closest('[data-a]'); if (!a) return;
        if (a.dataset.a === 'open') { opened = true; draw(); box.querySelector('input').focus(); }
        if (a.dataset.a === 'remove') { applied = null; opened = false; error = ''; o.first = ''; changed(); }
        if (a.dataset.a === 'apply') { var v = box.querySelector('input').value.replace(/\s+/g, '').toUpperCase(); if (v && !busy) check(v); }
      });
      // Enter applies the code; it must not send the order.
      box.addEventListener('keydown', function (e) { if (e.key === 'Enter' && e.target.tagName === 'INPUT') { e.preventDefault(); var b = box.querySelector('[data-a=apply]'); if (b) b.click(); } });
      var p = o.phone && document.getElementById(o.phone);
      if (p) p.addEventListener('input', refresh);
      if (window.MIR_PAUSED) pauseForm(window.MIR_PAUSED);
      refresh();
    },
    refresh: refresh,
    code: function () { return applied ? applied.code : null; },
    after: function (amount) { return round(amount - off(amount)); },
    text: function (amount) {
      if (!applied) return '';
      var m = moneyOf(off(amount));
      return m ? T.off + ' ' + applied.code + ': −' + m : T.code + ': ' + applied.code;
    }
  };
}());
