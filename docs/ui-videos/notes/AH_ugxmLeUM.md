# Kole Jain: "7 UI/UX mistakes that SCREAM you're a beginner"

- Channel: Kole Jain. URL: https://youtu.be/AH_ugxmLeUM. Length: 7:17 (the title says 7 mistakes; there are 7 plus a bonus eighth on charts).
- Method: video downloaded at 720p and viewed as 8 contact sheets (a frame every 5 s, 88 frames), plus the English auto-captions read alongside. Tags: SHOWN means seen on screen, SAID means only in the voice-over. Contact sheets are kept in the helper scratch folder only; no frames were copied into the repo.
- Subject: one mobile recipe app ("Tasty", three screens: allergies, home, recipe) redesigned one mistake at a time in Figma, with before and after. Mobile app UI, not a landing page, but the fixes are generic polish rules.

## What is shown (timestamps are video time)

- 0:00-0:20: hook over four sample sites (a camera site, a travel site with hand-drawn circles, an Airbnb grid). SHOWN.
- 0:23-1:03, mistake 1, user flow: the allergy screen has six preset foods, no search for any other allergy and no skip for people with none. SAID plus SHOWN (a search field and a "Skip" link added at the top). A hand sketches boxes on grid paper first (SHOWN 0:46). Often-missed items: navigation links, hidden states, hover and micro interactions (SAID).
- 1:04-1:54, mistake 2, overusing effects: a blue-to-green gradient button becomes a flat dark green (SHOWN 1:18-1:33; SAID "stick to variations of the same color, or none"). The Figma default drop shadow is too harsh; the fix is a light grey shadow with a much bigger blur (panel SHOWN at 1:40: X 0, Y 3, blur 30, colour D3D3D3), or no shadow. Caption "Less Noise = Better Design" (SHOWN 1:50).
- 1:54-2:45, mistake 3, spacing: three-column grid on the allergy screen, two-column on the home screen; align to the grid, and where something breaks the grid and still looks balanced, leave it (SAID). More vertical spacing in stacks, "more space than you think" on mobile (SAID). Cards and chips rebuilt with auto layout and vertical trim off (SHOWN 2:33-2:42, a Figma text panel and chip frames).
- 2:47-3:32, mistake 4, inconsistent components: the two search bars made identical except the hint text; small components all get a 10 px corner radius; skip and back buttons matched in size, radius and style (SHOWN 3:00-3:24, side-by-side bars in a dashed selection). Rule of thumb: styles for colours, variables for measurements, components for UI elements (SAID).
- 3:32-4:54, mistake 5, icons: cards had no icons so the reader must read more; the "Save" word becomes a bookmark icon (SHOWN). Header icons mismatched in fill, line width and style (a "Bad" row beside a "Good" row, SHOWN 3:36-3:55), fixed from one library with the same stroke and corner (Flaticon filters shown; Feather and Phosphor named). Download as SVG (SAID). Well-known icons (house, bookmark, user) need no label; odd ones get a tooltip (SAID). Pro tip: different icon styles are fine in separate zones (navbar icons, food icons, recipe icons are three separate sets, SHOWN 4:42-4:53).
- 4:54-5:30, mistake 6, redundant elements: carousel arrows removed because swiping works, the arrow inside the button removed, the outline stroke on cards removed (or dimmed if contrast is the worry). SHOWN and SAID.
- 5:30-6:19, mistake 7, interactive feedback: a tapped "Start exploring" button turns grey straight away so the user knows the next screen is coming; a loading wheel if it is slow; a filled save icon plus a red dot on the Save tab (SHOWN 5:45-6:10 as an animated cursor test and a toast).
- 6:22-6:57, bonus mistake 8, charts: two charts, one from Dribbble and one plain. The Dribbble one has no vertical axis, round-topped bars (hard to see where a bar ends) and 16 bars for 7 days. The plain one has an axis and 7 bars. SHOWN 6:26-6:57 with "16 Bars / 7 Days" brackets, and SAID.
- 7:00-7:17: sign-off, Figma file in the description. Not design content.

## Lessons

