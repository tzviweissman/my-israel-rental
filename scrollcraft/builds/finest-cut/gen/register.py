# One-off: register this site's opening kind and look in the shared lists. Run once from the repo root.
import json

p = 'scrollcraft/motions.json'
d = json.load(open(p, encoding='utf8'))
d['spotlight'] = {"what": "a light and the camera go round the real product, one part at a time, the rest dimmed", "used_by": ["finest-cut"]}
with open(p, 'w', encoding='utf8') as f:
    json.dump(d, f, ensure_ascii=False, indent=2)
    f.write('\n')

p = 'scrollcraft/fingerprints.json'
s = open(p, encoding='utf8').read()
new = '''  "finest-cut": {"slug": "finest-cut", "hero": "their real chicken board lit on black stone, the camera and a warm light go round it on the scroll", "signature": "their own count, 4 types of chicken and 3 sauces, walked through on the real board, ending on the price", "nav": "dark bar, round logo from their sauce lid, pages, outline order button with a count", "close": "one amber statement band mid-page; dark band with contacts and their name cropped huge", "layout": "multi-page: home (opening, kosher band, statement band, the feast with big numbers, your table or someone else's, how ordering works), shop (one product stage, order in three steps with their sauce cups), contact", "ground": "stone black with cream words and one amber band", "own_colours": ["#F6A313", "#14110E"], "effects": {"button": "B11", "link": "L2", "tile": "T8", "reveal": "R3", "steps": "S5", "price": "P5", "heading": "none", "other": ["X33", "X34", "X18"]}},
'''
s = s.replace('  "krysp":', new + '  "krysp":', 1)
s = s.replace('    "X32":', '    "X33": {"kind": "other", "name": "the camera and a warm light go round one real photo on the scroll, the rest dimmed, one part per step", "loud": true},\n    "X34": {"kind": "other", "name": "order steps shown as the business\'s own three sauce cups, one lighting per step", "loud": false},\n    "X32":', 1)
json.loads(s)
open(p, 'w', encoding='utf8').write(s)
