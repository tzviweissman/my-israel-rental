import io
s = io.open('index.html', encoding='utf8').read()
def sub(a, b):
    global s
    assert s.count(a) == 1, (s.count(a), a[:70]); s = s.replace(a, b)
sub(r"""  var ITEMS = { t913: ['9x13 tray', 260], tgas: ['Gastro tray', 650], rice: ['9x13 rice', 70], lomein: ['Vegetable lo mein', 95] };""",
r"""  // their shop on the site (gen/catalog/load_products.py): the order is saved
  // there first, so it has a tracking link, then written out in WhatsApp
  var GIG = 'd574d800-2e8a-41ce-ae28-f6f03fd6329a';
  var API = /^(localhost|127\.0\.0\.1)$/.test(location.hostname) ? 'http://localhost:8001/api' : '/api';
  var ITEMS = { t913: ['9x13 tray', 260, 'cm913tray001'], tgas: ['Gastro tray', 650, 'cmgastro0001'], rice: ['9x13 rice', 70, 'cm913rice001'], lomein: ['Vegetable lo mein', 95, 'cmlomein0001'] };""")
sub(r"""  document.getElementById('form').addEventListener('submit', function (e) {
    e.preventDefault();
    if (!check(true))""", r"""  var sending = false;
  function save(notes) {
    var ls = []; for (var k in q) if (q[k]) ls.push({ product_id: ITEMS[k][2], qty: q[k] });
    var post = fetch(API + '/marketplace/order-form/' + GIG + '/orders', { method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ lines: ls, fulfilment: 'pickup', date: v('when'), customer_name: v('me'), customer_phone: v('ph'), notes: notes }) })
      .then(function (r) { return r.ok ? r.json() : null; }).catch(function () { return null; });
    // if the site is slow, WhatsApp opens anyway: an order is never lost
    return Promise.race([post, new Promise(function (res) { setTimeout(function () { res(null); }, 5000); })]);
  }
  document.getElementById('form').addEventListener('submit', function (e) {
    e.preventDefault();
    if (sending) return;
    if (!check(true))""")
sub(r"""    window.open('https://wa.me/' + WA + '?text=' + encodeURIComponent(lines.join('\n')), '_blank', 'noopener');""",
r"""    var notes = [st.length ? 'Styles: ' + st.join(', ') : '', v('sauce') ? 'Sauces and notes: ' + v('sauce') : '', 'Sent from the Chicken Munch page by WhatsApp'].filter(Boolean).join('\n');
    sending = true; send.setAttribute('aria-busy', 'true');
    var label = send.firstElementChild.textContent; send.firstElementChild.textContent = 'Sending';
    // opened now, while this still counts as the tap, so no popup blocker stops it
    var tab = window.open('', '_blank');
    save(notes).then(function (saved) {
      var text = lines.join('\n');
      if (saved && saved.track_url) text += '\n\nFollow the order: ' + saved.track_url;
      var url = 'https://wa.me/' + WA + '?text=' + encodeURIComponent(text);
      if (tab) tab.location.href = url; else location.href = url;
      sending = false; send.removeAttribute('aria-busy'); send.firstElementChild.textContent = label;
    });""")
io.open('index.html', 'w', encoding='utf8', newline='').write(s)
print('ok')
