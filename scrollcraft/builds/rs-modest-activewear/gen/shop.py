# The shop: one product on a stage (photos big, Tzvi's product-page rule 3k), then the order in three steps
# on the same page. Sizes and colours are not in the record, so the order asks for them in words.

PHOTOS = [('skirts', 'A black and a white RS sports skirt on a stone plinth beside an RS bag', 1023, 1209),
          ('shop', 'Inside the RS store: a rail of skirts beside the counter', 1800, 2400),
          ('bag', 'The white RS shopping bag with black ribbon handles', 1109, 1330)]
IMGS = ''.join(f'        <img class="{"on" if i == 0 else ""}" data-p="{k}" src="assets/{k}.webp" alt="{a}" width="{w}" height="{h}"{" fetchpriority=\"high\"" if i == 0 else " loading=\"lazy\""}>\n' for i, (k, a, w, h) in enumerate(PHOTOS))
THUMBS = ''.join(f'<button type="button" data-p="{k}" aria-pressed="{"true" if i == 0 else "false"}" aria-label="Photo {i + 1} of 3"><img src="assets/{k}.webp" alt="" width="{w}" height="{h}" loading="lazy"></button>' for i, (k, a, w, h) in enumerate(PHOTOS))
BIN = '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>'

SHOP = f'''  <form id="form" novalidate>
  <section class="stage" id="skirt" aria-labelledby="h-shop">
    <div class="wrap st-grid">
      <div class="st-ph-w">
        <div class="st-ph" id="st-ph">
{IMGS}        </div>
        <div class="st-th" role="group" aria-label="Photos of the skirt">{THUMBS}</div>
      </div>
      <div class="st-info">
        <p class="caps">Shop · Women's activewear</p>
        <h1 id="h-shop">Premium Modest Sports Skirt</h1>
        <p class="st-desc">Premium sports skirt with built-in leggings.</p>
        <div class="ptag" aria-label="320 shekels"><span class="sym">₪</span>320</div>
        <div class="st-buy">
          <span class="step" role="group" aria-label="How many skirts"><button type="button" data-d="-1" aria-label="One fewer">−</button><output id="st-n">1</output><button type="button" data-d="1" aria-label="One more">+</button></span>
          <button class="btn" type="button" id="st-add"><span>Add to basket, ₪320</span></button>
        </div>
        <p class="st-in" id="st-in" aria-live="polite">You write your size and colour in the note in your basket.</p>
        <ul class="facts" aria-label="About the skirt">
          <li><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 3h10l1.5 18h-5L12 10l-1.5 11h-5z"/></svg>Built-in leggings</li>
          <li><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="5" r="2"/><path d="M12 8v6M12 14l-4 6M12 14l4 6M6 11l6-3 6 3"/></svg>Designed for movement and everyday wear</li>
        </ul>
      </div>
    </div>
  </section>

  <section class="order-sec" id="order" aria-labelledby="h-basket">
    <div class="wrap">
      <ol class="osteps" id="steps" aria-label="Order steps">
        <li class="is-now" aria-current="step"><button type="button" data-go="1">Step 1: Your basket</button></li>
        <li><button type="button" data-go="2">Step 2: Collecting</button></li>
        <li><button type="button" data-go="3">Step 3: Your details</button></li>
      </ol>
      <div class="form">
        <div>
          <div class="card ostep" data-s="1">
            <h2 id="h-basket">Your basket</h2>
            <ul class="blist" id="sum-list"><li class="bl"><span>Your basket is empty. Add the skirt above.</span></li></ul>
            <div id="w-sc"><label class="f" for="sc">Note: your size and colour</label><input class="fld" id="sc" maxlength="120" placeholder="Write your size and colour" autocomplete="off"><p class="err" id="e-sc"></p></div>
            <p class="err" id="e-items"></p>
            <a class="lnk more" href="#skirt">Back to the skirt</a>
          </div>
          <div class="card ostep" data-s="2" hidden>
            <h2>Collecting your order</h2>
            <div class="opts" id="opts" role="radiogroup" aria-label="Collecting">
              <label class="opt"><input type="radio" name="how" value="collect" checked><span><b>Collect from the store</b><small>31 King George Street, Jerusalem</small></span></label>
              <!-- delivery waits for Ravit's answer (message-to-ravit.md, question 3): not offered until she says she delivers -->
            </div>
            <p class="err" id="e-how"></p>
            <div id="w-addr" hidden><label class="f" for="addr">Delivery address</label><input class="fld" id="addr" autocomplete="street-address" maxlength="160" placeholder="Street, number, city"><p class="err" id="e-addr"></p></div>
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
          <ul class="sum-mini" id="sum-mini"><li><span>Nothing yet</span></li></ul>
          <p class="sum-where" id="sum-where" hidden></p>
          <div class="total"><span>Total</span><span id="total">₪0</span></div>
          <button class="btn" id="send" type="submit"><span>Continue to collecting</span></button>
          <button class="back" id="back" type="button" hidden>Back</button>
          <p class="note" id="send-note">Next: collect from the store or delivery.</p>
          <p class="sent" id="sent" role="status" hidden></p>
          <a class="lnk keep" href="#skirt">Keep shopping</a>
        </aside>
      </div>
    </div>
  </section>
  </form>
'''

SHOP_JS = '<script>\n' + open('gen/shop.js', encoding='utf8').read().replace('__BIN__', BIN.replace("'", "\\'")) + '</script>\n'

# the old addresses keep working
REDIRECT = '''<!doctype html><html lang="en"><head><meta charset="utf-8"><title>RS Modest Activewear</title>
<meta name="robots" content="noindex"><link rel="canonical" href="shop.html">
<script>location.replace('shop.html' + location.search + location.hash);</script>
<meta http-equiv="refresh" content="0; url=shop.html"></head><body><a href="shop.html">The shop</a></body></html>
'''
