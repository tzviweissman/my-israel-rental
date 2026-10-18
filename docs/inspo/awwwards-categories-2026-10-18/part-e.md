# Awwwards categories, part E (startups, technology, web interactive, scrolling, transitions, storytelling, microinteractions, parallax)

Captured with the intro and scroll frames at 1440x900. Pictures sit beside this file.

| Category | Site | The big idea |
|---|---|---|
| startups | Second Ride (https://second-ride.de/en) | Full-bleed split hero: two photos side by side, the one you point at widens |
| startups | Wafer (https://www.wafer.ai/) | Calm cloud-sky hero with tiny type, then a dark page with line-drawn diagrams |
| technology | ITSUA (https://itsua.com/) | A "pick the one that sounds like you" panel and a bold row of proof numbers |
| technology | BMW F3 (https://www.bmwf3.com/) | A start-engine button as the opening, then one big word per scroll chapter |
| technology | Room and Pillar (https://www.roomandpillar.com/) | A stone object floating behind a big headline, and a pill menu pinned at the bottom |
| web-interactive | Sweet Tape, Media Harbour, Think Big Studio, Artemii Lebedev, Blue2Purple | Captured but nothing distinct enough to borrow (blue agency page, plain layouts, partial frames) |
| scrolling | Awake Agency (https://www.awakeagency.dev/) | Red hero with falling balls, cards that stack like a deck, a sentence you finish by picking a word |
| scrolling | Varsity (https://www.varsity.vc/) | Photo grid that doubles as the menu, floating word tags, ribbons that carry logos |
| scrolling | Pilato (https://www.pilato.it/) | Hero that cycles through products with a new colour backdrop each time |
| transitions | Mild Sugar Design (https://mildsugardesign.jp/) | A sleeping character room, with an orange "Hey!" bubble that wakes it |
| storytelling | Bulletproof (https://www.wearebulletproof.com/) | Giant words over a wave film, then a list of names where each pops its picture |
| storytelling | MediaQuest (https://mediaquestweb.com/) | A dashed orange line that runs through every section like a trail |
| microinteractions | Bhavana Kulkarni (https://www.bhavanakulkarni.com/) | Name written in a ring that turns around the portrait |
| microinteractions | Grande Charte (https://grandecharte.co/) | Hello in many languages as the opening, and a giant email address to finish |
| microinteractions | Previously Installed (https://previouslyinstalled.com/) | One object only, a CD drive with a pile of discs |
| parallax | 71three (https://71three.com/) | Testimonials with the client's own photos flying around the quote, then a photo collage behind a line |
| parallax | AI Common (https://aicommon.creamu.co.jp/) | Glowing glass orb hero, and a pricing row where the middle plan is lit |
| not captured | Kling 4, Twain, Swimtopia, Streathers Daynes Smith, Spotkat, Sam Goddard, Emma Portner, Auge Experience | Failed, loader only, or too generic to use |

## The effects

### Opening and first screen

**1. Start-engine button between two words** (bmw-f3-1-start-button)
The page opens on the words NEXT and MOVE with a glowing red button between them, ringed by pulsing circles. You press it and the site starts. Build: code, a button with a pulsing ring and one click event that starts the page. Suits: tour guide, mover, rental apartment ("Check in"), restaurant ("Open the menu").

**2. Hero that cycles products on coloured backdrops** (pilato-1-model-cycle)
The first screen swaps through the vehicles, each in a different colour scene, under one steady line of text. Build: generated, one master image per item with a coloured scene, cross-faded in code. Suits: bakery, gift shop, caterer, rental apartment (one room per colour).

**3. Glass orb hero** (ai-common-1-glass-orb)
A softly lit glass sphere sits behind a short headline on black. It gives a calm, expensive first screen with nothing else on it. Build: generated, a looping orb clip with text over it. Suits: tutor, photographer, cleaner (a calm "clean" object).

**4. Wave film behind giant words** (bulletproof-1-wave-words)
Huge words slide over a black and white wave that moves slowly. The words change as you scroll. Build: generated, a short film, plus words moved in code. Suits: photographer, tour guide, event caterer.

**5. Hello in many languages** (grande-charte-1-greetings)
The opening is just a greeting that changes language, written large on a pale textured page, before the real page loads. Build: code, a timed word swap. Suits: tour guide, rental apartment, any business serving visitors.

**6. Sky hero with tiny type** (wafer-1-sky-hero)
A calm cloud photo with one short line and a small black button. Very little on screen, lots of air. Build: generated, one sky image. Suits: rental apartment, tutor, cleaner.

**7. Photo grid that is also the menu** (varsity-1-photo-grid)
Six photo cells fill the screen, each cell holds a menu word in its corner, with the headline across the bottom left. Build: code, a grid with hover zoom on each cell. Suits: restaurant (cells for menu, book, find us), photographer, caterer.

**8. Split hero** (second-ride-1-split-hero)
Two photos share the first screen, and the one under your pointer widens a little. Each carries its own label. Build: code, flex widths on hover. Suits: bakery (sweet or savoury), cleaner (home or office), mover (local or long distance).

### Scroll scenes

**9. One big word per chapter** (bmw-f3-2-word-chapters)
As you scroll, single words fill the screen one at a time, blurring in and sharpening, such as THE SHIFT. Each is a chapter title. Build: code, pinned section with words fading by scroll position. Suits: tour guide (the day in four words), mover, caterer.

**10. A dashed line that runs through the page** (mediaquestweb-1-dashed-path)
An orange dashed line wanders between sections and arrows toward the next button, as if drawing the route. Build: code, an SVG path drawn by scroll. Suits: mover, tour guide, any "how it works" page.

**11. Name list that shows a picture for each name** (bulletproof-2-name-list)
Client names stack as big words; the one you reach pops its photo in front. Build: code, image swaps by scroll position or hover. Suits: restaurant (dish names), photographer (shoots), gift shop.

**12. Floating word tags around a headline** (varsity-2-floating-tags)
A short statement sits in the middle while small coloured tags drift around it and settle. Build: code, absolutely placed tags with slow drift. Suits: tutor (subjects), cleaner (services), caterer (event types).

**13. Ribbons that carry logos** (varsity-3-ribbons)
Two twisting ribbons run down the page and "WE BACK EARLY, AND STAY USEFUL" sits either side, with client logos passing between them. Build: both, a drawn ribbon loop with code scroll. Suits: any business with a list of clients or partners.

### Showing products or services

**14. Cards that stack like a deck** (awake-agency-3-card-deck)
Each service is a tilted card; scrolling slides the next card over the last so they pile like a deck. Build: code, sticky stacked cards. Suits: cleaner, mover, tutor, caterer with several packages.

**15. Sentence you finish by picking** (awake-agency-4-need-picker)
"I need ... development, web design, branding" and a Next button, where the options scroll like a wheel. It turns a menu into a sentence. Build: code, a scrolling word list. Suits: cleaner, mover, caterer, tutor.

**16. Intent picker panel** (itsua-1-intent-picker)
A panel says "Pick the one that sounds like you" with five plain lines such as "My product is behind schedule". Each leads to the right page. Build: code, a modal with links, no form. Suits: mover, cleaner, tutor, rental apartment (stay for work, for family, for a break).

**17. Proof numbers row** (itsua-2-stats-row)
A row of five coloured numbers (12, 50+, 250k, 10+, 20+) under the headline, each with a small label. Build: code, count-up on load. Suits: any business with years, jobs done or reviews.

**18. Pricing row with the middle plan lit** (ai-common-2-pricing-cards)
Three plans sit on dark, the middle one in a pale card that stands out. Build: code, a three-card layout. Suits: cleaner (weekly, monthly), tutor, caterer packages.

**19. Client photos fly around the quote** (71three-1-testimonial-photos)
A customer quote and a big result number sit in the middle while photos of their work spin around it. Build: both, photos supplied by the owner, motion in code. Suits: restaurant, bakery, photographer, cleaner (before and after).

### Galleries

**20. Photo collage that parts behind a line** (pilato-2-photo-collage)
Photos of different sizes are scattered across white and slide apart as you scroll, with a line of text arriving after. Build: code, parallax at different speeds. Suits: photographer, gift shop, rental apartment (rooms).

**21. Collage behind a serif line** (71three-2-collage-words)
"Average is expensive" in italic serif with colourful photos drifting around it. Build: code, parallax photo layers. Suits: gift shop, bakery, photographer.

### Mouse and hover

**22. Falling balls on the hero** (awake-agency-1-falling-balls)
Pink and white balls drop into the hero and bounce around the headline; you can nudge them. Build: code, a small physics library. Suits: bakery, gift shop, kids party caterer.

**23. Floating project pictures with a drawn line** (awake-agency-2-floating-projects)
Project thumbnails drift at different depths while a pink hand-drawn loop passes behind them. Build: code, parallax layers and an SVG line. Suits: photographer, gift shop, restaurant dishes.

**24. Hey bubble** (mild-sugar-1-hey-bubble)
An orange circle saying "Hey!" appears over a sleeping scene and wakes it. A small playful greeting. Build: both, a generated room image plus a clicked bubble. Suits: tutor, cleaner, bakery (a night kitchen waking up).

### Navigation and menus

**25. Pill menu pinned at the bottom** (room-and-pillar-1-rock-hero)
A small rounded menu with a lime Contact button stays at the bottom of the screen while a stone object floats behind the headline. Build: code, fixed pill. Suits: every small business, especially on phones.

### Type

**26. Name written in a ring around the portrait** (bhavana-1-ring-portrait)
The person's name and role run in a circle that slowly turns around their photo. Build: code, SVG text on a path with rotation. Suits: tutor, photographer, tour guide, any one-person business.

### Footer and close

**27. Giant email as the last thing** (grande-charte-2-giant-email)
The page ends on "Have a project? Let's talk" with the email address set huge across the screen. Build: code, just very large type that is a mail link. Suits: every small business.

## Best five

1. Intent picker panel (itsua-1-intent-picker): turns a menu into "which sounds like you", easy to build and fits movers, cleaners and tutors.
2. Sentence you finish by picking (awake-agency-4-need-picker): a friendly way to choose a service and go straight to the right page.
3. Client photos fly around the quote (71three-1-testimonial-photos): puts real customer work next to the quote, ideal for restaurants and bakeries.
4. Giant email as the last thing (grande-charte-2-giant-email): a one-line closer that every small site can copy.
5. Cards that stack like a deck (awake-agency-3-card-deck): shows packages one at a time without a long page.
