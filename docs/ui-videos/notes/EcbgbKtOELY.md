# Every UI/UX Concept Explained in Under 10 Minutes

- Channel: Kole Jain
- URL: https://youtu.be/EcbgbKtOELY
- Length: 9:23 (562 s)
- Watched: frames every 4 s (all 12 contact sheets) plus full-resolution key frames; transcript read alongside.

## What is shown

Format: ten numbered concepts, each a short animated demo, with the presenter on camera between them.

- 0:04-0:32 Affordances and signifiers. Three icon+label pills (Drinks / Food / Dessert). A shared container groups two as related; a raised inner container marks the selected one; grey text marks the inactive one. Toggling slides the container and swaps the content below. Says: the UI itself tells you how it works (press states, active-nav highlights, hover states, tooltips).
- 0:36-0:44 Sidebar of a SaaS app with a hover tooltip ("Quick actions") on a collapsed icon rail. Example of signifiers only.
- 0:48-1:52 Visual hierarchy, built step by step on a delivery card. Starts as a plain label/value list, then a spreadsheet look, then: brand logo/image added, item name large and bold at top, date and time smaller below, price top-right in blue, "from/to" replaced by two pin icons joined by a dotted line with times. The final card has a large food photo on top. Says: size, position and colour make hierarchy; the contrast between big/small and coloured/plain creates it; use images whenever possible. Frame: frames/EcbgbKtOELY-0152.jpg
- 1:56 Profile card (name, bio, three stats, rating, black "Send offer" and grey "Message" buttons) as a second hierarchy example.
- 2:04-2:28 Grid myth. A page overlaid with pink 12-column guides; content does not line up with them. Says: grids and 8 px spacing are guidelines, useful for galleries, blogs and repeating content; white space matters more.
- 2:40-3:00 Whitespace on a dark hero ("Detailed Analytics"): 16 px font / 20 px line height for sub text, 20 / 28 for another size; pink overlay labels show 32 px gaps between announcement chip, headline, sub text and button, then 16 px between grouped items (announcement + headline, headline + sub text). Says: group related items closer; everything a multiple of 4 because you can halve it. Frame: frames/EcbgbKtOELY-0252.jpg
- 3:04-3:12 Bar chart of spacing steps 4 to 40, then the hero at 0.5x and 0.25x proving the proportions hold.
- 3:16-3:36 Typography. Font names on screen (DM Sans, Plus Jakarta Sans, Axiforma, SF Pro, Geist). Says: you never need more than one font.
- 3:36-3:56 Large-heading hack on a "Tight knit team, fuelling global influence" hero: letter spacing about -2 to -3 percent, line height about 110 to 120 percent. The heading tightens visibly.
- 4:04-4:28 Type scale ladder: 64 (H1), 42, 32, 20, 16, 14, then the dashboard scale (24 down to 12). Says: no more than six sizes on landing pages.
- 4:24-4:56 Sponsor segment (Mobbin, a screens library). Advertising; ignore.
- 5:00-5:32 Colour. A purple ramp (50 to 950); a product card ("Raspberry Turkish Delight", "Limited Edition" pill, "Add to cart", small text "Only 13 left!") built from tints and shades of one hue. Then semantic colour: announcement bar, focus ring, green "New" chip. Says: start with one brand colour; lighten for backgrounds, darken for text; semantic colours must carry meaning, not decoration.
- 5:44-6:20 Dark mode. A "Bluetooth Speaker" card. Lower border contrast; card lighter than the page (no shadows in dark); dim the chip's saturation; same card shown on deep purple, red and green grounds.
- 6:24-6:44 Shadows on light mode. Heavy shadow reduced in opacity with more blur; raised "Send offer" button with inner plus outer shadow. Says: if the shadow is the first thing you notice, it is wrong; cards need less, popovers more.
- 6:52-7:24 Icons and buttons. Icon size equals the label's line height (24 px); sidebar links are ghost buttons; button padding about 16 px vertical and 32 px horizontal (width about double the height); primary plus ghost CTA side by side.
- 7:36-7:56 Feedback and states. Four button states (Default, Hovered, Pressed, Disabled). Email field: focus ring, placeholder, error (red border and "Please enter a valid email address"), warning (yellow border, "This email already exists. Login instead?"). Says: every action needs a response; also loading spinners and success messages. Frame: frames/EcbgbKtOELY-0740.jpg
- 8:10-8:28 Micro-interaction: click an email address, it copies and a "Copied!" chip slides up.
- 8:30-9:00 Overlays. Ski photo with white text over it is unreadable; fix with a linear gradient from the image into a dark text area, then a progressive blur on the gradient. Frame: frames/EcbgbKtOELY-0850.jpg
- 9:04 Search field with a spinner as a loading state.

