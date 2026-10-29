// The parts every page of Bake away shares (page rules 3k): the menu bar and its phone menu, the header and phone bar
// on scroll, the reveals, her menu (one place for names and prices) and a basket kept between pages.
document.body.classList.remove('no-js');
(function () {
  var BASKET_KEY = 'ba-basket-v1';
  // Her menu, prices from her listing (src/record.json). A basket line is "item" or "item~choice~choice":
  // doughnuts are "dn~milky~p05" (kind, flavour), cakes are "cakes~marble".
  var FL = [
    ['p05', 'White glaze, milk chocolate lines'], ['p06', 'Milk chocolate, crushed topping'], ['p07', 'Chocolate, caramel and white lines'], ['p08', 'White glaze, chocolate and white pearls'],
    ['p11', 'Chocolate glaze, rainbow sprinkles'], ['p12', 'White glaze, cookie crumbs'], ['p13', 'Pink glaze, sprinkles'], ['p14', 'Chocolate glaze, crunchy topping']
  ];
  var ITEMS = {
    dn: { name: 'Doughnuts', one: 'Doughnut', price: 16 }, cream: { name: 'Cream doughnuts', one: 'Cream doughnut', price: 18 }, diy: { name: 'DIY kit', one: 'DIY kit', price: 70 },
    tray: { name: 'Trays of cake', one: 'Tray of cake', price: 120 }, challah: { name: 'Challos', one: 'Challah', price: 40 }, buns: { name: 'Cinnamon buns', one: 'Cinnamon buns', price: 50 },
    cakes: { name: 'Cakes', one: 'Cake', price: 45 }, mini: { name: 'Mini cheesecakes', one: 'Mini cheesecakes', price: 120 }, cheese: { name: 'Cheesecakes', one: 'Cheesecake', price: 250 }, babka: { name: 'Babka', one: 'Babka', price: 60 }
  };
  var KIND = { milky: 'milky', parve: 'parve' }, CAKE = { marble: 'marble', honey: 'honey', mocca: 'mocca' };
  function flavour(id) { for (var i = 0; i < FL.length; i++) if (FL[i][0] === id) return FL[i][1]; return ''; }
  function lower(s) { return s.charAt(0).toLowerCase() + s.slice(1); }
  function money(n) { return '₪' + n; }
  function parts(key) { return key.split('~'); }
  function unit(key) { var it = ITEMS[parts(key)[0]]; return it ? it.price : 0; }
  // the line as it is said on the order, the same words on the item, in the basket and in the message (3l.2)
  // her three cream doughnuts, named from her own photos (p02 to p04); names to be confirmed by her (message-to-owner 14)
  var CREAM = [['jam', 'Jam and cream', 'p02'], ['plain', 'Cream', 'p03'], ['choc', 'Chocolate cream', 'p04']];
  function cream(id) { for (var i = 0; i < CREAM.length; i++) if (CREAM[i][0] === id) return CREAM[i][1]; return ''; }
  function label(key) {
    var p = parts(key), it = ITEMS[p[0]]; if (!it) return key;
    if (p[0] === 'dn') return 'Doughnut: ' + lower(flavour(p[2])) + ', ' + (KIND[p[1]] || p[1]);
    if (p[0] === 'cream' && p[1]) return 'Cream doughnut, ' + lower(cream(p[1]));
    if (p[0] === 'cakes') return 'Cake, ' + (CAKE[p[1]] || p[1]);
    return it.one;
  }
  window.BA = { CREAM: CREAM, cream: cream, FL: FL, ITEMS: ITEMS, flavour: flavour, label: label, unit: unit, money: money };

  window.siteBasket = {
    get: function () { try { return JSON.parse(localStorage.getItem(BASKET_KEY)) || {}; } catch (e) { return {}; } },
    set: function (b) { try { localStorage.setItem(BASKET_KEY, JSON.stringify(b)); } catch (e) {} showCount(b); }
  };
  function totals(b) { var n = 0, t = 0; for (var k in b) { n += +b[k] || 0; t += (+b[k] || 0) * unit(k); } return { n: n, t: t }; }
  function showCount(b) {
    var s = totals(b), c = document.getElementById('count');
    if (c) { c.hidden = !s.n; c.textContent = s.n; c.setAttribute('aria-label', s.n + ' in your order'); }
    var bp = document.querySelector('#bar .p');
    if (bp) bp.innerHTML = s.n ? '<b>Basket, ' + money(s.t) + '</b>' + s.n + (s.n > 1 ? ' items' : ' item') : '<b>From ₪16</b>Doughnuts, cakes, challah and more';
  }
  showCount(window.siteBasket.get());

  var nav = document.getElementById('nav'), btn = document.getElementById('menu-btn');
  function setMenu(open) { nav.classList.toggle('shown', open); btn.setAttribute('aria-expanded', open); btn.textContent = open ? 'Close' : 'Menu'; }
  btn.addEventListener('click', function () { setMenu(!nav.classList.contains('shown')); });
  addEventListener('keydown', function (e) { if (e.key === 'Escape') setMenu(false); });
  nav.addEventListener('click', function (e) { if (e.target.closest('a')) setMenu(false); });

  // the phone bar waits for the first screen and is gone while something with its own price and button is on screen
  // (the opening film, the flavour spot, the shop stage, the order form, the closing band), so it never covers them
  var top = document.getElementById('top'), bar = document.getElementById('bar'), form = document.getElementById('order') || document.getElementById('book'), tick = 0;
  var hideWhile = ['film', 'flavours', 'items'].map(function (id) { return document.getElementById(id); }).filter(Boolean), cl = document.querySelector('.close');
  function frame() {
    tick = 0;
    var vh = innerHeight;
    top.classList.toggle('solid', scrollY > 10);
    var busy = hideWhile.some(function (e) { var r = e.getBoundingClientRect(); return r.top < vh * .6 && r.bottom > vh * .4; });
    if (bar) bar.classList.toggle('on', scrollY > vh * .5 && !busy && (!form || form.getBoundingClientRect().top > vh * .75) && (!cl || cl.getBoundingClientRect().top > vh));
  }
  addEventListener('scroll', function () { if (!tick) tick = requestAnimationFrame(frame); }, { passive: true });
  frame();

  var io = new IntersectionObserver(function (es) { es.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } }); }, { rootMargin: '0px 0px -8% 0px' });
  [].forEach.call(document.querySelectorAll('.rev'), function (el) { io.observe(el); });

  // An Add link anywhere (data-add="<item>") puts one in the basket; its href opens the order page.
  [].forEach.call(document.querySelectorAll('[data-add]'), function (a) {
    a.addEventListener('click', function () { var b = window.siteBasket.get(); if (!b[a.dataset.add]) b[a.dataset.add] = 1; window.siteBasket.set(b); });
  });
})();

// a short note that slides in at the top and leaves by itself
window.siteToast = (function () {
  var el = document.createElement('div'), t = 0; el.className = 'toast'; el.setAttribute('role', 'status');
  el.innerHTML = '<span class="tk" aria-hidden="true"></span><span class="tt"></span>'; document.body.appendChild(el);
  return function (msg) { el.lastChild.textContent = msg; el.classList.add('show'); clearTimeout(t); t = setTimeout(function () { el.classList.remove('show'); }, 2200); };
})();
