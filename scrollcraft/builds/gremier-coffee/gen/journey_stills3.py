"""The two stills of "you are the coffee" (gen/coffee-journey-brief.md), through the Higgsfield API: the reference model
gets the layout sketch (rules A3.11 / 3aa.9) and the grinder of the earlier still. HF_KEY from backend/.env.local, never
printed. Run from the build folder: python gen/journey_stills3.py j1|j2 [take]"""
import io
import sys
import urllib.request
from pathlib import Path

from dotenv import load_dotenv
from PIL import Image

ROOT = Path('C:/Users/tzviw/Documents/my-israel-rental')
load_dotenv(ROOT / 'backend/.env.local')
import higgsfield_client as h  # noqa: E402

W = Path('gen/world')
LOOK = ("Real studio product photograph, 16:9, soft warm daylight from the left, a plain warm cream background "
        "(#F6EEE3) with soft shadows, nothing else in the room. Real materials: matte black metal and clear glass, real "
        "roasted coffee beans and grounds, opaque, never glassy, no glow. ")
SHOTS = {
    'j1': (['j1-layout.png', 'w1.png'],
           LOOK + "Photograph this layout for real: in the middle of the frame, the matte black coffee grinder of the second "
           "picture floating in the air, taken apart into its pieces as an exploded view, each piece a little apart: the "
           "clear glass hopper at the top with roasted beans pouring into it from above, the burr ring below it, the two "
           "halves of the black body apart to the left and right, the steel burrs between them, and a thin stream of fine "
           "dark coffee grounds falling straight down out of the bottom. The whole grinder is large and fully in frame, "
           "about two thirds of the frame's height. Behind it, huge bold terracotta (#CD7850) serif capital letters "
           "spelling exactly COLD fill the width of the frame; the grinder stands inside the word, between the O and the "
           "L, and the right half of the grinder's body passes behind the L. Only the word COLD, no other text, no logos."),
    'j2': (['j2-layout.png'],
           "Real macro photograph, 16:9, soft warm daylight. The whole frame, edge to edge, is filled with gentle rolling "
           "waves of clear cold water seen close from just above the surface, light rippling through them, a few ice cubes "
           "drifting; no glass, no jar edge, no wall, no horizon, nothing but water, so you cannot tell where it is. From "
           "above, a thin falling stream of fine dark coffee grounds lands in the middle of the waves; where it lands the "
           "first brown clouds of coffee curl into the clear water in soft rings. Real materials, opaque coffee, never "
           "glassy, no glow. No text, no letters, no logos, no hands."),
    'g0': (['g0-layout.png', 'w1.png'],
           LOOK + "Photograph this layout for real, wide, with clear cream space all round and above: in the middle of the "
           "frame the matte black coffee grinder of the second picture, whole and assembled, standing upright in the air, "
           "about half the frame's height, its clear glass hopper on top fully in frame. Roasted coffee beans pour down "
           "into the hopper from above in a loose stream that starts inside the top of the picture. Behind it, huge bold "
           "terracotta (#CD7850) serif capital letters spelling exactly GRIND fill most of the width; the grinder stands "
           "in front of the letter I and hides it. Nothing touches the edges of the frame except the cream ground. Only "
           "the word GRIND, no other text, no logos."),
    'o1': (['o1-layout.png'],
           "Real photograph, 16:9, soft warm daylight from the left. The camera is right at the waterline of a wavy ocean "
           "that runs across the whole width of the frame: rolling swells of clear cold blue-grey water come toward the "
           "camera, the nearest swell rising in the lower part of the frame with light shining through it and a little "
           "spray, the wave crests forming a wavy line across the middle of the frame. Above the waves, a plain warm "
           "cream (#F6EEE3) ground, soft and even, no sky, no horizon line of land, no beach, no glass, no wall. A thin "
           "stream of fine dark coffee grounds falls from the top of the frame into the middle of the waves, where the "
           "first brown clouds curl into the water. Real materials, opaque coffee, never glassy, no glow. No text, no "
           "letters, no logos, no people."),
}

# the phone film (13 Nov 2026): the same stills re-framed tall, the wide still as the second reference so the objects match
TALL = " Tall 9:16 picture for a phone held upright; the same objects, light and colours as the second picture, re-framed tall."
SHOTS['g0t'] = (['g0t-layout.png', 'g0.png'], SHOTS['g0'][1].replace('16:9', '9:16').replace('fill most of the width', 'run across the whole width') + TALL +
                " Below the grinder only the endless plain cream ground, no table, floor, shelf or horizon.")
