"""The skeleton every designed site shares (page rules 3k), so a new build
writes only what is particular to the business: its brand, its sections and
its order or booking page. Learned from Chicken Munch, The Whipped Cup and
Nails by Elisheva, which each rewrote this by hand (19 Oct 2026).

Use from a build's gen/build.py (see scrollcraft/starter/README.md):

    import sys; sys.path.insert(0, '../../starter'); import sitekit as kit
    SITE = kit.Site(name=..., short=..., slug=..., pages=[('index', 'Home'), ...],
                    contacts=[kit.Contact('whatsapp', '+972 55 331 6975'), ...],
                    fonts='family=...', cta=('shop.html#order', 'Basket'), bar=('From ₪40', 'Each jar ...'))
    SITE.write('index', title, description, og_image, body_html, tail_html)

What it writes around the body: the head (title, description, og tags,
fonts, site.css), the menu bar (name, pages with aria-current, the one CTA
with a basket count, the phone Menu button), a closing band with every
contact labelled by what it does (3o.4), the full footer of rules 3v.1 (who they
are, the pages, how ordering works, reach us, the base line), the phone bar,
and site.js. Copy starter/site.css and
starter/site.js into the build and restyle site.css's tokens.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from html import escape
import json
import re

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
    pages: list[tuple[str, str]]  # [('index', 'Home'), ('shop', 'Shop'), ('contact', 'Contact')]: menu and order are one page (rules 3k)
    contacts: list[Contact]
    fonts: str                    # the Google Fonts css2 query after "?"
    cta: tuple[str, str]          # ('shop.html#order', 'Basket'): the one action
    bar: tuple[str, str]          # phone bar: (bold line, small line)
    place: str = 'Jerusalem'      # footer: "<name>, <place>"
    close_title: str = 'Order now'
    mark_html: str = ''           # logo markup before the name, optional
    count: bool = True            # show a basket count on the CTA
    close_extra: str = ''         # a giant line under the closing band
    lang: str = 'en'
    footer_note: str = 'Listed on <a href="https://myisraelrental.com/">MyIsraelRental</a>, free to list, no commission'
    about: str = ''               # footer: one line in the owner's words under the name (3v.1)
    ordering: tuple[str, list[str]] = ('', [])  # footer part: ('Ordering', ['24 to 48 hours ahead', ...]) or ('Visit', [address, hours])
    socials: list[tuple[str, str]] = field(default_factory=list)  # [('Instagram', url)], only real ones
    since: int | None = None      # founding year, for the base line
    year: int = 2026
    ld_type: str = 'LocalBusiness'  # schema.org kind for Google (Bakery, Store, FoodEstablishment...), 3x.8
    ld_extra: dict = field(default_factory=dict)  # more JSON-LD fields from the record (openingHours, makesOffer...)
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
{self.ld(desc, og) if page == 'index' else ''}</head>
<body class="no-js" data-page="{page}">
<a class="skip" href="#main">Skip to content</a>
'''

    def header(self, page: str) -> str:
        cur = ' aria-current="page"'
        links = ''.join(f'<a href="{p}.html"{cur if p == page else ""}>{escape(t)}</a>' for p, t in self.pages)
        count = '<span class="count" id="count" aria-live="polite" hidden></span>' if self.count else ''
        return f'''<header class="top" id="top">
  <a class="mark" href="index.html" aria-label="{escape(self.short)}, home">{self.mark_html}<span>{escape(self.short)}</span></a>
  <nav class="nav" id="nav" aria-label="{escape(self.short)}">{links}</nav>
  <div class="top-r">
    <a class="btn-line" href="{self.cta[0]}" data-label="{escape(self.cta[1], True)}">{escape(self.cta[1])}{count}</a>
    <button class="menu-btn" id="menu-btn" type="button" aria-expanded="false" aria-controls="nav">Menu</button>
  </div>
</header>
<main id="main">
'''

    def ld(self, desc: str, og: str) -> str:
        # the business described for Google (rules 3x.8): only facts the record gives
        d = {'@context': 'https://schema.org', '@type': self.ld_type, 'name': self.name, 'description': self.about or desc,
             'url': f'https://myisraelrental.com/pages/{self.slug}/', 'image': self.og_base + og,
             'address': {'@type': 'PostalAddress', 'addressLocality': self.place, 'addressCountry': 'IL'}}
        tel = next((c.value for c in self.contacts if c.kind in ('whatsapp', 'whatsapp-only', 'call', 'text')), None)
        mail = next((c.value for c in self.contacts if c.kind == 'email'), None)
        if tel: d['telephone'] = tel
        if mail: d['email'] = mail
        if self.socials: d['sameAs'] = [u for _, u in self.socials]
        d.update(self.ld_extra)
        return '<script type="application/ld+json">' + json.dumps(d, ensure_ascii=False).replace('</', '<\\/') + '</script>\n'

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
{self.full_footer()}

<div class="bar" id="bar" aria-hidden="true">
  <p class="p"><b>{escape(self.bar[0])}</b>{escape(self.bar[1])}</p>
  <a class="btn" href="{self.cta[0]}" tabindex="-1">{escape(self.cta[1])}</a>
</div>
<script src="site.js"></script>
'''

    def full_footer(self) -> str:
        # rules 3v.1: parts with a heading, each only when the record fills it, then one base line
        pages = ''.join(f'<a href="{p}.html">{escape(t)}</a>' for p, t in self.pages)
        reach = ''.join(f'<a href="{KINDS[c.kind][1].format(d=c.digits, v=c.value)}"{' target="_blank" rel="noopener"' if KINDS[c.kind][2] else ''}>'
                        f'{escape(KINDS[c.kind][0].split(",")[0])} {escape(c.value)}</a>' for c in self.contacts)
        reach += ''.join(f'<a href="{u}" target="_blank" rel="noopener">{escape(n)}</a>' for n, u in self.socials)
        parts = [f'<div class="fbrand"><a class="fname" href="index.html">{escape(self.short)}</a>'
                 + (f'<p>{escape(self.about)}</p>' if self.about else '')
                 + f'<a class="fcta" href="{self.cta[0]}">{escape(self.cta[1])} <span class="arw" aria-hidden="true">→</span></a></div>',
                 f'<nav aria-label="Pages"><h2>Pages</h2>{pages}</nav>']
        if self.ordering[1]:
            parts.append(f'<div><h2>{escape(self.ordering[0])}</h2>' + ''.join(f'<p>{escape(x)}</p>' for x in self.ordering[1]) + '</div>')
        if reach:
            parts.append(f'<div><h2>Reach us</h2>{reach}</div>')
        since = f' Since {self.since}.' if self.since else ''
        return ('<footer class="foot full">\n  <div class="fgrid">\n    ' + '\n    '.join(parts) + '\n  </div>\n'
                f'  <div class="fbase"><span>© {self.year} {escape(self.name)}.{since}</span><span>{self.footer_note} · '
                '<a href="https://myisraelrental.com/privacy">Privacy</a></span></div>\n</footer>')

    def write(self, page: str, title: str, desc: str, og: str, body: str, tail: str = '') -> None:
        html = self.head(page, title, desc, og) + self.header(page) + body + self.footer() + tail + '</body>\n</html>\n'
        html = guard(page, title, desc, html)
        with open(f'{page}.html', 'w', encoding='utf8') as f:
            f.write(html)

    def gift_section(self, title_html: str = 'Give a gift card') -> str:
        """Gift cards bought right here (3x.14). Hidden until gift.js finds them switched on for this business.
        Put it on the order page, and add <script src="gift.js"></script> to that page's tail."""
        return f'''  <section class="sec gift" id="gift" aria-labelledby="h-gift" data-mir-gift="{escape(self.slug)}" hidden>
    <div class="wrap">
      <h2 id="h-gift">{title_html}</h2>
      <div data-mir-gift-box></div>
    </div>
  </section>
'''

    def page_head(self, title_html: str, lede: str) -> str:
        """The top of an inner page (Menu, Order, Contact)."""
        return f'''  <header class="page-head"><div class="wrap">
    <h1>{title_html}</h1>
    <p class="lede">{lede}</p>
  </div></header>
'''


