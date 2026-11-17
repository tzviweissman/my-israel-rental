"""Rebuild docs/inspo/pinterest-ads-2026-11-02/motion/index.html from its data.json (16 Nov 2026).
Add a row (code, score, idea, cat, what, src, url, by, video, poster) to data.json, then run:
    python scripts/build-motion-index.py
Rows are shown 5s first, then by score; the filter bar has one button per idea."""
import html
import json
from pathlib import Path

M = Path(__file__).resolve().parents[1] / "docs/inspo/pinterest-ads-2026-11-02/motion"
rows = sorted(json.loads((M / "data.json").read_text(encoding="utf-8")), key=lambda r: -r["score"])
e = html.escape
fives = sum(r["score"] == 5 for r in rows)
srcs = sorted({r["src"] for r in rows})

head = """<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Moving ads</title>
<style>:root{--bg:#fff;--ink:#111827;--mut:#666;--line:#e3e3e3}@media (prefers-color-scheme:dark){:root{--bg:#111;--ink:#eee;--mut:#aaa;--line:#333}}
body{margin:0;font:14px/1.45 system-ui,sans-serif;background:var(--bg);color:var(--ink);padding:16px}h1{font-size:22px;margin:0 0 4px}.lead{color:var(--mut);margin:0 0 12px;max-width:760px}
.bar{display:flex;flex-wrap:wrap;gap:6px;margin-bottom:14px}button{border:1px solid var(--line);background:none;color:var(--ink);border-radius:99px;padding:5px 11px;cursor:pointer}button.on{background:#000;color:#fff;border-color:#000}
.g{display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:14px}.c{margin:0;border:1px solid var(--line);border-radius:12px;overflow:hidden}video{width:100%;aspect-ratio:9/12;object-fit:cover;background:#000;display:block}
figcaption{padding:8px 10px}figcaption b{display:inline-block;background:#167AB8;color:#fff;border-radius:6px;padding:0 6px}.t{color:var(--mut)}figcaption p{margin:4px 0}a{color:#167AB8;font-size:12px}</style></head><body>
"""
out = [head, f"<h1>Moving ads ({len(rows)}, {fives} scored 5)</h1>\n",
       f'<p class="lead">Animated and video ads ({", ".join(srcs)}), kept from many more watched. Each clip plays when it '
       'is on screen. Notes in ../README.md, "Moving ads".</p>\n',
       '<div class="bar" id="bar"><button class="on" data-f="5">Only 5s</button><button data-f="all">All</button>',
       *(f'<button data-f="{e(i)}">{e(i)}</button>' for i in sorted({r["idea"] for r in rows})), "</div>\n",
       '<div class="g" id="g">']
for r in rows:
    link = f'<a href="{e(r["url"])}" target="_blank" rel="noopener">{e(r["src"])} · {e(r.get("by", ""))}</a>' if r.get("url") \
        else f'<span class="t">{e(r["src"])}{" · " + e(r["by"]) if r.get("by") else ""}</span>'
    out.append(f'<figure class="c" data-s="{r["score"]}" data-i="{e(r["idea"])}"><video src="{e(r["video"])}" '
               f'poster="{e(r["poster"])}" muted loop playsinline preload="none"></video>\n<figcaption><b>{r["score"]}</b> '
               f'<span class="t">{e(r["idea"])} · {e(r["cat"])}</span><p>{e(r["what"])}</p>'
               + (f'<p class="t">{e(r["lesson"])}</p>' if r.get("lesson") else "") + f'{link}</figcaption></figure>')
out.append("""</div>
<script>
const cs=[...document.querySelectorAll('.c')];const io=new IntersectionObserver(es=>es.forEach(e=>{const v=e.target;if(e.isIntersecting){v.preload='auto';v.play().catch(()=>{})}else v.pause()}),{rootMargin:'200px'});
cs.forEach(c=>io.observe(c.querySelector('video')));
const show=f=>cs.forEach(c=>c.style.display=(f==='all'||(f==='5'?c.dataset.s==='5':c.dataset.i===f))?'':'none');
document.getElementById('bar').onclick=e=>{const b=e.target.closest('button');if(!b)return;document.querySelectorAll('#bar button').forEach(x=>x.classList.toggle('on',x===b));show(b.dataset.f)};show('5');
</script></body></html>
""")
(M / "index.html").write_text("".join(out), encoding="utf-8")
print(f"index.html: {len(rows)} ads, {fives} scored 5")
