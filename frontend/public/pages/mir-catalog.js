/*
 * A designed page's catalogue, drawn from the business's own products
 * (Tzvi, 14 Oct 2026: owners mark items out of stock and back in stock,
 * and add or remove items, from the dashboard, and the page follows).
 *
 * frontend/server.js adds this script and the products (#mir-live-products,
 * from GET /api/marketplace/business/<slug>/page-edits) to any page that has
 * a [data-mir-catalog] element. Without them the page keeps the list that
 * was typed into it, so nothing breaks when the API is slow or down.
 *
 * The page supplies the look; this script only fills it in:
 *
 *   <div data-mir-catalog data-wa="972535386042" data-href="order.html?add={name}"
 *        data-msg="Hi, I'd like to order the {name} ({price})."
 *        data-other="More gifts" data-out="Out of stock">
 *     <div data-mir-list> ...the typed-in list, replaced when live data exists... </div>
 *     <template data-mir-group><h3 data-f="group"></h3><ul data-f="items"></ul></template>
 *     <template data-mir-item>
 *       <li><a data-f="link"><img data-f="img" alt=""><b data-f="name"></b><span data-f="price"></span></a></li>
 *     </template>
 *   </div>
 *
 * data-href (optional) sends a tap to the page's order page with the item
 * added; without it a tap opens WhatsApp asking for that item (data-wa).
 *
 * Sections follow each product's "group" in the order they first appear
 * (products with none go under data-other, last). An item out of stock is
 * kept, greyed by the page's own .is-out style, with data-out in place of
 * its price and no link, so nobody asks for what cannot be sold.
 */
(function () {
  var holder = document.getElementById('mir-live-products');
  if (!holder) return;
  var products;
  try { products = JSON.parse(holder.textContent || '[]'); } catch (e) { return; }
  if (!Array.isArray(products) || !products.length) return;

  var SYM = { USD: '$', ILS: '₪', EUR: '€', GBP: '£' };
  function money(n, cur) {
    var v = Number(n);
    var s = Number.isInteger(v) ? String(v) : v.toFixed(2);
    var sym = SYM[cur] || '';
    return sym ? sym + s : s + ' ' + (cur || '');
  }
  function priceText(p, ask) {
    // a price of 0 means the business has not set one: ask, never "$0"
    if (!(Number(p.price) > 0)) return ask;
    var t = money(p.price, p.currency);
    if (p.price_to != null && Number(p.price_to) > Number(p.price)) t += ' to ' + money(p.price_to, p.currency);
    return t;
  }

  document.querySelectorAll('[data-mir-catalog]').forEach(function (cat) {
    var list = cat.querySelector('[data-mir-list]');
    var tGroup = cat.querySelector('template[data-mir-group]');
    var tItem = cat.querySelector('template[data-mir-item]');
    if (!list || !tGroup || !tItem) return;
    var wa = (cat.getAttribute('data-wa') || '').replace(/\D/g, '');
    var href = cat.getAttribute('data-href') || '';
    var msg = cat.getAttribute('data-msg') || '';
    var other = cat.getAttribute('data-other') || '';
    var outLabel = cat.getAttribute('data-out') || 'Out of stock';
    var askLabel = cat.getAttribute('data-ask') || 'Ask for the price';

    var order = [], groups = {};
    products.forEach(function (p) {
      var g = p.group || other;
      if (!groups[g]) { groups[g] = []; order.push(g); }
      groups[g].push(p);
    });
    // the unnamed section always last
    if (groups[other] && order[order.length - 1] !== other) {
      order.splice(order.indexOf(other), 1); order.push(other);
    }

    var frag = document.createDocumentFragment(), n = 0;
    order.forEach(function (g) {
      var gNode = tGroup.content.cloneNode(true);
      var head = gNode.querySelector('[data-f="group"]');
      if (head) { if (g) head.textContent = g; else head.remove(); }
      var ul = gNode.querySelector('[data-f="items"]');
      groups[g].forEach(function (p) {
        var it = tItem.content.cloneNode(true);
        var li = it.firstElementChild;
        var price = priceText(p, askLabel);
        var name = it.querySelector('[data-f="name"]'); if (name) name.textContent = p.name;
        var pr = it.querySelector('[data-f="price"]'); if (pr) pr.textContent = p.in_stock ? price : outLabel;
        var img = it.querySelector('[data-f="img"]');
        if (img) { if (p.image) { img.src = p.image; img.alt = p.name; } else img.remove(); }
        var a = it.querySelector('[data-f="link"]');
        if (a) {
          if (p.in_stock && href) {
            // the page's own order page, with this item added
            a.href = href.replace('{name}', encodeURIComponent(p.name));
            a.setAttribute('aria-label', p.name + ', ' + price + '. Add it to your order');
          } else if (p.in_stock && wa) {
            a.href = 'https://wa.me/' + wa + '?text=' + encodeURIComponent((Number(p.price) > 0 ? msg : msg.replace(' ({price})', '')).replace('{name}', p.name).replace('{price}', price));
            a.target = '_blank'; a.rel = 'noopener';
            a.setAttribute('aria-label', p.name + ', ' + price + '. Ask for it on WhatsApp');
          } else {
            // no link for what cannot be ordered: the same box, as plain content
            var box = document.createElement('div');
            box.className = a.className;
            while (a.firstChild) box.appendChild(a.firstChild);
            a.replaceWith(box);
          }
        }
        if (!p.in_stock && li) li.classList.add('is-out');
        if (li) li.style.setProperty('--i', String(n++ % 4));
        ul.appendChild(it);
      });
      frag.appendChild(gNode);
    });
    list.replaceChildren(frag);
    list.setAttribute('data-mir-live', '');
  });
})();
