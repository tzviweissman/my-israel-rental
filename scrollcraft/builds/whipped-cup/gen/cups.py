# "How many coffees?": her recipe card with a servings switch (CONCEPT.md, Effects S6),
# replacing the drawn glass that Tzvi found fake (20 Oct 2026). Every number is hers:
# "each jar makes 3 to 4 coffees", and her jar and package prices.
CUPS = '''  <section class="sec cups" id="coffees" aria-labelledby="h-cups">
    <div class="wrap cups-grid">
      <div class="ph rev"><img src="assets/bottles.webp" alt="Two jars of The Whipped Cup tied with ribbon on pink linen" width="1023" height="1537" loading="lazy"></div>
      <div class="card-r rev">
        <h2 id="h-cups">How many <span class="pink">coffees?</span></h2>
        <div class="serve" role="group" aria-label="How many coffees">
          <span class="glide" aria-hidden="true"></span>
          <button type="button" data-c="4" aria-pressed="false"><b>4</b>coffees</button>
          <button type="button" data-c="7" aria-pressed="true"><b>7</b>one a day</button>
          <button type="button" data-c="14" aria-pressed="false"><b>14</b>two a day</button>
          <button type="button" data-c="21" aria-pressed="false"><b>21</b>three a day</button>
        </div>
        <p class="need" aria-live="polite"><span class="n" id="cups-n">2 to 3</span><span class="u" id="cups-u">jars</span></p>
        <p class="fits" id="cups-fit">Each jar makes 3 to 4 coffees. The Try It Duo has 2 jars, ₪75.</p>
        <a class="btn" id="cups-go" href="order.html?pack=duo">Order the Try It Duo, ₪75</a>
        <ol class="recipe" aria-label="How to make it">
          <li>Fill your glass with ice</li>
          <li>Pour in cold milk</li>
          <li>Add whipped coffee as desired</li>
        </ol>
      </div>
    </div>
  </section>
'''

CUPS_JS = '''<script>
(function () {
  var box = document.querySelector('.serve'); if (!box) return;
  var btns = [].slice.call(box.querySelectorAll('button')), glide = box.querySelector('.glide');
  var n = document.getElementById('cups-n'), u = document.getElementById('cups-u'), fit = document.getElementById('cups-fit'), go = document.getElementById('cups-go');
  // her packages, smallest that covers the most jars needed
  var PACKS = [
    [1, 'order.html?jar=classic', 'Order a jar, from \u20aa40', 'A single jar is \u20aa40, or \u20aa48 for Caramel and Vanilla.'],
    [2, 'order.html?pack=duo', 'Order the Try It Duo, \u20aa75', 'The Try It Duo has 2 jars, \u20aa75.'],
    [4, 'order.html?pack=one', 'Order 4 jars, from \u20aa148', 'One Flavour has 4 jars for \u20aa148, Assorted mixes all three for \u20aa155.'],
    [6, 'order.html?pack=bundle', 'Order the Cloud Bundle, \u20aa220', 'The Cloud Bundle has any 6 jars, \u20aa220.']
  ];
  function pick(b) {
    var c = +b.dataset.c, lo = Math.ceil(c / 4), hi = Math.ceil(c / 3), i = btns.indexOf(b);
    btns.forEach(function (x) { x.setAttribute('aria-pressed', x === b ? 'true' : 'false'); });
    glide.style.transform = 'translateX(' + (i * 100) + '%)';
    n.textContent = lo === hi ? lo : lo + ' to ' + hi; u.textContent = hi === 1 ? 'jar' : 'jars';
    var p = PACKS.filter(function (x) { return x[0] >= hi; })[0], extra = '';
    if (!p) { p = PACKS[PACKS.length - 1]; extra = ' Add ' + (hi - 6 === 1 ? 'a jar' : (hi - 6) + ' jars') + ' to it if you like them strong.'; }
    fit.textContent = 'Each jar makes 3 to 4 coffees. ' + p[3] + extra;
    go.href = p[1]; go.textContent = p[2];
  }
  btns.forEach(function (b) { b.addEventListener('click', function () { pick(b); }); });
  pick(btns[1]);
})();
</script>
'''
