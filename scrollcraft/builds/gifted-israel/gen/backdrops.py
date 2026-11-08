"""Sets each item's own photo in a set of its category's colour and lights it from that set (Tzvi, 6 Nov 2026, from the Pinterest
product pictures: rich colour, one strong light, a real world round the piece, the piece the sharpest thing).
The piece is never redrawn: their photo, so every Hebrew letter stays theirs. A solid piece is laid on as it is, its shape from the white
ground and the cut-out (backend/utils/cutout.py, src/cut/<id>.png). In a clear piece (CLEAR, by eye) the print stays and the white becomes the set seen through it.
Run from the build folder after gen/scene.py: writes assets/p/<id>.webp and square sizes in assets/catalog.js, and
gen/look/backdrops-sheet.jpg to look at."""
import json
import re
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw
from scipy import ndimage
from scipy.spatial import ConvexHull

SIZE = 800
# standing: set, foot height on the block, foot centre, largest (w, h) of the picture, light side (-1 left, 1 right)
UP = {'Home & Decor': ('terracotta', .64, .505, (.54, .5), -1),
      'Shabbos': ('honey', .825, .5, (.64, .68), -1),
      'Judaica': ('olive', .78, .505, (.58, .68), 1),
      'Havdalah': ('plum', .805, .51, (.6, .72), -1),
      'Chanukah': ('blue', .72, .42, (.64, .62), -1),
      'Rosh Hashana': ('pomegranate', .76, .5, (.56, .62), -1),
      'Games & Gifts': ('teal', .845, .5, (.56, .7), -1)}
FLAT = {c: (v[0] + '-flat', v[4]) for c, v in UP.items()}
FLAT_ROOM = (.76, .72)
LIFT = .3   # clear Lucite catches the light: dark print stays readable on a deep set
# looked at on the sheet: the shape test gets these wrong
FORCE_UP = {'Resin Arch Tzedakah Box', 'Rotating Resin Mayim Achronim', 'Painted Kosel Tzedakah Box', 'Watercolor Tzedakah Box',
            'Mauve Faux Floral', 'Triangle Salt Shakers', 'Suspended Salt Shakers', 'Classic Wine Stand', 'Cherry Blossom Washing Cup',
            'MetaLucite Twig Washing Cup', 'Modern Netilas Yadayim Washing Cup', 'Havdalah Cup', 'Suspended Match Jar',
            'Suspended Besamim Jar', 'Butterfly Block Match Jar', 'Toiletry Bag', 'Cosmetic Bag', 'Bee Honey Dish', 'Suspended Honey Dish',
            'Havdalah Candle Base', 'Diamond Menorah', 'Painted Chanukah Block', 'Painted Black Havdalah Matchbox Holder',
            'Resin Shabbos Matchbox Holder', 'Cherry Blossom Napkin Holder', 
            'MetaLucite Dowel Napkin Holder', 'Butterfly Tabletop Al Hamichyah', 'Watercolor Tabletop Hadlokas Neiros', 'Basics Resin Al Hamichyah',
            'Onyx Butterfly Hadlokas Neiros', 'Side Opening Bencher', 'U Liquor Set'}
