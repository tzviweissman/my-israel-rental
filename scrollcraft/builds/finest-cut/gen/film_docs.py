"""One-off: records Tzvi's pick of the Golden mountains film in the build's plans and registers. Run from the build folder."""
import json
import re
from pathlib import Path


def sub(path, pairs):
    p = Path(path)
    s = p.read_text(encoding='utf8')
    for a, b in pairs:
        if a not in s:
            print('NOT FOUND', path, a[:50])
        s = s.replace(a, b)
    p.write_text(s, encoding='utf8', newline='\n')


sub('IDEAS.md', [
    ('## Chosen: A\n', '## Chosen: F\n'),
    ('E, F and G are the new film ideas on gen/storyboard.png; A stays until Tzvi picks one.',
     'E, F and G are the new film ideas on gen/storyboard.png; Tzvi picked F the same day.'),
])
sub('gen/build.py', [('data-frames="FILM_FRAMES"', 'data-frames="204"')])
sub('gen/plan.py', [
    ('the scroll takes the camera and light round 4 types and 3 sauces of their own board',
     'the scroll flies a tiny camera low over their board as if it were golden mountains, past the 3 sauce cups, then up to the whole board'),
    ('you land on a whole chicken board on black, and every scroll the camera and light take you to the next of its 4 types and 3 sauces, ending on the price',
     'you land inside a landscape of golden crust, and your scroll flies you over it, past the sauce cups like lakes, then up until it is one board with the price'),
    ('the camera arrives at each part as its chapter line shows', 'each chapter line shows while that part of the board is passing'),
    ('the listing spells it "Ulimate", Tzvi is', 'the listing spelled it "Ulimate" and Tzvi had it corrected on 6 Nov 2026; Tzvi was'),
])
s = Path('CONCEPT.md').read_text(encoding='utf8')
a = s.index('## Chosen')
b = s.index('## Effects')
s = s[:a] + '''## Chosen
F, Golden mountains (Tzvi, 6 Nov 2026, after "it just focuses on different chicken its not wow"). A tiny camera flies low over their chicken as if it were a mountain range, thin steam drifting past like cloud; their three sauce cups pass like lakes; it climbs until the mountains are one board on black, landing exactly on their real photo, with the price and the button. The film follows the scroll.

## Wow gate
1. Strongest real photo, big: the film lands on their board photo, whole, filling the screen on laptop and phone.
2. Signature moment from their own thing: their own board and their own logo cups become the landscape, and the visitor's scroll flies over it.
3. The visitor's choice changes the page: "Your table" or "Someone else's table" changes the section's picture, ground, words and button, and carries into the order form (who it is for).
4. Side by side: docs/inspo/awwwards-2026-10-18/united-5-from-above-clouds.webp is a camera high above a subject through cloud; ours flies below the peaks in steam, on real food. The ending comes from docs/inspo/moto-card-2026-10-21/hero-2500.webp, one object lit on a dark ground under one line. The first screen's composition comes from sweetgreen on Mobbin (https://mobbin.com/sites/sections/a7dbacd8-c85d-459f-b06f-635450c43365).
5. One sentence: you land inside a landscape of golden crust, and your scroll flies you over it, past the sauce cups like lakes, then up until it is one board with the price.

''' + s[b:]
s = s.replace("- other: X33, the opening: camera and light go round their real board on the scroll, from docs/inspo/videos-2026-11-04/flashlight-hero.jpg and https://21st.dev/@pulkitxm/components/cursor-spotlight, rebuilt on the scroll;",
              "- other: X33, the opening: a tiny camera flies over their board as a landscape, a generated film on the scroll, from docs/inspo/awwwards-2026-10-18/united-5-from-above-clouds.webp;")
s = s.replace('Effect budget: signature the board tour;', 'Effect budget: signature the flight over the board;')
Path('CONCEPT.md').write_text(s, encoding='utf8', newline='\n')

m = json.loads(Path('../../motions.json').read_text(encoding='utf8'))
m.pop('spotlight', None)
m['flyover'] = {'what': 'a tiny camera flies low over the product as if it were a landscape, then climbs until the whole product is seen', 'used_by': ['finest-cut']}
Path('../../motions.json').write_text(json.dumps(m, indent=2, ensure_ascii=False) + '\n', encoding='utf8', newline='\n')

fp = Path('../../fingerprints.json')
t = fp.read_text(encoding='utf8')
t = t.replace('their real chicken board lit on black stone, the camera and a warm light go round it on the scroll',
              'a tiny camera flies low over their real chicken board as if it were golden mountains, past their sauce cups, and climbs to the whole board on black, on the scroll')
t = t.replace('the camera and a warm light go round one real photo on the scroll, the rest dimmed, one part per step',
              'a tiny camera flies low over the product as a landscape in a generated film on the scroll, then climbs to the whole product')
fp.write_text(t, encoding='utf8', newline='\n')
print(re.findall(r'"finest-cut": \{.{0,200}', t)[0][:220])
