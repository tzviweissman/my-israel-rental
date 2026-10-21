# one-off: turn the starter's site.css into this business's base (tokens and button states), then business.css is appended
import shutil
shutil.copy('../../starter/site.css', 'site.css')
s = open('site.css', encoding='utf8').read()
a = s.index(':root {'); b = s.index('*, *::before')
s = s[:a] + """:root {
  /* the brand, from her logo (gold monogram, leaf green, strawberry) and her fruit */
  --ground: #FFFBF3; --surface: #EFF3E4; --ink: #17261C; --soft: #4F5B50; --accent: #C62B45; --accent-ink: #FFFFFF; --line: #DDE3D0;
  --leaf: #3F6B3A; --gold: #B8925A; --melon: #FFE9C9;
  --font-head: 'Amatic SC', 'Segoe Print', cursive; --font-body: 'Open Sans', system-ui, sans-serif;
  --r: 14px;
  --gutter: clamp(18px, 4vw, 44px); --bar-h: 64px; --top-h: 68px; --out: cubic-bezier(.2, .7, .2, 1);
}
""" + s[b:]
s = s.replace("h1, h2, h3 { font-family: var(--font-head); margin: 0; line-height: 1.04; }",
              "h1, h2, h3 { font-family: var(--font-head); font-weight: 700; margin: 0; line-height: .95; letter-spacing: .005em; }")
s = s.replace('.btn[aria-busy="true"]', """.btn { position: relative; box-shadow: 0 0 0 0 rgba(198,43,69,0); transition: box-shadow 220ms var(--out), transform 120ms var(--out), width 260ms var(--out), padding 260ms var(--out), background 160ms; }
@media (hover: hover) { .btn:hover { box-shadow: 0 0 0 5px rgba(198,43,69,.2); } }
.btn:active { transform: scale(.97); box-shadow: 0 0 0 2px rgba(198,43,69,.3); }
.btn .tk { position: absolute; inset: 0; margin: auto; width: 24px; height: 24px; opacity: 0; transform: scale(.6); transition: opacity 160ms, transform 200ms var(--out); }
.btn.added { padding-inline: 0 !important; background: var(--leaf); }
.btn.added > span { opacity: 0; } .btn.added .tk { opacity: 1; transform: none; }
.btn > span { transition: opacity 120ms; white-space: nowrap; }
.btn[aria-busy="true"]""", 1)
s = s.replace("/* CHANGE: the outline button's hover and press, chosen with the main one */",
              "@media (hover: hover) { .btn-line:hover { border-color: var(--accent); color: var(--accent); } } .btn-line:active { transform: scale(.97); }")
s = s.replace(".mark img { width: 36px; height: auto; }",
              ".mark img { width: 38px; height: 38px; border-radius: 50%; box-shadow: 0 0 0 1px var(--line); }\n.mark { font-size: 1.75rem; letter-spacing: .01em; min-height: 44px; } .mark span { padding-top: .08em; }")
s = s.replace(".nav a { padding: .55rem .9rem;", ".nav a { padding: .6rem 1rem;")
s += "\n" + open('gen/business.css', encoding='utf8').read()
open('site.css', 'w', encoding='utf8').write(s)
print('site.css', len(s))
