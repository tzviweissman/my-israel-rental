"""The skeleton every designed site shares (page rules 3k), so a new build
writes only what is particular to the business: its brand, its sections and
its order or booking page. Learned from Chicken Munch, The Whipped Cup and
Nails by Elisheva, which each rewrote this by hand (19 Oct 2026).

Use from a build's gen/build.py (see scrollcraft/starter/README.md):

    import sys; sys.path.insert(0, '../../starter'); import sitekit as kit
    SITE = kit.Site(name=..., short=..., slug=..., pages=[('index', 'Home'), ...],
                    contacts=[kit.Contact('whatsapp', '+972 55 331 6975'), ...],
                    fonts='family=...', cta=('order.html', 'Order'), bar=('From ₪40', 'Each jar ...'))
    SITE.write('index', title, description, og_image, body_html, tail_html)

What it writes around the body: the head (title, description, og tags,
fonts, site.css), the menu bar (name, pages with aria-current, the one CTA
with a basket count, the phone Menu button), a closing band with every
contact labelled by what it does (3o.4), the footer with page links and the
MyIsraelRental line, the phone bar, and site.js. Copy starter/site.css and
starter/site.js into the build and restyle site.css's tokens.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from html import escape

KINDS = {
    # what each kind of number can do, said on the page (3o.4)
    'whatsapp': ('WhatsApp or call', 'https://wa.me/{d}', True),
    'whatsapp-only': ('WhatsApp', 'https://wa.me/{d}', True),
    'call': ('Call only, no WhatsApp', 'tel:+{d}', False),
    'text': ('Text', 'sms:+{d}', False),
    'email': ('Email', 'mailto:{v}', False),
}


@dataclass
class Contact:
    kind: str
    value: str
    note: str = ''

    @property
    def digits(self) -> str:
        return ''.join(ch for ch in self.value if ch.isdigit())

    def html(self) -> str:
        label, href, new_tab = KINDS[self.kind]
        url = href.format(d=self.digits, v=self.value)
        tgt = ' target="_blank" rel="noopener"' if new_tab else ''
        extra = f' {escape(self.note)}' if self.note else ''
        return f'{label}{extra} <a href="{url}"{tgt}>{escape(self.value)}</a>'


@dataclass
class Site:
    name: str                     # "The Whipped Cup"
    short: str                    # the name in the menu bar
    slug: str                     # the live slug: og image URLs use it
    pages: list[tuple[str, str]]  # [('index', 'Home'), ('menu', 'Menu'), ...]
    contacts: list[Contact]
    fonts: str                    # the Google Fonts css2 query after "?"
    cta: tuple[str, str]          # ('order.html', 'Order'): the one action
    bar: tuple[str, str]          # phone bar: (bold line, small line)
    place: str = 'Jerusalem'      # footer: "<name>, <place>"
    close_title: str = 'Order now'
    mark_html: str = ''           # logo markup before the name, optional
    count: bool = True            # show a basket count on the CTA
    close_extra: str = ''         # a giant line under the closing band
    lang: str = 'en'
    footer_note: str = 'on <a href="/">MyIsraelRental</a>, free to list, no commission'
    og_base: str = field(init=False, default='')

    def __post_init__(self):
        self.og_base = f'https://myisraelrental.com/pages/{self.slug}/assets/'

    def head(self, page: str, title: str, desc: str, og: str) -> str:
        t, d = escape(title), escape(desc)
        return f'''<!doctype html>
<html lang="{self.lang}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>{t}</title>
<meta name="description" content="{d}">
<meta property="og:title" content="{t}">
<meta property="og:description" content="{d}">
<meta property="og:image" content="{self.og_base}{og}">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?{self.fonts}&display=swap" rel="stylesheet">
<link rel="stylesheet" href="site.css">
</head>
<body class="no-js" data-page="{page}">
'''

    def header(self, page: str) -> str:
        cur = ' aria-current="page"'
        links = ''.join(f'<a href="{p}.html"{cur if p == page else ""}>{escape(t)}</a>' for p, t in self.pages)
        count = '<span class="count" id="count" hidden></span>' if self.count else ''
        return f'''<header class="top" id="top">
  <a class="mark" href="index.html" aria-label="{escape(self.short)}, home">{self.mark_html}<span>{escape(self.short)}</span></a>
  <nav class="nav" id="nav" aria-label="{escape(self.short)}">{links}</nav>
  <div class="top-r">
    <a class="btn-line" href="{self.cta[0]}">{escape(self.cta[1])}{count}</a>
    <button class="menu-btn" id="menu-btn" type="button" aria-expanded="false" aria-controls="nav">Menu</button>
  </div>
</header>
<main>
'''

    def contacts_html(self) -> str:
        return '<br>'.join(c.html() for c in self.contacts)

    def footer(self) -> str:
        links = ' · '.join(f'<a href="{p}.html">{escape(t)}</a>' for p, t in self.pages)
        giant = f'\n    <p class="giant" aria-hidden="true">{self.close_extra}</p>' if self.close_extra else ''
        return f'''  <section class="close" aria-label="{escape(self.close_title)}">
    <div class="wrap">
      <div>
        <h2>{escape(self.close_title)}</h2>
        <p>{self.contacts_html()}</p>
      </div>
      <a class="btn" href="{self.cta[0]}">{escape(self.cta[1])} <span class="arw" aria-hidden="true">→</span></a>
    </div>{giant}
  </section>
</main>
<footer class="foot"><nav aria-label="Pages">{links}</nav>{escape(self.name)}, {escape(self.place)} · {self.footer_note}</footer>

<div class="bar" id="bar" aria-hidden="true">
  <p class="p"><b>{escape(self.bar[0])}</b>{escape(self.bar[1])}</p>
  <a class="btn" href="{self.cta[0]}" tabindex="-1">{escape(self.cta[1])}</a>
</div>
<script src="site.js"></script>
'''

    def write(self, page: str, title: str, desc: str, og: str, body: str, tail: str = '') -> None:
        html = self.head(page, title, desc, og) + self.header(page) + body + self.footer() + tail + '</body>\n</html>\n'
        with open(f'{page}.html', 'w', encoding='utf8') as f:
            f.write(html)

    def page_head(self, title_html: str, lede: str) -> str:
        """The top of an inner page (Menu, Order, Contact)."""
        return f'''  <header class="page-head"><div class="wrap">
    <h1>{title_html}</h1>
    <p class="lede">{lede}</p>
  </div></header>
'''


def gallery(title_html: str, kicker: str = '', max_photos: int = 12, seed: str = '') -> str:
    """A place the owner fills with their own photos (page rules 3m). `seed`
    is the photos the page starts with (figure markup); the owner's photos
    replace them once they add some."""
    k = f'<p class="caps rev">{kicker}</p>' if kicker else ''
    return f'''  <section class="sec gallery" id="gallery" aria-labelledby="h-gallery" data-mir-gallery data-max="{max_photos}"{'' if seed else ' hidden'}>
    <div class="wrap">
      {k}<h2 id="h-gallery" class="rev">{title_html}</h2>
      <div class="gal-grid" data-mir-photos>{seed}</div>
      <template data-mir-photo><figure class="gal-ph"><img data-f="img" alt=""></figure></template>
    </div>
  </section>
'''


def faq(title_html: str) -> str:
    """Questions in the owner's words, filled through Ask for a change (3m)."""
    return f'''  <section class="sec faq" id="faq" aria-labelledby="h-faq" data-mir-faq hidden>
    <div class="wrap">
      <h2 id="h-faq">{title_html}</h2>
      <div class="faq-list" data-mir-qs></div>
      <template data-mir-q><details class="faq-q"><summary data-f="q"></summary><p data-f="a"></p></details></template>
    </div>
  </section>
'''


def price(amount, currency: str = 'ILS') -> str:
    """A price whose sign is set in the body face, so a display font without
    ₪ never shows a broken glyph (3o.5)."""
    sym = {'ILS': '₪', 'USD': '$', 'EUR': '€', 'GBP': '£'}.get(currency, '')
    n = f'{amount:g}' if isinstance(amount, (int, float)) else str(amount)
    return f'<span class="sym">{sym}</span>{n}'
