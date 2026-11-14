/*
 * What the standard order page does, on a designed site's own order form (Tzvi, 6 Nov 2026: a new feature reaches every
 * business, the designed sites first). frontend/server.js adds this script to any designed page with a form, so no site
 * has to be rebuilt and a new site has it from the start. If it never arrives, the page works as its own code says.
 *
 *   - a small line under the phone: use a number that gets texts
 *   - under the email: the terms and privacy line
 *   - an email box, required, under the phone (found by input[type=tel][autocomplete=tel]; a page's own email box is used
 *     when it has one). The address is added to what the page sends, on a later page too (KasherMyBnB).
 *   - texts on (data-texts on this script, from the business's switch): no WhatsApp. The order is saved, then the customer
 *     goes to the tracking page; the words on the form stop promising WhatsApp. A save that failed still opens WhatsApp,
 *     so an order is never lost.
 *   - texts on: a small "Have questions? Message us on WhatsApp" under the send button, from the page's own WhatsApp link.
 *   - texts off, on a phone: the WhatsApp app, not the web page in a new tab.
 *
 * The pages open a blank tab inside the tap and fill it once the order is saved, so window.open and fetch are the two
 * places every form passes through.
 * ponytail: the WhatsApp wording is matched by pattern, so a new phrase on a new site needs a line in WORDS.
 */
