s = open('gen/build.py', encoding='utf8').read()
rep = [
    ("json.dumps([{'k': k, 'n': n, 'f': f, 'a': a} for k, n, c, f, a in SHADES])",
     "json.dumps([{'k': k, 'n': n, 'f': f, 'a': a, 'c': c} for k, n, c, f, a in SHADES])"),
    ("  var frame = document.getElementById('frame'), name = document.getElementById('shade-name'), book = document.getElementById('book-shade');",
     "  var frame = document.getElementById('frame'), name = document.getElementById('shade-name'), book = document.getElementById('book-shade'), hero = document.getElementById('open');\n  hero.style.setProperty('--tint', SHADES[0].c);"),
    ("    name.textContent = SHADES[i].n;", "    name.textContent = SHADES[i].n;\n    hero.style.setProperty('--tint', SHADES[i].c);"),
    ('''  <section class="hero" id="open" aria-labelledby="h-open">
    <div class="wrap">''', '''  <section class="hero" id="open" aria-labelledby="h-open">
    <div class="tint" aria-hidden="true"></div>
    <p class="ghost" aria-hidden="true">Elisheva</p>
    <div class="wrap">'''),
]
for a, b in rep:
    assert s.count(a) == 1, a[:60]
    s = s.replace(a, b)
open('gen/build.py', 'w', encoding='utf8').write(s)
c = open('site.css', encoding='utf8').read()
c += '''
/* wow pass (19 Oct 2026): the shade you tap colours the whole opening, and a
   giant "Elisheva" in her script sits behind the photo in that colour */
.hero { isolation: isolate; }
.hero .tint { position: absolute; inset: 0; z-index: -2; background: var(--tint, #F4EFEE); opacity: .32; transition: background-color 900ms cubic-bezier(.65, 0, .35, 1); }
.hero .ghost { position: absolute; z-index: -1; right: -2vw; top: 50%; translate: 0 -46%; margin: 0; font: 400 min(30vw, 62svh)/1 var(--font-script); color: var(--tint, #F4EFEE);
  opacity: .55; white-space: nowrap; pointer-events: none; transition: color 900ms cubic-bezier(.65, 0, .35, 1); filter: saturate(1.2) brightness(.92);
  animation: ghost-in 1600ms var(--out) both; }
@keyframes ghost-in { from { opacity: 0; transform: translateX(6vw); } to { opacity: .55; transform: none; } }
.hero .frame { max-width: min(560px, 76svh * .8); }
@media (max-width: 860px) { .hero .ghost { font-size: 44vw; top: 22%; right: -8vw; } }
@media (prefers-reduced-motion: reduce) { .hero .ghost { animation: none; } }
'''
open('site.css', 'w', encoding='utf8').write(c)
print('ok')