FORCE_FLAT = {'Diagonal Challah Cover', 'Wavy Challah Cover', 'Hotel Style Chanukah Set', 'Hotel Style Havdalah Set'}
CLEAR = {'Classic Luxe Dreidel Card + Block', 'Classic 2.0 Chanukah Brachos Match Cloche', 'Diamond Menorah', 'Onyx Tabletop Chanukah Brachos',
         'Pearlstone Oil Jug Chanukah Block', 'Painted by Batya 2.0 Menorah Tray with Drawer', 'Painted Chanukah Block',
         'Watercolor Flowers Hadlakos Neiros Tabletop', 'Onyx Butterfly Hadlokas Neiros', 'Hadlokas Neiros Tea Light Holder', 'Onyx Square Besamim Holder',
         'Marble & Clear Bencher Set', 'Colored Base Bencher Set', 'Hemstitch Hadlokas Neiros Tray', 'Painted Havdala Set Drawer',
         'Rosh Hashanah Painted Pomegranate Honey Dish', 'Square Besamim Holder', 'Painted Kosel Tzedakah Box', 'Luxe Bread / Towel Tray',
         'Cherry Blossom Washing Cup', 'Cherry Blossom Bread / Towel Tray', 'Edge Cup', 'Suspended Salt Shakers', 'Hotel Style Chanukah Set',
         'Traditional Matchbox Holder', 'Leaf Challah Board', 'Classic Wine Stand', 'U Liquor Set', 'Havdalah Candle Base', 'Painted Black Havdalah Plate',
         'Watercolor Tefillas Chana Card', 'Side Opening Bencher', 'Basics Resin Al Hamichyah', 'Basics Al Hamichyah', 'Basics Traditional Asher Yatzar',
         'Agate Asher Yatzar', 'Basics Resin Asher Yatzar', 'Painted Gold Tabletop Simanim', 'Classic 2.0 Simanim Tabletop Plaque', 'Classic 2.0 Simanim Card Set',
         'Bee Honey Dish', 'Suspended Honey Dish', 'MetaLucite Dowel Napkin Holder', 'Butterfly Tabletop Al Hamichyah', 'Agate 2.0 Asher Yatzar',
         'Stripe Mezuzah Case', 'Painted Kosel Winter Mezuzah Case', 'Cherry Blossom Napkin Rings', 'Cherry Blossom Napkin Holder', 'Onyx Bread / Towel Tray',
         'Painted Yosefa Bread Tray', 'MetaLucite Twig Washing Cup', 'Modern Netilas Yadayim Washing Cup', 'Tall Wine Decanter', 'Suspended Mayim Achronim',
         'Classic 2.0 Raised Challah Board', 'Classic Hadlakas Neiros Tray', 'Watercolor Hadlokas Neiros Tray', 'Watercolor Tabletop Hadlokas Neiros',
         'Frame Tzedakah Box', 'Watercolor Tzedakah Box', 'Watercolor Matchbox Holder', 'Onyx Havdalah Plate', 'Painted Gold Havdalah Plate',
         'Classic 2.0 Havdalah Plate', 'Traditional Havdalah Plate', 'Havdalah Cup', 'Painted Black Havdalah Matchbox Holder', 'Onyx Square Match Holder',
         'Square Match Holder', 'Suspended Match Jar', 'Suspended Besamim Jar'}
# clear plaques: a whole pane of Lucite even where its edge fades into the white of the photo
PANEL = {'Classic 2.0 Chanukah Brachos Match Cloche', 'Onyx Tabletop Chanukah Brachos', 'Watercolor Flowers Hadlakos Neiros Tabletop', 'Onyx Butterfly Hadlokas Neiros',
         'Hadlokas Neiros Tea Light Holder', 'Marble & Clear Bencher Set', 'Colored Base Bencher Set', 'Watercolor Tefillas Chana Card', 'Side Opening Bencher',
         'Basics Resin Al Hamichyah', 'Basics Al Hamichyah', 'Basics Traditional Asher Yatzar', 'Agate Asher Yatzar', 'Basics Resin Asher Yatzar',
         'Painted Gold Tabletop Simanim', 'Classic 2.0 Simanim Tabletop Plaque', 'Butterfly Tabletop Al Hamichyah', 'Agate 2.0 Asher Yatzar',
         'Watercolor Tabletop Hadlokas Neiros', 'Modern Netilas Yadayim Washing Cup', 'Frame Tzedakah Box', 'Watercolor Tzedakah Box', 'Diagonal Challah Cover', 'Painted by Batya 2.0 Menorah Tray with Drawer',
         'Classic 2.0 Raised Challah Board', 'Pearlstone Oil Jug Chanukah Block', 'Butterfly Block Match Jar'}
KEEP_OWN = {'Flower Napkin Rings'}   # shown in use on their table, nothing to cut: widened to a square with its own ground
STRIP = ('Leather Kids Gedolim Book', 'Leather Painted Tehillim', 'Tall Leather Painted Megillas Esther', 'Leather Kriyas Shema Book', 'Leathe Nishmas Booklet',
         'Painted Leather Hadlokas Neiros Booklet', 'Wood Salt Shakers', 'Onyx Salt Shakers', 'Leather Magnetic Bencher Set')
BODY = set()   # filled in below: Bee Honey Dish
BODY_CUT = set()   # filled in below: the cut alone, its floor reflection joins the shape
OWN_PALE = {'gi20a3d87b30'}
ROT = {'Toiletry Bag': -6}  # by name: turn to level
TRIM = {'Classic 2.0 Simanim Card Set': .1, 'Trapezoid Havdalah Candle': .075, 'Onyx Havdalah Candle': .075, 'Minimalist Havdalah Candle': .075}  # by name: share of the bottom to cut off, a floor reflection


def lies_down(a):
    """A piece standing up has a level foot; one photographed lying at an angle comes to a point at the bottom."""
    h, w = a.shape
    if h > 2.4 * w:
        return False   # tall and thin stands, whatever its foot looks like
    return (a[h - max(3, round(h * .04)):] > .5).any(axis=0).mean() < .38


