"""The shop parts of the starter (12 Nov 2026, rules as a blueprint; tested on Gremier Coffee). sitekit imports them, so
a build calls kit.catalog_js(), kit.card(), kit.shop_page(). They write the shop already right by the rules:

- every card has photo, name, size and price, a real old price struck through with its percent off (3t.2, 3j.10, 3e.10)
- every Add is a button of the same height that says what it adds (3c.6, 3s.29)
- the products sit in data-mir-catalog with list, group and item templates (3m.1)
- the order is three steps beside the order and total, every line removable, saved before WhatsApp (3k.7, 3k.8, 3k.9)
- one real add-on, with Add and No thanks, only if the build names one (3j.2)
- the test hooks the checks use (#st-add, #send, #addr, #me, #ph, #when) are always there (3g.12)
"""
from __future__ import annotations

import json
from html import escape


def money_html(n: float) -> str:
    from sitekit import price
    return price(n)


def catalog_js(items: list[dict], cats: list[str], source: str) -> str:
    """assets/catalog.js: window.CAT = {items, cats}. items: id, name, price, was (or None), cat, size ('1 litre', or
    'from' for a from-price), desc, w, h (the card photo's size, assets/p/<id>.webp), colour (optional stripe)."""
    need = {'id', 'name', 'price', 'cat', 'size', 'desc', 'w', 'h'}
    for it in items:
        miss = need - set(it)
        if miss:
            from sitekit import BuildError
            raise BuildError(f'catalog item {it.get("id")}: missing {sorted(miss)}')
    by = {i['id']: i for i in items}
    for it in items:   # a saving against other items is worked out from their prices, never typed (3j.13, 3j.14)
        if it.get('was_of'):
            n, of = it['was_of']
            it['was'] = n * by[of]['price']
    return f'// {source}\nwindow.CAT = ' + json.dumps({'items': items, 'cats': cats}, ensure_ascii=False) + ';\n'


def prices_json(items: list[dict], sym: str = '₪') -> str:
    """prices.json: every price the site shows, by its product name in the listing, so frontend/server.js puts the
    dashboard's price on the page and in window.MIR_PRICES, which catalog.js reads (3j.14). Names must match the listing."""
    return json.dumps({i['name']: {'was': i['price'], 'sym': sym} for i in items}, ensure_ascii=False, indent=1) + '\n'


def price_row(it: dict) -> str:
    off = ''
    was = ''
    if it.get('was'):
        pct = round((1 - it['price'] / it['was']) * 100)
        was = f' <s aria-label="was {it["was"]:g}">{money_html(it["was"])}</s>'
        off = f'<span class="off">{pct}% off</span>' if pct >= 1 else ''
    size = '' if it['size'] == 'from' else f'<span class="unit">{escape(it["size"])}</span>'
    pre = '<span class="unit">from</span> ' if it['size'] == 'from' else ''
    return f'<p class="pr-row">{pre}<span class="pr">{money_html(it["price"])}</span>{was}{off}{size}</p>'


def card(it: dict, lazy: bool = True) -> str:
    load = ' loading="lazy" decoding="async"' if lazy else ' fetchpriority="high"'
    stripe = f' style="--stripe:{it["colour"]}"' if it.get('colour') else ''
    return (f'<li class="pc"{stripe}><a class="pc-a" data-f="link" data-id="{it["id"]}" href="shop.html?p={it["id"]}">'
            f'<span class="pc-ph"><img data-f="img" src="assets/p/{it["id"]}.webp" alt="{escape(it["name"], True)}" width="{it["w"]}" height="{it["h"]}"{load}></span>'
            f'<span class="pc-t"><b data-f="name">{escape(it["name"])}</b>{price_row(it)}</span></a>'
            f'<button class="btn btn-sm" type="button" data-add="{it["id"]}" aria-label="Add {escape(it["name"], True)}, {it["price"]:g}">Add</button></li>')


