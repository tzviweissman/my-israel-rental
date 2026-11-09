"""The opening's seven rooms (IDEAS.md idea I, Tzvi 9 Nov 2026 "yes 1"): their own piece set on the stone of each room, the way
gen/backdrops.py sets every shop picture, at the screen's own shapes (gen/rooms/<set>-wide.jpg 16:9, -tall.jpg 9:16; 3c.12).
Writes, per room and shape, assets/rooms/<cat>-<shape>.webp (the room with the piece and its shadow) and -front.webp (the piece
alone, the same size, for the layer laid over the room's big word). Run from the build folder."""
import json
import re
from pathlib import Path

import numpy as np
from PIL import Image

import backdrops as bd

# category, room, piece, (block's middle across, block's top down) on the wide and the tall picture, the piece's largest size as a
# share of the square around it, the light's side. The block positions were read off gen/rooms/*.jpg.
ROOMS = [
    ('Shabbos', 'honey', 'gi2fe5a04aaa', (.51, .845), (.51, .84), (.5, .52), -1),
    ('Havdalah', 'plum', 'gi137ecab4b5', (.51, .77), (.5, .75), (.24, .58), -1),
    ('Home & Decor', 'terracotta', 'gic89fc190e6', (.495, .72), (.5, .60), (.46, .44), -1),
    ('Judaica', 'olive', 'gi29aaadfe12', (.5, .75), (.5, .68), (.42, .52), 1),
    ('Rosh Hashana', 'pomegranate', 'gia0015d7c59', (.5, .73), (.5, .61), (.5, .42), -1),
    ('Chanukah', 'blue', 'gid3c9bd3757', (.495, .49), (.5, .62), (.3, .4), -1),
    ('Games & Gifts', 'teal', 'gic9467ef945', (.495, .745), (.5, .77), (.36, .46), -1),
]
SLUG = lambda c: re.sub(r'[^a-z]+', '-', c.lower()).strip('-')


def layer(cat, room, pid, at, size, side, shape):
    g = Image.open(f'gen/rooms/{room}-{shape}.jpg').convert('RGB')
    W, H = g.size
    S = min(W, H)
    cx, top = at[0] * W, at[1] * H
    # the square the piece is set in: centred on the block across, the block's top at 72% of it down
    x0 = int(min(max(cx - S / 2, 0), W - S))
    y0 = int(min(max(top - S * .72, 0), H - S))
    sq = np.asarray(g.crop((x0, y0, x0 + S, y0 + S)), dtype=np.float32) / 255
    bd.SIZE = S
    foot = (top - y0) / S + .012
    name = next(i['name'] for i in ITEMS if i['id'] == pid)
    if shape == 'wide':
        size = (size[0] * .72, size[1] * .72)   # a laptop room shows more wall: the piece smaller, so the words have room
    scene = (room, foot, (cx - x0) / S, size, side)
    im = bd.compose(pid, sq, scene, False, name in bd.CLEAR, name in bd.PANEL, bd.ROT.get(name, 0), bd.TRIM.get(name, 0),
                    name.startswith(bd.STRIP), name)
    full = g.copy()
    full.paste(im, (x0, y0))
    k = Image.fromarray((np.clip(bd.LAST_K, 0, 1) * 255).astype('uint8'))
    front = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    front.paste(im.convert('RGBA'), (x0, y0), k)
    base = f'assets/rooms/{SLUG(cat)}-{shape}'
    full.save(base + '.webp', 'WEBP', quality=80, method=6)
    front.save(base + '-front.webp', 'WEBP', quality=82, method=6, alpha_quality=90)
    return full


if __name__ == '__main__':
    raw = open('assets/catalog.js', encoding='utf8').read()
    ITEMS = json.loads(re.search(r'window\.GI = (.*);\s*$', raw, re.S).group(1))['items']
    Path('assets/rooms').mkdir(exist_ok=True)
    sheet = Image.new('RGB', (7 * 400, 225 + 711), 'white')
    for i, (cat, room, pid, wide, tall, size, side) in enumerate(ROOMS):
        a = layer(cat, room, pid, wide, size, side, 'wide')
        b = layer(cat, room, pid, tall, size, side, 'tall')
        sheet.paste(a.resize((400, 225)), (i * 400, 0))
        sheet.paste(b.resize((400, 711)), (i * 400, 225))
        print(cat, 'done')
    sheet.save('gen/look/rooms-sheet.jpg', quality=85)