1. **Plan the flow on paper first; list the missed states** (a way out, a way to add your own, empty and hidden states, hover, navigation). SHOWN 0:46, SAID 0:55-1:03. ALREADY in spirit (3e.9 states, 0b build order); the paper-first step is a small NEW habit.
2. **Every choice list has an escape.** Preset options always come with a search or "other" field and a clearly visible "Skip" or "None". On our pages: dietary and allergy pickers, the order form's "anything else we should know", a filter row with an "All" chip. SHOWN 0:28-0:45. NEW.
3. **Gradients: none, or two shades of the same hue.** Never a two-colour gradient. SHOWN 1:18-1:33. ALREADY (3c.9).
4. **One soft shadow, defined once:** light grey, small vertical offset (Y about 3), large blur (about 30), no spread, quiet colour (the video used D3D3D3). Change the shadow colour; do not just lower the opacity of a harsh default. SHOWN 1:40. ALREADY says "one soft shadow" (3c.9); the concrete numbers are NEW. Check against our tokens before using them.
5. **Small components share one radius (the video uses 10 px),** and two controls that do the same job (back and skip, two search bars) are the same component: same height, radius, style. SHOWN 3:00-3:24. ALREADY (3e.15 one radius); the "same job, same component" check is NEW and testable: compare computed height and radius across all controls of one kind.
6. **Lay out on a column grid** (three columns for a picker, two for cards); a stray element may break the grid if the page still looks balanced; vertical gaps in a stack are bigger than feels needed on a phone. SHOWN 2:03-2:30. ALREADY (3e.13 spacing) for the spacing; the column-grid step is NEW.
7. **Icons come from one library with one stroke width and corner style per zone.** Mismatched fill or line width is the loudest beginner signal. Different sets are allowed only in visually separate zones (nav bar vs content). SHOWN 3:36-4:53. ALREADY (3c.9 one icon set, lucide); the "separate zones may differ" exception is NEW and low priority for us.
8. **Put a small icon on a card or row that is otherwise all words, and swap a bare word like "Save" for its icon.** Icons reduce reading. Unusual icons need a tooltip or a visible label; only house, bookmark, user, search and the like go unlabeled. SHOWN 3:46-4:34. NEW. Our rule: every icon-only button has an `aria-label`, and if not universal, visible text beside it on phones.
9. **Remove anything that does nothing:** a carousel arrow on a swipeable row, an arrow inside a button that already says go, an outline on a card that already has a shadow or tint. SHOWN 4:57-5:29. ALREADY (3c.9 "no arrows or outlines that do nothing"). Added detail: if contrast is the concern, dim the outline instead of deleting it.
10. **Instant feedback on every press:** the button greys or shows a spinner the moment it is tapped; a saved item fills its icon and a dot appears on the place it went (saved tab, basket). SHOWN 5:45-6:10. ALREADY (3e.9 pressed and disabled states, 3c.9); the count dot on the destination (basket count, saved heart) is NEW and fits shops.
11. **Charts: show the axis, square bar tops, one bar per category** (7 bars for 7 days, not 16). Less pretty, more readable. SHOWN 6:26-6:57. NEW, but only for a business that shows a chart; avoid charts on small-business pages unless the owner supplies real numbers.
12. **Count beginner signals before the owner sees the page:** mismatched icons, two-colour gradient, harsh shadow (dark colour or blur under about 16 px), differing radii, a button with no visible press reaction, dead arrows. The video's whole structure is a checklist. NEW as a framing; each item is already a rule, so the 3r review script can report them as one "beginner signals" count.

## Do not copy

- The sample sites used as hook bait (a glowing camera site, an Airbnb screenshot).
- The recipe app's invented numbers (560 cals, 4.6 stars). We never invent ratings, reviews, calories or counts.
- The sales-style hook ("SCREAM you're a beginner") and the "link in description" pitch.
- The 16-bar Dribbble-style chart is the bad example; do not build it.

## For our pages

- A small-business page feels expensive when it is calm and consistent: one radius, one icon style, one soft shadow, flat colour, and nothing that has no job. Most polish is removal, not addition.
- Pickers and forms (a caterer's dietary needs, a nail salon's service choice, a gym's goal) need a way out: a "Skip" and an "Other, tell us" field. That small kindness reads as professional.
- Give every card and row one small lucide icon and a short label (a clock for hours, a pin for the address, a bag for the order), same stroke throughout.
- Make every button respond at once: grey or spinner on tap, a count dot on the basket or saved heart. That is what "a real website" feels like on a phone.
- Run the beginner-signals list before showing the owner: gradient, harsh shadow, mismatched radius or icons, dead arrows, outlines on cards, buttons with no visible press.
