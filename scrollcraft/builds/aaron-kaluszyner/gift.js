// Gift cards bought right on a designed site (page rules 3x.14; Tzvi, 5 Nov 2026: "add gift card purchases straight
// from the page and not through a separate link"). sitekit's SITE.gift_section() writes the hidden section; this asks
// the shop and fills it in only when the owner has gift cards switched on in their dashboard, so turning them on later
// needs no rebuild. Same order as the /gift-cards page (backend routes/marketplace/gift_cards.py): no account, no payment
// on the site, the card goes out once the business confirms it was paid. Copy into the build beside site.js.
(function () {
  var sec = document.querySelector('[data-mir-gift]');
  if (!sec) return;
  var API = /^(localhost|127\.0\.0\.1)$/.test(location.hostname) ? 'http://localhost:8001/api' : '/api';
  var slug = encodeURIComponent(sec.getAttribute('data-mir-gift'));
  var he = document.documentElement.lang === 'he';
  var T = he ? {
    body: function (y) { return 'בוחרים סכום ולמי הוא מיועד. משלמים לנו ישירות, ואחרי שאנחנו מאשרים הכרטיס נשלח במייל עם הקוד. בתוקף ל־' + y + ' שנים.'; },
    amount: 'סכום', other: 'סכום אחר', forWho: 'למי זה?', elseOne: 'למישהו אחר', self: 'לעצמי',
    toName: 'השם שלו או שלה', toEmail: 'המייל שלו או שלה (לא חובה)', toEmailNote: 'בלי מייל, הכרטיס יגיע אליכם כדי שתעבירו אותו.', message: 'הקדשה על הכרטיס (לא חובה)',
    name: 'השם שלכם', email: 'המייל שלכם', phone: 'טלפון, כדי לתאם תשלום (לא חובה)',
    send: function (v) { return 'הזמנת כרטיס מתנה על סך ' + v; }, sendPlain: 'הזמנת כרטיס המתנה', noCharge: 'לא מחויבים באתר. את התשלום מתאמים איתנו.',
    range: function (a, b) { return 'בין ₪' + a + ' ל־₪' + b; }, failed: 'לא נשלח. בדקו את הפרטים ונסו שוב.',
    doneTitle: 'הזמנת כרטיס המתנה התקבלה', doneBody: 'משלמים לנו ישירות. מיד אחרי שאנחנו מאשרים, הכרטיס נשלח במייל עם הקוד.', see: 'לכרטיס המתנה שלכם'
  } : {
    body: function (y) { return 'Choose an amount and who it is for. You pay us directly; once we confirm, the card is emailed with its code. Valid for ' + y + ' years.'; },
    amount: 'Amount', other: 'Other amount', forWho: 'Who is it for?', elseOne: 'Someone else', self: 'Myself',
    toName: 'Their name', toEmail: 'Their email (optional)', toEmailNote: 'Without their email, the card comes to you to pass on.', message: 'A message on the card (optional)',
    name: 'Your name', email: 'Your email', phone: 'Phone, so we can arrange payment (optional)',
    send: function (v) { return 'Order a ' + v + ' gift card'; }, sendPlain: 'Order the gift card', noCharge: 'Nothing is charged on this site. You arrange payment with us.',
    range: function (a, b) { return '₪' + a + ' to ₪' + b; }, failed: 'Could not send. Check your details and try again.',
    doneTitle: 'Your gift card is ordered', doneBody: 'Pay us directly. As soon as we confirm, the card is emailed with its code.', see: 'See your gift card'
  };
  function el(tag, attrs, text) {
    var e = document.createElement(tag);
    for (var k in attrs || {}) e.setAttribute(k, attrs[k]);
    if (text != null) e.textContent = text;
    return e;
  }
  function field(id, label, attrs) {
    var w = el('div', { 'class': 'gift-field' });
    w.appendChild(el('label', { 'for': id }, label));
    var tag = attrs.rows ? 'textarea' : 'input';
    attrs.id = id; attrs.name = id;
    w.appendChild(el(tag, attrs));
    return w;
  }
  fetch(API + '/marketplace/gift-cards/' + slug).then(function (r) { return r.ok ? r.json() : null; }).then(function (d) {
    if (!d || !d.amounts || !d.amounts.length) return;
    var box = sec.querySelector('[data-mir-gift-box]');
    box.appendChild(el('p', { 'class': 'lede' }, T.body(d.valid_years)));
    var form = el('form', { 'class': 'gift-form' });
    box.appendChild(form);

    // amount: tiles, the second one ready chosen, as the /gift-cards page does (rules 3k.10)
    var fs = el('fieldset'); fs.appendChild(el('legend', null, T.amount));
    var tiles = el('div', { 'class': 'gift-tiles' }); fs.appendChild(tiles); form.appendChild(fs);
    var chosen = d.amounts[Math.min(1, d.amounts.length - 1)], otherWrap = field('gift-other', T.other, { type: 'number', inputmode: 'numeric', min: d.min, max: d.max, placeholder: T.range(d.min, d.max) });
    otherWrap.hidden = true; fs.appendChild(otherWrap);
    var other = otherWrap.querySelector('input'), send;
    function value() { return chosen === 'other' ? Number(other.value) : chosen; }
    function valid() { var v = value(); return v >= d.min && v <= d.max; }
    function label() { send.textContent = valid() ? T.send('₪' + Math.round(value())) : T.sendPlain; }
    function tile(v, text) {
      var b = el('button', { type: 'button', 'class': 'gift-tile', 'aria-pressed': String(v === chosen) }, text);
      b.addEventListener('click', function () {
        chosen = v;
        [].forEach.call(tiles.children, function (t) { t.setAttribute('aria-pressed', String(t === b)); });
        otherWrap.hidden = v !== 'other'; other.required = v === 'other'; if (v === 'other') other.focus();
        label();
      });
      tiles.appendChild(b);
    }
    d.amounts.forEach(function (a) { tile(a, '₪' + a); });
    if (d.custom) tile('other', T.other);
    other.addEventListener('input', function () { label(); });

    // who it is for
    var who = el('fieldset'); who.appendChild(el('legend', null, T.forWho));
    var forSelf = false, sw = el('div', { 'class': 'gift-switch', role: 'group' }), to = el('div', { 'class': 'gift-to' });
    [[false, T.elseOne], [true, T.self]].forEach(function (o) {
      var b = el('button', { type: 'button', 'aria-pressed': String(o[0] === forSelf) }, o[1]);
      b.addEventListener('click', function () {
        forSelf = o[0]; to.hidden = forSelf; form.querySelector('#gift-to-name').required = !forSelf;
        [].forEach.call(sw.children, function (x) { x.setAttribute('aria-pressed', String(x === b)); });
      });
      sw.appendChild(b);
    });
    who.appendChild(sw);
    to.appendChild(field('gift-to-name', T.toName, { maxlength: 80, autocomplete: 'off', required: '' }));
    to.appendChild(field('gift-to-email', T.toEmail, { type: 'email', maxlength: 200, autocomplete: 'off' }));
    to.appendChild(el('p', { 'class': 'gift-note' }, T.toEmailNote));
    to.appendChild(field('gift-message', T.message, { rows: 3, maxlength: 400, dir: 'auto' }));
    who.appendChild(to); form.appendChild(who);

    // the buyer
    form.appendChild(field('gift-name', T.name, { maxlength: 80, autocomplete: 'name', required: '' }));
    form.appendChild(field('gift-email', T.email, { type: 'email', maxlength: 200, autocomplete: 'email', required: '' }));
    form.appendChild(field('gift-phone', T.phone, { type: 'tel', maxlength: 20, autocomplete: 'tel' }));

    var msg = el('p', { 'class': 'gift-msg', role: 'status' }); form.appendChild(msg);
    send = el('button', { type: 'submit', 'class': 'btn' }); form.appendChild(send); label();
    form.appendChild(el('p', { 'class': 'gift-note' }, T.noCharge));

    var val = function (id) { return (form.querySelector('#' + id).value || '').trim(); };
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      msg.textContent = '';
      send.setAttribute('aria-busy', 'true');
      fetch(API + '/marketplace/gift-cards/' + slug + '/buy', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          amount: Math.round(value()), buyer_name: val('gift-name'), buyer_email: val('gift-email'), buyer_phone: val('gift-phone') || null, for_self: forSelf,
          to_name: forSelf ? null : val('gift-to-name'), to_email: forSelf ? null : (val('gift-to-email') || null),
          message: forSelf ? null : (val('gift-message') || null), lang: he ? 'he' : 'en'
        })
      }).then(function (r) { return r.json().then(function (j) { return { ok: r.ok, j: j }; }); }).then(function (r) {
        send.removeAttribute('aria-busy');
        if (!r.ok) {
          var x = r.j && r.j.detail;
          msg.textContent = typeof x === 'string' ? x : (Array.isArray(x) && x[0] && x[0].msg ? x[0].msg.replace(/^Value error, /, '') : T.failed);
          return;
        }
        var done = el('div', { 'class': 'gift-done', role: 'status' });
        done.appendChild(el('h3', null, T.doneTitle));
        done.appendChild(el('p', null, T.doneBody));
        if (d.note) done.appendChild(el('p', { dir: 'auto' }, d.note));
        (d.payment_links || []).forEach(function (p) {
          if (/^https:\/\//.test(p.url)) done.appendChild(el('a', { 'class': 'btn-line', href: p.url, target: '_blank', rel: 'noopener noreferrer nofollow' }, p.label));
        });
        var see = el('a', { 'class': 'gift-see', href: 'https://myisraelrental.com' + r.j.path }, T.see);
        done.appendChild(see);
        box.innerHTML = ''; box.appendChild(done);
        done.setAttribute('tabindex', '-1'); done.focus();
      }).catch(function () { send.removeAttribute('aria-busy'); msg.textContent = T.failed; });
    });
    sec.hidden = false;
  }).catch(function () { /* the section stays hidden */ });
})();
