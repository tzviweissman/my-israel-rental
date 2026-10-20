# The shop: the menu and the order on one page (Tzvi, 20 Oct 2026: "they can
# probably be merged into 1", "merge them and make it the standard"; page
# rules 3k). Built from the product pages he sent (docs/inspo/
# product-pages-2026-10-20): one flavour at a time on a stage that takes its
# colour (1, 2), "+" facts beside it (4), quantity and the total in the button
# (8), the packages with their choices under them (rules 3l), then the basket
# and delivery on the same page.

JAR_IMGS = ''.join(f'''        <img class="{'on' if i == 0 else ''}" data-flav="{k}" src="assets/jar-{k}.webp" alt="A jar of {n} on coffee beans" width="500" height="1111"{' fetchpriority="high"' if i == 0 else ' loading="lazy"'}>
''' for i, (k, n) in enumerate([('classic', 'Classic Cloud'), ('caramel', 'Caramel Cloud'), ('vanilla', 'Vanilla Cloud')]))
PICKS = ''.join(f'''          <button type="button" data-flav="{k}" aria-pressed="{'true' if i == 0 else 'false'}"><img src="assets/jar-{k}.webp" alt="" width="500" height="1111" loading="lazy"><span><b>{n}</b>₪{p}</span></button>
''' for i, (k, n, p) in enumerate([('classic', 'Classic Cloud', 40), ('caramel', 'Caramel Cloud', 48), ('vanilla', 'Vanilla Cloud', 48)]))

SHOP = f'''  <form id="form" novalidate>
  <section class="stage" id="jars" data-flav="classic" aria-labelledby="h-shop">
    <div class="wrap st-grid">
      <div class="st-ph">
{JAR_IMGS}      </div>
      <div class="st-info">
        <p class="kick">Shop · Whipped coffee in a jar</p>
        <h1 id="h-shop"><span id="st-name">Classic Cloud</span></h1>
        <p class="st-desc" id="st-desc">Original whipped coffee</p>
        <p class="st-price"><span id="st-price">₪40</span> <small>a jar</small></p>
        <ul class="facts" aria-label="About every jar">
          <li>Makes 3 to 4 coffees</li><li>Kosher certified</li><li>Handcrafted and fresh</li>
        </ul>
        <div class="st-buy">
          <span class="step" role="group" aria-label="How many jars"><button type="button" data-d="-1" aria-label="One fewer">−</button><output id="st-n">1</output><button type="button" data-d="1" aria-label="One more">+</button></span>
          <button class="btn" type="button" id="st-add"><span>Add a jar, ₪40</span></button>
        </div>
        <p class="st-in" id="st-in" aria-live="polite"></p>
        <div class="st-pick" aria-label="Flavours">
{PICKS}        </div>
      </div>
    </div>
  </section>

  <section class="sec shop-packs" id="packs" aria-labelledby="h-packs">
    <div class="wrap">
      <div class="packs-head"><h2 id="h-packs">Weekly packages</h2><p class="lede">Delivered fresh to your door every week.</p></div>
      <div class="plans" id="plans" role="radiogroup" aria-labelledby="h-packs"></div>
      <div class="mix" id="mix" hidden><h5 id="mix-h"></h5><p class="left" id="mix-left"></p><div id="mix-body"></div></div>
    </div>
  </section>

  <section class="sec" id="order" aria-labelledby="h-basket">
    <div class="wrap">
      <!-- the order in steps (Tzvi, 20 Oct 2026: "make steps the rule for order pages", like Blazin
           Boards): one question per screen, the order and its total beside every step -->
      <ol class="osteps" id="steps" aria-label="Order steps">
        <li class="is-now" aria-current="step"><button type="button" data-go="1">Step 1: Your basket</button></li>
        <li><button type="button" data-go="2">Step 2: Delivery</button></li>
        <li><button type="button" data-go="3">Step 3: Your details</button></li>
      </ol>
      <div class="form">
        <div>
          <div class="card ostep" data-s="1">
            <h2 id="h-basket">Your <span class="pink">basket</span></h2>
            <ul class="blist" id="sum-list"><li><span>Nothing yet</span></li></ul>
            <p class="deal" id="deal" hidden><span></span> <button type="button" class="btn-line">Switch</button></p>
            <p class="err" id="e-items"></p>
            <a class="more" href="#jars">Add more jars</a>
          </div>
          <div class="card ostep" data-s="2" hidden>
            <h2>Delivery</h2>
            <p class="deliv">Delivered fresh to your door.</p>
            <div id="w-addr"><label class="f" for="addr">Delivery address</label><input class="fld" id="addr" autocomplete="street-address" maxlength="160" placeholder="Street, number, neighbourhood"><p class="err" id="e-addr"></p></div>
            <div id="w-when"><label class="f" for="when">First delivery day</label><input class="fld" id="when" type="date"><p class="err" id="e-when"></p></div>
          </div>
          <div class="card ostep" data-s="3" hidden>
            <h2>Your details</h2>
            <div id="w-me"><label class="f" for="me">Your name</label><input class="fld" id="me" autocomplete="name" maxlength="80"><p class="err" id="e-me"></p></div>
            <div id="w-ph"><label class="f" for="ph">Your phone</label><input class="fld" id="ph" type="tel" autocomplete="tel" maxlength="30"><p class="err" id="e-ph"></p></div>
            <label class="f" for="note">Anything else</label>
            <textarea class="fld" id="note" maxlength="500"></textarea>
          </div>
        </div>
        <aside class="card sum" id="c-items" aria-live="polite">
          <h3>Your order</h3>
          <ul id="sum-mini"><li><span>Nothing yet</span></li></ul>
          <p class="sum-where" id="sum-where" hidden></p>
          <div class="total"><span>Total</span><span id="total">₪0</span></div>
          <button class="btn" id="send" type="submit"><span>Continue to delivery</span></button>
          <button class="back" id="back" type="button" hidden>Back</button>
          <p class="note" id="send-note">Next: where and when we deliver.</p>
        </aside>
      </div>
    </div>
  </section>
  </form>
'''

SHOP_JS = '<script>\n' + open('gen/shop.js', encoding='utf8').read() + '</script>\n'

# the old addresses keep working (links already shared, the home page's ?pack= and ?jar=)
REDIRECT = '''<!doctype html><html lang="en"><head><meta charset="utf-8"><title>The Whipped Cup</title>
<meta name="robots" content="noindex"><link rel="canonical" href="shop.html">
<script>location.replace('shop.html' + location.search + location.hash);</script>
<meta http-equiv="refresh" content="0; url=shop.html"></head><body><a href="shop.html">The shop</a></body></html>
'''
