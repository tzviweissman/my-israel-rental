# Independent review: Aaron Dovid site

Tested in Chrome (Playwright) at 1440x900, 1280x650, 390x844 and 360x640 (touch). All four pages, hover, string pluck, rotating word, sound button, phone menu, and the book page walked through 3 steps for each of the 3 services at three sizes. POST and wa.me were routed, nothing real was sent.

## Checklist

1. PASS. The three services show alike on /book.html (name, one line, price on the right) and the occasion rows and chips are uniform. Lessons page has two matching cards.
2. PASS. Price sits right-aligned in each service card on book; on lessons.html both cards put price then button in the same spots. Mentoring says "Ask for the price" where a number would be (deliberate).
3. FAIL. One purpose, two wordings: mentoring price reads "Ask for the price" on lessons.html and book step 1, but "Aaron tells you the price" in the book summary panel (set huge, two lines, at all sizes). Also the "Book" nav button vs "Send on WhatsApp" is fine; only the price wording clashes. Fix: use "Ask for the price" in the summary, normal size.
4. PASS. Cursor is pointer on Book, occasion rows, Sound; occasion row inverts on hover (index, 1440); buttons, chips, step links respond; focus ring on fields.
5. PASS. n/a in spirit: the list of occasions beside no photo. Hero strings respond to the mouse (pluck2.png: strings bend), and touch tap works. The rotating word cycles Bar Mitzvah / Chuppah / Bris Milah / simcha.
6. PASS. Kumzits: occasion chips appear under the choice at once; lesson and mentoring: in person / online / not sure appears at once; place and guests only for kumzits on step 2; day, time, name, phone, note all choosable. Errors show per field (no occasion, no time, no name, no phone). A Friday or Saturday gives "Aaron books Sunday to Thursday" with a button to jump to the next Sunday, which works.
7. PASS with one note (see Other findings 3). WhatsApp text, kumzits: "Hi Aaron, I would like to book: A kumzits for a Chuppah, on Sunday 15 November at 10:00, in Baka, for about 40 people. From Test Tester, 052-111-2222. Please bring a capo / Price on your listing: ₪1,200 / Follow the booking: https://myisraelrental.com/track/test". Lesson: "A 40-minute guitar lesson, online, on Sunday 15 November at 10:30. From ... / Price on your listing: ₪100". Mentoring: "Guitar and mentoring, online, ..." no price line, correct. Same text at all three sizes. POST body carries date, slot, name, phone, message. Number used is 972534193420, correct.
7a. PASS. No savings claimed anywhere; none exist (single kumzits, single lesson price).
8. PASS (n/a for owner photos: none). The hero wall photo is sharp at all four sizes, not stretched; strings do not blur it.
9. n/a. No product photos.
10. PASS. Every stop point I captured shows whole sections (heading with its text and price). On phone the order bar overlaps the bottom row of the occasion list only while scrolling past, content is reachable.
11. PASS. No blank bands after reveal on laptop or phone, hero visible at once. Learn/Play/Grow columns are stepped lower on purpose (CSS nth-child margins), not a bug.
12. PASS. On phone the bottom bar (Kumzits ₪1,200 / Book) hides itself on book.html, so it never covers Continue or Send. On the other pages it sits over footer text at the very end but the Privacy link stays above it.
13. PASS. Every fact traces to record.json or the flyers: ₪1,200 kumzits, ₪100 / 40 min lesson, Jerusalem, Sunday to Thursday 9:00 to 17:00, 053-419-3420, musicnchizuk@gmail.com, "Now offering online lessons", Learn / Play / Grow, "A relaxed time to play guitar, talk...", Bar Mitzvah / Chuppah / Bris Milah. Nothing invented found. "Aaron Dovid" is on both flyers.
14. PASS. Strings across the opening that bend under the pointer or a tap (with Sound toggle), and the pick-shaped logo mark. Works on desktop and phone.

## FAIL list (from the checklist and extra)

- FAIL (item 3): "Ask for the price" vs "Aaron tells you the price", the latter oversized. book.html summary panel.
- FAIL, extra: WhatsApp links `https://wa.me/0534193420` (closing band on every page, footer "WhatsApp or call", contact page card) use a local number with a leading 0 and no country code. WhatsApp will not open a chat from that. The book flow and the videos link correctly use 972534193420. Fix: `https://wa.me/972534193420` everywhere (keep "tel:" for call if wanted).
- FAIL, extra: closing band "Book your kumzits or your first lesson" has padding-top but padding-bottom 0 (site.css line 110): the Email line sits flush on the bottom edge of the dark band on every page and size (lap-index-3, lap-contact-0). Fix: add bottom padding equal to the top.
- FAIL, extra: contact.html card links ("053-419-3420", email) render in the browser's default blue (rgb 0,0,238) on the tan card, unstyled and low contrast, unlike every other link on the site. Fix: style `.card a` with the ink/accent colour and underline.
- FAIL, extra (minor): moving between booking steps scrolls the form to the top under the sticky header, so the "Step 1 / Step 2 / Step 3" labels are half hidden (lap-kumzits-4, ph step 2 and 3). Fix: scroll-margin-top on #book equal to the header height.

## Other findings

1. favicon.ico returns 404 (one red console line on a page load). Add a favicon or a link tag pointing to the mark.
2. Mentoring is posted to the "Music Lessons" gig with tier "Music Lessons" (₪100 listing). The text says mentoring, so Aaron can tell, but the saved booking on MyIsraelRental will show a ₪100 lesson. Worth telling the owner or adding a tier for it.
3. Kumzits times offered are 09:00 to 16:30 only, taken from his weekly availability. Kumzitzes are usually evenings; ask Aaron if evening slots should be allowed (not failed, it matches his record).
4. Spelling varies on purpose between "kumzits" (flyer) and "kumzitzes" (his description); consistent in use.
5. No horizontal scroll on any page at any of the four sizes. No JS errors.


## Re-check after fixes

Seen again at 1280x650, 1440x900 and 360x640 (touch), all four pages plus a mentoring booking walked to the end:
- Price wording: book summary now reads "Ask for the price" in normal size, matching lessons.html and step 1. PASS.
- wa.me: every link on index, lessons, contact and book is now https://wa.me/972534193420. The sent WhatsApp text for mentoring is complete (no price line). PASS.
- Closing band: padding-bottom 48px, the Email line no longer touches the edge, on all pages and sizes. PASS.
- Contact card links: now ink colour (rgb 36,23,13) with underline, like the rest of the site. PASS.
- Step labels: after moving to step 3 at 360x640 and 1280x650 the "Step 1 / 2 / 3" row sits fully below the sticky header. PASS.
- Nothing broken by the fixes: no horizontal scroll, no JS errors, booking and message still correct. All earlier PASS items still hold. Minor notes 1 to 3 above still stand (favicon 404, mentoring saved under the Music Lessons tier, kumzits slots 09:00 to 16:30).

Verdict: PASS
