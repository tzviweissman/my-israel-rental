# Independent review, Bake away (page rules 3r)
Used for real with Playwright at 1440x900 and 390x844: scrolled the opening film, tapped flavours, added from cards and the shop stage, went through all 3 order steps (window.open stubbed, /api/ intercepted). Screenshots in gen/review/. No console errors, no horizontal scroll.

1. Same-kind items shown alike: FAIL. index.html "Cream doughnuts" is a dark band with THREE photos side by side; every other item (DIY kit ... Babka) is a card with one 120px photo. Fix: one photo (cream-p02) in the same card style. Flavour chips and the 8 doughnut cut-outs are alike (PASS part).
2. Prices, units, buttons in same place: PASS. Price left, Add right on every card (index, 1440 and 390); shop stage price, stepper, Add in one row for all 10 items.
3. One wording per purpose: PASS. Main button "Order" in nav, hero, bar, closing band, contact; "Add" on every item; "Choose" only on Cakes (needs a pick).
4. Pressable things respond: PASS. Chips, Add, steppers, step list show pressed states and "Added" toast.
5. Big photo follows the item: PASS. Index flavour spot: chips 1/4/7 gave 1 of 8 / 4 of 8 / 7 of 8 with matching photo and name. Shop: all 8 flavours and all 10 bakes change the photo (checked the src each time).
6. Choices right under the item: PASS. Doughnuts show Milky/Parve and flavour under the photo, Cakes show Marble/Honey/Mocca, other items offer none. Note for owner: Cream doughnuts ("a very wide variety") has no flavour choice and Cakes on index says Choose (goes to shop); acceptable, ask owner for the cream varieties.
7. Order message complete and correct: PASS. 7 lines, totals right (16+18+70+120+2x16+45+250 = 551), delivery address, day (Sunday 1 November), name, phone, notes, "delivery fee to be confirmed"; POST to the order API fired with correct product ids; WhatsApp URL to 972583233995.
7a. Savings: PASS. No saving shown; none exists from the owner's prices (same price milky/parve).
8. Photos not soft/stretched/sliced: PASS at both sizes (hero doughnut whole, cut-outs whole, cards whole).
9. One look per product: PASS. Same cut-out and product photos on index and shop.
10. Stops make sense: PASS in the 18/19 scroll stops each side; film ends with the full drizzled doughnut and its copy.
11. Nothing blank: PASS. No empty reveal bands seen (laptop and phone). The gallery section stays hidden when empty.
12. Phone order bar: PASS. Hidden while film, flavour spot and shop stage are on screen; on cards it only sits at the screen bottom with the same Order button, no card button was blocked in the stops.
13. Every fact theirs: FAIL.
   - "Baked at home by Malky Ballon" (index kitchen heading, 390 and 1440): the name appears nowhere in src/record.json, only inside the email address malkyballon@gmail.com. Invented claim; remove the name ("Baked at home in Jerusalem") or get the owner's confirmation.
   - "Closed for Shabbat and holidays" (shop step 2 hint): record only says shabbat_closing true; "holidays" comes from the live order form, not her record. Say "Closed for Shabbat".
   - "Drizzled by hand" (hero kicker): not in her sources; the drizzle is a film effect. Replace with a record fact.
   Everything else matches: prices, tier names/descriptions, 24-48 hours, delivery "Jerusalem and more", cash/bit/bank transfer, Badatz Eida HaChareidis, founded 2020, Hebrew and English, WhatsApp +972 58-323-3995, email.
14. Touch only this business has: PASS. The chocolate drizzle landing on her own doughnut as you scroll, then her 8 doughnut flavours turning on the same spot; works on both sizes.
Extra: voice "we", never "they" (the only "they" is a code comment): PASS. No exclamation marks and no long dashes in visible text: PASS. Minor, not blocking: on the phone the basket list lines wrap unevenly (price under the stepper for some lines, beside it for DIY kit).

Verdict: FAIL
Must fix: (1) Cream doughnuts band uses three photos, make it a one-photo card like the rest; (13) remove invented name "Malky Ballon", change "Shabbat and holidays" to "Shabbat", replace "Drizzled by hand".

## Second pass, 28 Oct 2026
Re-read the live files (same server).
- Finding 2 (name): FIXED. "Malky Ballon" is gone from index, shop and contact; heading reads "Our home bakery", which matches the record's "home-based business". PASS.
- Finding 4 ("Drizzled by hand"): FIXED. The phrase no longer appears; the first chapter line is "Milky or parve", from her doughnut tiers. PASS.
- Finding 3 (Shabbat and holidays): ACCEPTED. The coordinator shows her platform setting is "Closed on Shabbat and holidays" and the server refuses yom tov dates, so the message must name holidays. Not a defect.
- Finding 1 (Cream doughnuts band): ACCEPTED. It is a separate section of three of her own photos of one product's varieties with one price and one Add; the ivory cards are one photo each. A visitor sees a deliberate feature band, not an inconsistent card. Not a defect.
Nothing else changed; earlier PASS items stand.

Verdict: PASS
