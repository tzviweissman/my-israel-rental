# Apply-pass audit: elisheva-nails (Nails by Elisheva)

Pages read: index.html, book.html, contact.html, site.css, site.js, gen/book.js, gen/build.py, message-to-elisheva.md, laptop and phone screenshots (8731). Built files are generated: change gen/build.py (index, contact), gen/book.js (booking logic) and site.css, then rebuild. SITE = `scrollcraft/builds/elisheva-nails`. "Save tag" = a pale green pill "Save ₪20" (fill #E6F4EA, text #2E7D4F, 11px caps), the only green on the site, used for the one real saving.

Facts we hold: Gel ₪90 (45 min), gel with removal ₪110 (60), nail art/French/gradient ₪110 (60), gel removal ₪40 (25); hours Sun 10 to 13, Mon to Thu 10 to 19, Fri 10 to 13, Shabbat closed; more than four years of experience; WhatsApp +44 7871 822590, text +972 53 348 4521; Romema, Jerusalem. The one real saving: removal ₪40 plus gel ₪90 = ₪130 apart, ₪110 together, Save ₪20.

Video ids: qJ4 = qJ4qYhTqAz0 (paywalls), V77 = V77dzdX8uQs (shop and trust), oYs = oYskl2ZBoBc (product page), AH_ = AH_ugxmLeUM (app polish), 7pv = 7pviK2SBpGg (premium shop), yH0 = yH0QwDpV4ZM (micro-interactions), U7j = U7jTCgIWS4w (listings and filters), OKO = OKOingYdtVw (attention), GGg = GGg61sdEjeI (product page redesign).

| Video | Item (short) | Verdict | Where / exact change |
|---|---|---|---|
| qJ4 | Saving as struck old price + "Save ₪X" tag, no sentence | fix | book.html `#st-save` reads "Save ₪20 against booking removal and new gel apart" (gen/book.js drawSvc). Change to the Save tag alone. Add the same on the index.html row "Gel nails with removal": struck `₪130` before `₪110` plus the Save tag; on the booking option card put the tag on the card's top-right border |
| qJ4 | Lead plan first and pre-selected | done | Basic gel is first on both pages; arriving from a row's Book link pre-selects that service (?service=) |
| qJ4 | Keep choices to the few that matter; side option behind grey link | n/a | Four services only, nothing competes |
| qJ4 | Other option reachable via grey "View all plans" link | n/a | No plan tiers |
| qJ4 | Timeline above price (Today, Day 12, Day 14) | fix | Replace the book page `.st-facts` line with a three-step line, true steps only: "1 Choose and send on WhatsApp, 2 Elisheva confirms your time, 3 Come in". No dates, no charge steps |
| qJ4 | Reassurance line with green check between price box and button | fix | In `aside.sum`, above `#send`, replace the `.note` text with a bold 13px line with a check icon: "Nothing to pay on this page. Your time is yours once Elisheva confirms it on WhatsApp." (true: the page takes no payment) |
| qJ4 | "No payment due now" tick above main button | fix | Same single line as the previous row; do not add a second one |
| qJ4 | Price box: lead-in, bold price, struck regular price below | fix | `#st-price` already shows struck price beside price. Add a small grey lead-in "Booked together" on the gel-with-removal service only. Other services show no struck price (none is real) |
| qJ4 | Primary button flat, uppercase condensed, 3px corners, no shadow | n/a | The brand button is a pill with a tinted shadow (site.css `.btn`); the video's style does not suit this brand. Flat colour already true |
| qJ4 | Say what the first step costs in the button's sub line | fix | Covered by the reassurance line above the button ("Nothing to pay on this page"); no second line under the button |
| qJ4 | Price follows need: quantity stepper | n/a | One appointment, no quantity |
| qJ4 | Monthly/annual segmented switch | n/a | No billing periods |
| qJ4 | Plan comparison table | n/a | Four unrelated services, not tiers |
| qJ4 | Never blur or lock what a person made behind a wall | done | No walls or sign-up anywhere |
| qJ4 | Try the full product before paying; do not lead with a discount | done | No discount led with; booking takes no payment |
| qJ4 | Test one structural change at a time | n/a | Process advice, no traffic to test |
| qJ4 | Hide extra options beside the main offer | n/a | Nothing extra beside the main offer |
| qJ4 | Proof as one big number in mono, thin bar | ask | Only real figure held is "more than four years". Ask for real numbers (see Questions) before showing any |
| qJ4 | Underline the one price that matters, fade the rest | fix | Book page: once a service is chosen, dim the other three option cards to 0.6 opacity (site.css `.opts:has(input:checked) .opt input:not(:checked) + .box`), 160 ms ease-out. Never hide them |
| qJ4 | Yellow highlighter on key phrase of a quote | ask | No quote exists yet (message point 7) |
| V77 | One plain price per product, name left, price right, no sale badge | done | index `.svc-row` and book `.opt .box`: name left, price right; no badge on everyday items |
| V77 | Square colour swatch chips, selected ringed, "+4 more" | done | `.shade` chips on hero and booking, selected ring (site.css `.shade[aria-pressed]`). Round suits gel pots; six shades fit, no "+more" needed |
| V77 | Small outlined tag top-left of tile saying what item is for | n/a | Each service already has a one-line description |
| V77 | Tier naming: tiny caps word, quoted name, who it is for | ask | Each service's "who it suits" needs her words (for example who picks gel with removal). Ask; keep today's one-liners meanwhile |
| V77 | Stars and real review count next to name; pack size pills | ask | No reviews held; reviews question |
| V77 | "Quick add" bar on hover over photo | n/a | No product tiles; the shade chips are the quick action |
| V77 | Rounded pill filters above grid | n/a | No filterable grid |
| V77 | "Bestseller" tag only if real | ask | Which service is booked most? Show nothing until she answers |
| V77 | Bundle as set price with "($X Value)" and Save chip | fix | Gel with removal is the one real bundle: show `₪110` with `(₪130 apart)` in grey and the Save ₪20 tag on index and booking |
| V77 | Saving as struck old price + Save tag, no percentage | fix | Same change as the first row of this table |
| V77 | Describe a bundle by what it replaces | fix | index row text for gel with removal: "Your old gel taken off, then a new gel colour. Replaces a ₪40 removal and a ₪90 gel." Both prices are on the price list |
| V77 | Main product one price all year; discounts on kits | done | Fixed prices; the only saving is the real kit price |
| V77 | At most 2 to 4 sitewide sales with real dates | n/a | No sales run |
| V77 | Separate "Seconds / Clearance" section | n/a | Services, no stock |
| V77 | First-order offer panel in product box | n/a | Owner offered none; do not invent |
| V77 | New-customer email popup | n/a | No offer, no email list |
| V77 | Mark largest pack "Best value" only if cheapest per unit | n/a | No packs |
| V77 | Thin grey bar above header with real guarantee/threshold | n/a | No guarantee, delivery or threshold exist |
| V77 | Three small icon lines under Add button | fix | Under `#send` in `aside.sum` add three 13px icon lines, true ones only: "Confirmed by Elisheva on WhatsApp", "Sunday to Friday, closed Shabbat", "About 25 to 60 minutes, by service". Add cancellation and lateness lines only after she answers |
| V77 | Row of 3 to 4 icon facts above gallery | n/a | No warranty, trial or returns; the lines in the previous row cover it |
| V77 | Guarantee tile in the grid | ask | Does she fix a nail that chips in the first days? (message point 4) |
| V77 | Plain money-back / warranty terms with exclusions | ask | Same question; nothing to publish until answered |
| V77 | State the catch in an FAQ accordion | ask | Owner asked for FAQ answers (message point 8); add a 4-row accordion on index or contact once answered |
| V77 | One real named review next to its section | ask | Reviews with names and permission (message point 7) |
| V77 | Clickable question chips near buy button | ask | Needs her two biggest client questions; same FAQ question |
| V77 | Footnote a claim with its evidence | n/a | No claims needing evidence |
| V77 | Certificates as round badges on photo | ask | Any nail course certificate or licence? Show only a real one with the issuer named |
| V77 | Searchable customer list or map, counter strip | n/a | No customer list, no real counters |
| V77 | State what you do not do as a headline | n/a | Nothing to claim |
| V77 | Real dated running total | n/a | None held |
| V77 | Real founder quote strip | ask | One sentence in her own words about her work |
| V77 | Say who the page is for in one plain line | fix | index hero `.lede`: append "For gel, French and nail art on your natural nails." (fact-only; never say who it is not for) |
| V77 | Grey out main button until choice made | fix | Top fix 1: `#send` disabled grey until service, day, time, name and phone are set |
| V77 | "What to expect" timeline on booking | ask | Needs her words: clean nails, lateness, cancelling (message point 3). The three-step line covers the process |
| V77 | Welcome card with the first visit | ask | Same answers as the previous row |
| V77 | Full-bleed autoplay video hero with pause control | n/a | Hero is her photo with the shade reveal; no video held |
| V77 | Numbered editorial list of benefits | n/a | No benefits held that are not claims |
| V77 | Story section in serif with italic words, one large photo | ask | Why she started, in her own words; studio.webp exists |
| V77 | Quiz or "find your match" helper beside pickers | done | The "Tap a shade" picker on hero and booking carries the shade into the booking |
| V77 | Ask past customers what almost stopped them | ask | Added to Questions |
| V77 | Do not discount best sellers | done | No discounts besides the real kit price |
| oYs | Status pill above title, only when true | n/a | Nothing true to say ("New", "Best seller" unknown) |
| oYs | Lead hero with the product in use | done | Hero and booking stage show her gel on a client's hands |
| oYs | Gallery shows use: in hand, real setting, process | fix | index `.work-grid` has five photos, mostly sets on hands plus studio.webp. Add a process photo (lamp or her applying gel) when sent; ask in Questions |
| oYs | Real rating as exact number "4.9 (221 Reviews)" | ask | No ratings held; reviews question |
| oYs | 1px grey divider between facts on one line | fix | `.st-facts` ("More than four years of experience · Sunday to Friday"): replace the middle dot by a 1px #EBCFCB divider, 16px tall, 12px each side (site.css) |
| oYs | Option cards instead of dropdowns for 2 to 5 choices | done | `#svcs .opt` cards and time chips; no dropdowns |
| oYs | Small round photo left of each option name | ask | Needs a photo per service (French, art, gradient photos, message point 1). Skip until sent |
| oYs | Selected option: pale fill, border, tick circle | fix | `.opt input:checked + .box` has rose border and blush fill; add a 20px circle with white tick at the right end of the card (CSS `::after`), rose not green so the green stays for the Save tag |
| oYs | Swap main photo and label when an option is chosen | done | Shade picker swaps photo, caption and tint (gen/book.js drawShade) |
| oYs | One-line tooltip on hover answering the doubt | ask | Needs her short line per shade or service (for example how long a shade lasts); ask in Questions |
| oYs | Plan choice in warm panel as side-by-side cards | n/a | No subscribe or pack choice |
| oYs | "MOST POPULAR" pill on a card | ask | Which service do most clients book? Only if she says |
| oYs | Three tick lines inside panel answering fears | fix | Same three true lines as the V77 icon-lines row, drawn as green ticks inside `aside.sum` under the button |
| oYs | Reveal pack sizes after one-time card chosen | n/a | No packs |
| oYs | Pack saving as money, no sentence | fix | Same change as the first row of this table |
| oYs | Main button full width, sentence case, step label | fix | `#send` full width inside `aside.sum`, WhatsApp icon, label "Send booking on WhatsApp"; already sentence case |
| oYs | Drop the quantity stepper on single-item buys | done | No stepper |
| oYs | Three icon columns replacing a generic grey list | fix | Only if it fits one screen at 1280x650: three columns under the stage with true facts ("Gel colour on natural nails", "Sunday to Friday", "WhatsApp confirmation"); otherwise keep the text lines of the V77 row |
| oYs | Accordions (Serving info, Ingredients) with hairlines and a plus | ask | Needs FAQ content; build when answered |
| oYs | One warm palette, green only for selection, saving, ticks | done | Rose and blush throughout; green to be added only for the Save tag |
| oYs | Check every percentage against real prices | done | No percentages anywhere; saving is money |
| oYs | Same saving figure in label, radio and tick list | fix | When Save ₪20 appears in three places they must read the same, computed in gen/book.js from SERVICES prices (gel + removal minus gel with removal), never typed |
| oYs | Tint shadows to surface colour | done | `.btn` shadow `rgb(142 74 68 / .7)` and `.frame` shadow are rose tinted |
| AH_ | Search field for long list | n/a | Four services, six shades |
| AH_ | "Skip" pill on optional question | n/a | The one optional field (Colour) is labelled "(optional)" and never blocks |
| AH_ | Filter icon button beside search | n/a | No search or filters |
| AH_ | Save/bookmark button top right of detail | n/a | Nothing to save |
| AH_ | Primary button one flat colour, no gradient | done | `.btn` background is flat `--rose-dk` |
| AH_ | Soften shadows | done | `.btn` and `.frame` shadows are soft and tinted |
| AH_ | Generous vertical spacing, 20px or more | done | Spacing is open in the screenshots; cards 1.2 to 1.8rem padding |
| AH_ | 3-column tile picker, 2-column cards, chip row runs off edge | fix | Book page `.opts` is 2 columns at 1280 and "Nail art, French or gradient nails" wraps to three lines (screenshot book-0). Make `.opts` one column of full-width cards or shorten the label to "Nail art, French or gradient" |
| AH_ | Equal padding and gap on every card and chip | done | `.opt .box` padding and `.opts` gap are uniform |
| AH_ | Identical components identical shape | done | Two button sizes only: 54px `.btn`, 44px `.btn-line` and `.menu-btn` |
| AH_ | One corner radius on all small components | fix | `.opt .box` is 14px, `.fld` 12px, `.card` 18px. Set `.fld` to 14px in site.css; pills and cards keep their own radii |
| AH_ | Small icon on each card; bookmark chip | n/a | No product cards |
| AH_ | One icon set, one stroke weight | done | Only the 1.8-stroke arrow svg is used; the new ticks and WhatsApp icon must use the same 1.8 stroke |
| AH_ | Label only lesser-known icons with a dark tooltip | n/a | No icons needing a label |
| AH_ | Different icon styles only in separate zones | n/a | Single icon style |
| AH_ | Drop arrows swipe implies; let last card peek | n/a | No horizontal scrolling lists |
| AH_ | Dim "See All" to grey, no arrow | n/a | No "See all" link |
| AH_ | Remove outlines on fields and chips; plain white tiles | n/a | Hairline outlines on option cards and fields are needed for form clarity on a blush ground; keep |
| AH_ | Selected tile: green border and tick badge | fix | Same as the oYs tick-circle row, in rose |
| AH_ | On tap grey the main button; "Just a moment" pill | fix | `#send` submit: set `disabled` and grey for the instant before WhatsApp opens; no spinner pill (the wait is under 300 ms) |
| AH_ | Fill bookmark on tap; red dot on Saved tab | n/a | No save feature |
| AH_ | Success note after an action | fix | After `window.open` in gen/book.js show a note at the top for 2.4 s: tick, "Booking written out", "Press send in WhatsApp and Elisheva will confirm your time." No Done button, slides in 200 ms ease-out, leaves itself |
| AH_ | Charts with axis and gridlines | n/a | No charts |
| AH_ | Key figures in a chart card | n/a | No charts |
| AH_ | Sketch the flow on paper first; check missing controls | done | Flow is service, shade, day, time, details, WhatsApp; nothing missing |
| 7pv | Saving as struck old price + Save tag | fix | Same change as the first row of this table |
| 7pv | Price inside the main buy button label | fix | `#send` label "Send on WhatsApp · ₪110" updated live in gen/book.js `update()` once a service is chosen (Top fix 1) |
| 7pv | Size/pack picker: chosen box 2px black border, bold, own price | done | `.opt .box` shows each price; chosen has a 1.5px rose border. Make it 2px (site.css `.opt input:checked + .box`) |
| 7pv | Refill or smaller size at lower price beside main | n/a | No sizes; gel removal alone at ₪40 is already its own card |
| 7pv | Quiet strip under button with small icon for a real perk | fix | The three icon lines (V77 row) serve this. No threshold perk exists |
| 7pv | Card label in tiny caps ("Best seller") only when true, plus one-line description | done | Each row has a one-line description; no label shown (none true) |
| 7pv | Size/option dropdown inside the card | n/a | No dropdowns; cards open the booking with the service chosen |
| 7pv | Three green-tick benefit lines on a card | fix | See V77 icon-lines row; on the service card level keep the one-liner |
| 7pv | Pale-yellow one-word chips top-left ("New") | n/a | Nothing new or best-selling known |
| 7pv | Break grid with photo or silent clip every 2nd or 3rd slot | n/a | Services are a list, not a grid; gallery already is all photos |
| 7pv | Real review count beside five stars on cards | ask | None held; reviews question |
| 7pv | Proof strip of real stats in quiet columns | ask | Needs real numbers; Questions |
| 7pv | Yellow marker on one key proof phrase | n/a | Not on this site's palette (rose); no proof phrase held |
| 7pv | Show how it is made: process photos with captions | ask | A short phone clip or photo of her applying gel; Questions |
| 7pv | Make the quality difference easy to see in 3 seconds | done | The hero opens on a close-up of finished nails in a chosen shade |
| 7pv | Feature real experts or customers: portraits in a grid | ask | Photo of Elisheva and her OK to show it; Questions |
| 7pv | "As seen in" logo strip for real press only | n/a | No press |
| 7pv | Real tiers so the middle option is clear | n/a | Services, not tiers |
| 7pv | Highlight recommended option by dimming others | fix | Applies only to the chosen option: see the qJ4 "fade the rest" row; nothing is "recommended" |
| 7pv | "Inquire now" pre-filled WhatsApp with product link | fix | Nail art is custom: on the index row "Nail art, French or gradient nails" add a text link "Ask about a design" to `https://wa.me/447871822590?text=Hi%20Elisheva%2C%20I%20would%20like%20to%20ask%20about%20a%20nail%20art%20design`. The booking itself already opens a pre-filled WhatsApp message (done) |
| 7pv | "Only a few left" on a limited item | n/a | No stock or batches; never show |
| 7pv | Do not make the cheapest price the main message | done | Hero says "Gel from ₪90" once; headline leads with the work. Keep it in the lede, never in the h1 |
| 7pv | Calm, near-text-free hero with a thin outlined button | done | Hero is one photo, one headline, one button; the button is a solid pill by brand choice |
| 7pv | Cart panel: Subtotal, Checkout, payment logos, add-on row | n/a | No cart; the summary card holds the total |
| 7pv | Reveal list copy one line at a time, 2 s apart | n/a | Slow reveal conflicts with motion under 0.5 s |
| 7pv | Announcement bar only for a real offer | n/a | No real offer |
| 7pv | Photos of real locals using the product with consent | ask | More client photos with permission; Questions |
| 7pv | Read competitors' reviews, use real reasons in headlines | n/a | Research step, no page change |
| yH0 | Press feedback scale 0.97 and dim on all tappables | fix | `.btn:active` and `.btn-line:active` have scale .97. Add `.opt .box:active`, `.shade:active` (and `.nav a:active`): `transform: scale(.97); opacity: .85` with 120 ms ease-out (site.css) |
| yH0 | Fade page in once on load, 200 ms opacity only | fix | `body:not(.no-js)` opacity 0 to 1 over 200 ms ease-out, once; keep the existing sweep reveals for sections |
| yH0 | Animations purposeful, 150 to 300 ms, no bounce on every section | fix | Over the 0.5 s rule: `.rev.in::after` sweep 840 ms (line 119), `.frame` spread 1300 ms, `.hero .tint` and shade text wash 900 ms, `.stage` 700 ms, `.st-ph img` 600 ms, `.work-grid img` hover 600 ms, `.ghost-in` 1600 ms. Cut sweep to 420 ms (uncover 280 ms), hover to 300 ms, stage 400 ms, st-ph 300 ms. The shade wash and spread were chosen by Tzvi: ask before shortening those two |
| yH0 | Cross-fade selection: empty circle to tick, 1px accent outline moves | fix | Same tick circle as oYs row; fade it in 160 ms (`.opt .box::after` opacity) |
| yH0 | Pack row: bold title, dim price line, right-aligned unit price | done | `.opt .box`: bold name, small grey duration under it, price right |
| yH0 | Saving as struck old price + Save tag on row top-right border | fix | Same as the first row of this table |
| yH0 | Badge changes with state ("Save" to "Selected") | fix | On the gel-with-removal card the tag reads "Save ₪20" unchosen and "Selected" once chosen (solid rose pill, white text, same position) |
| yH0 | Button label follows state | fix | `#send`: "Choose a service" when empty, "Send on WhatsApp · ₪110" when ready, "Opening WhatsApp" disabled while it opens |
| yH0 | Success toast at top, slides in and leaves itself | fix | Same note as the AH_ success-note row (one element, not two) |
| yH0 | Primary greyed and disabled until required field has content | fix | Top fix 1; use `aria-disabled` and keep the red field messages visible on a press so the person learns what is missing |
| yH0 | Keep primary action above the keyboard on phones | fix | On phones `#send` row gets `position: sticky; bottom: 12px` inside the form so it stays reachable while the phone keyboard is open; check on a 390 wide screenshot |
| yH0 | Soft pale glow on focused input | fix | `.fld:focus` (site.css line 173): replace the 3px outline with `border-color: var(--rose-dk); box-shadow: 0 0 8px rgb(142 74 68 / .3); outline: 2px solid transparent` |
| yH0 | Open a step with first field focused | n/a | First step is a tap choice, and auto-focus would open the phone keyboard before a service is chosen |
| yH0 | Message box grows to 4 lines then scrolls | fix | `#note` textarea: start at 1 row (48px) and grow to 4 lines on input in gen/book.js, then scroll |
| yH0 | Own screen before browser permission prompts | n/a | The site never asks for location, notifications or camera |
| yH0 | Say what person gets when asking photos or notifications | n/a | No permission asks |
| yH0 | Empty states say what is missing and where to tap | done | Time list: "Choose a day first." and "No times left that day. Choose another day." (gen/book.js drawTimes); summary "Nothing chosen yet" |
| yH0 | Replace bare spinner with rotating true status lines | n/a | No loading waits |
| yH0 | Fade images in 200 ms, dim to 0.7 while pressed | fix | `.work-grid img` and `.st-ph img` fade in 200 ms on `load`; gallery photos are not tappable, so no pressed dim |
| yH0 | Suggestion chips above free-text box | n/a | The note box is optional and short |
| yH0 | Before/after slider | ask | Does she have real before and after photos (for example gel removal then new set)? Questions |
| yH0 | Zoom a card into its detail page via View Transitions | n/a | Row to booking is a plain page change; heavy for a two-page flow |
| yH0 | Personalise with first name only after given | fix | After the form's name is entered, the summary card heading "Your booking" becomes "Your booking, Dana" (name from `#me`), and the note and WhatsApp text already use it |
| yH0 | Small grey fine print under main button | done | `aside.sum .note` under `#send` (moves to the check line, with a short grey line "Opens WhatsApp with your booking written out" kept below) |
| yH0 | Polish as a stack of twenty small things | done | This table is that audit |
| U7j | Photo of the actual product on every card, not the logo | done | Hero and stage use her photos; logo only in header |
| U7j | Photos given real space | done | The arch photo is the largest block on hero and booking |
| U7j | Do not cram above the fold; let the next card peek | done | Each section is one screen; first screens are calm |
| U7j | One corner-radius family across a screen | fix | Same as the AH_ radius row |
| U7j | Card with three levels of text | done | Service rows: serif name, price, grey line |
| U7j | "Free" or good price in bold green | n/a | No free item; green stays for the Save tag |
| U7j | Filters as visible chips; no 17-option dropdowns | n/a | No filters |
| U7j | Round filter and sort buttons | n/a | No list to filter or sort |
| U7j | Filter sheet with counts and "Show N places" | n/a | No filters |
| U7j | Result count next to list heading | n/a | Four services |
| U7j | Card / compact-list switch | n/a | Four services |
| U7j | One custom icon set on quiet tiles instead of stock category circles | n/a | No category circles |
| U7j | Search placeholder says what can be searched | n/a | No search |
| U7j | Name and numbers under the photo, not on it | done | Index photo has only a small "My work, on a client" tag; name and price sit beside it |
| U7j | "BEST MATCH" label only if true | n/a | No matching logic |
| U7j | Booking button says what happens ("Book Sat 11:30") and three real time chips | fix | Time chips are real (`#times`, 30 min steps within her hours, done). Button label: once day and time are set, `#send` reads "Send Sat 11:30 on WhatsApp" (Top fix 1) |
| U7j | "Fits your search" tick pill | n/a | No search |
| U7j | Price with per-month figure | n/a | Not a recurring cost |
| U7j | Filters open as a sheet with grabber and Reset | n/a | No filters |
| U7j | Range slider with min/max boxes | n/a | No ranges |
| U7j | Histogram of real prices behind slider | n/a | No data and no slider |
| U7j | All options visible in a row instead of steppers | done | Time slots and services are all visible |
| U7j | Type icons above labels in a 2x3 grid with real counts | n/a | Four services |
| U7j | "N of total" fit in price header | n/a | No filter |
| U7j | Ask what people know and work out the price | n/a | Prices are fixed |
| U7j | Plain per-month breakdown lines | n/a | No monthly cost |
| U7j | "Your reach" budget mark on histogram | n/a | No histogram |
| U7j | Preview effect of a stricter choice, joined range bar | n/a | No filters |
| U7j | Keep the sheet short; only decision-helping info | done | The booking card has service, shade, day, time, details, nothing more |
| U7j | Count taps: two filters in two taps | done | Booking is: service, day, time, name, phone, send; the shade is optional |
| U7j | Give the visitor the control (Clear, Reset) | fix | The shade chip toggles off on a second tap (gen/book.js done); add a small grey "Clear" link beside "Colour (optional)" when a shade is chosen, and a "Change" link on each summary row (see OKO row) |
| OKO | Deal as struck old price + Save tag, no sentence | fix | Same change as the first row of this table |
| OKO | Genuinely new product at top labelled "New" | n/a | No new item announced |
| OKO | Honest count badge on basket icon | n/a | No basket |
| OKO | Visible progress cue ("Step 2 of 3") on booking | fix | book.html: label the three cards "1 Service and colour", "2 Day and time", "3 Your details" with a thin 2px progress rule that fills as each part is complete (gen/book.js `check`). Fill is truthful |
| OKO | One honest pause before payment: "Ready to book?" summary with Back and Change | fix | `aside.sum` is the summary; rename its heading "Ready to book?" once all fields are set, and add a "Change" link on each row that scrolls to that field. No payment step exists, so no Back needed |
| OKO | Back, close and "Continue shopping" always visible | done | Header with logo, Home, Book, Contact is sticky on every page (`.top`) |
| OKO | Real client praise as chat-bubble card | ask | Needs a real WhatsApp message she is happy to show, with the client's OK (message point 7) |
| OKO | Follow/add/book buttons one style repeated | done | Each service row has the same 44px `.btn-line` Book button, hairline dividers between rows |
| OKO | One-tap reactions for feedback | n/a | No order feedback flow; asking for reviews is done by Elisheva by WhatsApp |
| OKO | Step title with the customer's feeling in italic | n/a | Invented sentiment; we do not know what clients feel |
| OKO | Fixed colour code for status pills | n/a | No statuses |
| OKO | Customer's own progress (tracker, loyalty stamps) | n/a | No tracker or loyalty scheme exists |
| OKO | Real timestamp on updates | n/a | No updates feed |
| OKO | "How booking works" as four labelled steps around a chalk arrow | fix | The three-step line (qJ4 row) is the compact version; a chalk-arrow drawing is a brand fit for the Parisienne script but would add a screen; skip unless the index has room at 1280x650 |
| OKO | Open a section with one lowercase geometric phrase and drawn lines | n/a | Brand uses Bodoni and Parisienne, not geometric lowercase |
| OKO | Single accent on near-black card for a stats strip | n/a | No stats and no near-black card in this palette |
| OKO | Say exactly what an offer includes under the button | fix | Under `#send`: "Includes the service, the time and your colour, written out for Elisheva" is wordy; use the three icon lines and the check line (V77 and qJ4 rows) |
| GGg | Overlay icons in solid white circles on photo hero | n/a | No overlay icons on the photos; the only overlay is the pill tag |
| GGg | One photo style and off-white background for every product | n/a | Photos are real client hands, not product cut-outs |
| GGg | Show the product the way it is sold | done | Photos show a full set on hands, which is what is sold |
| GGg | One left margin and one right margin | done | `.wrap` with `--gutter` holds everything to one margin pair |
| GGg | Check text on accent colour for contrast | done | White on `--rose-dk` #8E4A44 is above 4.5:1; keep the Save tag at #2E7D4F on #E6F4EA (about 4.9:1) |
| GGg | Colour roles: image gets colour, secondary neutral, accent sparingly | done | Page tint follows the shade photo; buttons rose, text ink |
| GGg | One typeface family; hierarchy by size and weight | fix | Site uses three faces by design (Bodoni Moda, Outfit, Parisienne script as accent), approved by Tzvi; keep. No change |
| GGg | Small uppercase labels: 0.05em spacing and muted colour | done | `.caps` uses .22em tracking in `--rose-dk`; wider than 0.05em on purpose, kept |
| GGg | Badges: short words, sentence case, no icon | fix | The Save tag is the only badge: sentence case "Save ₪20", no icon; the oYs "11px caps" style must be set to sentence case instead |
| GGg | Body text line height 1.5 to 1.6, softer slate | done | body line-height 1.65, colour `#3A2523` ink, secondary `--soft` #6E5450 |
| GGg | Rating row under the title | ask | No reviews held; reviews question |
| GGg | Feature list: one row of four icon items | fix | Same as the oYs three-column row (three true facts, not four) |
| GGg | Dividers 1px pale grey, equal 24px steps | done | `.svc-row` and `.hours` dividers are 1px `--line` |
| GGg | Never put the word "Price:" before a price | done | No such label anywhere |
| GGg | Keep quantity out of the title; unit beside price; two decimals | done | Time sits beside the price ("about 45 minutes"); whole shekels are the real prices, so no decimals |
| GGg | Price high, under rating, with stepper on the same row | n/a | One appointment, no stepper; price sits under the booking title already |
| GGg | Add to cart button: sentence case, 14 to 16px, no shadow, never caps | fix | `.btn` is sentence case at 1.02rem; the soft rose shadow stays by brand choice. No change |
| GGg | Stepper next to Add in one bottom row | n/a | No stepper |
| GGg | Real total inside the button, updating live | fix | Same as the 7pv price-in-button row |
| GGg | Page as a card with rounded top corners sliding over the photo | n/a | The page already opens on the full-height photo arch; a sliding sheet is a different layout |
| GGg | Sticky bottom bar with stepper and add | n/a | index has the phone `.bar` (price and Book); on book.html it was removed on purpose (site.js comment) because the summary card carries the total |
| GGg | After tapping add, fly a cart icon; button turns into green check | fix | After `window.open` the `#send` button turns into a check circle for 1.2 s (160 ms morph), no flying icon (no cart) |
| GGg | Quick-pick tiles for pack sizes with italic name and total | n/a | No pack sizes |
| GGg | "Often bought with" 2-column grid | ask | Does she sell extras clients pick (nail care products)? Only real products; Questions |
| GGg | Feature chips: soft grey pills with icon and label | n/a | The `.facts` pills already exist as plain pills; no loud icon row to replace |
| GGg | Test any new product photo in a catalog grid | done | `.work-grid` uses one 4:5 crop for every photo so new photos can be checked beside the rest |

## Top fixes

1. **Send button that tells the truth (gen/book.js `update()` and site.css).** `#send` is `aria-disabled` and grey (#C9B9B6, white text) until service, day, time, name and phone are valid. Labels: none chosen "Choose a service"; ready "Send Sat 11:30 on WhatsApp · ₪110"; pressed "Opening WhatsApp" (disabled). A press while incomplete still shows the red field messages. (7pv price in button, GGg live total, U7j label says what happens, yH0 state, V77 grey out)
2. **Show the one real saving the shop way.** Gel with removal: `₪130` struck beside `₪110` and a Save tag reading exactly "Save ₪20", on index.html (row for gel with removal), on the booking option card (tag on the top-right border, becomes "Selected" when chosen) and in `#st-price`. Delete the sentence "against booking removal and new gel apart" in gen/book.js drawSvc. Compute 20 from SERVICES prices. (qJ4, V77, oYs, 7pv, yH0, OKO)
3. **Reassurance line above the button.** In `aside.sum` replace `.note` with a bold 13px line with a green check: "Nothing to pay on this page. Your time is yours once Elisheva confirms it on WhatsApp." Keep one grey line below: "Opens WhatsApp with your booking written out." (qJ4, V77, oYs)
4. **Three true icon lines under the button.** "Confirmed by Elisheva on WhatsApp", "Sunday to Friday, closed Shabbat", "About 25 to 60 minutes, by service", 13px, 1.8 stroke icons, rose. Add cancellation and lateness lines only after she answers. (V77, oYs, 7pv, GGg)
5. **Tick circle on the chosen option card.** `.opt .box::after`: 20px circle at the right end, white tick, fading in 160 ms; border becomes 2px `--rose-dk`; other cards drop to 0.6 opacity once one is chosen. (oYs, AH_, 7pv, qJ4, yH0)
6. **One column of option cards.** `.opts` single column so "Nail art, French or gradient nails" stops wrapping onto three lines at 1280. Check the stage still fits 1280x650. (AH_)
7. **Progress cue.** Label the booking cards "1 Service and colour", "2 Day and time", "3 Your details" with a 2px progress rule that fills as each part is complete. (OKO, qJ4)
8. **Three-step line instead of the facts line.** Replace `.st-facts` with "Choose and send on WhatsApp, Elisheva confirms your time, you come in", with 1px pale dividers. (qJ4, oYs)
9. **Soft focus glow.** `.fld:focus`: `border-color: var(--rose-dk); box-shadow: 0 0 8px rgb(142 74 68 / .3)` with a transparent 2px outline kept for high-contrast mode. (yH0)
10. **Press states on every tappable.** `.opt .box:active, .shade:active, .nav a:active { transform: scale(.97); opacity: .85; }` 120 ms ease-out. (yH0)
11. **Motion under 0.5 s.** Section sweep 840 ms to 420 ms (uncover 280 ms), gallery hover 600 ms to 300 ms, `.stage` 700 ms and `.st-ph img` 600 ms to 300 ms, ghost-in 1600 ms to 400 ms. Leave the hero shade wash and photo spread for Tzvi to decide. (yH0)
12. **Success note after sending.** Top note for 2.4 s, slides in 200 ms: tick, "Booking written out", "Press send in WhatsApp and Elisheva will confirm your time." The button shows a check for 1.2 s. (AH_, yH0, GGg)
13. **Summary card as the honest pause.** Heading "Ready to book?" when complete, "Change" link on each row that scrolls and focuses that field, first name in the heading after it is typed. (OKO, yH0, U7j)
14. **Ask about a design on the nail art row.** A text link next to Book on index.html opening `wa.me/447871822590` with "Hi Elisheva, I would like to ask about a nail art design". (7pv)
15. **Small consistency fixes.** `.fld` radius 14px to match `.opt`; "Gel Nails" to "Gel nails" in index.html and book.html option name; `.st-facts` dividers; one-line "who it is for" appended to the hero lede ("For gel, French and nail art on your natural nails."); textarea `#note` growing to 4 lines; gallery photos fade in 200 ms. (AH_, V77, yH0, oYs)

## Questions for the owner

1. Do you have a few photos of French nails, gradient and nail art sets, and one of you applying gel (the lamp, or your hands at work)? These make the page show use, not only finished colours.
2. Which service do most clients book? We will show a "most booked" label only if you tell us, and only for that one.
3. Do you have real before and after photos (for example removal then a new set)? We can add a slider.
4. Clients' words: can you send two or three nice messages with each person's name and their OK to show them?
5. Is there any certificate or course you completed that you would like shown, with the name of the school?
6. In one or two sentences, why did you start, and who do you like doing nails for? We will write it in your own words.
7. What do clients ask you most before they book, and what almost stopped some from booking? We will answer it in a short FAQ.
8. If a nail chips in the first days, do you fix it, and what do you say about lateness and cancelling? We will put your answer in the booking lines.
9. Do you sell anything clients take home (nail care, oil) that we could show beside the booking?
10. A real number you are proud of (clients, sets done), if you would like one shown.
11. A photo of yourself, if you are happy for it to appear.
