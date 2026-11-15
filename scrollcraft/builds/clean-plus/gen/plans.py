"""Write plan lines into BLUEPRINT.md: python gen/plans.py plans.json (id -> plan text)."""
import json, re, sys
bp = 'BLUEPRINT.md'
plans = json.load(open(sys.argv[1], encoding='utf-8'))
lines = open(bp, encoding='utf-8').read().split('\n')
out, i, done = [], 0, set()
while i < len(lines):
    out.append(lines[i])
    m = re.match(r'- \[.\] (R[\w.]+) ', lines[i])
    if m and m.group(1) in plans and i + 1 < len(lines) and lines[i + 1].strip().startswith('plan:'):
        out.append('  plan: ' + plans[m.group(1)]); done.add(m.group(1)); i += 2; continue
    i += 1
open(bp, 'w', encoding='utf-8').write('\n'.join(out))
print('set', len(done), 'missing', sorted(set(plans) - done))
