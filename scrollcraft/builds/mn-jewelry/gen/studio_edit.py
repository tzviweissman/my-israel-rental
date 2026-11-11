"""Billable Higgsfield API photo edits: each of their own photos re-set on a dark studio surface, then that picture in the
other two golds (Tzvi, 10 Nov 2026: "make all the diamonds look real and high end"; cut-outs pasted on a gradient read as
fake). Brief: gen/studio-brief.md. Model alibaba/qwen-image-3/edit (tested beside xai/grok-imagine-image-2.0 on p10).
    python gen/studio_edit.py base            -> gen/studio/pNN.png for every piece that has none
    python gen/studio_edit.py golds           -> gen/studio/pNN-<gold>.png, edited from pNN.png, metal colour only
    python gen/studio_edit.py base p05 p06    -> only those (delete the png first to redo one)
HF_KEY from backend/.env.local; never read or printed. A finished file is never paid for twice."""
import sys, os, json, urllib.request
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor
from dotenv import load_dotenv
load_dotenv(Path('C:/Users/tzviw/Documents/my-israel-rental/backend/.env.local'))
import higgsfield_client as h
from PIL import Image
os.chdir(Path(__file__).resolve().parent.parent)
MODEL = 'alibaba/qwen-image-3/edit'
SRC = {'p04': 'yellow', 'p05': 'white', 'p06': 'white', 'p07': 'white', 'p08': 'white', 'p10': 'white', 'p14': 'rose',
       'p15': 'white', 'p16': 'white', 'p17': 'white', 'p18': 'yellow', 'p19': 'white'}   # p21 (the ring on a napkin roll) is not used: the edit had to invent the hidden band
BASE = ('Change only the background of this photo. The piece of jewellery stays exactly where it is, the same size in the frame, '
        'the same angle, every pixel of its metal and every diamond facet unchanged. The metal keeps its own colour. '
        'Everything under and behind it becomes a smooth matte charcoal stone surface in a dark studio, with a soft real '
        'contact shadow and a faint reflection of the piece on the surface. Nothing else changes. No text, no extra objects, no hands.')
# what the first try got wrong on a piece, said to it plainly (checked beside the real photo, gen/studio/_sheet-*.jpg)
HINT = {'p08': ' The blurred cushion and fabric behind the ring are removed completely: plain dark studio, no folds, no fabric.',
        'p14': ' The diamond stays as small as it is in the photo, with the same claws; do not enlarge it or add claws. The pebble and sweets are removed.',
        'p18': ' The bracelet stays cropped by the edges of the frame exactly as in the photo, running across it; do not complete it into a loop.'}
GOLD = {'white': 'bright white gold, silver-white', 'yellow': 'warm 18k yellow gold', 'rose': 'soft pink 18k rose gold'}
def gold_prompt(g):
    return ('Change only the colour of the metal in this photo. All the metal of the piece (band, claws, settings, bail, links, '
            f'clasps) becomes {GOLD[g]}. Every diamond stays exactly as it is, white and clear, with no tint. The shape, size, '
            'angle and position of the piece, the dark background, the shadow and the reflection stay exactly as they are. Add nothing.')

def edit(src, out, prompt):
    out = Path(out)
    if out.exists(): return f'have {out.name}'
    png = Path(src)
    if png.suffix != '.png':
        png = Path(f'gen/studio/_{Path(src).stem}-in.png')
        if not png.exists():
            im = Image.open(src).convert('RGB'); s = min(im.size)
            im.crop(((im.width - s) // 2, (im.height - s) // 2, (im.width + s) // 2, (im.height + s) // 2)).save(png)
    try:
        r = h.subscribe(MODEL, arguments={'prompt': prompt, 'image_urls': [h.upload_file(str(png))], 'resolution': '2k',
                                           'aspect_ratio': '1:1', 'prompt_extend': False, 'enable_thinking': False})
        urllib.request.urlretrieve(r['images'][0]['url'], out); return f'made {out.name}'
    except Exception as e: return f'FAILED {out.name}: {str(e)[:200]}'

if __name__ == '__main__':
    mode, names = sys.argv[1], sys.argv[2:] or list(SRC)
    Path('gen/studio').mkdir(exist_ok=True)
    jobs = [(f'src/owner/{n}.jpg', f'gen/studio/{n}.png', BASE + HINT.get(n, '')) for n in names] if mode == 'base' else \
           [(f'gen/studio/{n}.png', f'gen/studio/{n}-{g}.png', gold_prompt(g)) for n in names for g in GOLD if g != SRC[n]]
    with ThreadPoolExecutor(4) as ex:
        for line in ex.map(lambda j: edit(*j), jobs): print(line, flush=True)
