# How to think like a GENIUS UI/UX designer

- Channel: Kole Jain
- URL: https://youtu.be/HE4rLEQpiXY
- Length: 5:25 (about 5.5 min). Mobbin sponsor segment at 2:14-2:40.
- Method: video downloaded, frames sampled every 3 s and viewed, plus subtitle text. Frame timestamps can be off by a few seconds.

## What is shown

Mostly kinetic-type captions over film clips, with a worked mock UI (a made-up "Runway" vacation-rental site) built up step by step.

- 0:25-0:55, intent first. A lone search bar on a plain card (one field, one round blue search button). It grows to four labelled fields: Where / Check-In / Check-Out / Travellers, with a round indigo search button. Then the same bar over a hero photo headed "Find your next getaway". Presenter: the hero photo and header add nothing the bare bar did not. Frame: `frames/HE4rLEQpiXY-0051.jpg`.
- 1:00-1:25, second intent (browsing). A grid of 5 listing cards per row under the search bar, then a row of category icons with labels (Pool, Pet friendly, Waterfront, Treehouse...) as filters. Presenter: fonts, colours and icons change the look but little of the function; functionality grows only as the user's intent grows.
- 1:25-2:10, expected layouts. The search bar is shown moved to the bottom of the page, to show it is possible. Presenter: after 30 years users expect nav on top, top-to-bottom and left-to-right flow, and obvious CTAs. Conventional layouts are easier to extend and make responsive. Make it yours with a micro-interaction or one unique feature.
- 2:41-3:10, decide which content to show. Cards show only location, rating, price. A longer description was tried then removed. Presenter: scanners need location, rating and price first; detail lives behind the click.
- 3:10-3:30, structure the content you do show. A card with a very long title is truncated with an ellipsis ("Icelandic house near ..."). The save icon sits in a small circle so it stays visible on a bright photo. Frame: `frames/HE4rLEQpiXY-0321.jpg`.
- 3:34-4:05, animation must add clarity. A nav with many links (List Your Property, Wishlist, My Trips, For You, Services, FAQ, Packages, Deals, Blog, Contact) runs out of room, so it collapses into a menu that slides in. Frame: `frames/HE4rLEQpiXY-0346.jpg`. A large search bar shrinks to a compact "Where to next?" pill that expands on click.
- 4:05-4:20, a "Load more" button under the grid with the footer (Support / Runway / General columns, copyright) visible below. Frame: `frames/HE4rLEQpiXY-0418.jpg`. Presenter: preferred over infinite scroll because the user keeps control and can reach the footer.
- 4:20-4:28, buttons get a small animation; scroll-hijacking effects used very sparingly, if ever. On screen: a black pill "Book a call" button with a small green "3 spots open" line under it, and an AirPods Pro scroll-jacking site as the thing to be careful with.
- 4:28-5:14, design systems. A token sheet: spacing scale 4/8/12/16/20/24/32/40/50 px, heading sizes h1 20 down to h5 12 px, colour dots, button radii (Large 20px, Small 10px). Material Design shown as the heavyweight example. Presenter: building the system matters more than the design itself; break the rules only on purpose.
- 0:00-0:25 shows award-style sites (a yellow "Buttermax" page, a dark particle site) as the "impress other designers" trap.

## Candidate rules for us

Context: one-page sites for small local businesses in Israel, honest persuasion only.

1. Start from the visitor's job, not the look. For each business list the 1-3 things a visitor comes to do (order, book, call, see prices) and put the control for that first. SHOWN (0:25-1:25).
2. Do not put a hero image behind the main action just to fill space. Test: does the hero add information or an action the plain version lacked? If not, shrink it. SHOWN (0:50-1:00) and SAID.
3. Keep conventional structure: nav on top, content top-to-bottom, CTA visible and easy to find. Novelty goes into one micro-interaction or one distinctive feature, not the skeleton. SAID (1:25-2:10).
4. Cards show only what a scanner decides on (bakery: name, price, one-line description; coach: package name, price, who it is for). Detail goes behind a click or expander. SHOWN (2:41-3:10).
5. Design for the worst content: truncate long titles with an ellipsis, and put icons or text over photos on a solid circle or scrim so contrast holds on any photo. Test with a very long Hebrew name and a very bright photo. SHOWN (3:10-3:30).
6. Use motion only when it does a job: opening a menu, expanding a search, button feedback. No decorative scroll animation. Buttons get a small hover/press animation. SHOWN and SAID (3:34-4:28). Respect reduced-motion.
7. Collapse long navigation into a menu instead of squeezing links; on a one-pager keep the top bar to 3-5 anchors plus one CTA. SHOWN (3:43).
8. Prefer a "Load more" button over infinite scroll so the footer (contact, address, hours) stays reachable. SHOWN (4:05-4:20).
9. Scroll-hijacking effects: avoid, or allow only with a clear reason. This is stricter than our cinematic pages; decide per business. SAID (4:22).
10. Define spacing, type scale and button radii as tokens once, then reuse. SHOWN (4:28-5:14). We already do this via design tokens.

Rejected: nothing here conflicts with honesty, with one caution. The "3 spots open" line under the "Book a call" button (about 4:25) is a scarcity cue shown only as a button example. Do not copy it unless the number is real and kept current.

## Reliability
The video is high level and gives no measurements except the token sheet. Treat it as principles, not specs.
