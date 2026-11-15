# Review of Gremier Coffee Co. (independent, 15 Nov 2026, third look: the first 2.6 s of the film play by themselves on arrival, and the phone film has new tall Steep and Pour clips)

Method: webkit with devices['iPhone 13'] at 390x664 (its real Safari viewport) and again at 390x844; chromium at 1440x900. Home film scrolled in 30 steps (390x664), 80 steps (390x844) and 24 steps (1440x900), a screenshot after each, plus the arrival at 0.5 s and 3.5 s. The seams between the tall clips checked on the files themselves (last frame of s2, s3, s4 against the first of s3, s4, s5 with ffmpeg). Whole home page and shop page scrolled at 390x844. Screenshots in C:/Users/tzviw/AppData/Local/Temp/claude/cb449cd502c6c9de/adf5a651-acb9-41c3-b66c-4d86a50fd92c/scratchpad/review/shots/ (sheetarr.png, sheetm0-3.png, sheetg0-5.png, sheetd0-2.png, seams.png, sheeth*.png, sheets*.png). Shop cards, basket and order message were not changed since the 13 Nov look; items 1 to 7a, 9, 13 and 14 carried from it (the shop page was re-scrolled on a phone: one column pair, no overflow). No site file edited; only this one.

1. PASS: shop cards share one shoot and one crop (carried; re-seen on the phone shop page).
2. PASS: prices and Add buttons line up in each row (carried).
3. PASS: one wording per purpose (carried).
4. PASS: pressable things respond (carried).
5. PASS: tabs and chips change the photo (carried).
6. PASS: choices sit under the item (carried).
7. PASS: order message complete (carried, not changed).
7a. PASS: savings true from their prices (carried).
8. PASS: the phone clips show the whole grinder, whole glass, whole bar; the whirlpool fills the width and is not a crop of anything. Laptop film unchanged.
9. PASS: same bottle, jug and bar everywhere (carried).
10. PASS (re-checked 15 Nov after the caption fix, max-width 38vw minus the gutter, 130 px wide at 390): at 390x664 and 390x844 the Grind, Steep, Pour and Serve cards sit in the left third and the stream of ground coffee, the stream into the glass and the glass are clear. The captions wrap on whole words (no split word, nothing clipped, no horizontal overflow of the card). Minor, not a FAIL: at 390x664 the Pour and Serve cards brush the top-left rim of the glass by a few pixels for a few steps. Cold, Steep and Pour read well at the narrower width.
11. PASS: nothing blank at any step on laptop or phone. Note (not a FAIL): on phones the 9:16 clips leave a cream band about 100 px tall between the menu bar and the picture at 390x844, so the film does not fill the screen top to bottom.
12. PASS: phone order bar hidden during the film, shown after it, never over an Add button for long (it scrolls past).
13. PASS: copy and prices match src/facts.md; chapter lines are their own words.
14. PASS: beans, ground, cold water, brown whirlpool, glass of ice and their coffee bar is their world; the grinder sits inside their word.

Film checks:
A. PASS: arrival plays. At 0.5 s beans are pouring into the grinder (also on webkit); by 3.5 s the grinder has opened and the scroll then leads. The opening card clears the grinder.
B. PASS: the grounds drop once. They leave the grinder in Grind, carry on as one stream into Cold, hit the water and taper off. In Steep nothing falls. The only later fall is the coffee stream into the glass in Pour (a drop and then a stream), which is a different thing (one dark drop above the plain ice glass looks a little like a bean, minor).
C. PASS: the whirlpool is clearly seen: the brown sea turns into a swirl, the camera dives into the dark centre and comes out into the glass. It fills the phone screen over roughly 12 steps of 80.
D. PASS: slides join without a jump. Last frame of Cold equals first of Steep, last of Steep equals first of Pour, last of Pour equals first of Serve (seams.png). The only visible blend is the Pour to Serve fade, a short ghost of the glass over the bar (as before).
E. PASS: no overflow (scrollWidth 390) on home or shop at 390; no failed requests except the local gift-card API call to localhost:8001 (not running here, not a site fault).
F. CAUTION (not scored): no touch-action: manipulation on buttons, so a fast double tap on Add may zoom the page on a real iPhone; the emulator cannot show it. Adding it to buttons and links would remove the risk.
G. PASS: laptop film at 1440x900 unchanged and working; menu, contact and footer fine on the phone.

FAILs: none (item 10 fixed and re-checked).

Verdict: PASS