class BuildError(ValueError):
    """A rule broken while writing a page: fix the words or markup it names, then write again."""


def guard(page: str, title: str, desc: str, html: str) -> str:
    """Rules built into writing a page (12 Nov 2026, rules as a blueprint), so they are right before any check runs:
    share title 60 and description 155 characters (3x.8, check-web-basics), one h1 (3x.8), every picture sized (3s.24),
    no long dash or exclamation mark in the words (3.4), and pictures after the first section load lazily (3x.8)."""
    import re
    bad = []
    if not 1 <= len(title) <= 60:
        bad.append(f'title is {len(title)} characters (1 to 60): {title!r}')
    if not 1 <= len(desc) <= 155:
        bad.append(f'description is {len(desc)} characters (1 to 155): {desc!r}')
    h1s = len(re.findall(r'<h1[\s>]', html))
    if h1s != 1:
        bad.append(f'{h1s} h1 headings, one needed')
    shown = re.sub(r'<template\b.*?</template>', '', html, flags=re.S)   # templates are filled by live data, sized there
    for tag in re.findall(r'<img\b[^>]*>', shown):
        if 'width=' not in tag or 'height=' not in tag:
            bad.append(f'a picture without width and height: {tag[:90]}')
    words = re.sub(r'<script.*?</script>|<style.*?</style>|<[^>]+>', ' ', html, flags=re.S)
    for ch, name in (('—', 'long dash'), ('–', 'long dash'), ('!', 'exclamation mark')):
        for m in re.finditer(re.escape(ch), words):
            bad.append(f'{name} in the words: ...{" ".join(words[max(0, m.start() - 40):m.end() + 20].split())}...')
    if bad:
        # a site made before these guards (its RULES.md is older than 12 Nov 2026) only hears about it: new rules never
        # block a site that is already made (page rules 6, rule-dates); a new site stops here
        import os
        import sys
        from datetime import datetime
        made = os.path.exists('RULES.md') and datetime.fromtimestamp(os.path.getmtime('RULES.md')) < datetime(2026, 11, 12)
        if made:
            sys.stderr.write(f'note (made before the 12 Nov guards): {page}.html: ' + '; '.join(bad) + '\n')
        else:
            raise BuildError(f'{page}.html: ' + '; '.join(bad))
    # pictures after the first section load lazily (the opening's own pictures keep their fetchpriority)
    cut = html.find('</section>')
    if cut > 0:
        html = html[:cut] + re.sub(r'<img\b(?![^>]*\bloading=)(?![^>]*fetchpriority)', '<img loading="lazy" decoding="async"', html[cut:])
    return html


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


