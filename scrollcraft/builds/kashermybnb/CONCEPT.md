# KasherMyBnb, kitchen kashering, concept

Category: service

Replaces BRIEF.md (kept for the facts list, every fact on the page is in it). Reworked 22 Oct 2026 to the `service` row of rule 3t.

## Ideas
- **Trucking model, say what you do plainly** (docs/inspo/awwwards-anatomy-2026-10-22/services/trucknroll-white-rest.webp): Truck'N Roll names the job in the first line, then shows facts on a white rest with numbers. For us: the headline says "Kitchen kashering for rentals, in Jerusalem and across Israel", facts sit on white.
- **Numbered steps, one sentence each** (docs/inspo/awwwards-anatomy-2026-10-22/services/townhouse-d-sheet.webp): Townhouse shows 01 to 06 with one line each. For us: How it works, 01 to 04, from their own booking flow.
- **Services as named panels with one picture each** (docs/inspo/awwwards-anatomy-2026-10-22/services/aventura-services-dark-panel.webp): Aventura gives each service one panel with a picture and a link. For us: two panels, Whole kitchen and Pots and cutlery, each with its photo, price, time and the one button.
- Own: the walk. Their promise is that every part of a strange kitchen is handled, so the opening walks the kitchen wall station by station and ticks each part in the nav index, ending on "Ready to use."
- Mobbin search 25 Oct, after the build, "home services booking hero section with numbered steps": YLLW (https://mobbin.com/sites/sections/fa9788f2-54fc-4579-9173-7052eadacd20: "Four steps. A clear process") and Airtasker (https://mobbin.com/sites/sections/562c15ad-712e-47b4-8db8-a8561e49441e: three numbered steps beside service tiles). Both confirm the numbered-steps idea we chose (How it works, 01 to 04); neither has an opening event like our kitchen walk, which stays the opening.
- 21st search 25 Oct, after the build, "booking steps stepper": Stepper by originui (https://21st.dev/@originui/components/stepper) and Registration Stepper by ravikatiyar162 (https://21st.dev/@ravikatiyar162/components/registration-stepper). Not used in the build; our four-step booking bar was built earlier from their own flow.

## Chosen
The walk as the opening event (their own promise, kept from the first build) and the service pattern after it: light ground for facts, two service panels, numbered steps, places list, one blue closing block for the booking, one dark footer. The Moto-style photo screens between sections were removed (rule 3t).

## Wow gate
1. Strongest real photo: their own pots photo sits as the second service panel's picture; the kitchen wall is the opening, full width, the largest image they have.
2. Signature moment from their own thing: the camera visits oven, microwave, stovetop, countertops, sink and hot plate and ticks each; the whole wall ends marked "Ready to use."
3. The choice changes the page: the booking flow takes the service chosen and fills the review and sent pages with it.
4. Side by side: Truck'N Roll's plain facts and numbers on white, Townhouse's numbered steps (pictures above); ours uses the same pattern with their real services and prices. Sources (recorded 25 Oct): closest Mobbin reference https://mobbin.com/sites/sections/fa9788f2-54fc-4579-9173-7052eadacd20; Inspo docs/inspo/awwwards-anatomy-2026-10-22/services/townhouse-d-sheet.webp; 21st "booking steps stepper" found Stepper (originui).
5. One sentence: a camera walks round one kitchen wall and ticks off every part they kasher, then the page tells you the two prices and how it works.

## Effects
- button: B6, from our own idea: label and arrow in two blocks, the arrow slides on hover (kept from the first build)
- link: L7, from docs/inspo/awwwards-anatomy-2026-10-22/services/trucknroll-white-rest.webp: plain underlined text links on white
- tile: T3, from docs/inspo/awwwards-anatomy-2026-10-22/services/aventura-services-dark-panel.webp: a panel with one picture, name, price and button
- reveal: R1, from the effects library: fade up
- steps: S4, from docs/inspo/awwwards-anatomy-2026-10-22/services/townhouse-d-sheet.webp: numbers 01 to 04 over a rule, one sentence each
- price: P5, from our own idea: price in text colour beside the time, accent kept for the main button
- heading: none
- other: X-walk, from our own idea: the pinned kitchen walk
- touch: the station index in the bar ticks like their checklist as the camera visits each part of the kitchen, from our own idea (their flyer is a checklist)

## Not alike
kashermybnb-kashering-services: different from all 11 other pages

## Where the WhatsApp number comes from (22 Oct 2026 review)

The number in site.js (972584031989) is not in the owner's flyer notes or BRIEF.md, but it is in their own
MyIsraelRental listing record: `whatsapp: "+972584031989"` with `whatsapp_confirmed: true` and
`booking_mode: "whatsapp"` (seen in scrollcraft/builds/home-openings/data/gigs.json, a copy of the
listing data, created 1 Sep 2026). The booking message goes to the number the listing already books on;
the page does not print it. The owner is still asked in message-to-owner.md which number takes WhatsApp.