(function () {
  'use strict';
  var script = document.currentScript;
  var TEXTS = !!(script && script.dataset.texts);
  var PHONE = /iPhone|iPod|Android/i.test(navigator.userAgent);
  var KEY = 'mir-order-email';
  var EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  var SEND = 'a#order, #place, #place2, #placeBar, #send, a[href$="book-review"]';
  var he = function () { return (document.documentElement.lang || '').indexOf('he') === 0; };
  var T = function () {
    return he()
      ? { hint: 'כדאי מספר שמקבל הודעות טקסט, כדי לקבל עדכונים על ההזמנה', consent: ['בשליחה אתם מסכימים ל', 'תנאי השימוש', ' ול', 'מדיניות הפרטיות', '.'], email: 'אימייל', bad: 'צריך אימייל תקין, כדי לקבל עדכונים על ההזמנה' }
      : { hint: 'Use a number that gets texts, so you hear about your order', consent: ['By sending, you agree to the ', 'Terms', ' and the ', 'Privacy policy', '.'], email: 'Your email', bad: 'Add your email, so you hear about your order' };
  };
  var stored = function () { try { return sessionStorage.getItem(KEY) || ''; } catch (e) { return ''; } };
  var input = null;
  var email = function () { return input ? input.value.trim() : stored(); };

  // ── the email and the line under the phone
  function line(cls, css, text) {
    var p = document.createElement('div');
    p.className = cls; p.style.cssText = 'display:block;font-size:12px !important;line-height:1.4;margin-top:4px;text-align:start;' + css; p.textContent = text;
    return p;
  }
  function shell(phone) {
    // the phone's own box: as far up as nothing else to fill is inside it
    var w = phone;
    while (w.parentElement && w.parentElement.querySelectorAll('input,textarea,select').length === 1) w = w.parentElement;
    return w;
  }
  function makeBox(phone, w) {
    var c = w.cloneNode(true);
    [c].concat([].slice.call(c.querySelectorAll('*'))).forEach(function (el) {
      el.removeAttribute('data-mir-key'); el.removeAttribute('data-need'); el.removeAttribute('id');
      if (el.classList.contains('err') || el.classList.contains('msg') || el.classList.contains('mir-hint')) el.remove();
    });
    var box = c.matches('input') ? c : c.querySelector('input');
    box.id = 'mir-email'; box.name = 'email'; box.type = 'email'; box.value = '';
    box.setAttribute('autocomplete', 'email'); box.setAttribute('inputmode', 'email'); box.setAttribute('maxlength', '200'); box.setAttribute('dir', 'ltr');
    if (phone.placeholder) box.placeholder = T().email; else box.removeAttribute('placeholder');
    box.setAttribute('aria-label', T().email);
    var label = c.querySelector('label') || (c.matches('label') ? c : null);
    if (label && label !== c) { label.setAttribute('for', 'mir-email'); label.textContent = T().email; if (label.hasAttribute('data-en')) label.setAttribute('data-en', 'Your email'); }
    w.parentNode.insertBefore(c, w.nextSibling);
    // a page that styles input[type=tel] by type leaves an email box bare (Michal Balloons)
    var from = getComputedStyle(phone), to = getComputedStyle(box);
    ['width', 'height', 'padding', 'border', 'borderRadius', 'background', 'color', 'font', 'boxSizing'].forEach(function (k) { if (from[k] !== to[k]) box.style[k] = from[k]; });
    return box;
  }
  function mount() {
    var phone = document.querySelector('input[type=tel][autocomplete=tel]');
    if (!phone || document.querySelector('.mir-hint')) return;
    var w = shell(phone);
    input = document.querySelector('input[type=email]') || makeBox(phone, w);
    // its own row, so a phone beside the name does not push the two out of line
    w.parentNode.insertBefore(line('mir-hint', 'opacity:.75;font-weight:400;grid-column:1/-1;flex-basis:100%;width:100%', T().hint), w.nextSibling);
    input.required = true;
    // the terms line every form that takes someone's details carries (LoadState.jsx FormConsent, 7 Nov 2026)
    var c = T().consent, agree = line('mir-consent', 'opacity:.75;font-weight:400;grid-column:1/-1;flex-basis:100%;width:100%', c[0]);
    [[c[1], '/terms'], [c[2]], [c[3], '/privacy'], [c[4]]].forEach(function (x) {
      if (!x[1]) { agree.appendChild(document.createTextNode(x[0])); return; }
      var a = document.createElement('a'); a.href = x[1]; a.target = '_blank'; a.textContent = x[0]; a.style.cssText = 'color:inherit;text-decoration:underline'; agree.appendChild(a);
    });
    var iw = shell(input);
    iw.parentNode.insertBefore(agree, iw.nextSibling);
    var own = input.closest('label, .field'), opt = own && own.querySelector('.hint');
    if (opt) opt.remove();
    if (!input.value) input.value = stored();
    input.addEventListener('input', function () {
      clearBad();
      try { sessionStorage.setItem(KEY, input.value.trim()); } catch (e) { /* the box still holds it */ }
    });
  }
  function clearBad() { var b = document.querySelector('.mir-err'); if (b) b.remove(); }
  function refuse(e) {
    if (!input || !input.offsetParent || EMAIL.test(input.value.trim())) return;
    e.preventDefault(); e.stopImmediatePropagation();
    clearBad();
    input.parentNode.insertBefore(line('mir-err', 'color:#b42318;font-weight:600', T().bad), input.nextSibling);
    input.focus();
  }
  document.addEventListener('submit', refuse, true);
  document.addEventListener('click', function (e) {
    if (e.target.closest && e.target.closest(SEND)) refuse(e);
  }, true);

  // ── the email goes with the order; what the server answers is kept for the step after
  var saving = null;
  var realFetch = window.fetch;
  window.fetch = function (url, opts) {
    var u = String(url), key = /\/order-form\/[^/]+\/orders$/.test(u) ? 'customer_email' : /\/gigs\/[^/]+\/book$/.test(u) ? 'contact_email' : /\/quote-requests$/.test(u) ? 'email' : '';
    if (!key || !opts || opts.method !== 'POST') return realFetch.apply(window, arguments);
    try {
      var body = JSON.parse(opts.body);
      if (!body[key] && email()) { body[key] = email(); opts = Object.assign({}, opts, { body: JSON.stringify(body) }); }
    } catch (e) { /* sent as the page wrote it */ }
    var sent = realFetch.call(window, url, opts);
    saving = sent.then(function (r) { return r.ok ? r.clone().json() : null; }).catch(function () { return null; });
    return sent;
  };

  // ── where the customer goes after the order is saved
  function whatsapp(url) {
    var m = /wa\.me\/(\d+)\/?(?:\?text=(.*))?$/.exec(url);
    if (PHONE && m) location.href = 'whatsapp://send?phone=' + m[1] + (m[2] ? '&text=' + m[2] : '');
    else location.href = url;
  }
  function go(url) {
    Promise.resolve(saving).then(function (saved) {
      var track = saved && (saved.track_url || (saved.track_path && 'https://myisraelrental.com' + saved.track_path));
      if (TEXTS && track) location.href = track; else whatsapp(url);
    });
  }
  var realOpen = window.open;
  window.open = function (url, name) {
    if (url !== '' || name !== '_blank' || !(TEXTS || PHONE)) return realOpen.apply(window, arguments);
    return { location: { set href(u) { go(u); } }, close: function () {} };
  };

  // ── texts on: the form's words stop promising WhatsApp. Its contact links are still WhatsApp and keep their words.
  var THEN = 'You get a text and an email with a link to follow it.';
  var WORDS = [
    [/Your (order|request|booking) is open in WhatsApp\.[^.]*\./, 'Your $1 was sent. ' + THEN],
    [/(Your order opens in|Opens|Press send in) WhatsApp[^.]*\.?/, THEN],
    [/[,;]? ?then WhatsApp opens[^.]*\./, '. ' + THEN],
    [/WhatsApp or phone/, 'Phone'],
    [/Opening WhatsApp/, 'Sending'], [/Opened in WhatsApp/, 'Sent'],
    [/\b(Send|send|Order|order|Book|book)([^.]*?) (?:on|by|via) WhatsApp/, '$1$2'],
    [/,? ?we confirm it on WhatsApp/, ', we text you to confirm it'],
    [/\b(confirm|confirmed|added|get it)([^.]*?) on WhatsApp/, '$1$2 by text'],
    [/ בוואטסאפ/, '']
  ];
  function reword(root) {
    if (!/WhatsApp|וואטסאפ/.test(root.textContent || '')) return;
    var walk = document.createTreeWalker(root, NodeFilter.SHOW_TEXT), n;
    while ((n = walk.nextNode())) {
      if (!/WhatsApp|וואטסאפ/.test(n.nodeValue) || !n.parentElement || n.parentElement.closest('script,style,a[href*="wa.me"]:not(#send),title')) continue;
      var v = WORDS.reduce(function (s, r) { return s.replace(r[0], r[1]); }, n.nodeValue);
      if (v !== n.nodeValue) n.nodeValue = v;
    }
  }
  // texts on: the order no longer opens WhatsApp, so a customer with a question gets a small link to ask there
  // (Tzvi, 13 Nov 2026: "if someone has a question they still need a way to text"). The number is the page's own
  // WhatsApp link; a page with none gets no line.
  function ask() {
    var m = null;
    [].some.call(document.querySelectorAll('a[href*="wa.me/"]'), function (l) { return (m = /wa\.me\/(\d+)/.exec(l.getAttribute('href'))); });
    var send = [].slice.call(document.querySelectorAll('form button[type=submit], ' + SEND)).filter(function (e) { return e.id !== 'placeBar'; })[0];
    if (!m || !send || document.querySelector('.mir-ask')) return;
    var p = line('mir-ask', 'opacity:.8;font-weight:400;margin-top:10px;width:100%;flex-basis:100%;grid-column:1/-1', he() ? 'יש שאלות? ' : 'Have questions? ');
    var a = document.createElement('a');
    a.href = 'https://wa.me/' + m[1]; a.target = '_blank'; a.rel = 'noopener';
    a.textContent = he() ? 'כתבו לנו בוואטסאפ' : 'Message us on WhatsApp';
    // a 44px tap target on a phone (padding) without moving the line (the same negative margin)
    a.style.cssText = 'color:inherit;text-decoration:underline;font:inherit;font-size:inherit !important;letter-spacing:inherit;display:inline-block;padding:14px 0;margin:-14px 0';
    p.appendChild(a);
    send.parentNode.insertBefore(p, send.nextSibling);
  }
  function start() {
    mount();
    if (!TEXTS) return;
    ask();
    reword(document.body);
    new MutationObserver(function (list) {
      list.forEach(function (m) { reword(m.target.nodeType === 3 ? m.target.parentNode : m.target); });
    }).observe(document.body, { childList: true, characterData: true, subtree: true });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();
