# uxpeak: "This UI/UX Redesign Will Teach You More Than 100 Tutorials Combined" (second study)

- Channel: uxpeak. URL: https://youtu.be/GGg61sdEjeI. About 13.5 min. First study: `GGg61sdEjeI.md` (frames only, no transcript).
- Method this time: video downloaded, a frame every 4 s (203 frames) in 11 contact sheets, every sheet looked at, PLUS the full transcript (obtained through youtube_transcript_api after yt-dlp subtitles gave 429). Tags: SHOWN = seen on screen, SAID = in the narration.
- Subject: one mobile product page (organic strawberries) with 15 numbered mistakes, then 3 extra improvements. Mobile shop page, not a landing page, but most fixes are generic.
- What the old notes missed in structure: the presenter numbers the fixes 1 to 15 and then adds three "improvements" (scroll card, sticky bottom bar, preset quantities). The 15 are cheap hygiene; the 3 are what makes it feel premium. The old notes also missed mistakes 1, 3, 11, 12 and 13 almost entirely, and the scroll card.

## What is shown, with timestamps

- 0:00-0:36: the ugly page, "pause and count the mistakes", markers 1 to 15 around the phone.
- 0:37-1:22 (mistake 1): nav icons sit straight on the photo and work only because that strawberry photo is dark. Swap in a bright pineapple and they vanish (SHOWN 0:55). Fix: a subtle container behind each icon, enough contrast, a thin outline, so it holds on any photo (SHOWN 1:18, white circles with dark arrow and dots).
- 1:24-1:59: Mobbin sponsor and research (product pages, checkout, order confirmation, saved items). Caption "Design for systems, not screens."
- 2:00-3:32 (mistake 2): six photos A to F with a mood meter. A too busy, no focal point. B hands are the subject, lifestyle not product. C one strawberry but the item is sold by weight, "a small mismatch in the user's mind". D pink background looks artificial for fresh organic food. E strong but would not match the others in a grid. F wins: natural, clean ground, one visual system for the whole catalogue. 3:06 shows a messy grid next to a tidy one.
- 3:34-4:15 (mistake 3): alignment. Some items slightly left, some right. SAID: users do not consciously notice "but they feel it", less calm, less trustworthy. Fix: one margin (example 24 px, chip at 4:03) used down the whole screen.
- 4:17-4:50 (mistake 4): colour too bright and saturated, emphasising the wrong things. Softer natural palette. Captions: sets the mood, supports the product, guides attention.
- 4:51-5:17 (mistake 5): too many font styles. One family (Lato), hierarchy by size, weight, colour, line height. Bolt, Euclid, Instrument Sans, Futura as references.
- 5:20-5:48 (mistake 6): "FRUITS" label cramped, add letter spacing. Badge "20% OFF DISCOUNT" plus icon cut to "20% off".
- 5:50-6:18 (mistake 7): title size and weight wrong for the hierarchy; "stands out without shouting".
- 6:20-6:50 (mistake 8): paragraph lines too close. Increase line height; SAID slightly reduce body contrast. "Headlines attract attention, paragraphs support understanding."
- 6:51-7:25 (mistake 9): rating moved up to the title. "What is it, and can I trust it?"
- 7:48-8:20: sponsor segment (uxpeak plus, code). Skip.
- 8:21-8:55 (mistake 10): feature icons: too many colours, some filled, some outlined, some heavy. One logic, fewer colours, tighter spacing so the row "no longer dominates the screen".
- 8:55-9:20 (mistake 11): divider lines "extremely dark and heavy", the page splits into harsh blocks. Soften them. SAID: "small details are often what make an interface feel premium". SHOWN: black rules become pale.
- 9:21-9:46 (mistake 12): spacing between some sections too LARGE, layout disconnected. Tighten slightly.
- 9:47-10:15 (mistake 13): redundant "Price:" label. A number with a currency sign is a price; labelling it would mean labelling the stepper too. Removed.
- 10:16-10:55 (mistake 14): "1 kg" in the title is misleading because the stepper changes quantity. Price moved up under the rating; old price struck through, "per kg" added.
- 10:55-11:35 (mistake 15): Add to cart is all caps and oversized, "shouting". Softer sentence case, stepper beside it with the unit inside ("1 kg"), total inside the button ("Add to cart · $6.20"). "That removes uncertainty."
- 11:41-12:16 (improvement 1): content becomes a soft card with rounded corners and a subtle shadow that slides up over the product image. Once the photo is no longer the focus, the item name moves into the top bar and sticks.
- 12:16-12:42 (improvement 2): sticky bottom action area (stepper plus button) stays visible over a related products grid.
- 12:43-13:17 (improvement 3): preset chips (0.5 kg Snack, 1 kg Regular, 2 kg Family, 3 kg Party) with prices; custom stepper kept. SAID: base the presets on real purchase data.
- 13:18-13:29: original beside new version.

