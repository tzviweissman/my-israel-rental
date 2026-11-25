// Our own reviews, each saying what the person ordered, with "Order this" (rules 3am.5; Nate Herk's coffee site,
// 25 Nov 2026). An option for new sites only. Markup:  <section id="our-reviews" data-business="<business id>"
// data-order="shop.html#order" hidden><h2>…</h2><div class="rv-list"></div></section>
// It stays hidden until there is at least one real review. Only reviews written after a real site order carry
// "Ordered:" and the button (the API sends item names only); every other review shows its words alone. The look
// (.rv-card, .rv-stars, .rv-by, .rv-ordered, .rv-again) is written for each site in its own site.css.
(function () {
  var box = document.getElementById('our-reviews'); if (!box || !box.dataset.business) return;
  var API = /^(localhost|127\.0\.0\.1)$/.test(location.hostname) ? 'http://localhost:8001/api' : '/api';
  var list = box.querySelector('.rv-list') || box, MAX = +box.dataset.max || 6;
  function el(tag, cls, text) { var e = document.createElement(tag); if (cls) e.className = cls; if (text) e.textContent = text; return e; }
  // "/order/<gig>?items=p1~2,p2%3A%3Abig~1" -> the site basket's keys ("<product id>::<option id>") and amounts
  function basketFrom(path) {
    var m = /[?&]items=([^&]+)/.exec(path || ''), b = {}; if (!m) return null;
    m[1].split(',').forEach(function (it) { var p = it.split('~'); var k = decodeURIComponent(p[0]); if (k) b[k] = Math.max(1, Math.min(20, +p[1] || 1)); });
    return b;
  }
  fetch(API + '/businesses/' + encodeURIComponent(box.dataset.business) + '/reviews?sort=newest')
    .then(function (r) { return r.ok ? r.json() : null; }).catch(function () { return null; })
    .then(function (j) {
      var rows = ((j && j.enabled && j.reviews) || []).filter(function (x) { return x.text; }).slice(0, MAX);
      if (!rows.length) return;
      rows.forEach(function (x) {
        var card = el('article', 'rv-card');
        var stars = el('p', 'rv-stars', '★★★★★'.slice(0, Math.round(x.rating)) + '☆☆☆☆☆'.slice(0, 5 - Math.round(x.rating)));
        stars.setAttribute('aria-label', x.rating + ' out of 5'); card.appendChild(stars);
        card.appendChild(el('p', 'rv-text', x.text));
        card.appendChild(el('p', 'rv-by', x.author_display_name + (x.verified ? ', ordered here' : '')));
        if (x.ordered && x.ordered.length) {
          card.appendChild(el('p', 'rv-ordered', 'Ordered: ' + x.ordered.join(', ')));
          var b = basketFrom(x.order_again);
          if (b && window.siteBasket) {
            var a = el('a', 'rv-again', 'Order this'); a.href = box.dataset.order || '#order';
            a.addEventListener('click', function () {
              var cur = window.siteBasket.get(); for (var k in b) cur[k] = Math.max(+cur[k] || 0, b[k]);
              window.siteBasket.set(cur); document.dispatchEvent(new CustomEvent('site:basket'));
              if (window.siteToast) window.siteToast('Added: ' + x.ordered.join(', '));
            });
            card.appendChild(a);
          }
        }
        list.appendChild(card);
      });
      box.hidden = false;
    });
})();
