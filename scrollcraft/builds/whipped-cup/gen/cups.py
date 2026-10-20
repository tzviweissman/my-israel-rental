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
        <p class="fits" id="cups-fit">Each jar makes 3 to 4 coffees.</p>
        <a class="btn" id="cups-go" href="shop.html?pack=duo">Order the Try It Duo, ₪75</a>
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
  // what to order for the jars needed: the cheapest of her own prices that gives at least that many
  // (the review, 20 Oct 2026: "2 to 3 jars" offered a 4-jar package and never 3 jars)
  function offer(hi) {
    if (hi <= 1) return ['shop.html?jar=classic', 'Order a jar, from ₪40', 'A jar is ₪40, or ₪48 for Caramel and Vanilla.'];
    if (hi === 2) return ['shop.html?pack=duo', 'Order the Try It Duo, ₪75', 'The Try It Duo is 2 jars of any flavours for ₪75.'];
    if (hi === 3) return ['shop.html?jar=classic&n=3', 'Order 3 jars, from ₪120', '3 jars are from ₪120. The weekly packages give 4 jars from ₪148.'];
    if (hi === 4) return ['shop.html?pack=one', 'Order 4 jars, from ₪148', 'One Flavour is 4 jars for ₪148, Assorted mixes all three for ₪155.'];
    if (hi === 5) return ['shop.html?jar=classic&n=5', 'Order 5 jars, from \u20aa200', '5 jars are from \u20aa200. The Cloud Bundle is any 6 jars for \u20aa220.'];
    if (hi <= 6) return ['shop.html?pack=bundle', 'Order the Cloud Bundle, ₪220', 'The Cloud Bundle is any 6 jars for ₪220.'];
    return ['shop.html?pack=bundle', 'Order the Cloud Bundle, ₪220', 'The Cloud Bundle is any 6 jars for ₪220. Add ' + (hi - 6 === 1 ? 'a jar' : (hi - 6) + ' jars') + ' to it for the rest.'];
  }
  function pick(b) {
    var c = +b.dataset.c, lo = Math.ceil(c / 4), hi = Math.ceil(c / 3), i = btns.indexOf(b);
    btns.forEach(function (x) { x.setAttribute('aria-pressed', x === b ? 'true' : 'false'); });
    glide.style.transform = 'translateX(' + (i * 100) + '%)';
    n.textContent = lo === hi ? lo : lo + ' to ' + hi; u.textContent = hi === 1 ? 'jar' : 'jars';
    var o = offer(hi);
    fit.textContent = 'Each jar makes 3 to 4 coffees.';  // the button carries the offer and its price; no sentence about it (Tzvi: "too many words")
    go.href = o[0]; go.textContent = o[1];
  }
  btns.forEach(function (b) { b.addEventListener('click', function () { pick(b); }); });
  pick(btns[1]);
})();
</script>
'''
