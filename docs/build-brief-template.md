# Builder brief (copy for every site build or rework)

The one brief every builder gets (Tzvi, 24 Oct 2026: "make future builds better, faster and have less errors"). Fill in the brackets, delete nothing else. Each line is a mistake that already reached Tzvi once.

---

Build [new site / rework] for **[business name]** ([category: food-shop, place, fashion-shop, beauty, events, trainer, service, rental], rule 3t). R = C:\Users\tzviw\Documents\my-israel-rental. Folder: R\scrollcraft\builds\[folder]. Listing id: [gig id]. Served at http://127.0.0.1:8990/[folder]/ (do not start or stop that server).

**Read first:** R\docs\page-generation-rules.md (all of it), R\scrollcraft\starter\README.md, the business's src/record.json and every photo on src/sheet.jpg, and [what Tzvi asked, in his words].

**1. Facts.** Only what the business gave: listing, flyer, photos, owner messages. No invented claims, years, counts or delivery. Every price and product name matches the live listing. Questions for the owner go in message-to-owner.md (never sent, never signed); build the rest while they wait.

**2. Research before ideas** (rules 3c.1, 3h.6). Search Mobbin, Inspo and 21st for this category's openings and sections, and docs/inspo. CONCEPT.md names each source (a mobbin.com link, a docs/inspo picture, the 21st component); if a search fails, say so. Ideas come from the business's own world, never a formula ("ingredients, cooking, the dish" for every food site).

**3. The wow opening** (rule 3h). Check what the opening already does first. If it is not already a full-screen event from their own thing, write three numbered film steps and the cost, and stop for Tzvi's yes before any paid generation. **Never rule the film out.** Films follow the scroll (frames on a canvas: R\scrollcraft\starter\film.js), never a video that plays once. No scroll cues.

**4. Paid generation** (rule 8, right the first time). Before any credit: gen/[name]-brief.md with a close crop of the one item, its traits written from the crop and kept, only the camera, light or setting changed, no idealising words. Stills before video. Put each result beside their photo before using it.

**5. Selling** (rules 3j, 3k, 3t). Price and Add within two screens for a shop. Savings only like for like, as "N% off" with the real separate price struck. Every order or booking is saved to MyIsraelRental first (POST to /api/...), then WhatsApp opens. Real times and prices from the listing.

**6. Copy.** Their words first; "we" for the business, "you" for the visitor; no long dashes, no exclamation marks, no slogans; a headline says what the customer gets.

**7. Prove it** (rule 3a, every rule, every site). `node scripts/check-build.mjs scrollcraft/builds/[folder]` must pass: it runs check-site, check-fits, check-motion and readable on every page, then check-concept, check-fingerprints and check-rules. RULES.md answers every checklist line with a real reason ("not judged" and the like are refused). Then put screenshots on one sheet (laptop 1440x900 and phone 390x844, the opening at several scroll points) and look at it yourself; fix what looks weak before replying.

**Never:** commit, push or publish; touch other sites, fingerprints.json (unless told), backend or frontend; kill processes by name; print secrets; sign as Tzvi.

**Reply:** what you built in 4 to 6 lines, the check-build result, the sheet path, owner questions, and anything you could not do and why.