def shop_page(site, items: list[dict], cats: list[str], *, popular: str, wa: str, gig: str, lede: str, title_html: str,
              delivery_hint: str, lead_days: int = 1, addon: str = '', addon_line: str = '', note_label: str = 'Anything else') -> str:
    """The shop page body: head, the most popular item's Add (the order test's #st-add), chips, groups, the product sheet,
    the three-step order. wa: the WhatsApp number in digits; gig: the listing's order form id; popular: an item id the
    owner calls most popular; addon: an item id offered once in the basket (3j.2), with addon_line its short reason."""
    by = {i['id']: i for i in items}
    pop = by[popular]
    # the layout follows the number of products (shop research, 13 Nov 2026); shop.js keeps it right for the live list
    size = 'size-s' if len(items) <= 6 else 'size-m' if len(items) <= 40 else 'size-l'
    he = site.lang.startswith('he')
    empty = ('הסל עדיין ריק. נוסיף משהו מהחנות, והוא יופיע כאן.', 'לחנות') if he else \
        ('Your basket is empty. Tap Add on anything above and it shows here.', 'See the shop')
    chips = ''.join(f'<button class="chip" type="button" data-c="{escape(c, True)}">{escape(c)}</button>' for c in cats)
    groups = ''.join(
        f'<div class="grp" data-c="{escape(c, True)}"><h2 data-f="group">{escape(c)}</h2><ul class="cards four" data-f="items">'
        + ''.join(card(i, not (k == 0 and n < 4)) for n, i in enumerate([x for x in items if x['cat'] == c])) + '</ul></div>'
        for k, c in enumerate(cats))
    add_html = ''
    if addon:
        a = by[addon]
        add_html = f'''
            <div class="addon" id="addon" hidden>
              <img src="assets/p/{a['id']}.webp" alt="" width="96" height="64" loading="lazy" decoding="async">
              <p><b>{escape(addon_line)}</b>{escape(a['name'])}, {money_html(a['price'])}</p>
              <span class="addon-b"><button class="btn btn-sm" type="button" data-add="{a['id']}" aria-label="Add {escape(a['name'], True)}">Add</button><button class="btn-line" type="button" id="addon-no">No thanks</button></span>
            </div>'''
    return f'''{site.page_head(title_html, lede)}
  <div class="wrap"><p class="st-top"><button class="btn-line" id="st-add" type="button" data-add="{pop['id']}">Add our most popular, {escape(pop['name'])}, {money_html(pop['price'])}</button></p></div>
  <div class="wrap">
    <div class="filters" id="filters" role="group" aria-label="Go to a kind"><div class="chips">{chips}</div></div>
    <div id="cat" class="{size}" data-mir-catalog data-href="shop.html?add={{name}}" data-other="More from {escape(site.short, True)}" data-out="Out of stock">
      <div data-mir-list>{groups}</div>
      <template data-mir-group><div class="grp"><h2 data-f="group"></h2><ul class="cards four" data-f="items"></ul></div></template>
      <template data-mir-item><li class="pc"><a class="pc-a" data-f="link"><span class="pc-ph"><img data-f="img" alt=""></span><span class="pc-t"><b data-f="name"></b><span data-f="price"></span></span></a></li></template>
    </div>
  </div>
  <dialog class="sheet" id="sheet" aria-labelledby="sh-name">
    <span class="grab" aria-hidden="true"></span>
    <button class="sh-close" id="sh-x" type="button" aria-label="Close">×</button>
    <div class="sh-in">
      <figure class="sh-ph"><img id="sh-img" alt="" width="1200" height="800"></figure>
      <div>
        <h2 id="sh-name"></h2>
        <p class="pr-row"><span class="pr" id="sh-pr"></span><span class="unit" id="sh-size"></span></p>
        <p class="desc" id="sh-desc"></p>
        <div class="buy">
          <span class="step"><button type="button" data-d="-1" aria-label="One fewer">−</button><output id="sh-n">1</output><button type="button" data-d="1" aria-label="One more">+</button></span>
          <button class="btn" id="sh-add" type="button"><span>Add</span></button>
        </div>
      </div>
    </div>
  </dialog>
  <form id="form" novalidate>
  <section class="sec is-empty" id="order" aria-labelledby="h-basket" data-wa="{wa}" data-gig="{gig}" data-name="{escape(site.short, True)}" data-addon="{addon}" data-lead-days="{lead_days}">
    <div class="wrap">
      <p class="o-empty">{escape(empty[0])} <a class="lnk" href="#cat">{escape(empty[1])}</a></p>
      <ol class="osteps" id="steps" aria-label="Order steps">
        <li class="is-now" aria-current="step"><button type="button" data-go="1">Step 1: Your basket</button></li>
        <li><button type="button" data-go="2">Step 2: Delivery or pickup</button></li>
        <li><button type="button" data-go="3">Step 3: Your details</button></li>
      </ol>
      <div class="form">
        <div>
          <div class="card ostep" data-s="1">
            <h2 id="h-basket">Your basket</h2>
            <ul class="blist" id="sum-list"><li><span>Your basket is empty. Choose something above to add it.</span></li></ul>
            <p class="err" id="e-items" role="alert"></p>{add_html}
          </div>
          <div class="card ostep" data-s="2" hidden>
            <h2>Delivery or pickup</h2>
            <div class="ful chips" role="radiogroup" aria-label="Delivery or pickup"><label class="chip"><input type="radio" name="ful" value="delivery" checked>Delivery</label><label class="chip"><input type="radio" name="ful" value="pickup">Pickup</label></div>
            <div id="w-addr"><label class="f" for="addr">Delivery address</label><input class="fld" id="addr" autocomplete="street-address" maxlength="160" placeholder="Street, number, city"><p class="err" id="e-addr" role="alert"></p><p class="hint">{escape(delivery_hint)}</p></div>
            <div id="w-when"><label class="f" for="when" id="when-l">Delivery day</label><input class="fld" id="when" type="date"><p class="hint" id="h-pick" hidden>We send the pickup address on WhatsApp.</p><p class="err" id="e-when" role="alert"></p><button type="button" class="chip" id="first-day" hidden>Choose the first day</button></div>
          </div>
          <div class="card ostep" data-s="3" hidden>
            <h2>Your details</h2>
            <div id="w-me"><label class="f" for="me">Your name</label><input class="fld" id="me" autocomplete="name" maxlength="80"><p class="err" id="e-me" role="alert"></p></div>
            <div id="w-ph"><label class="f" for="ph">Your phone</label><input class="fld" id="ph" type="tel" autocomplete="tel" maxlength="30"><p class="err" id="e-ph" role="alert"></p></div>
            <label class="f" for="note">{escape(note_label)}</label>
            <textarea class="fld" id="note" maxlength="500"></textarea>
          </div>
        </div>
        <aside class="card sum" id="c-items" aria-live="polite">
          <h3>Your order</h3>
          <ul id="sum-mini"><li><span>Nothing yet</span></li></ul>
          <p class="sum-where" id="sum-where" hidden></p>
          <div class="total"><span>Total</span><span id="total">0</span></div>
          <button class="btn" id="send" type="submit"><span>Continue to delivery or pickup</span></button>
          <button class="back" id="back" type="button" hidden>Back</button>
          <p class="note" id="send-note">Next: delivery or pickup, and the day.</p>
          <p class="sent" id="sent" role="status" hidden></p>
          <a class="keep lnk" href="#cat">Keep shopping</a>
        </aside>
      </div>
    </div>
  </section>
  </form>
'''
