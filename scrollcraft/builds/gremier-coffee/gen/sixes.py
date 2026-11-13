"""The litre 6-pack card (review.md, 11 Nov): six of their own sunlit product photos tiled 3 x 2 on the page's cream,
so the card shows six and matches the other cards' shoot. Nothing generated. Run after gen/assets.py."""
from PIL import Image

G, BG = 10, (246, 238, 227)
SETS = {'six-litres': ['classic-liter-lifestyle-v2', 'house-blend-lifestyle-v1', 'colombia-liter-lifestyle-v2',
                       'sweetened-liter-lifestyle-v3', 'decaf-liter-lifestyle-v2', 'classic-liter-lifestyle-v2']}
W, H = 1200, 800
tw, th = (W - 2 * G) // 3, (H - G) // 2
for name, photos in SETS.items():
    out = Image.new('RGB', (W, H), BG)
    for i, f in enumerate(photos):
        im = Image.open(f'src/site/{f}.webp').convert('RGB')
        # each photo shown whole, scaled to the tile (their 3:2 photos fill a tile of 393x395 only by height, so keep
        # the bottle in the middle third, where it stands in every one of their shots)
        s = th / im.height
        im = im.resize((round(im.width * s), th), Image.LANCZOS)
        x0 = (im.width - tw) // 2
        out.paste(im.crop((x0, 0, x0 + tw, th)), ((i % 3) * (tw + G), (i // 3) * (th + G)))
    out.save(f'assets/p/{name}.webp', 'WEBP', quality=82)
    print(name)
