"""How a WhatsApp chat shows a tall ad, before it is sent (Tzvi, 25 Nov 2026: "When I send the ad on WhatsApp some
of it is cut off unless people press on it which they don't do"). Rule A8.10 in docs/ad-rules-checklist.md.

    python scripts/ad-chat-view.py <ad.jpg> <sheet.jpg>

A chat shows a picture taller than 3:4 as its centred 3:4 window until someone taps it: measured on Tzvi's phone
the restaurants ad (1080x1920) showed rows 250 to 1670 only. The sheet puts the whole ad, with that window marked,
beside the window alone at phone size. Every word, the name, the link and the QR must be inside it."""
import sys

from PIL import Image, ImageDraw

RATIO = 1420 / 1080    # the tallest a chat shows uncut, height over width (measured: 0.76 wide to 1 high, a hair under 3:4)
ad = Image.open(sys.argv[1]).convert("RGB")
W, H = ad.size
h = min(H, round(W * RATIO))
top = (H - h) // 2
marked = ad.copy()
d = ImageDraw.Draw(marked)
for y in (top, top + h):
    d.line([(0, y), (W, y)], fill=(230, 30, 30), width=6)
show = 720
a = marked.resize((round(W * show / H), show))
b = ad.crop((0, top, W, top + h)).resize((round(W * show / h), show))
sheet = Image.new("RGB", (a.width + b.width + 60, show + 50), "white")
d = ImageDraw.Draw(sheet)
d.text((4, 10), f"WHOLE AD (red: what a chat shows, rows {top} to {top + h})", fill="black")
d.text((a.width + 40, 10), "IN THE CHAT, before anyone taps", fill="black")
sheet.paste(a, (0, 40))
sheet.paste(b, (a.width + 40, 40))
sheet.save(sys.argv[2], quality=88)
print(f"wrote {sys.argv[2]}: a chat shows rows {top} to {top + h} of {H}")
