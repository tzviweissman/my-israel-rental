# Master the 3 Types of CRAZY Mobile UI Swipe Interactions

- Channel: Kole Jain
- URL: https://youtu.be/14h1VnkQvIc
- Length: 5:53 (353 s)
- Watched: frames every 3 s (10 contact sheets) plus 0.17 to 0.5 s frame strips of the swipe-up expand (2:57-3:01) and the onboarding circle wipe (3:45-3:56). Transcript read alongside.

## What is shown

Three categories, all phone mockups with a cursor standing in for a finger: within-page navigation, between-page navigation, swipe gestures.

Within a page
- 0:20-0:40 Scrolling cards (crypto wallet cards). Rigid linear swipe first, then the same swipe with a bouncy ease so cards carry momentum. 0:42-0:51 shows an easing playground (linear, ease-in, ease-out and other curves racing along 4000 ms tracks); 0:54-0:57 a toggle sliding. Says: almost never linear; easing sets the tone (snappy, springy, slow).
- 1:03-1:12 Cards skewed and tilted off the screen edges so they read as a 3D ring, neighbours peeking at left and right. Frame: frames/14h1VnkQvIc-0106.jpg
- 1:12-1:18 Indicator dots under the cards: plain highlight, then a fluid "magnetic" blob that stretches between dots on swipe.
- 1:24-1:45 Circular avatar picker at the bottom: avatars shrink toward the screen edge like a horizon, a cone follows the finger, the headline and chart above change to the chosen person. Swipe down goes full screen; the black ground is tappable or swipeable to change modes.
- 1:48-2:03 Reminders and Gmail rows: swipe to reveal Details/Flag/Delete or delete with a "moved to Trash / Undo" bar. Says: swipe and button both exist.
- 2:07-2:57 Sponsor segment (a course site). Ignore.

Between pages
- 2:51-3:20 Swipe-up page transition on a "Cooking Class" card. From the 0.17 s strips (starting 2:57): the black tab at the bottom of the card swells into a rounded hump over about 1 to 1.5 s as the finger drags (the hump tracks the drag); at release the black fills the whole screen in about 0.3 s, the new content fades up and in over roughly another 0.3 s, and the top edge of the black sheet wobbles for one beat (elastic snap) before settling flat. Replayed slowed down at 3:00-3:24. Frame: frames/14h1VnkQvIc-0300.jpg
- 3:29-3:56 Onboarding with a circular wipe. From the 0.5 s strip (starting 3:45): a pink circle grows from the button to cover the screen in about 1 s while content slides out; the next screen's button circle shrinks back and content slides in. The wipe originates at the pressed button. Frame: frames/14h1VnkQvIc-0350.jpg
- 3:58-4:13 Recipe list: tapping a photo zooms it into the hero image of the detail page (shared element), so the image stays continuous. Says: it creates continuity.

Swipe gestures
- 4:15-4:20 Inbox row swipe reveals an action ("Unread").
- 4:21-4:44 Invite-list app: drag a contact up into a yellow list (same magnetic indicator), or long-press for an Add/Delete/Archive menu. Says: offering both is better, but once learned the swipe is faster.
- 4:48-5:09 Bottom sheet popups: swipe down to dismiss with a visible button too; the background screen scales down and moves back when the sheet opens, and returns on close.
- 5:12-5:25 Slide-to-send confirmation in an email tool ("Ready to send?" with warnings, then a "Slide to send" slider). Says: for high-impact or irreversible actions. Frame: frames/14h1VnkQvIc-0519.jpg

## Candidate rules for us

Our context is a one-page marketing site, so most app gestures do not apply; the transferable ones are listed.

| # | Rule (testable) | Evidence | SHOWN or SAID |
|---|---|---|---|
| 1 | Never linear easing on moving UI: use an ease-out or spring-like cubic-bezier for carousels, sheets, reveals. Check: no `transition-timing-function: linear` on UI motion. | 0:20-0:57 | SHOWN and SAID |
| 2 | Horizontal card carousels show a sliver of the previous and next card so people can see it scrolls. For us: menu items, gallery, before/after. | 0:20-1:12 | SHOWN |
| 3 | Pair every swipe with a visible control (dots or arrows that are tappable); swipe is a shortcut, never the only path. In RTL, swipe direction and dot order mirror. | 1:10-1:20, 1:44-2:03, 4:56 | SHOWN and SAID |
| 4 | Any swipe action has a button alternative. We use plain buttons; nothing on a business page is swipe-only. | 1:44-2:03, 4:21-4:44 | SAID; shown in Gmail |
| 5 | Sheets and overlays (e.g. the enquiry form) slide up from the bottom, close by swipe down AND a visible close button, and the page behind scales down slightly while open. | 4:56-5:09 | SHOWN |
| 6 | Changing views animates from where the user tapped (a thumbnail grows into the detail hero) rather than a hard cut. Under about 0.5 s; honour prefers-reduced-motion. | 2:51-3:20, 3:58-4:13 | SHOWN |
| 7 | Slide-to-confirm is only for irreversible high-stakes actions. Our enquiries and bookings are reversible, so use ordinary buttons. | 5:12-5:25 | SHOWN; our rule is to not use it |
| 8 | New content enters from the direction of the gesture; mirror in Hebrew. | 3:12-3:29 | SAID |

### Rejected / not applicable

- Rejected for our build: slide-to-send for contact forms (extra friction, no benefit for reversible actions).
- Not applicable: circular avatar picker, wallet cards, onboarding wipes (app onboarding, not marketing pages). Useful only as motion references if a page has a genuine multi-step flow.
- The sponsor segment (2:02-2:37) is advertising.

## Key frames

- frames/14h1VnkQvIc-0106.jpg (skewed 3D card ring with peeking neighbours)
- frames/14h1VnkQvIc-0300.jpg (swipe-up expand)
- frames/14h1VnkQvIc-0350.jpg (circular wipe onboarding)
- frames/14h1VnkQvIc-0519.jpg (slide-to-send confirmation)