# ── parts made to the rules (12 Nov 2026, rules as a blueprint): use these instead of hand-writing the markup ──

def picture(src: str, alt: str, w: int, h: int, *, tall: str = '', tall_wh: tuple[int, int] | None = None,
            first: bool = False, cls: str = '') -> str:
    """A photo that is right by construction: sized (3s.24), lazy unless it is the opening's (3x.8), and on a phone the
    owner's photo extended to the tall shape (extend_photo.py) instead of cropped (3c.12)."""
    load = ' fetchpriority="high"' if first else ' loading="lazy" decoding="async"'
    c = f' class="{cls}"' if cls else ''
    img = f'<img{c} src="{src}" alt="{escape(alt, True)}" width="{w}" height="{h}"{load}>'
    if not tall:
        return img
    tw, th = tall_wh or (w, h)
    return f'<picture><source media="(max-aspect-ratio: 1/1)" srcset="{tall}" width="{tw}" height="{th}">{img}</picture>'


def facts(items: list[str]) -> str:
    """The true facts under the main button (3v.14): three at most, each item its own dot, so a wrapped line never
    starts with a separator (3a.8). Items may hold price() markup."""
    if not 1 <= len(items) <= 3:
        raise BuildError(f'facts: {len(items)} items, 1 to 3')
    return '<ul class="btn-facts">' + ''.join(f'<li>{x}</li>' for x in items) + '</ul>'


