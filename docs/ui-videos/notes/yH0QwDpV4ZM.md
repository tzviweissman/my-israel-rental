# Code with Beto: "Why AI-Built Apps Feel Cheap (And How to Fix It)"

- Channel: Code with Beto. URL: https://youtu.be/yH0QwDpV4ZM. Length: 13:37.
- Method: video downloaded at 720p and viewed as six contact sheets (a frame every 6 s, 6x4 tiles, about 136 frames), with the auto transcript read alongside. No full-size frame pulls or fps=6 strips were made: the motion is on a phone screen recording, so micro-motion (press scale, fade timing) is judged from the narration plus the sheet frames, not measured. Tags: SHOWN = seen on screen, SAID = narration only.
- Subject: a React Native iOS app (Inkigo, an AI tattoo app) and five small things that make a mobile app feel premium. Native app, not a website, so each lesson is translated to the web below. The speaker's claims about his own revenue are a pitch, not evidence.

## What is shown

- 0:00-1:19: talking head; SAID: premium vs cheap is "in the details"; his app charges $20/month and $10/week against competitors at $3.99, because it "feels real". SHOWN as price cards. Sales framing.
- 1:21-2:50 "#1 visual feedback" (press states and spring physics): SHOWN a card scales down while pressed, and pressing then scrolling away cancels it, so the user knows release will not navigate. SHOWN a library page (Pressto) that swaps the standard pressable for one that animates opacity or scale.
- 2:51-5:55 "#2 subtle animations": SHOWN the home screen fading its items in on load; a check icon and circle cross-fading when a plan is selected; a toast that appears and goes; an image that fades in when it arrives; a brief opacity dip on a pressed image; a native zoom transition from a style tile into its detail page. SAID: "play these when something happens, not when you want to show off"; too much animation makes the app feel cheap.
- 5:56-7:32 "#3 haptics" (phone vibration): SAID/SHOWN only as a before/after slider and a library page. Not testable on the web.
- 7:33-9:39 "#4 keyboard behaviour": SHOWN the Continue button rising with the keyboard, the input auto-focused, a soft glow on the field while typing, the input growing to four lines then scrolling inside, swipe down to dismiss. SAID: a static input at the top that ignores the keyboard marks a low-quality app.
- 9:40-12:30 "#5 loading and empty states": SHOWN a camera screen with an icon, "Let's get started" and a Continue button BEFORE the system permission prompt; a blank screen that says "Describe your tattoo or choose a suggestion below"; a shimmering line of text ("brewing...") instead of a spinner while the image generates; the result fading in.
- 12:31-12:50: SAID: no single detail makes an app premium; 20 stacked details do.
- 12:51-13:37: SHOWN a blog post with an "audit your own app" prompt, then a pitch for his paid template. Sales.

## Lessons

1. **Every tappable thing answers the finger at once.** Buttons, cards and tiles get a pressed state (scale to about 0.97 or a darker fill) that starts on pointer down and takes under 100 ms, with a hover state on laptop. Checkable: `:active` rule on every `a`, `button` and clickable card. NEW as a stated rule. (3e.16 covers easing and length of transitions, not the pressed state.)
2. **A press that moves away cancels.** The pressed state ends when the pointer leaves or the page scrolls, and the action does not fire. Native `click` already does this; do not trigger on `pointerdown`. NEW.
3. **Fade content in when it loads; never pop it in.** Page content and each late-arriving image fade in over about 200-400 ms with ease-out; images reserve their space so nothing jumps. NEW as a rule for loading (3e.16 covers easing, `.js-reveal` covers scroll).
4. **Toggle controls cross-fade their icon or state** (open/close, tick/circle, heart on/off) over about 150 ms instead of swapping. Checkable: the menu icon, accordion arrows and basket tick transition. NEW.
5. **Use motion only when something happens, and stop at that.** One small motion per event (press, load, success). A page with continuous decoration everywhere reads cheap. Checkable: count looping animations per screen; ambient ones stay at one. ALREADY in spirit (3e.18, 3g, 3n "no showing off"), the framing "too much looks cheap" is NEW wording only.
6. **Explain before you ask for a permission.** Before a browser prompt (location, notifications, camera, microphone, contact access) show our own line saying why and what the visitor gets, with a Continue button, and only then trigger the prompt. Never fire a prompt on page load. Checkable: grep for `getCurrentPosition`, `Notification.requestPermission`, `getUserMedia` called outside a click handler. NEW. (3j covers honesty in claims, not prompts.)
7. **An empty state says what it is and what to do next.** Empty basket, empty search, empty "my bookings", a gallery with no photos yet: one icon or picture, one plain sentence, one button. Never a blank area or the word "No data". Checkable: every list has an empty branch with a button. NEW for our pages; fits the Requests board and dashboards.
8. **Replace a spinner with a skeleton or a line that says what is happening** ("Checking the oven times..."), with a soft shimmer. Shimmer is a layer over the shape, not the text's own colour. ALREADY (3f.6 for text shimmer); the "say what is happening, not a bare spinner" part is NEW.
9. **A text field responds to being used.** Visible focus ring or soft glow on focus, textarea grows with its content up to a limit, then scrolls inside. On phones the submit button stays visible above the keyboard (`position: sticky` bottom bar or `env(keyboard-inset-height)` where supported). Checkable: tab into each field and look; open the contact form at 375 px with the keyboard up. NEW.
10. **Premium is the stack, not any one item.** Judge a page by whether every small thing (press, load, empty, focus, toggle) has been done, not by one flourish. ALREADY the logic of 3n and 3r; keep as the reason for lesson list items 1-9 being a single checklist.

## Do not copy

- The revenue and price boasts ($800 a month, $20 against $3.99) and "people pay because it feels premium". Unverified, and a pitch for his template (Platano) and his course. Our pages never quote earnings or "premium price" claims.
- Haptics, native zoom transitions, Expo and React Native libraries: native only, no web equivalent we need.
- The "audit prompt" and template plug at the end.

## For our pages

- A bakery, nail salon or gym page feels real when the small things behave: the Order or Book button dips when pressed, the menu photo fades in instead of popping, the basket icon changes tick on add. Add a pressed state and a fade-in to the starter once, so every build inherits them.
- Give every list an honest empty state ("No classes on Friday yet. See Thursday") with a button, and a "Sending your order..." line with a shimmer instead of a bare spinner.
- Ask for location (a caterer's delivery area) or notifications only after a plain sentence explains the use, never on arrival.
- Booking and order forms: visible focus, growing message box, button never hidden by the phone keyboard. Test this at 375 px, in English and Hebrew.
- Keep each effect small and tied to an event; the wow belongs to the opening (3h, 3n), the polish belongs to these details.
