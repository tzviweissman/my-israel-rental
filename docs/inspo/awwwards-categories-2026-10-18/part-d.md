# Awwwards study, part D (photography, promotional, real estate, social, sports, startups, other)

Captured with scripts/inspo-shoot.mjs at 1440x900. Not captured (blank or loader only): nick-ho, atmos-gallery. Seen but nothing worth borrowing: reapi, the-f-list, field-rank, lev, growthbook, biite, the-soviet-flip, xiloteca (cookie banner covered the page).

| Category | Site | The big idea |
|---|---|---|
| photography | [Kinoria](https://kinoria.studio/) | Camera viewfinder in the dark, then a lens pull into a lit product scene |
| photography | [Agnes Toth](https://agnestoth.com/) | Calm editorial luxury: split-panel picker, colour-dot product viewer, six-generation story |
| photography | [Hans Sleutelaar](https://sleutelaar.xyz/) | Giant repeating name, then portraits that float over the text on hover |
| promotional | [Aikah](https://aikah.robertoattanasio.com/en) | Scrambled-letter intro, then a chapter per product with a floating chrome object |
| promotional | [Ten Pound Feather](https://tenpoundfeather.com/) | Pull a curtain to enter a clockwork world that you scroll through |
| promotional | [Kyoosang Choi](http://kyoosangchoi.com/) | Sticker book you open, then a particle explosion that spells a word |
| promotional | [Maria Vasilyeva](https://www.mariavasilyeva.com/) | Loading text wall, then a horizontal strip of images and letters |
| promotional | [Dawn Saunders](https://www.dawnsaunders.com/) | Giant first name behind a portrait on one warm colour, slatted reviews |
| real-estate | [Fox Valuations](https://foxvaluations.com.au/) | A drawn fox runs into a drawn house; sketch sofa leads into the service cards |
| real-estate | [Concrete](https://www.concretemanagement.fr/) | Full-screen split: "I am an owner" vs "I am a tenant", the chosen side widens |
| real-estate | [Rialto](https://rialto.com.au/) | Blue logo loader, aerial hero, tall condensed chapter headings over photo grids |
| real-estate | [Halcyon Lighting](https://www.halcyon.co.nz/) | An OFF switch that turns the lights on in the hero photo |
| social-responsibility | [Deferred Damage](http://plastic-ocean.com/) | Scroll descends underwater; a bottle ages as the numbers count |
| social-responsibility | [Colonia Zacamil](https://coloniazacamil.com/) | An aerial photo sits inside the headline as one of its words |
| other | [LPAS](https://lpas.com/) | Full-screen colour panels, one per project type, sliding sideways |
| sports | [Blunt Umbrellas](https://bluntumbrellas.com/) | One big product with plus-hotspots that explain each feature |
| sports | [Justin Jefferson](https://jjettas.com/) | Trading cards that fan out, giant outline type behind each partner product |
| sports | [Sixes Cricket](https://sixescricket.com/) | Pink-stripe opening, then a cream booking card right on the page |
| sports | [Glowing Cheetah](https://www.glowingcheetah.com/) | Torn zigzag edge between a dark hero and a white page |

## The effects

### Opening and first screen

**1. Viewfinder reveal** (kinoria-1-viewfinder-reveal)
A black screen with thin camera frame lines and a tiny shutter readout. The scene behind it comes up out of blur, then snaps sharp and the big name lands on the lit table.
Build: both. A short generated clip of the focus pull, code for the overlay lines and title.
Suits: photographer, gift shop, bakery, tour guide.

**2. Fox runs into the house** (fox-valuations-1-fox-runs-into-house)
A flat line drawing of a house on warm cream. A small fox runs across and goes in through the door. Cheap, charming, and it says "home" with no photo.
Build: code, an SVG or Lottie animation on a short timeline.
Suits: rental apartment, cleaner, mover, property manager.

**3. Blue logo loader** (rialto-1-blue-logo-loader)
A solid brand-colour screen with the logo bars drawing in, then a cut to the full-screen aerial. It makes the first second feel like a brand event.
Build: code. Colour block plus SVG draw-on, then fade to the hero.
Suits: any business with a simple mark.

**4. Lights-off toggle** (halcyon-lighting-1-lights-off-toggle)
The hero photo starts dim with an OFF switch in the corner. Flip it and the house lights come on. The product is the effect.
Build: both. Two photos (dark and lit) cross-faded by a toggle.
Suits: rental apartment, restaurant, cafe, florist.

**5. Image inside the headline** (colonia-zacamil-1-image-inside-headline)
A tall condensed headline where one word slot is a small aerial photo. The photo acts as a word.
Build: code. Inline element with the same height as the type.
Suits: tour guide, rental apartment, caterer.

**6. Pull the curtain** (ten-pound-feather-1-pull-the-curtain)
An engraved curtain and logo with the word PULL. Drag or scroll and the curtain parts to reveal the site.
Build: both. Engraving-style image, code for the pull.
Suits: gift shop, bakery, tutor, photographer.

**7. Giant name behind a portrait** (dawn-saunders-1-giant-name-portrait)
A huge first name in white across one warm colour, with a black-and-white portrait in front of the letters. Personal and easy to remember.
Build: code, with a cut-out portrait.
Suits: tutor, photographer, tour guide, any owner-led business.

### Scroll scenes

**1. Underwater descent** (deferred-damage-1-bottle-ages-stats)
Scroll sinks you deeper in teal water. A bottle changes as the years tick, and one big number fills the screen at each stop.
Build: both. Layered images with scroll-driven counters.
Suits: tour guide (a day in the Old City), mover (the journey of a box), cleaner (before and after).

**2. Clockwork tunnel** (ten-pound-feather-2-gear-tunnel)
Scroll flies the camera through gears, with one line of text typing in at each stop.
Build: generated. A flythrough clip scrubbed by scroll, with code for the text.
Suits: restaurant (inside the kitchen), mover, cleaner.

**3. Chrome object per chapter** (aikah-1-chrome-object-chapters)
One shiny object per text block, turning as you scroll, text on the left.
Build: generated. A rotating clip per object, scrubbed.
Suits: gift shop, bakery, jeweller.

**4. Particles spell a word** (kyoosang-choi-2-particle-word)
Floating objects explode into a dust cloud that settles into the word ACTION.
Build: code. Canvas particles.
Suits: gift shop, events caterer.

### Showing products or services

**1. Pick what you need** (fox-valuations-2-pick-what-you-need)
"What do you need valued?" with three large photo cards, each a plain-word service with a link.
Build: code.
Suits: cleaner, mover, tutor, tour guide.

**2. Split owner or tenant** (concrete-1-split-owner-tenant)
The screen is two tall rooms. Hover or tap one and it widens while the other dims. One click to the right path.
Build: code.
Suits: rental apartment (I am a guest or I am an owner), mover, any two-audience business.

**3. Colour blocks per service** (lpas-1-colour-block-categories)
Each project type gets a full colour panel with its own photo and a small label. Panels slide along as you scroll.
Build: code.
Suits: cleaner (home, office), caterer, photographer.

**4. Product hotspots** (blunt-umbrellas-1-product-hotspots)
One large product photo with plus marks. Each mark opens a short line about that feature.
Build: code.
Suits: gift shop, bakery, rental apartment (point at the balcony, the kitchen).

**5. Colour dots on a product** (agnestoth-2-colour-dot-product)
Small colour dots under the product switch the photo and the price block.
Build: code.
Suits: gift shop, bakery, florist.

**6. Booking card in the page** (sixes-cricket-1-booking-card)
A cream card with place, date, time and people in one row and a bright Book Now button, right in the scroll.
Build: code.
Suits: rental apartment, tour guide, restaurant, tutor.

### Galleries

**1. Split-panel picker** (agnestoth-1-split-panel-picker)
Two big photos side by side, labelled Handbags and Accessories. Hover to grow one.
Build: code.
Suits: photographer, gift shop, rental apartment (rooms by type).

**2. Film strip of images and letters** (maria-vasilyeva-1-film-strip-letters)
A long thin strip across the middle that runs by, mixing small images and big letters, with a cluster of cards on the side.
Build: code.
Suits: photographer, tutor, gift shop.

**3. Card fan** (justin-jefferson-1-card-fan)
Collectible cards stagger and rise at different speeds as you scroll.
Build: code.
Suits: gift shop, restaurant dishes, rental apartments as cards.

### Navigation and menus

None worth borrowing in this batch.

### Mouse and hover

**1. Portraits float over the text** (sleutelaar-2-hover-portraits)
On a plain blue text page, small portraits drift in under the cursor and sit behind the words as you move through the list.
Build: code.
Suits: restaurant (dish photos on a menu list), tutor, photographer.

**2. Sticker book opens** (kyoosang-choi-1-sticker-book-opens)
A covered sketchbook sits in the middle, "click to open". It opens on a click.
Build: code with a generated cover image.
Suits: gift shop, photographer, wedding caterer.

### Type

**1. Repeating name marquee** (sleutelaar-1-name-marquee-type)
The full name repeats across the screen in tight rows, scrolling slowly. Pure type, strong and cheap.
Build: code.
Suits: any business with a short name.

**2. Tall condensed chapter headings** (rialto-2-condensed-chapter-headings)
Very tall narrow capitals in the brand colour over photo grids, one per chapter.
Build: code.
Suits: restaurant, rental apartment, tour guide.

**3. Giant outline word behind product** (justin-jefferson-2-giant-type-behind-product)
A huge faint word sits behind each partner product and the product breaks out in front of it.
Build: code.
Suits: gift shop, bakery, caterer.

### Transitions

**1. Torn edge** (glowing-cheetah-1-torn-edge-hero)
The dark hero ends in a zigzag cut, like torn paper, before the white page starts.
Build: code. CSS clip-path.
Suits: bakery, gift shop, caterer.

**2. Review slats** (dawn-saunders-2-review-slats)
Reviews sit as narrow vertical slats. Click one and it widens to show the quote.
Build: code.
Suits: any business that has reviews.

### Forms

See the booking card above (sixes-cricket-1-booking-card).

### Footer and close

**Product spotlight in a dark band** (halcyon-lighting-1-lights-off-toggle): the closing sections use one big word on a dark band; borrow the habit of ending on a single large phrase ("Begin again.") from Dawn Saunders.

## Best five

1. Split owner or tenant (concrete-1-split-owner-tenant): two doors on the first screen, ideal for our rentals page.
2. Lights-off toggle (halcyon-lighting-1-lights-off-toggle): a switch that lights up the apartment photo.
3. Fox runs into the house (fox-valuations-1-fox-runs-into-house): a cheap, charming drawn animation for any home business.
4. Booking card in the page (sixes-cricket-1-booking-card): date, people and a bright button without leaving the scroll.
5. Product hotspots (blunt-umbrellas-1-product-hotspots): plus marks on one big photo, good for a room or a product.
