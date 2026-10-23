# Product hero shots, 23 Oct 2026

Rule 8 ("The product hero shot"), approved by Tzvi on 22 Oct. Every shot is edited from the owner's own photo in Higgsfield nano_banana_2 (role image_references, 2k), one job at a time, and compared with the original. The first shot in each set became the scene reference for the rest. Contact sheets per site: `hero-shots/<site>.jpg` (their photo on the left, the new shot on the right). Nothing here is on the live pages.

Spent 72.5 credits (572.6 to 500.1).

| Site | Shots (Higgsfield job) | In the build |
|---|---|---|
| The Whipped Cup | caramel c22dad83, classic 3506e471, vanilla dabb7f40 | shop stage (`jar-*-hero.webp`); home rooms, thumbs and the One Flavour tile use a tall crop of the same shot (`jar-*.webp`) |
| Bun Intended | cinnamon 362b4e0d, espresso 8b483c39, lotus ebba524b, chocolate a20a09b6 | the four flavour cards (`bun-*-hero.webp`); the builder and the pour keep the cut-outs |
| American Crust | bagel pack 05a4ba4e, pizza tub 7318e229 | home and shop (`bagel-hero.webp`, `pizza-hero.webp`) |
| The Brown Box | classic b7c5e9c8, tropical bb2bfe05, sunrise 7c1f2df5, superfruit 1f5207a9, own 2d808b99 | Pick your bowl (`bowls/*-hero.webp`), now rounded squares instead of circles |
| L.A. Cholent | gold b001b430, plum ad6b6ec3, steel 428e8013 | the three size cards (`tub-*.webp`) |
| Blazin' Boards | board df538c13 | the closing "Ready when you are" screen (`board-hero.webp`) |
| Chicken Munch | cornflake 7b66991b, fruity cdb5d2a9, rice krispie 966628ee | the kinds mosaic and the menu (`*-hero.webp`) |
| RS Modest Activewear | skirt b1dcd497 | the product card on the home page (`skirt-hero.webp`) |

## Fixed by hand, not by the model

- **American Crust pizza tub:** three tries all misread the small print (50GRAM, 60GRAM, 855-330-2730). The first try's scene was kept and their real label was cut from their photo and pasted on in code.
- **L.A. Cholent, steel:** the model wrote "Stir wall". The three colour versions line up exactly, so the label was copied from the gold one.
- **Whipped Cup vanilla:** coffee beans covered the small print in her photo; it was redrawn with the wording of her other two labels.

## Not done

- **The Brown Box gift boxes:** their only photos are 239 px. The try (e0d4cd36) invented tag words ("Açail Coceem Bowl") and changed the bowl's fruit, so it was dropped. Question 5 in `message-to-owner.md` asks for a photo of each box.
- **L.A. Cholent sizes:** they have one tub photo; `large.jpg` and `xl.jpg` are flyers. The three cards show the same tub in each card's colour, not three different containers.
- **Blazin' Boards sizes:** one board photo; the size ruler grows it in code. One hero shot, not five.
- **Chicken Munch:** Classic and Hot Poppers keep his photos (no clean source of the same kind), and the boxes and pans still need a photo each.
- **Gift Boutique phone film:** a 5 s MiniMax H3 clip between the existing first and last frames (0c9aff22, 10 credits) came out darker: the black lid passes through the middle third (brightness 3). Not used; the current film stays.
- Lechem Emek skipped as asked.
