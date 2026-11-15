import re,json,sys
r=json.load(open('clean-plus/src/rbs-plans.json',encoding='utf-8'))
t=open('clean-plus/BLUEPRINT.md',encoding='utf-8').read()
n=sys.argv[1]
s=re.split(r'\n## ',t); s=[x for x in s if x.startswith('Stage %s.'%n)][0]
for m in re.finditer(r'- \[ \] (R[\w.]+) (.*)\n  plan: (.*)',s):
  print(m.group(1),'|',m.group(2)[:150],'\n   RBS:',r.get(m.group(1),'-')[:220],'\n   NOW:',m.group(3)[:120])