def aligned(photo, cut):
    """The cut's mask at its place in the photo: the cut is the photo's own pixels, cropped."""
    P = np.asarray(photo, dtype=np.int16)
    C = np.asarray(cut, dtype=np.int16)
    ys, xs = np.nonzero(C[..., 3] >= C[..., 3].max() * .8)
    pick = np.linspace(0, len(ys) - 1, 400).astype(int)
    ys, xs = ys[pick], xs[pick]
    H, W = C.shape[:2]
    # the sample furthest from white has few places it could be in the photo
    far = np.argmin(C[ys, xs, :3].sum(axis=1))
    cy, cx = np.nonzero(np.abs(P - C[ys[far], xs[far], :3]).max(axis=2) <= 2)
    best, at = 1e9, (0, 0)
    for y, x in zip(cy.tolist(), cx.tolist()):
        dy, dx = y - ys[far], x - xs[far]
        if 0 <= dy <= P.shape[0] - H and 0 <= dx <= P.shape[1] - W:
            d = np.abs(P[ys + dy, xs + dx] - C[ys, xs, :3]).mean()
            if d < best:
                best, at = d, (dy, dx)
                if d < 1:
                    break
    assert best < 6, ('cut does not match its photo', best)
    A = np.zeros(P.shape[:2], dtype=np.uint8)
    A[at[0]:at[0] + H, at[1]:at[1] + W] = C[..., 3]
    return A


def silhouette(P):
    """Everything in the photo not joined to its white ground, holes filled: a clear piece's whole shape."""
    near = P.min(axis=2) > 232
    lab, _ = ndimage.label(near)
    bg = np.isin(lab, list(set(np.unique(np.r_[lab[0], lab[-1], lab[:, 0], lab[:, -1]])) - {0}))
    m = ndimage.binary_opening(~bg, iterations=2)
    lab, n = ndimage.label(m)
    if n == 0:
        return m
    # a set in several pieces keeps them all; specks and stray bits of floor go
    size = ndimage.sum(m, lab, range(1, n + 1))
    return ndimage.binary_fill_holes(np.isin(lab, [i + 1 for i, v in enumerate(size) if v > size.max() * .03]))


def hull(m):
    """A clear plaque's whole shape from the parts of it the photo shows."""
    ys, xs = np.nonzero(m)
    pts = np.c_[xs, ys]
    v = pts[ConvexHull(pts).vertices]
    im = Image.new('L', (m.shape[1], m.shape[0]), 0)
    ImageDraw.Draw(im).polygon([tuple(p) for p in v.tolist()], fill=255)
    return np.asarray(im) > 0


def no_reflection(S, A, P):
    """The faint reflection under a piece joins the shape from the white ground: nothing lower than the cut's own foot."""
    a = A > 128
    # a cut that caught only part of the piece says nothing about where its foot is
    if a.sum() < S.sum() * .5:
        return S
    low = np.where(a.any(axis=0), a.shape[0] - 1 - a[::-1].argmax(axis=0), a.shape[0])
    kept = S & (np.arange(a.shape[0])[:, None] <= low[None, :] + 3)
    # a second part that lies apart from what the cut caught (cards beside a case) stays whole
    lab, n = ndimage.label(S)
    apart = [i for i in range(1, n + 1) if not a[lab == i].any() and (P[lab == i].min(axis=1) < 140).mean() > .02]   # with nothing dark in it, it is a reflection
    return kept | np.isin(lab, apart)


