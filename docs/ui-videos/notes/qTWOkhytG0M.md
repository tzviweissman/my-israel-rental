# Christian Peverelli: "How to Build $10,000 Websites Using Claude Code (Full Guide)"

- Channel: Christian Peverelli. URL: https://youtu.be/qTWOkhytG0M. Length: 27:20 (1640 s).
- Method: 720p download, one frame every 10 s (11 contact sheets, 4x4, all viewed), two 0.25 s-step strips at 19:26 and 19:58 (scroll motion), English transcript read in full via youtube_transcript_api. Every 10 s rather than 5 s because most of the video is a talking head or a screen recording of a chat box.
- Caveat: only about 10 of the 27 minutes show the finished design (roughly 11:00 to 22:00). The rest is a presenter, Claude desktop-app UI, and a Hostinger hosting upsell with a discount code. The "$10,000" is a title claim, never shown as a sale.

## What is shown
- 0:40-1:10 Overlay cards list "5 things to get right": strategy (one goal: capture an email, book a call), custom design ("not another AI template"), custom motion (scroll animations, even some 3D), mobile responsive (browser, phone, iPad), it actually works (form wired to a CRM, real domain). A reference site at about 1:10 has a 3D glass spine at the right of the hero, small serif paragraph at left, tiny nav.
- 5:50-10:40 Inspiration sources. 21st.dev ("The living library of interfaces", dark navy page with gradient cards); a hero with an animated white wave-line field on black; a grid of dark hero thumbnails; motionsites.ai (frame 10:40: a car hero with the hood opening, glowing marker dots, a prompt-copy button); a Pexels photo page for licence-free car photos, which he downloads.
- 8:00-10:00 The brief has three sections: Hero, Interior story, Book a test drive. He types a product-requirements prompt, asks for real research on how people describe the subject, and uploads the photos plus a sheet describing each shot.
- 11:00 First build: light slate-blue gradient page, small "VEYRA" wordmark top-left, headline "Electric, from the outside in." about 40 px, sans, left-aligned, orange car photo cut out and centred (about 60% of the width), lime-yellow pill button top-right. Plain but the goal is clear.
- 11:20-11:50 Section 2 on near-black: left-aligned "Step inside." with small side text at right; section 3 "Take the wheel." with a lime-yellow "Book a test drive" button. Sections alternate blue and black blocks.
- 13:20-16:00 Interior section after the second pass: tall photo in a right column, a numbered list of short rows at left ("The seat", "The driver's side", "What's in the cabin": sport seats, two textures, orange stitching), tiny grey captions with a "Photo 03" credit line. Strip at 19:58 shows the motion: the photo scrolls with a slight lag, the next heading fades up from low opacity, list rows fade in one after another, a second photo slides in from the left edge.
- 14:10-16:00 He pastes a code prompt from motionsites.ai and asks Claude to restyle it as his own car. Result at 19:30: car in a rounded-corner frame, lime dots on the wheel and hood, a three-swatch wheel chooser below, tabs "Exterior / Open hood / X-ray" top-right. Open hood lifts the hood; a dot opens a label card; a colour swatch recolours the car (red, yellow, green, silver, grey), see 21:30.
- 20:00-21:30 Dark navy-to-indigo version with glowing blue lines at the page edges, wordmark "PEVERELLI", an exploded chassis and engine drawing with a short heading "Electricity, into motion." and a short list (stator windings, rotor, reduction gear). White heading 32-40 px, left-aligned.
- 22:30 "Last steps": phone-width view stacks the hero (car above, wheel chooser as a small card below); agents compress files "so it loads quicker".
- 23:30-25:00 Hostinger plans, coupon code, domain; 25:50 "Live on a custom domain". 26:40 recap card ticks all five things.