## Lessons

1. **Controls over a photo get their own backing (soft container, enough contrast, thin outline) and are tested on a bright photo AND a dark one, not only the photo in the design.** NEW (old notes only said "calm backdrop"). Check: render the hero with a white photo and a black photo; back and menu buttons stay readable in both.
2. **Pick the photo for how the item is sold, not only for looks.** One strawberry for a by-the-kilo price is a mismatch; hands in the frame make it lifestyle, not product. NEW. For us: a tray photo for a tray price, a single slice for a per-slice price.
3. **A product background must look natural for the product** (a pink studio ground on fresh food reads fake). NEW.
4. **Same treatment across the set (background, light, props) so a grid looks like one catalogue.** ALREADY (old notes rule 9, one look per product, rules 3p).
5. **One left margin down the whole page.** Text, price, button and icons start at the same x; slightly off is felt as less trustworthy. NEW (old notes had spacing groups, not a shared margin). Check: collect the left edge of every text block and button in a column; one value, 1 px tolerance.
6. **Divider lines are pale and thin, never black.** NEW as a stated reason (the flow theme's #E3E3E3 hairline already does it, so the value is ALREADY in the palette). Check: no rule darker than that hairline.
7. **Too much empty space is also a fault.** Oversized gaps between related sections disconnect the page. NEW, a counter to "generous whitespace". Gap between groups at least 2x the gap inside a group (ALREADY old rule 4) but not beyond about 4x.
8. **Paragraphs: line height about 1.5 to 1.6, contrast kept at 4.5:1 or better.** The video says "slightly reduce contrast"; never go below 4.5:1. NEW for the line-height number. Check: computed line-height over font size at least 1.5.
9. **Small uppercase labels get letter spacing (about 0.06 to 0.12 em); badges are two or three words.** Badge part ALREADY (old rule 8); letter spacing NEW.
10. **Do not label what is obvious.** No "Price:" before "$6.20"; a currency sign says it. Same for a "Phone:" label before a number with a phone icon. NEW.
11. **Buttons are sentence case, not all caps, not oversized.** "Add to cart · $6.20", not "ADD TO CART". NEW. Check: no `text-transform: uppercase` on primary buttons.
12. **Feature icon rows: one family, one stroke weight, one muted colour, and the row must not outshine title and price.** Identical items ALREADY (old rule 5); "muted, does not dominate" NEW.
13. **No changeable value in the name** ("1 kg" in the title while a stepper changes it). ALREADY (old rule 10).
14. **Sticky bottom bar with the stepper and a button that carries the total, visible while the visitor reads on.** Bar and total ALREADY (3g, 3j, rule line 184: never covers content). NEW is the reason: people decide halfway down, not at the top, so the action cannot live only at the top.
15. **Scroll card over the photo: the content area is a rounded, softly shadowed card that slides up over the photo; when the photo is gone the item name moves into the top bar and sticks.** NEW. The visitor never loses what they are looking at. Fits a bakery item, a gym class, a board.
16. **Presets come from real orders, with a custom option kept.** Chips ALREADY (old rule 7); "based on what people actually buy" NEW. Ask the owner which sizes sell; do not invent them.
17. **Build order: hygiene first (margin, colour, type, spacing, labels), then the three experience upgrades (card, sticky bar, presets).** NEW. A page with no mistakes is not yet premium.
18. **Study a screen library for the same type of page first** (Mobbin for product pages and checkout). ALREADY (3e, inspo workflow).

## Do not copy

- The 4.8 stars with "89 reviews", the red "20% off", the struck-through old price, "Often bought with" and any quantity discount. Invented numbers; 3j applies. Only real, checkable ones.
- "Reduce body text contrast". Never below 4.5:1.
- The sponsor segments and discount code (uxpeak plus, Mobbin).
- The olive green button. Our buttons follow the flow theme (black with white text).
- Its font choice (Lato). Our type is locked (Playfair Display and Manrope, RTL swap).
- Phone status bar and back-arrow chrome: not for a business site.

## For our pages (bakeries, coffee, nail salons, gyms, gift shops, caterers, meat boards)

- Real-looking sites feel calm: one margin, one type family used in weights, hairline dividers, nothing that shouts. Check the margin and the rules before anything fancy.
- Choose each hero and product photo for how it is sold (by slice, by tray, by session), on a natural ground, and back any control over it so it survives whatever photo the owner swaps in.
- Open with the item name and the real price early, real trust below it (only real reviews), and an action bar that follows the visitor with the real total.
- The card that slides over a big photo and carries the name up into the top bar is a high-end, cheap-to-build move for bakery, coffee and gift item pages.
- Package chips (half tray, full tray, party tray; 1, 5, 10 sessions) only with the owner's real sizes and prices.
- Premium is subtraction: no "Price:" labels, no all-caps buttons, no confetti of coloured icons.