def opening_slides(slides: list[tuple[str, str, str]], h1_html: str, line: str, cta: tuple[str, str],
                   fact_items: list[str], end_photo: tuple[str, int, int], end_title: str, label: str,
                   hold: float = 1.0, push: float = 0.55) -> str:
    """The opening as connected slides (join method 'slides'; slides.js). slides: [(file stem in assets/film, big word,
    short line)], each with assets/film/<stem>-d.mp4 and -m.mp4 and their -d.webp / -m.webp posters (clip-chain writes
    them). Placement is the part's, so it is right by construction: the headline, line, button and facts on a tight
    shade at the left (5b.3, at most 40% of a phone's picture), the slide's big word on its own slide at the lower left
    (laptop only: a phone keeps the film clear, 3h.25), the closing title and button at the end, and on a phone the
    business's own photo whole at the end (3c.12). label: what the whole film shows, for screen readers."""
    if not 2 <= len(slides) <= 6:
        raise BuildError(f'opening_slides: {len(slides)} slides, 2 to 6')
    words = len(re.sub(r'<[^>]+>', ' ', h1_html).split())
    if not 2 <= words <= 5:
        raise BuildError(f'opening_slides: the headline has {words} words, 2 to 5 (3g.13)')
    src, w, h = end_photo
    def one(sl):
        s, word, sub = sl[:3]
        still = len(sl) > 3 and sl[3]   # (stem, word, line, True): a still slide, the business's own photo (clipchain end_still)
        vid = '' if still else f' data-video="assets/film/{s}-{{k}}.mp4"'
        return (f'        <div class="slide"{vid} data-poster="assets/film/{s}-{{k}}.webp">'
                f'<p class="chap" aria-hidden="true"><b>{escape(word)}</b><span>{escape(sub)}</span></p></div>\n')
    # a clip made from the last frame of the clip before (clipchain) carries on in place: pushing it up would show that
    # one picture twice, leaving and arriving, which reads as a restart (review 12 Nov, Gremier). Only a change of scene
    # (a still, or a clip not chained) is pushed up as a new slide (3aa.2).
    def is_still(sl): return len(sl) > 3 and sl[3]
    items = ''.join(one(sl).replace('<div class="slide"', '<div class="slide" data-same', 1)
                    if k and not is_still(sl) and not is_still(slides[k - 1]) else one(sl)
                    for k, sl in enumerate(slides))
    return f'''  <section class="film slides" id="film" aria-labelledby="h-open" data-hold="{hold}" data-push="{push}">
    <div class="stage">
      <div class="track" role="img" aria-label="{escape(label, True)}">
{items}      </div>
      <noscript><img src="{src}" width="{w}" height="{h}" alt=""></noscript>
      <div class="over w0" data-arrive>
        <h1 id="h-open">{h1_html}</h1>
        <p class="ln">{line}</p>
        <a class="btn" href="{cta[0]}">{escape(cta[1])}</a>
        {facts(fact_items)}
      </div>
      <div class="end-photo" aria-hidden="true"><img src="{src}" alt="" width="{w}" height="{h}" loading="lazy" decoding="async"></div>
      <div class="over w-end"><h2>{escape(end_title)}</h2><a class="btn" href="{cta[0]}" tabindex="-1">{escape(cta[1])}</a></div>
    </div>
  </section>
'''


# the shop parts live in shopkit.py (12 Nov 2026)
from shopkit import card, catalog_js, price_row, shop_page  # noqa: E402,F401