SHOTS['o1t'] = (['o1t-layout.png', 'o1.png'], SHOTS['o1'][1].replace('16:9', '9:16').replace('across the middle of the frame', 'about a third of the way down the frame') + TALL +
                " The waves fill the lower two thirds of the frame, the nearest swell large at the bottom, so you feel you are in the water.")
SHOTS['J3t'] = (['J3t-layout.png', 'J3-last.png'], "Real photograph. The same tall clear glass full of ice and cold brew coffee as the second picture, on the same "
                "pale table, the same warm wall and low sunlight from the left; a thin stream of cold brew falls into it from the top of the frame. "
                "The whole glass large in the frame, nothing cut off. Real materials, opaque coffee, never glassy, no glow. No text, no logos." + TALL)

# the Grind clip's planned end (15 Nov 2026, remake: one thick torrent, enough to brown the sea; rules 3aa.27, 3aa.31):
# the same ocean as o1, the torrent landing and a brown cloud reaching both sides
SHOTS['o2'] = (['o1.png', 'K2-last.png'],
               "Real photograph, 16:9, soft warm daylight from the left. Exactly the same wavy ocean, camera height, light and plain "
               "warm cream (#F6EEE3) ground above as the first picture: rolling swells of cold blue-grey water across the whole "
               "width, the nearest swell large in the lower part of the frame, the crests a wavy line across the middle, no sky, "
               "no horizon line of land, no glass, no wall. Into the middle of the waves pours one thick heavy column of fine "
               "dark coffee grounds, as thick as in the second picture, from the top edge of the frame without a gap. Where it "
               "lands, a huge dark brown cloud of coffee billows through the water under the surface, spreading left and right "
               "until it reaches both sides of the frame, the swells above it turning brown. Real materials, opaque coffee, "
               "never glassy, no glow. No text, no letters, no logos, no people.")
SHOTS['o2t'] = (['o1t.png', 'o2.png'], SHOTS['o2'][1].replace('16:9', '9:16').replace('the first picture', 'the first picture, and the torrent and brown cloud of the second picture')
                .replace('across the middle', 'about a third of the way down the frame') + TALL +
                " The waves fill the lower two thirds of the frame, the brown cloud filling them from side to side.")

# their bar photo extended tall for real (15 Nov 2026): the 10 Nov tall version was the padded canvas only blurred, smeared
# stripes the phone film ended on; the reference model paints the top, then extend_photo.py paste puts their pixels back
SHOTS['bar-fillt'] = (['../ext/canvas-tall.png'],
    "Real photograph, 9:16. The lower part of this picture is a real photo of a coffee bar table on a sunlit terrace: keep "
    "it exactly as it is, every object, label and colour unchanged and in the same place, the same size. Only replace the "
    "smeared, blurred stripes in the upper part with what is really above that table: the same pale stone colonnade, its "
    "tall columns running up out of the top of the frame, the same warm low sun from the right, soft green trees between "
    "the columns, a little soft sky, slightly out of focus like the background of the photo. No new objects, no people, no "
    "text, no logos.")


def jpg(p: Path) -> Path:
    out = W / f'{p.stem}-src.jpg'
    buf = io.BytesIO(); Image.open(p).convert('RGB').save(buf, 'JPEG', quality=92); out.write_bytes(buf.getvalue())
    return out


def main(name: str, take: str) -> None:
    refs, prompt = SHOTS[name]
    final = {}
    r = h.subscribe('marketing-studio/image/sunburst',
                    arguments={'prompt': prompt, 'image_urls': [h.upload_file(str(jpg(W / f))) for f in refs],
                               'aspect_ratio': '9:16' if name.endswith('t') else '16:9', 'resolution': '2k', 'quality': 'medium', 'enhance_prompt': False},
                    on_queue_update=lambda s: final.update(s=s))
    if not isinstance(final.get('s'), h.Completed):
        raise SystemExit(f'not made: {type(final.get("s")).__name__}')
    url = ((r or {}).get('images') or [{}])[0].get('url')
    if not url:
        raise SystemExit('not made: no image')
    out = W / f'{name}-{take}.png'
    Image.open(io.BytesIO(urllib.request.urlopen(url, timeout=60).read())).convert('RGB').save(out)
    print('saved', out, Image.open(out).size)


if __name__ == '__main__':
    main(sys.argv[1], sys.argv[2] if len(sys.argv) > 2 else '1')
