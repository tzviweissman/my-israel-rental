"""Their WhatsApp catalogue (src/whatsapp-catalog.txt, read from screenshots) against their website's products
(src/site/Product.json): doubles, pieces only on WhatsApp, pieces only on the website, prices that differ.
Writes gen/catalog/whatsapp-check.md. Run from the build folder."""
import json, re, collections, difflib

def norm(s):
    s = s.lower().replace('hadlakas', 'hadlokas').replace('hadlakos', 'hadlokas').replace('tzedaka ', 'tzedakah ').replace('challa ', 'challah ')
    s = s.replace('chanuka ', 'chanukah ').replace('havdala ', 'havdalah ').replace('colored', 'color').replace('towel/bread', 'towel / bread')
    s = re.sub(r'\((silver|gold|white|silver ?& ?white)\)|-\s*(silver|gold|white|pink)$|pack of 4 cards', '', s.strip())
    s = s.replace('havdalah tray set with drawer', 'havdalah set drawer').replace('side opening bencher set', 'side opening bencher')
    return re.sub(r'[^a-z0-9]+', ' ', s).strip()

web = [x for x in json.load(open('src/site/Product.json', encoding='utf8')) if not x['hidden']]
W = {norm(x['name']): x for x in web}
W2 = {re.sub(r'[^a-z0-9]+', ' ', x['name'].lower()).strip(): x for x in web}
rows = []
for l in open('src/whatsapp-catalog.txt', encoding='utf8'):
    if l.startswith('#') or not l.strip(): continue
    n, p, ph = [t.strip() for t in l.split('|')]
    rows.append((n, p, ph))

out = ['# WhatsApp catalogue against the website (gen/catalog/match_whatsapp.py)', '']
cnt = collections.Counter((norm(n), ph) for n, p, ph in rows)
doubles = sorted({n for n, p, ph in rows if cnt[(norm(n), ph)] > 1})
out += [f'## Listed twice or more on WhatsApp with the same photo ({len(doubles)})', ''] + [f'- {d} (x{cnt[(norm(d), next(ph for n, p, ph in rows if n == d))]})' for d in doubles]
names = collections.Counter(norm(n) for n, p, ph in rows)
colours = sorted({n for n, p, ph in rows if names[norm(n)] > 1 and cnt[(norm(n), ph)] == 1})
out += ['', f'## Same name, different colour photo (not doubles, but they need their own names) ({len(colours)})', ''] + [f'- {c}' for c in colours]
seen, only_wa, price_diff, matched = set(), [], [], set()
for n, p, ph in rows:
    k = norm(n)
    if k in seen: continue
    seen.add(k)
    m = W.get(re.sub(r'[^a-z0-9]+', ' ', n.lower()).strip()) or W2.get(re.sub(r'[^a-z0-9]+', ' ', n.lower()).strip()) or W.get(k) or (W[difflib.get_close_matches(k, W.keys(), 1, .93)[0]] if difflib.get_close_matches(k, W.keys(), 1, .93) else None)
    if not m: only_wa.append((n, p, ph)); continue
    matched.add(m['id'])
    pw = m['price_shekel']
    pn = re.match(r'\d+', p)
    if pn and float(pn.group()) != pw: price_diff.append((n, p, pw))
    if m['name'].strip().lower() != n.lower() and norm(m['name']) != k: out_name = True
out += ['', f'## Only on WhatsApp, not on their website ({len(only_wa)})', ''] + [f'- {n}, {p}, photo: {ph}' for n, p, ph in only_wa]
out += ['', f'## Prices that differ ({len(price_diff)})', ''] + [f'- {n}: WhatsApp {p}, website {w:g}' for n, p, w in price_diff]
rest = [x for x in web if x['id'] not in matched]
out += ['', f'## On the website, not seen in these screenshots ({len(rest)})', ''] + [f'- {x["name"].strip()}, {x["price_shekel"]:g}' for x in rest]
wd = collections.defaultdict(list)
for x in web: wd[norm(x['name'])].append(x)
dup = [(k, v) for k, v in wd.items() if len(v) > 1]
out += ['', f'## Listed twice on their website ({len(dup)})', ''] + [f'- {v[0]["name"].strip()}: ' + ', '.join(f'{x["price_shekel"]:g} ({x["colors"] or "no colour"})' for x in v) for k, v in dup]
open('gen/catalog/whatsapp-check.md', 'w', encoding='utf8').write('\n'.join(out) + '\n')
print('\n'.join(out))
