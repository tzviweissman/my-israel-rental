# Room picture brief (R8.7): the one generated picture, behind the plan board

Made under Tzvi's standing OK of 4 Nov 2026 (generate what looks significantly better than code). Through the
Higgsfield API only (gen/still.py, higgsfield-ai/soul/standard, the model RBS's room used). Spend is measured as
the balance before and after and written in gen/report.md. At most one retry per shape.

**What it is:** a home like a customer's, shown clean. Not their work, not their premises; the page never says it is.

**Source:** no photo of theirs can be edited (a flyer with baked-in text, and a receipt with a customer's name that
is never used). The flyer gives only the feel: white, pale blue, bright, tidy.

**Prompt (wide, 16:9):** A real photograph of a bright, tidy living room in a Jerusalem apartment, morning. A large
window on the right half shows pale Jerusalem-stone buildings across the street and a clear sky. White walls, a
pale stone floor, a light grey sofa with two pale blue cushions, a low oak table with nothing on it, one green plant.
The left half of the room is calm: a plain white wall and floor, for words. Soft morning light from the window,
natural colours, eye level, 28 mm, sharp. No people, no text, no logos, no flowers, no cleaning tools, no clutter.

**Tall (9:16):** the same room, the window and sofa in the upper 55%, the plain pale floor in the lower 45%.

**Check before it stays:** bright (brightness.py passes), sharp at 1920 wide, no text or marks, nothing that
reads as a brand, window straight, stone buildings real-looking (rule 3w.7), the left half (lower part on the tall
one) calm enough for the words. Both shapes read as one room. Nothing like RBS's room (window over a park).

**Saved as:** assets/room-wide.webp (1920x1080), assets/room-tall.webp (1080x1920), under 600 KB each;
assets/og.webp 1200x630 from the wide one.
