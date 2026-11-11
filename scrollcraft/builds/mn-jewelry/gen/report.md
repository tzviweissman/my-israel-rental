# M and N Jewelry: build report (10 Nov 2026)

Live record: business "M and N Jewelry", slug m-and-n-jewelry (src/record.json). Three pages: Home, Shop (every piece and the
order on one page), Contact. Built on branch claude/mn-jewelry-site, not published.

## The site now

- Opening: light crosses their twist ring as its gold turns white, yellow, rose; four more of their pieces drift by in
  boxes; the ring settles above "Quality. Sparkle. Comfort." Made in code from their pieces' studio pictures
  (gen/scenes.html), no generated clip and no 3D.
- Shop: eleven of their pieces, each from their own photo re-set on one dark studio surface. Every piece goes on the stage
  with its gold (white, yellow, rose), natural or lab diamonds, and a ring size for rings; one summary line carries the
  choice to the basket and the order. Every price reads From $2,000.
- Order: basket, the day you would like to see it in Jerusalem, your details; saved to their shop first, then WhatsApp with
  the total and a tracking link (tested with the requests caught, gen/test-form.mjs).
- Independent Sonnet review: review.md, latest entry last.

- 10 Nov 2026, Tzvi: "make all the diamonds look real and high end with a dynamic customize area and a great wow
  moment" (after "it looks so fake" about the film and "the rings look very fake" about the 3D designer):
  1. Real pictures: eleven of their pieces, each from their own photo, re-set on one dark studio surface with one soft
     light (gen/studio_edit.py) and checked beside their photo (gen/studio/_sheet-*.jpg). The cut-outs, the 3D designer
     and the generated film are gone. The bangle, the half eternity band on fur and the solitaire on a mirror are left
     off until there are clean photos.
  2. Customise area: every piece goes on the stage. Choose the piece, its gold (the picture fades into that gold with
     one pass of light), natural or lab diamonds, and a ring size for rings. One summary line says the whole choice and
     it reaches the basket and the order. The picture grows under the pointer for a closer look.
  3. Wow opening, made in code from those pictures: light crosses their twist ring as its gold turns white, yellow,
     rose, four more pieces drift by in boxes, and the ring settles above "Quality. Sparkle. Comfort."
- Spend this round: 42 picture edits through the API (41 Qwen Image 3 edit at 2k, 1 Grok Image 2.0). The API gave no
  price for them; the 2 Nov price note puts a still at about 1 to 2 credits. The new opening cost nothing.

## Not done yet
- Each piece's real price, what each gold and natural or lab adds, and sizes: waiting on the owner (OWNER-QUESTIONS.md 1 to 5).
- The owner's yes on the studio pictures and the three golds (OWNER-QUESTIONS.md 12).
- Hebrew version.
- FAQ, owner's name and photo, where they meet: hidden until the owner answers.

## For your call
1. The price stays "From $2,000" until the owner gives what each gold and diamond choice adds (OWNER-QUESTIONS 1).
2. The opening film has one brief drawn flash on the stone as the light crosses it. BRAND.md bans drawn sparkle
   everywhere else; it can come out of the film at no cost.
3. The yellow and rose gold pictures are edits of their photo, not photos. They stay only if the owner confirms each
   piece comes in that gold and looks right.

## Earlier rounds (history: of this, only the order flow and the dark look are on the site now)

- Opening: their own round solitaire photo full screen; a jeweler's loupe glides onto the diamond and shows it magnified,
  and the visitor moves it (drags it on a phone). The photo's sides were continued with its own white in code
  (gen/extend.py); the ring is their original pixels.
- Fifteen pieces from their twenty photos, each named only by what the photo shows, each at its listing product's $2,000.
- Order: basket, the day you would like to see it in Jerusalem, your details; saved to their shop first, then WhatsApp with
  the total and a tracking link (tested with the requests caught, gen/test-form.mjs).
- Spend (first build): 0 credits. One price check (2 credits a fill); the Higgsfield API had no image-fill model under any id it accepted,
  so nothing was charged and the extension was done in code.
- Independent Sonnet review: FAIL first (letterboxed bracelet photos, uneven prices, a guessed colour choice, thin names,
  one "M&N Jewelry" where it should be "us"), all fixed, then PASS (review.md).

- 8 Nov 2026, Tzvi's ask: the shop opens on Design your piece, a ring, tennis bracelet or necklace drawn live in 3D that
  changes with every choice of gold, centre stone, band diamonds, halo, stone size and natural or lab; designs go to the
  basket with their choices. Every price reads From $2,000. Their four shop products were renamed on the live shop at his
  request: Solitaire and halo rings, Diamond bands and solitaires, Necklaces and tennis bracelets, Earrings, bangle and
  solitaire. Review PASS after six rounds; publish-page --check passes.

- 8 Nov 2026, after Tzvi's comparison with 22 high-end jewelry sites and videos, his four choices, all built:
  1. Dark luxury look: the whole site on near-black velvet with their logo's gold as the one accent; every piece cut out
     and set on the same velvet with one spotlight (gen/studio.py), so every background matches; the 3D designer sits on
     the same ground; their logo's gold kept and its marble removed for the dark bar.
  2. Words about light: the headline is "Diamonds chosen for their sparkle" and the film closes on their own three words,
     "Quality. Sparkle. Comfort."
  3. Stone-shape wheel: in Design your piece the three shapes sit on a dial in the viewer's corner and the chosen one turns
     to the top; each Centre stone button carries the shape's outline.
  4. Macro diamond film: the home page opens on their twist ring, and scrolling moves the camera in while a band of light
     crosses the stone. Both ends of the clip are their own photo (gen/film_frames.py); laptop and phone clips, MiniMax H3
     through the API. The loupe opening was retired.
- Spend this round: 48 credits, the approved maximum (four 6 s clips: one laptop and one phone take, then one retry of each after the review found a star-shaped flare). None of it is on the site now.