def compose(pid, g, scene, flat, clear, panel=False, rot=0, trim=0, strip=False, name=''):
    photo = Image.open(f'src/plain/{pid}.webp').convert('RGB')
    P = np.asarray(photo, dtype=np.int16)
    A = aligned(photo, Image.open(f'src/cut/{pid}.png').convert('RGBA'))
    own = max(P[0].mean(), P[-1].mean(), P[:, 0].mean(), P[:, -1].mean()) < 235
    if own:
        # their photo has its own ground (the bibs): no multiplying, and the ground seen through a hole goes
        c0 = np.median(np.r_[P[:8].reshape(-1, 3), P[-8:].reshape(-1, 3)], axis=0)
        sat = P.max(axis=2) - P.min(axis=2)
        if pid in OWN_PALE:
            # a pale bib on a brown table: the table goes, and the cut-out is not needed
            A = (ndimage.binary_opening(ndimage.binary_closing((sat < 38) & (P.max(axis=2) > 90), iterations=4), iterations=4) * 255).astype(np.uint8)
            lab, n = ndimage.label(A > 0)
            A = ((lab == 1 + np.argmax(ndimage.sum(A > 0, lab, range(1, n + 1)))) * 255).astype(np.uint8)
        else:
            hole = ndimage.binary_opening(np.abs(P - c0).max(axis=2) < 60, iterations=3)
            A = np.where(hole, 0, A).astype(np.uint8)
        S = ndimage.binary_opening(A > 40, iterations=1)
    else:
        S = (A > 128) if pid in BODY_CUT else no_reflection(silhouette(P), A, P)
        S = ndimage.binary_closing(S | (A > 128), iterations=2)
        if panel:
            # the faint edge and every line of print count: anything a little darker than the white ground
            faint = ndimage.binary_opening(P.min(axis=2) < 226, iterations=1)
            S = hull(S | faint) & (np.arange(S.shape[0])[:, None] <= np.nonzero(S.any(axis=1))[0].max() + 3)
        if strip:
            # a pale reflection the cut-out kept under a darker piece: up from the foot while it stays near white
            up = S.shape[0] // 10
            for x in np.nonzero(S.any(axis=0))[0]:
                y = np.nonzero(S[:, x])[0].max()
                for _ in range(up):
                    if y < 0 or not S[y, x] or P[y, x].min() <= 226:
                        break
                    S[y, x] = False
                    y -= 1
            # what is left of it hangs in narrow drips: only the lowest quarter of the piece, so handles and edges above stay
            rows = np.nonzero(S.any(axis=1))[0]
            low = rows.max() - np.ptp(rows) // 4
            wide = ndimage.binary_opening(S, structure=np.ones((1, max(40, np.ptp(np.nonzero(S.any(axis=0))[0]) // 5))))
            S[low:] = wide[low:]
            if 'Shakers' not in name:
                S = hull(S)   # a book or a case has straight sides
        if pid in BODY:
            # the clear body under a spoon that sticks out above it
            top = np.nonzero(S.any(axis=1))[0].min() + round(np.ptp(np.nonzero(S.any(axis=1))[0]) * .25)
            b = S.copy()
            b[:top] = False
            S = S | hull(b)
    ims = [photo, Image.fromarray(A), Image.fromarray((S * 255).astype('uint8'))]
    if rot:
        ims = [i.rotate(rot, Image.BICUBIC, expand=True, fillcolor=(255, 255, 255) if i.mode == 'RGB' else 0) for i in ims]
    box = ims[2].point(lambda v: 255 if v > 100 else 0).getbbox()
    if trim:
        box = (box[0], box[1], box[2], round(box[3] - (box[3] - box[1]) * trim))
    ims = [i.crop(box) for i in ims]
    if flat:
        room, side = FLAT_ROOM, scene[1]
    else:
        foot, cx, room, side = scene[1], scene[2], scene[3], scene[4]
    s = min(SIZE * room[0] / ims[0].width, SIZE * room[1] / ims[0].height)
    w, h = round(ims[0].width * s), round(ims[0].height * s)
    c, al, sl = [np.asarray(i.resize((w, h), Image.LANCZOS), dtype=np.float32) / 255 for i in ims]
    if flat:
        left, top = SIZE // 2 - w // 2, SIZE // 2 - h // 2 + round(SIZE * .02)
    else:
        left, top = round(SIZE * cx) - w // 2, round(SIZE * foot) - h
    p = np.ones_like(g)
    p[top:top + h, left:left + w] = c
    a, k = np.zeros((SIZE, SIZE), dtype=np.float32), np.zeros((SIZE, SIZE), dtype=np.float32)
    a[top:top + h, left:left + w] = al
    k[top:top + h, left:left + w] = ndimage.gaussian_filter(sl, .7)
    if flat:
        # lying on the surface: its shadow falls away from the light
        cast = ndimage.gaussian_filter(np.roll(k, (round(SIZE * .018), round(-side * SIZE * .022)), axis=(0, 1)), SIZE * .014) * .55
        touch = ndimage.gaussian_filter(np.roll(k, 2, axis=0), 2.5) * (1 - k) * .5
    else:
        # standing: its own shape laid flat on the stone, away from the light, and a tight dark line where it touches
        fl_h = max(10, round(h * .12))
        fl = np.asarray(Image.fromarray((k[top:top + h, left:left + w] * 255).astype('uint8')).resize((w, fl_h)), dtype=np.float32) / 255
        flatmap = np.zeros_like(k)
        fy = round(SIZE * foot) - fl_h // 2
        for i in range(fl_h):
            x = left + round(-side * (fl_h - i) * 2.6)
            r, x0, x1 = fy + i, max(0, x), min(SIZE, x + w)
            if 0 <= r < SIZE and x0 < x1:
                flatmap[r, x0:x1] = fl[i, x0 - x:x1 - x]
        cast = ndimage.gaussian_filter(flatmap, 7) * .5
        touch = ndimage.gaussian_filter(np.roll(k, 3, axis=0) * (1 - k), 2.2) * .8
    out = g * (1 - np.maximum(cast, touch)[..., None])
    # the set's light falls gently on the piece; its colours stay theirs
    light = ndimage.gaussian_filter(g.mean(axis=2), 40)
    light = light / max(light[k > .5].mean(), .01)
    rel = 1 + (light.clip(.6, 1.4) - 1) * .12
    xx = (np.arange(SIZE, dtype=np.float32) - left - w / 2) / max(w, 1)
    fall = (1 + side * xx * .14)[None, :]
    q = np.clip((p - .5) * 1.06 + .5, 0, 1) * (rel * fall)[..., None]
    if own:
        out = out * (1 - a[..., None]) + q * a[..., None]
    elif clear:
        # the print stays as it is; white is the set seen through the piece, a little brighter inside its shape
        a = (1 - np.clip(((p * 255).min(axis=2) - 205) / 40, 0, 1)) * k
        through = (out + (1 - out) * LIFT * k[..., None]) * p
        out = through * (1 - a[..., None]) + q * a[..., None]
    else:
        a = k
        out = out * (1 - a[..., None]) + q * a[..., None]
    # a thin line of light on the side the light comes from
    rim = ndimage.gaussian_filter(np.clip(a - np.roll(a, 3 * int(side), axis=1), 0, 1) * a, 1.1) * .12
    out = out + rim[..., None] * (1 - out)
    return Image.fromarray((out.clip(0, 1) * 255).astype('uint8'))


if __name__ == '__main__':
    raw = open('assets/catalog.js', encoding='utf8').read()
    hit = re.search(r'window\.GI = (.*);\s*$', raw, re.S)
    cat = json.loads(hit.group(1))
    BODY.update(i['id'] for i in cat['items'] if i['name'] == 'Bee Honey Dish')
    BODY_CUT.update(i['id'] for i in cat['items'] if i['name'] == 'Painted by Batya Honey Dish')
    sets = {f.stem: np.asarray(Image.open(f).convert('RGB').resize((SIZE, SIZE), Image.LANCZOS), dtype=np.float32) / 255
            for f in Path('gen/scenes').glob('*.jpg')}
    cols, S = 14, 130
    sheet = Image.new('RGB', (cols * S, (len(cat['items']) + cols - 1) // cols * S), 'white')
    d = ImageDraw.Draw(sheet)
    for i, it in enumerate(cat['items']):
        n, pid = it['name'], it['id']
        if n in KEEP_OWN:
            a = np.asarray(Image.open(f'src/plain/{pid}.webp').convert('RGB'), dtype=np.float32)
            dx, dy = SIZE - a.shape[1], SIZE - a.shape[0]
            im = Image.fromarray(np.pad(a, ((dy // 2, dy - dy // 2), (dx // 2, dx - dx // 2), (0, 0)), mode='reflect').astype('uint8'))
        else:
            al = np.asarray(Image.open(f'src/cut/{pid}.png').convert('RGBA').getchannel('A'), dtype=np.float32) / 255
            flat = n in FORCE_FLAT or n.startswith('Bib') or (n not in FORCE_UP and lies_down(al))
            s = FLAT[it['cat']] if flat else UP[it['cat']]
            im = compose(pid, sets[s[0]], s, flat, n in CLEAR, n in PANEL, ROT.get(n, 0), TRIM.get(n, 0), n.startswith(STRIP), n)
        im.save(f'assets/p/{pid}.webp', 'WEBP', quality=80, method=6)
        it['w'] = it['h'] = SIZE
        sheet.paste(im.resize((S, S), Image.LANCZOS), (i % cols * S, i // cols * S))
        d.text((i % cols * S + 3, i // cols * S + 2), str(i), fill='white')
    open('assets/catalog.js', 'w', encoding='utf8').write(raw[:hit.start(1)] + json.dumps(cat, ensure_ascii=False, separators=(',', ':')) + raw[hit.end(1):])
    Path('gen/look').mkdir(exist_ok=True)
    sheet.save('gen/look/backdrops-sheet.jpg', quality=85)
    print('done', len(cat['items']))
