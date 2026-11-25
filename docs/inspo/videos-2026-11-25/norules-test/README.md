# The no-rules test (idea D3, 25 Nov 2026)

From RoboNuggets' video (Boris Cherny's "hobbling"): do our rules hold the model back? One first screen for a real,
live business, Gremier Coffee Co., built two ways.

- **With our rules:** the live site's first screen, built by Opus with the full rulebook (`rules-laptop.png`,
  `rules-phone.png`, frames from the build's own preview videos at 1.5 s).
- **Without:** a fresh Sonnet helper given only `src/record.json`, `src/facts.md`, the owner's two photos and
  `docs/inspo/by-look.md`, and told not to open the rulebook, the skill or the build's own files (`norules-laptop.png`,
  `norules-phone.png`, `gremier-first-screen.html`). Sonnet, because Tzvi's standing rule is that helpers run on
  Sonnet; so the test leans against the no-rules side.

`compare.png`: top, laptop (rules left, no rules right); bottom, phone (rules left, no rules right).

## What it shows

The no-rules screen holds up well:
- **A sharper headline from the owner's own words:** "Brewed for hours. Never bitter." (facts.md) against our
  "Cold brew & coffee bars".
- **The owner's real coffee-bar photo** as the hero, the price beside the button ("1 litre of Classic Dark Roast
  ₪49"), and three facts under a hairline.

What the rules added:
- **An event, not a still:** the grinder film (3h, "opening needs a wow"). The no-rules page is a photo with small drift.
- **Honesty:** the no-rules page says "Order by Wednesday, receive by Shabbat" for everyone. facts.md says that is for
  Jerusalem and Beit Shemesh only. Our rules (facts only, said as the owner said them) would have caught it.

What it suggests (for Tzvi to judge; no rule changed):
- The rules protect honesty and the opening event, but the words may be held back: the rules-built page chose a plain
  category line over the owner's own promise. Worth tracing which headline rule led there (the add-a-rule steps:
  trace sources before changing anything).
- One test, one business, one sample. Repeat on the next real build before changing any rule.
