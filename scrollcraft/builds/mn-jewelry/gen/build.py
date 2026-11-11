"""M and N Jewelry: home, shop (the pieces and the order on one page), contact. Run from anywhere:
python gen/build.py   (facts only from src/record.json and their flyer, src/owner/p01.jpg; open questions in OWNER-QUESTIONS.md)"""
import json, os, sys
os.chdir(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..'))
sys.path.insert(0, '../../starter'); import sitekit as kit

WA = '15167904616'                      # their listing's WhatsApp (whatsapp_confirmed), the number on their flyer
GIG = '437e8b9b-e536-418a-9e20-19bf6768fa92'
# their four products (record: two "rings", two "jewelry", each $2,000 USD); the photos are the ones the owner put on each
P1, P2, P3, P4 = '259cea53a30a', '80e61c425af4', '2a0f5884ad9e', 'f6ce9201e19b'

# every piece shown, one per kind from all twenty photos (rules 3o.6; duplicates kept as a second photo of the same piece).
# names describe only what the photo shows: no metal, carat or natural/lab claim (BRAND.md bans; OWNER-QUESTIONS.md asks)
ITEMS = [
    # key, product, name, kind, photos, alt
    # the round solitaire on white (p03) is shot on a mirror that does not come away on the dark ground: off until reshot
    ('solitaire-yellow', P1, 'Round solitaire, pavé band', 'Rings', ['p04'], 'A round diamond solitaire on a band set with small diamonds'),
    ('princess', P1, 'Princess-cut solitaire', 'Rings', ['p05'], 'A square princess-cut diamond on a band set with small diamonds'),
    ('marquise', P1, 'Marquise halo ring', 'Rings', ['p06'], 'A marquise diamond inside a halo of small diamonds'),
    ('baguette', P1, 'Baguette eternity band', 'Rings', ['p07'], 'A band set all round with baguette diamonds'),
    ('five-stone', P2, 'Five-stone band', 'Rings', ['p08'], 'A band set with five round diamonds'),
    # the solitaire in its velvet box (p09) is shown on the home page as it was photographed; its shank does not cut out
    ('twist', P2, 'Twist solitaire', 'Rings', ['p10'], 'A round diamond held where the band twists round it'),
    # the half eternity band (p12, p13) is photographed on fur that does not come away cleanly: it waits for a clean photo
    ('pendant', P3, 'Solitaire pendant', 'Necklaces', ['p14'], 'A single round diamond on a fine chain'),
    ('drops', P3, 'Pear-drop station necklace', 'Necklaces', ['p15'], 'A fine chain with small pear-shaped diamonds spaced along it'),
    ('halo-pendant', P3, 'Halo pendant', 'Necklaces', ['p16'], 'A round diamond pendant inside a halo of small diamonds'),
    ('tennis', P3, 'Tennis bracelet', 'Bracelets', ['p17'], 'A tennis bracelet of round diamonds'),
    # the bangle (p20) waits for a clean photo: it leans through a clear block that does not cut away (OWNER-QUESTIONS)
    ('huggies', P4, 'Diamond huggie earrings', 'Earrings', ['p19'], 'A pair of huggie earrings set with diamonds'),
]
SIZES = {f'p{n:02d}': s for n, s in [(2, (1000, 764)), (3, (1000, 990)), (4, (1000, 939)), (5, (1000, 676)), (6, (1000, 985)), (7, (1000, 965)),
         (8, (1000, 995)), (9, (1000, 713)), (10, (1000, 993)), (11, (1000, 962)), (12, (1000, 991)), (13, (1000, 969)), (14, (1000, 800)),
         (15, (1000, 968)), (16, (1000, 982)), (17, (1000, 507)), (18, (1000, 548)), (19, (1000, 979)), (20, (1000, 837)), (21, (1000, 958))]}
# each photo's own ground at its edges, so a photo of another shape sits whole in its square on its own colour (never cropped)
GROUND = {'p02': '#CED3D5', 'p03': '#FEFEFE', 'p04': '#D7D9DE', 'p05': '#F2F5FC', 'p06': '#D8D3D0', 'p07': '#707273', 'p08': '#B0A8A5',
          'p09': '#414454', 'p10': '#DCDFE1', 'p11': '#A4A89E', 'p12': '#D5D4D3', 'p13': '#D5D4D1', 'p14': '#C1BCB3', 'p15': '#A5A09A',
          'p16': '#282423', 'p17': '#45454C', 'p18': '#4C4A4B', 'p19': '#9C8E7F', 'p20': '#C6CBCE'}
PRICE = 2000
# the gold each photo was taken in (gen/studio_edit.py makes the other two, gen/studio-brief.md): their own photo is shown wherever it exists
GOLD_OF = {'p04': 'yellow', 'p14': 'rose'}
GOLD_OF = {f'p{n:02d}': GOLD_OF.get(f'p{n:02d}', 'white') for n in range(2, 22)}

SITE = kit.Site(
    name='M and N Jewelry', short='M and N Jewelry', slug='m-and-n-jewelry',
    pages=[('index', 'Home'), ('shop', 'Shop'), ('contact', 'Contact')],
    contacts=[kit.Contact('whatsapp-only', '+1 516-790-4616')],
    fonts='family=Italiana&family=Assistant:wght@400;600;700',
    cta=('shop.html', 'Shop jewelry'), bar=('Natural and lab diamonds', 'By appointment in Jerusalem'),
    mark_html='<img src="assets/mark-gold.webp" alt="" width="168" height="117">',
    about='Timeless, elegant fine jewelry for women who love classic luxury with a modern touch.',
    ordering=('Ordering', ['Message us to order', 'By appointment in Jerusalem', 'We also buy gold']),
    place='Jerusalem', close_title='Find something you will love and wear for years', ld_type='JewelryStore')

TITLE = 'M and N Jewelry · Natural and lab diamond jewelry, Jerusalem'
DESC = 'Diamond rings, eternity bands, tennis bracelets, necklaces and earrings in natural and lab diamonds, by appointment in Jerusalem. We also buy gold.'
OG = 'og.webp'
P = lambda n=PRICE: 'From ' + kit.price(f'{n:,}', 'USD')   # Tzvi, 8 Nov 2026: the price starts at $2,000 and grows with the gold and diamonds
ARW = '<span class="arw" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M6 12h11M12 7l5 5-5 5"/></svg></span>'
STONE = '<div class="stone" aria-hidden="true"><i></i></div>\n'   # the touch: a fine line with one round stone set in it


def img(ph, alt='', lazy=True, cls=''):
    c = f' class="{cls}"' if cls else ''
    return f'<img{c} src="assets/{ph}-st.webp" alt="{alt}" width="1000" height="1000"{" loading=\"lazy\"" if lazy else ""}>'


def finish(page):
    """site category (rule 3t), arrows drawn (the font has none), the closing band's stone"""
    f = f'{page}.html'
    s = open(f, encoding='utf8').read()
    s = s.replace('<meta charset="utf-8">', '<meta charset="utf-8">\n<meta name="site-category" content="fashion-shop">', 1)
    if page == 'index':   # rules 3g.18 (what they offer) and 3g.19 (the button in the product's own colour: the gold of their pieces)
        s = s.replace('<meta name="site-category" content="fashion-shop">', '<meta name="site-category" content="fashion-shop">\n<meta name="offers" content="diamond jewelry">\n<meta name="product-colour" content="#C2A46E" data-from="assets/p10-st-yellow.webp">', 1)
    s = s.replace('<span class="arw" aria-hidden="true">→</span>', ARW)
    s = s.replace('<header class="top" id="top">', '<header class="top" id="top" data-arrive="0">', 1)
    s = s.replace('  <section class="close"', '  ' + STONE.replace('class="stone"', 'class="stone last"') + '  <section class="close"', 1)
    open(f, 'w', encoding='utf8').write(s)


# ---- home ----
N_FRAMES = len(os.listdir('assets/film/d')) if os.path.isdir('assets/film/d') else 1

def card(key, prod, name, kind, photos, alt):
    return (f'<li class="rev"><a href="shop.html?piece={key}"><span class="ph">{img(photos[0], alt)}</span>'
            f'<span class="tx"><b>{name}</b><span class="k">{kind[:-1] if kind != "Earrings" else "Earrings"}</span>'
            f'<span class="rowp"><span class="pr tag">{P()}</span><span class="see">See this piece {ARW}</span></span></span></a></li>')

FEATURED = ['twist', 'marquise', 'tennis', 'huggies']
FEAT = ''.join(card(*[i for i in ITEMS if i[0] == k][0]) for k in FEATURED)

HOME = f'''  <section class="film open" id="open" aria-labelledby="h-open" data-frames="{N_FRAMES}" data-src="assets/film" data-video="assets/film/opening-{{k}}.mp4" data-marks="0.03,0.94">
    <div class="stage">
      <canvas aria-hidden="true"></canvas>
      <div class="words wrap">
        <h1 id="h-open" data-arrive="1">Diamonds chosen for their sparkle</h1>
        <p class="lede" data-arrive="2">Rings, necklaces, bracelets and earrings, natural and lab diamonds. Classic luxury with a modern touch, in Jerusalem.</p>
        <div class="go" data-arrive="3"><a class="btn" href="shop.html"><span>Shop jewelry</span></a>
          <ul class="btn-facts"><li>{P()}</li><li>Natural and lab diamonds</li><li>By appointment in Jerusalem</li></ul></div>
        <p class="hint" data-arrive="4">Scroll to see the stone</p>
      </div>
      <p class="end-line"><span>Quality.</span> <span>Sparkle.</span> <span>Comfort.</span></p>
      <picture class="end-ring" aria-hidden="true"><source media="(max-width: 760px)" srcset="assets/film/ring-m.webp"><img src="assets/film/ring-d.webp" alt="" width="1920" height="1080" loading="lazy"></picture>
      <div class="end wrap"><a class="btn" href="shop.html"><span>Shop jewelry</span></a></div>
    </div>
  </section>

  <section class="velvet" aria-labelledby="h-chosen">
    <div class="wrap">
      <figure class="rev"><img src="assets/p04-st.webp" alt="A round diamond solitaire in yellow gold" width="1000" height="1000" loading="lazy"></figure>
      <div class="rev">
        <h2 id="h-chosen">Every piece carefully selected</h2>
        <p>For quality, sparkle and comfort. Perfect for gifts, special occasions, weddings, birthdays, or treating yourself.</p>
        <div class="v-links"><a class="lnk" href="shop.html#items">Choose your gold and diamonds {ARW}</a><a class="lnk" href="shop.html#items">See every piece {ARW}</a></div>
      </div>
    </div>
  </section>

  <section class="sec cat-sec" id="pieces" aria-labelledby="h-pieces">
    <div class="wrap">
      <div class="rowhead"><h2 id="h-pieces" class="rev">From our collection</h2><a class="lnk rev" href="shop.html">See every piece {ARW}</a></div>
      <!-- Their shop, live when the site serves this page (mir-catalog.js); the typed-in pieces below show until then. -->
      <div data-mir-catalog data-href="shop.html" data-out="Ask us about this piece">
        <div data-mir-list><ul class="cat">{FEAT}</ul></div>
        <template data-mir-group><div><h3 data-f="group"></h3><ul class="cat" data-f="items"></ul></div></template>
        <template data-mir-item><li class="rev in"><a data-f="link"><span class="ph"><img data-f="img" alt=""></span><span class="tx"><b data-f="name"></b><span class="rowp"><span class="pr tag" data-f="price"></span></span></span></a></li></template>
      </div>
    </div>
  </section>

{STONE}  <section class="sec how" aria-labelledby="h-how">
    <div class="wrap">
      <div>
        <h2 id="h-how" class="rev">Three steps to your piece</h2>
        <p class="lede rev">Ask us about sizing, stones and availability, or for help choosing.</p>
      </div>
      <ol class="hsteps rev">
        <li><div><b>Choose your piece</b><span>Pick the piece, its gold and its diamonds. For a ring, tell us your size, or ask us to help.</span></div></li>
        <li><div><b>Pick a day to see it</b><span>We meet by appointment in Jerusalem. We confirm the day with you.</span></div></li>
        <li><div><b>Send it on WhatsApp</b><span>Your order opens in WhatsApp, written out. Send it and we reply to you.</span></div></li>
      </ol>
    </div>
  </section>

  <section class="gold" aria-labelledby="h-gold">
    <div class="wrap">
      <h2 id="h-gold" class="rev">We also buy gold</h2>
      <p class="rev">Message us on WhatsApp about the gold you would like to sell.</p>
      <a class="btn-line rev" href="https://wa.me/{WA}?text={'Hi M%26N Jewelry, I have gold I would like to sell.'.replace(' ', '%20')}" target="_blank" rel="noopener">WhatsApp us about gold</a>
    </div>
  </section>
{kit.gallery('Photos')}'''

HOME_JS = '<script src="film.js"></script>' + chr(10)
SITE.write('index', TITLE, DESC, OG, HOME, HOME_JS); finish('index')

# ---- shop: every piece and the order on one page (rules 3k) ----
# one grid, in the order rings, necklaces, bracelets, earrings (it fits a short laptop screen; rules 3p.6)
GROUPS = ['<ul class="picks">' + ''.join(f'<li><button type="button" class="pick" data-p="{k}" aria-label="See the {n}, $2,000"><span class="ph">{img(ph[0], "")}</span>'
          f'<span class="nm">{n}</span><span class="pr tag">{P()}</span></button></li>' for k, prod, n, kd, ph, a in ITEMS) + '</ul>']

# the stage: two layers of the same square, so a new gold or piece fades in over the last one (gen/shop.js paint)
STAGE_IMGS = ('<img class="on" src="assets/p10-st-white.webp" alt="A round diamond held where the band twists round it, in white gold" width="1000" height="1000" fetchpriority="high">'
              '<img src="assets/p10-st-white.webp" alt="" width="1000" height="1000">')

THUMBS = ''.join(f'<button type="button" class="thumb" data-p="{k}" aria-pressed="{"true" if k == "twist" else "false"}" aria-label="{n}"><img src="assets/{ph[0]}-st.webp" alt="" width="120" height="120"></button>' for k, prod, n, kd, ph, a in ITEMS)

SHOP = f'''  <form id="form" novalidate>
  <section class="stage-shop" id="items" aria-labelledby="h-shop">
    <div class="wrap st-grid">
      <div class="st-l">
        <div class="st-fr"><div class="st-ph" id="st-ph">{STAGE_IMGS}<span class="st-cue" aria-hidden="true">Look closer</span></div>
        <div class="st-alt" id="st-alt" role="group" aria-label="Photos of this piece"><button type="button" data-ph="p04" aria-pressed="true" aria-label="Photo 1 of 2"><img src="assets/p04-st.webp" alt="" width="120" height="120"></button><button type="button" data-ph="p06" aria-pressed="false" aria-label="Photo 2 of 2"><img src="assets/p06-st.webp" alt="" width="120" height="120"></button></div></div>
        <div class="thumbs" id="thumbs" role="group" aria-label="Our pieces">{THUMBS}</div>
      </div>
      <div class="st-info">
        <p class="kick">Our pieces · <span id="st-kind">Rings</span></p>
        <h1 class="st-h" id="h-shop"><span id="st-name">Round solitaire, pavé band</span></h1>
        <p class="st-desc" id="st-desc">Ask us about sizing, stones and availability.</p>
        <!-- every piece in your choice of gold and diamonds (Tzvi, 9 Nov 2026: change the type of gold on every product):
             the photo shows that piece in that gold, their own photo where they have one (gen/studio_edit.py) -->
        <div class="choice" id="c-gold" role="radiogroup" aria-label="Gold">
          <p class="f">Gold</p>
          <div class="tiles">{''.join(f'<label class="opt"><input type="radio" name="gold" value="{g}"{" checked" if g == "white" else ""}><span><i class="sw sw-{g}" aria-hidden="true"></i>{g.title()}</span></label>' for g in ('white', 'yellow', 'rose'))}</div>
        </div>
        <div class="choice" id="c-dia" role="radiogroup" aria-label="Diamonds">
          <p class="f">Diamonds</p>
          <div class="tiles"><label class="opt"><input type="radio" name="dia" value="Natural diamonds" checked><span>Natural</span></label><label class="opt"><input type="radio" name="dia" value="Lab diamonds"><span>Lab</span></label></div>
        </div>
        <div class="choice" id="c-size" role="radiogroup" aria-label="Ring size">
          <p class="f">Ring size</p>
          <div class="tiles"><label class="opt"><input type="radio" name="size" value="help" checked><span>Help me with sizing</span></label><label class="opt"><input type="radio" name="size" value="know"><span>I know my size</span></label><span id="w-ring" class="off"><label class="sr" for="ring">Your ring size</label><input class="fld" id="ring" maxlength="20" autocomplete="off" placeholder="Your size"></span></div>
          <p class="err" id="e-ring"></p>
        </div>
        <p class="st-sum" aria-live="polite"><span class="sr">Your piece: </span><span id="st-sum">Twist solitaire in white gold with natural diamonds</span></p>
        <div class="st-buy">
          <span class="pr tag" id="st-price">{P()}</span>
          <button class="btn" type="button" id="st-add"><span>Add to basket, $2,000</span></button>
          <span class="st-in" id="st-in" aria-live="polite"></span>
        </div>
        <p class="st-note">The price grows with the gold and diamonds. We reply on WhatsApp with yours.</p>
      </div>
    </div>
  </section>

  <section class="sec all" aria-labelledby="h-all">
    <div class="wrap">
      <div class="rowhead"><h2 id="h-all">Every piece</h2><p class="lede">Tap a piece to see it larger.</p></div>
      {''.join(GROUPS)}
    </div>
  </section>

  <section class="sec order" id="order" aria-labelledby="h-basket">
    <div class="wrap">
      <ol class="osteps" id="steps" aria-label="Order steps">
        <li class="is-now" aria-current="step"><button type="button" data-go="1">Step 1: Your basket</button></li>
        <li><button type="button" data-go="2">Step 2: Your appointment</button></li>
        <li><button type="button" data-go="3">Step 3: Your details</button></li>
      </ol>
      <div class="form">
        <div>
          <div class="card ostep" data-s="1">
            <h2 id="h-basket">Your basket</h2>
            <ul class="blist" id="sum-list"><li><span>Your basket is empty. Choose a piece above.</span></li></ul>
            <p class="err" id="e-items"></p>
            <a class="more lnk" href="#items">Keep shopping {ARW}</a>
          </div>
          <div class="card ostep" data-s="2" hidden>
            <h2>Your appointment</h2>
            <p class="hint">We meet by appointment in Jerusalem. We confirm the day and place with you on WhatsApp.</p>
            <div id="w-when"><label class="f" for="when">The day you would like</label><input class="fld" id="when" type="date"><p class="err" id="e-when"></p></div>
            <label class="f" for="note">A note for us</label>
            <textarea class="fld" id="note" maxlength="500" placeholder="Your ring size if you know it, a time that suits you, or a question"></textarea>
          </div>
          <div class="card ostep" data-s="3" hidden>
            <h2>Your details</h2>
            <div id="w-me"><label class="f" for="me">Your name</label><input class="fld" id="me" autocomplete="name" maxlength="80"><p class="err" id="e-me"></p></div>
            <div id="w-ph"><label class="f" for="ph">Your phone</label><input class="fld" id="ph" type="tel" autocomplete="tel" maxlength="30"><p class="err" id="e-ph"></p></div>
          </div>
        </div>
        <aside class="card sum" id="c-items" aria-live="polite">
          <h3>Your order</h3>
          <ul id="sum-mini"><li><span>Nothing yet</span></li></ul>
          <p class="sum-where" id="sum-where" hidden></p>
          <div class="total"><span>Total</span><span id="total">$0</span></div>
          <button class="btn" id="send" type="submit"><span>Continue to your appointment</span></button>
          <button class="back" id="back" type="button" hidden>Back</button>
          <p class="note" id="send-note">Next: the day you would like to see it.</p>
          <p class="sent" id="sent" role="status" hidden></p>
          <a class="keep lnk" href="#items">Keep shopping {ARW}</a>
        </aside>
      </div>
    </div>
  </section>
  </form>
'''
SHOP += SITE.gift_section()   # rules 3x.14: hidden until the owner switches gift cards on
SHOP_JS = '<script>\n' + open('gen/shop.js', encoding='utf8').read() + '</script>\n<script src="gift.js"></script>\n'
SITE.write('shop', 'Shop · M and N Jewelry, diamond jewelry in Jerusalem',
           'Diamond rings, necklaces, a tennis bracelet and earrings in white, yellow or rose gold, from $2,000. Choose yours and pick a day to see it in Jerusalem.',
           OG, SHOP, SHOP_JS); finish('shop')

# ---- contact ----
CONTACT = SITE.page_head('Contact', 'Message us to order, or to ask about sizing, stones and availability.') + f'''  <section class="sec contact" aria-label="How to reach us">
    <div class="wrap">
      <div class="contact-tiles">
        <div class="tile"><h2>WhatsApp</h2><p><a class="lnk" href="https://wa.me/{WA}" target="_blank" rel="noopener">+1 516-790-4616</a></p></div>
        <div class="tile"><h2>Where</h2><p>By appointment only, in Jerusalem.</p></div>
        <div class="tile"><h2>We also buy gold</h2><p>Message us about the gold you would like to sell.</p></div>
      </div>
    </div>
  </section>
'''
SITE.write('contact', 'Contact · M and N Jewelry, Jerusalem', 'WhatsApp +1 516-790-4616. M and N Jewelry: natural and lab diamond jewelry by appointment in Jerusalem. We also buy gold.', OG, CONTACT); finish('contact')
_c = open('contact.html', encoding='utf8').read(); open('contact.html', 'w', encoding='utf8').write(_c.replace(f'\n        <p>{SITE.contacts_html()}</p>', '', 1))

# ---- site.js (the pieces, one place for names and prices) and site.css ----
items = {k: {'id': prod, 'name': n, 'kind': kd, 'price': PRICE, 'photos': ph, 'alt': a, 'ring': kd == 'Rings'} for k, prod, n, kd, ph, a in ITEMS}
for _k in items: items[_k]['golds'] = [GOLD_OF[ph] for ph in items[_k]['photos']]
open('site.js', 'w', encoding='utf8').write(open('gen/site.src.js', encoding='utf8').read().replace('__ITEMS__', json.dumps(items, ensure_ascii=False)))
base = open('../../starter/site.css', encoding='utf8').read()
base = base[:base.index('/* ── BELOW HERE')]
base = base.replace("--ground: #FFFFFF; --surface: #F6F6F6; --ink: #111111; --soft: #555555; --accent: #333333; --accent-ink: #FFFFFF; --line: #E5E5E5;",
                    "--ground: #121319; --surface: #1A1C24; --ink: #F2EFE9; --soft: #A9A7A1; --accent: #C2A46E; --accent-ink: #121319; --line: #2C2E38; --velvet: #0B0C10; --gold: #C2A46E;")
base = base.replace("--font-head: Georgia, serif; --font-body: system-ui, sans-serif;", "--font-head: 'Italiana', 'Didot', serif; --font-body: 'Assistant', system-ui, sans-serif;")
base = base.replace("--r: 16px;", "--r: 4px; --shadow: 0 6px 34px rgba(0,0,0,.45);")
open('site.css', 'w', encoding='utf8').write(base + open('gen/own.css', encoding='utf8').read())
print('built')
