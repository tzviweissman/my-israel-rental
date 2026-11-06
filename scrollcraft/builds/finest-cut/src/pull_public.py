# Stand-in for fetch_business.py using the public API (the direct database read was refused on 6 Nov 2026).
import json,os,urllib.request
from PIL import Image
b=json.load(open('src/public.json',encoding='utf8'))
ls=b.get('listings') or []
rec={'business':{k:v for k,v in b.items() if k!='listings'},'listings':ls}
rec['business']['_id']=b['id']
json.dump(rec,open('src/record.json','w',encoding='utf8'),ensure_ascii=False,indent=1)
urls=[b.get('cover_url'),b.get('logo_url')]
for g in ls:
    urls+=g.get('gallery') or []
    for it in (g.get('tiers') or [])+(g.get('products') or []): urls+=it.get('images') or []
n=0
for u in dict.fromkeys(x for x in urls if x):
    n+=1
    p='src/owner/p%02d.jpg'%n
    req=urllib.request.Request(u.replace('/upload/f_auto,q_auto/','/upload/f_jpg,q_90/'),headers={'User-Agent':'mir-build'})
    open(p,'wb').write(urllib.request.urlopen(req,timeout=60).read())
    print(p,Image.open(p).size,u)