## Candidate rules for us
1. **Give every page one job and say it in the first screen.** SHOWN 0:50-1:00 (capture-an-email button mockup), 8:00 (Hero / story / Book). SAID 0:25-1:10 (strategy: a purpose such as book a call). For us: a bakery opens with one button, "Order for Shabbat" (WhatsApp); a kashering page opens with "Book a kashering visit".
2. **Ship a three-section skeleton first, then add layers.** SHOWN 8:00, 11:00 (bare skeleton before polish). SAID 5:40-6:20 (layered, "a very basic first version, a skeleton"). For us: hero, what we do, contact; review it, then add motion and polish as a separate pass.
3. **Build from the business's own real photos, never invented ones.** SHOWN 10:40 (downloaded photos), 13:20 (large interior frames). SAID 6:30-7:00. For us: the owner's own bakes, trainer, event. He used licensed Pexels shots of a car he does not own; we must not do that as if the shop made it (see rejected).
4. **Hero = one large cut-out or framed product, short left-aligned headline in plain sans, one accent-coloured pill button.** SHOWN 11:00, 19:30 (about 40 px headline, pill top-right, rounded frame). For us: the cake or gift box centred on a single soft ground; one accent for every button.
5. **Make the hero something the customer can operate, with real assets.** SHOWN 19:30-21:30 (hood opens, dots label parts, swatches recolour the product). SAID 14:30-16:00. For us: gift wrap colour swatches, cake tabs "Inside / Outside / Sizes". Needs a real photo per state; no faked states.
6. **Reveal on scroll: heading fades up, list rows stagger one by one, a second photo slides in from the side.** SHOWN strip 19:58 (cabin section). SAID 9:50-10:10 ("appearing animations so it looks expensive"). For us: use the fail-safe `.js-reveal` with `prefers-reduced-motion`; stagger about 80-120 ms per row, travel under 24 px.
7. **Tell the page as a short story, outside then inside then the action.** SHOWN 11:20-11:50 ("Walk around, then step inside." then "Take the wheel."). For us: bakery goes "the shop, the bench, take a box home"; trainer goes "meet you, a session, book a trial".
8. **Feature lists are short rows with a one-line note, not paragraphs.** SHOWN 13:20-16:00 (seats, textures, stitching), 21:00 (stator, rotor, reduction gear). SAID 9:50 ("clear bullet points"). For us: "Challah, babka, rugelach" each with one line; kashering "oven, stovetop, sink".
9. **Research how people talk about the subject and write real copy, not filler.** SHOWN 12:40 (specific interior wording). SAID 9:50-10:10. For us: copy comes from the owner's own words and facts; ask, don't invent.
10. **Test at phone width and compress images as a final separate pass.** SHOWN 22:30. SAID 22:00-23:00. For us: add an image weight budget and look at the phone screenshot before the owner sees the page.
11. **A form is only done when it reaches the owner.** SHOWN 23:30-25:50 (wired to live domain). SAID 1:10-1:30 (form connected to a CRM or email tool). For us: send a test message through the form to the owner's email or WhatsApp before showing the page.
12. **Pull sections and effects from reference libraries and restyle them in the business's own palette.** SHOWN 5:50-10:40 (21st.dev, motionsites.ai). SAID 7:20-8:00. For us: matches our 21st and Inspo rule; show 3 to 4 options, then use the owner's colours.
13. **Run a second critique pass that lists gaps and fixes them.** SHOWN 9:00-9:40 (it reports "no interior photos yet", "didn't use the inspiration"). SAID 9:00-9:40. For us: render, list what is missing, fix, re-render before showing.

### Rejected or restricted for honesty
- "$10,000 website" and "sell to other businesses" (25:30-26:30): an unsupported price claim; not for page copy.
- Lamborghini photos under the invented brand "Peverelli" (9:50-10:10, 22:00): an invented brand using another maker's car photos. A page must never present stock or someone else's photos as the business's own work.
- "Book a test drive" for a product that does not exist: demo-only; no booking flow that goes nowhere.
- Hostinger discount code and hosting upsell (23:30-25:00): affiliate material, not design guidance.
- Glowing dots, X-ray tab and 3D model of an invented car: need real assets per business; no faked technical detail.
- Alternating blue and near-black blocks: conflicts with our locked white-and-hairline flow theme; take only the section structure.

### Frames
- C:\Users\tzviw\Documents\my-israel-rental\docs\ui-videos\notes\frames\qTWOkhytG0M-1040.jpg : motionsites.ai reference, the car-hero library (10:40).
- C:\Users\tzviw\Documents\my-israel-rental\docs\ui-videos\notes\frames\qTWOkhytG0M-1930.jpg : final hero with hotspot dots, swatch chooser and tabs (19:30).
- C:\Users\tzviw\Documents\my-israel-rental\docs\ui-videos\notes\frames\qTWOkhytG0M-2005.jpg : cabin section mid-scroll (20:05).
- C:\Users\tzviw\Documents\my-israel-rental\docs\ui-videos\notes\frames\qTWOkhytG0M-2120.jpg : dark section with exploded chassis and short list (21:20).
- C:\Users\tzviw\Documents\my-israel-rental\docs\ui-videos\notes\frames\qTWOkhytG0M-2130.jpg : colour swatch change, product recoloured (21:30).
