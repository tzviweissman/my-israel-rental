# Rules from the 12 UI videos (8 Oct 2026), approved by Tzvi and now in page-generation-rules.md §3e

Watched as video (frames every 3-10 s, close-up strips for motion), with the
transcript alongside where YouTube allowed it. Per-video notes and key frames:
`notes/<videoid>.md`, `notes/frames/`. Approved in full by Tzvi on 8 Oct 2026, with both proposals in section D.

Videos: ngXi-No3s2o (premium product page), U7jTCgIWS4w ($80K vs $250K designer),
OKOingYdtVw and yBpv5rZoBjA (addictive apps), eMMiLeo_UGI (4 levels of landing
page), 2CJ9564opM0 ($1.2B funnel), HE4rLEQpiXY (think like a designer),
EcbgbKtOELY (every UI concept), GGg61sdEjeI (15-mistake redesign), 14h1VnkQvIc
(swipe interactions), oT0q_gbRdDk (Claude + Mobbin), WEUlsIqoKFQ (stunning websites).

"Already ours" means the page rules say it today; the video only confirms it.

## A. New rules proposed

**Page order and the first screen**
1. Sections follow the visitor's questions in order: what is it, can I trust it, what does it cost, what do I do. Menu and prices come before any enquiry form. (GGg61sdEjeI, oT0q_gbRdDk, ngXi-No3s2o)
2. A small label above the headline says who it is for and where ("Home-baked buns, Ramat Eshkol"). (oT0q_gbRdDk)
3. Each section has one job and ends on the same single action, same label, same destination as the header button. (ngXi-No3s2o, eMMiLeo_UGI)
4. The headline says what the customer gets (outcome), not what the business does. (eMMiLeo_UGI, 2CJ9564opM0)
5. The page's words match what sent the visitor (the ad, the WhatsApp message, the listing). (2CJ9564opM0)

**Buttons and prices**
6. The button says what happens, with a real number when there is one: "Order 4 buns, ₪55", "Show 12 sessions". (U7jTCgIWS4w, GGg61sdEjeI)
7. Price, unit and the action sit together; packages are tiles with name and price (small / family / party). (GGg61sdEjeI, ngXi-No3s2o)
8. Button text is at least 4.5:1 on its fill, measured, not judged by eye. (GGg61sdEjeI showed a green at 1.8:1)
9. Every button has rest, hover, pressed and disabled states; every field has focus and error states with a message; every action shows a confirmation ("Sent", "Copied"). Anything hover-only has a visible version on phones. (EcbgbKtOELY, eMMiLeo_UGI, WEUlsIqoKFQ)

**Cards, type and spacing**
10. A card has one reading order: the name largest, one emphasised fact (usually the price, in the accent colour, used nowhere else on the card), the rest lighter. Photos on cards are big, not thumbnails. (U7jTCgIWS4w, EcbgbKtOELY)
11. Design for the worst content: long names truncate, icons on photos sit on a solid circle or a gradient, never straight on the picture. (HE4rLEQpiXY, EcbgbKtOELY)
12. Text goes on a plain strip under an owner photo, not over it; where text must sit on a photo, a gradient into a dark area, not a flat dim. (U7jTCgIWS4w, EcbgbKtOELY)
13. Spacing on a 4 px grid: related things close, unrelated things clearly apart; same-kind items identical (icon size, row height). (EcbgbKtOELY, GGg61sdEjeI)
14. One font family for body in up to three weights, at most six text sizes; headings slightly tightened (-2%) with 110-120% line height. Hebrew tested before the tightening applies to it. (EcbgbKtOELY, GGg61sdEjeI)
15. One corner radius for images and buttons alike. (U7jTCgIWS4w, eMMiLeo_UGI)

**Motion**
16. Never linear easing: ease-out or a spring. Transitions grow from what was tapped and finish under 0.5 s. (14h1VnkQvIc)
17. A carousel shows a sliver of the next card, and every swipe has a visible button or dots, mirrored in Hebrew. A bottom sheet closes by swipe-down AND a close button. (14h1VnkQvIc)
18. A background video: camera locked, subtle, about a 6 s seamless loop, with a still poster and a reduced-motion still. (WEUlsIqoKFQ)

**Flows and coming back (honest forms of the "addictive" ideas)**
19. Every flow has a visible end: a clear "Done" screen after ordering, a list that ends, "Save and finish later" on long forms. (OKOingYdtVw, reversed)
20. Progress is shown only with true numbers: "Step 2 of 4", "Session 6 of 12", "5th loaf free, you have 3" (only for a loyalty offer the owner really runs). (yBpv5rZoBjA)
21. A reminder goes out only for something real the customer left unfinished (an unconfirmed booking, a saved order), once, with an off switch. (OKOingYdtVw)
22. The owner stays visible as a person: name, real photo, direct WhatsApp. (yBpv5rZoBjA)

**How we work**
23. After building, review a screenshot section by section against a reference for each point, rank the top five fixes, then keep or reject each with a reason. (oT0q_gbRdDk)
24. Keep the source link with every Mobbin / Inspo / 21st reference in the brief. (oT0q_gbRdDk)
25. Components from 21st or generated code get a polish pass for hover, focus and pressed states before they ship. (WEUlsIqoKFQ)

## B. Already ours (confirmed by the videos)
One solid button per screen; proof beside the button; true reassurance lines under it; choices as tiles; "Most popular" only if true; FAQ in the owner's words; reviews only if real; show the real product; one accent colour; one icon set; motion only with a reason; references from Mobbin/Inspo before designing.

## C. Rejected (shown in the videos, against our honesty rules)
Countdown timers, "limited time", "offer ends soon", "selling fast", "only 13 left", "3 spots open" (unless it is the owner's real availability); strike-through prices never charged; "$80 of value" free gifts; monthly price shown while billing quarterly; intro prices that renew higher; invented counters ("427,873+ delivered", "250+ / 95%"); "Trusted by 10k+", logo walls, "As seen on", award laurels; invented "Best match" / "Popular" badges; review stars and counts without real reviews; sweepstakes; random rewards; streaks and "don't lose your streak"; endless feeds and removed stopping cues; likes, leaderboards, fake unread badges; slide-to-confirm for ordinary forms.

## D. Where a video disagrees with us (Tzvi to decide)
- HE4rLEQpiXY says avoid scroll-hijacking; our cinematic pages pin and scrub on scroll. Proposal: keep our pinned sections (they fit one screen and never trap the order section), never hijack the scroll speed itself.
- WEUlsIqoKFQ uses only stock/AI backgrounds; our rule since today allows generated images anywhere, made from the owner's own photos. Proposal: unchanged; generated never stands in for their premises or people.