## Candidate rules for us

| # | Rule (testable) | Evidence | SHOWN or SAID |
|---|---|---|---|
| 1 | The most important item on a card or section is the largest and boldest and sits at the top; secondary facts (time, place) are smaller and below. Check: primary text is at least 1.5x the secondary text size. | 0:48-1:52 | SHOWN (card rebuilt step by step) |
| 2 | Use a real photo on each card or section where one exists (the baked goods, the coach, the finished room). A card without an image reads as a spreadsheet. | 0:53, 1:44-1:52 | SHOWN |
| 3 | Show price or the key figure in the accent colour, top-right of the card, and use that accent nowhere else on the card. | 1:11-1:28 | SHOWN |
| 4 | Replace label words with icons plus alignment (clock, pin, phone instead of "Hours:", "Address:"). | 1:28, 1:56 | SHOWN |
| 5 | Spacing in multiples of 4 px; one gap value between hero items (32 px desktop; scale down for phone), smaller gap (16 px) between grouped pairs. Check: computed margins are multiples of 4 and related items sit closer than unrelated ones. | 2:40-3:12 | SHOWN |
| 6 | White space over decoration. Do not force a 12-column grid on a custom one-page layout; use grids for repeating galleries and lists. | 2:04-2:37 | SHOWN and SAID |
| 7 | One font family per page (one Latin sans and its Hebrew partner, nothing else). | 3:16-3:31 | SAID; font names shown |
| 8 | Large headings: letter spacing -2 to -3 percent, line height 110 to 120 percent. Hebrew caveat: do not apply negative tracking to Hebrew without testing, tight spacing hurts Hebrew letter shapes. | 3:36-3:56 | SHOWN for Latin; Hebrew caveat is ours |
| 9 | At most six text sizes on the page. The 64 px H1 is desktop; phone H1 will be far smaller. | 4:04-4:28 | SHOWN and SAID |
| 10 | One brand colour as a ramp: tints for backgrounds, shades for text. Semantic colours carry meaning only (green = available/confirmed, red = error). | 5:00-5:32 | SHOWN and SAID |
| 11 | Every button has default, hover, pressed and disabled states; every input has focus and error states (red border plus a message saying how to fix it). On touch, pressed and focus must be visible since there is no hover. | 7:36-7:56 | SHOWN |
| 12 | Confirm actions visibly: copying a phone number or submitting a form shows "Copied" or "Message sent", never silence. | 8:10-8:28 | SHOWN |
| 13 | Text over a photo needs a gradient from the photo into a dark text area, not a flat full-screen dim. Verify contrast on the worst pixel under the text. | 8:30-9:00 | SHOWN (before and after) |
| 14 | Icon size equals the label's line height; button horizontal padding about twice vertical; primary plus ghost CTA side by side; minimum 44 px tap height on phone. | 6:52-7:24 | SHOWN (24 px match) |
| 15 | Related controls share a container, the selected one is raised, inactive ones are greyed, so tabs and filters explain themselves. | 0:04-0:32 | SHOWN |
| 16 | Shadows: low opacity, high blur; the shadow is never the first thing noticed. | 6:24-6:44 | SHOWN |

### Rejected or handle with care

- Rejected: the demo card at 5:04-5:12 carries "Limited Edition", "While stock lasts" and "Only 13 left!". The presenter uses it only to show colour tints, but for us this is fake urgency/scarcity unless it is the owner's real, current stock count. Do not copy the pattern.
- Rejected: reading "red for danger or urgency" (5:33) as licence for urgency styling on marketing. Red stays for errors only.
- Rejected: the "3 spots open" green dot under "Book a call" in the Linkd-style hero (about 3:44-3:56). Acceptable only as the owner's real, owner-maintained availability; otherwise omit.
- Not applicable: dashboard type scale and dark-mode work (our pages are light one-page marketing).

## Key frames

- frames/EcbgbKtOELY-0152.jpg (hierarchy: big image, bold name, blue price, icon location)
- frames/EcbgbKtOELY-0252.jpg (32 px and 16 px spacing labels on a hero)
- frames/EcbgbKtOELY-0740.jpg (button states list)
- frames/EcbgbKtOELY-0850.jpg (text over photo: gradient fix)
