"""One billable Higgsfield API still per set: the empty sets gen/backdrops.py lays their photos on. Run from the build folder:
python gen/scene.py [names], writes gen/scenes/<name>.jpg (cropped where the generator left a table edge or a wall in a surface set).
HF_KEY comes from backend/.env.local; never read or printed here."""
import sys, urllib.request
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from PIL import Image
from io import BytesIO
from dotenv import load_dotenv
load_dotenv(Path(r'C:/Users/tzviw/Documents/my-israel-rental/backend/.env.local'))
import higgsfield_client

END = ('Shallow depth of field. The middle of the picture is empty and clear, nothing stands or lies there. '
       'No product, no bottle, no vase, no people, no text. Photorealistic advertising still life photography.')
SETS = {
 # standing pieces: a block seen at eye level
 'terracotta': 'An empty set against a deep terracotta plaster wall. A wide low block of pale rough travertine in the lower third, seen at eye level. Hard late afternoon window light from the left throws a soft-edged shadow of palm leaves across the wall. A fold of raw linen falls at the far right edge, out of focus.',
 'honey': 'An empty set against a deep warm amber wall. A wide low block of honey coloured onyx stone in the lower third, seen at eye level. A warm low sun from the left, long soft shadows across the wall. Cream linen draped behind at the left, out of focus, and a stem of dried wheat at the far right edge.',
 'olive': 'An empty set against a deep olive green plaster wall. A wide low block of pale limestone in the lower third, seen at eye level. Hard morning window light from the right throws a soft-edged shadow of olive branches across the wall. One olive branch lies out of focus at the far left edge.',
 'plum': 'An empty set against a deep aubergine plum wall. A wide low block of dark polished stone in the lower third, seen at eye level. A single warm side light from the left with a soft glow on the wall behind, the rest falling into shade. Dried lavender stems out of focus at the far right edge.',
 'blue': 'An empty set against a deep midnight blue plaster wall. A wide tall block of pale limestone centred in the lower third, more than half the width of the picture, seen at eye level. A single warm golden side light from the left, like candlelight, glows on the wall and falls into deep shade on the right. A fold of dark blue velvet out of focus at the far right edge.',
 'pomegranate': 'An empty set against a deep pomegranate red plaster wall. A wide low block of pale travertine centred in the lower third, not touching the sides of the picture, seen at eye level. Warm low sun from the left throws a soft-edged shadow of leaves across the wall. A branch with one pomegranate out of focus at the far right edge.',
 'teal': 'An empty set against a deep teal green plaster wall. A wide low block of pale limestone in the lower third, seen at eye level. Hard window light from the left throws a soft-edged window shadow across the wall. A stem of dried eucalyptus out of focus at the far right edge.',
 # pieces photographed lying down: a surface seen from above at an angle
 'terracotta-flat': 'An empty seamless sheet of deep terracotta plaster filling the picture edge to edge, seen from above at an angle: one flat surface and nothing else, no table edge, no corner, no wall, no floor line, no window. Hard late afternoon window light from the left throws a soft-edged shadow of palm leaves across the surface. A fold of raw linen lies at the far top right corner, out of focus.',
 'honey-flat': 'An empty seamless sheet of deep warm amber plaster filling the picture edge to edge, seen from above at an angle: one flat surface and nothing else, no table edge, no corner, no wall, no floor line, no window. A warm low sun from the left, long soft shadows across the surface. Cream linen lies at the far top left corner, out of focus, and a stem of dried wheat at the far right edge.',
 'olive-flat': 'An empty seamless sheet of deep olive green plaster filling the picture edge to edge, seen from above at an angle: one flat surface and nothing else, no table edge, no corner, no wall, no floor line, no window. Hard morning window light from the right throws a soft-edged shadow of olive branches across the surface. One olive branch at the far top left corner, out of focus.',
 'plum-flat': 'An empty seamless sheet of deep aubergine plum plaster filling the picture edge to edge, seen from above at an angle: one flat surface and nothing else, no table edge, no corner, no wall, no floor line, no window. A single warm side light from the left makes a soft pool of light, the rest falling into shade. Dried lavender stems at the far top right corner, out of focus.',
 'blue-flat': 'An empty seamless sheet of deep midnight blue plaster filling the picture edge to edge, seen from above at an angle: one flat surface and nothing else, no table edge, no corner, no wall, no floor line, no window. A single warm golden side light from the left, like candlelight, makes a soft pool of light. A fold of dark blue velvet at the far top right corner, out of focus.',
 'pomegranate-flat': 'An empty seamless sheet of deep pomegranate red plaster filling the picture edge to edge, seen from above at an angle: one flat surface and nothing else, no table edge, no corner, no wall, no floor line, no window. Warm low sun from the left throws a soft-edged shadow of leaves across the surface. A branch with one pomegranate at the far top right corner, out of focus.',
 'teal-flat': 'An empty seamless sheet of deep teal green plaster filling the picture edge to edge, seen from above at an angle: one flat surface and nothing else, no table edge, no corner, no wall, no floor line, no window. Hard window light from the left throws a soft-edged window shadow across the surface. A stem of dried eucalyptus at the far top right corner, out of focus.',
}
CROP = {'honey-flat': (.05, .08, .93, .96), 'olive-flat': (0, .2, .66, .86), 'plum-flat': (0, 0, .86, .86),
        'blue-flat': (.22, .18, .85, .81), 'pomegranate-flat': (.38, .38, 1, 1), 'teal-flat': (.3, .05, .88, .63)}


def one(name):
    final = {}
    r = higgsfield_client.subscribe('higgsfield-ai/soul/standard',
        arguments={'prompt': f'{SETS[name]} {END}', 'resolution': '1080p', 'aspect_ratio': '1:1', 'num_images': 1},
        on_queue_update=lambda s: final.update(s=s))
    if not isinstance(final.get('s'), higgsfield_client.Completed) or not (r or {}).get('images'):
        return f"{name} FAILED {type(final.get('s')).__name__}"
    q = urllib.request.Request(r['images'][0]['url'], headers={'User-Agent': 'Mozilla/5.0'})
    im = Image.open(BytesIO(urllib.request.urlopen(q).read())).convert('RGB')
    if name in CROP:
        W, H = im.size
        c = CROP[name]
        im = im.crop((round(c[0] * W), round(c[1] * H), round(c[2] * W), round(c[3] * H)))
    im.resize((1080, 1080), Image.LANCZOS).save(f'gen/scenes/{name}.jpg', quality=90)
    return f"{name} saved {r.get('request_id', '')}"
with ThreadPoolExecutor(5) as x:
    print(*x.map(one, sys.argv[1:] or SETS), sep='\n')
