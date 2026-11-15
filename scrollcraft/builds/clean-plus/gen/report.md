# Clean Plus: build report (15 Nov 2026)

## What was built

A three-page site for Clean Plus (slug `clean-plus`), weekly home cleaning all around Jerusalem:

- **Home.** A bright Jerusalem living room fills the screen, with the flyer's own headline "Home cleaning, your
  way." On the right is a plan board: a royal blue 4-hour visit lands on Tuesday and repeats down the next four
  weeks. Tap any day and every visit slides to it. "Every two weeks" lifts every other visit off, and "Just once"
  leaves one. Below are the flyer's six options; the four that change a plan (same cleaner, supplies, deep clean,
  one-time) add their line to the plan. Then the ₪325 price card and the three steps.
- **Build your plan** (book.html). Three steps, with the plan written out beside the form as you choose. It is
  saved on MyIsraelRental first, then opens WhatsApp with the plan and a tracking link. It arrives already filled
  with whatever was chosen on the home page's board.
- **Contact.** WhatsApp, where we clean, and the price.

Facts used are only the listing's and the flyer's: weekly 4 hours ₪325, all around Jerusalem, the six options
in the flyer's words, and the listing's WhatsApp number. Nothing else is priced; everything else says the price
comes on WhatsApp. The flyer's receipt image shows a customer's name and is never used.

## Spend

One generated picture, the room, in two shapes (gen/still.py, Higgsfield API, `higgsfield-ai/soul/standard`, one
run per shape, no retries). The API returns no price and the connected account's balance shows the free plan, so
the exact credit cost was not measured; it is the same model and settings as the RBS room.

## Tested

- The plan board and the whole form, end to end, with the save and WhatsApp caught in the browser (never the
  owner's inbox): gen/test-form.mjs, 39 checks pass.
- Rendered at 1440x900, 1366x768, 768x1024, 390x844, 414x896 and 360x640.

## Not done yet

- The owner's answers (OWNER-QUESTIONS.md): which number takes WhatsApp and calls (the flyer says 058-713-0664,
  the listing 050-423-2291; the site uses the listing's), prices for other cleans, what a visit includes,
  Saturday (the listing says open, so the board leaves Saturday off until they confirm), real photos, reviews,
  and questions.
- Not published: it goes live at /pages/clean-plus only with your OK.

## For your call

1. Publish the site now, with the listing's WhatsApp number, or wait for the owner's answer on the phone number?
2. A scroll film for the opening (a visit being cleaned, room by room) is possible as a paid add-on later; the
   board is already the opening's wow, so I left it out.
