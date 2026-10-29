"""site.css = the starter's structure (tokens set for Krysp) + gen/krysp.css (her own parts)"""
import os; os.chdir(os.path.join(os.path.dirname(__file__), '..'))
s = open('../../starter/site.css', encoding='utf8').read()
s = s[:s.index('/* ── BELOW HERE')]
s = s.replace("--ground: #FFFFFF; --surface: #F6F6F6; --ink: #111111; --soft: #555555; --accent: #333333; --accent-ink: #FFFFFF; --line: #E5E5E5;",
 "--ground: #FBF1E6; --surface: #F3D5BB; --ink: #392615; --soft: #6B5440; --accent: #8A5A1E; --accent-ink: #FFF8EF; --line: #E3C7AC; --peach: #F3D5BB;")
s = s.replace("--font-head: Georgia, serif; --font-body: system-ui, sans-serif;", "--font-head: 'Nunito', 'Arial Rounded MT Bold', sans-serif; --font-body: 'Mulish', system-ui, sans-serif;")
s = s.replace("--r: 16px;", "--r: 18px; --shadow: 0 3px 30px rgba(57,38,21,.14);")
open('site.css', 'w', encoding='utf8').write(s + open('gen/krysp.css', encoding='utf8').read())
print('site.css', len(s))
