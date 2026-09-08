# Michal Simkin, a scroll-driven page from real data

**Self-authored, on instruction.** Tzvi, 8 Sep 2026: "use our design plugin
with these revision fixes you learnt to design a different business on my
site so i can see what you come up with. also use mobbin for inspiration
from similar categories and you can use higgsfield mcp to generate videos
if you need and you can also search pinterest for inspiration." No
questions asked this time: the ask was to see what I come up with.

Nothing touched production: one public GET of her record and listing, and
her public website read for copy, prices and photographs.

## The lessons from Blazin' Boards, applied before a line was drawn

1. **Find what the business actually has.** Our record: a name, Bet
   Shemesh, "Sun to Thursday 10 to 2 by appointment", English and Hebrew,
   one listing with one tier (custom wig consultation, 100), one image (her
   logo). Her website: her own headline, two services in her words, a
   five-step process, eight named testimonials, her bio, an academy with two
   courses, prices, a start date and a class cap, twenty-one client
   portraits, her profile photo, WhatsApp booking. That is the page.
2. **The product performs, not the camera.** Her product is a woman in a
   wig she loves. The portraits are the product, so they are what moves.
3. **Only their photographs.** Nothing generated. The business is real
   people; a generated face here would be a lie about a client.
4. **Only their numbers.** Prices, dates and the class cap are transcribed.
   "Max 10 students" is her capacity, stated as a fact, not dressed as
   urgency.
5. **No blank screens.** Five acts, every one carrying something.
6. **One idea that is theirs alone**, not borrowed from the reference.

## References, as devices not moods

- Mobbin: Hims' "real customers, real results" pairs with a caption that
  names the fact; Metalab's portraits on a dark ground with the quote set
  small beside them; Deel's two-panel before/after. Fresha and ClassPass
  were the category defaults (search bar, grid of tiles): avoided.
- Pinterest's salon boards are one template: moody, dark, serif, "luxury".
  Her brand is the opposite, warm and personal, so the page is ivory and
  navy with her blush, and the type is hers to the extent it can be.
- Her own site: navy `#0E1F39`, blush `#DBB3B1`, rose-gold logo, buttons
  with a 45px/10px asymmetric radius. Kept: the palette and the radius.

## The eight answers (self-authored)

1. **Vibe.** Warm, unhurried, personal. A friend's salon, not a brand.
2. **The scroll.** Her promise, with her clients arriving one by one. What
   happens when you come in, step by step. The transformation, in her
   clients' own words. The academy. Her sign-off.
3. **Loud and quiet.** Gentle open, the peak is a change of words not a
   change of volume, quiet close.
4. **The moment.** The words a client used before ("its fine", "make do",
   "dread wearing") strike through under the scroll and the words she used
   after take their place. All eight reviews contain both halves.
5. **One thing no site does.** That. The before-and-after is typographic,
   and every word of it is a quotation.
6. **Range.** Editorial, warm. Not premium-minimal, not the Pinterest
   moody salon.
7. **World or scenes.** Scenes. Hard grounds: navy, ivory, pale blush.
8. **Assets.** Her twenty-one portraits, her profile photo, the reviewers'
   own pictures, her two logos. Nothing else.

## The feeling curve

```
1  Recognition   navy. Her headline arrives; her clients deal onto a stack
                 one at a time under the wheel, each a real woman in the
                 salon chair. Greet
2  Ease          ivory. "This isn't about hair. This is about you." and
                 the five steps of a consult, hers, as a timeline
3  Relief        pale blush. THE PEAK. The before-words strike through and
                 the after-words arrive, then three named clients say it
                 in full, with their photographs
4  Ambition      navy. The academy: two courses, the bundle, the date, the
                 cap, one graduate who now runs her own salon
5  Welcome       ivory. Her own sign-off, one button, the consult price
                 and the hours beside it
```

## The peak

Act 3. Largest span (3.4vh), pale blush ground, the only act where words
are crossed out. The visitor's sentence:

> the words people used about their old wigs got crossed out one by one
> and the words they used after took their place, and they were all real

## The tell-someone sentence

> it's the site where the reviews rewrite themselves as you scroll

## Grammar

**Named: "Lookbook."** Chaptered scenes with hard grounds, the photographs
as objects that arrive rather than as ground, the type as the argument.
No video, no scrub. Forbids: photographic ground, counters, scroll cues,
cards for the copy (the portraits are photographs, not cards), more than
one CTA label.

## The signature move

**The same wig.** Before-words from the reviews ("its fine", "make do",
"dread wearing", "old style and uncomfortable", "lost its wow factor")
sit in the frame; as `--sc-p` advances a rule draws through each one
(transform scaleX, nothing else) and the after-word from the same review
rises beneath it ("cute, light, works amazingly", "love it", "brought it
back to life", "finally feel myself", "a fabulous fit"). Page JS off the
act's progress; the engine untouched. Every pair is one reviewer's own
before and after, and the names are on the page.

## Score

| Act | Beat | Device | Span | Ground |
|---|---|---|---|---|
| 1 hero | Recognition | `pin` + kinetic lines + bespoke deal (portraits) | 2.8 | #0E1F39 |
| 2 consult | Ease | `flow` + `in`, a five-step timeline | ~1.2 | #FBF7F4 |
| 3 same wig | Relief (PEAK) | `pin` + bespoke strike + three cued quotes | 3.4 | #F3E4E0 |
| 4 academy | Ambition | `flow` + `reveal` + `in` | ~1.3 | #0E1F39 |
| 5 close | Welcome | `pin`, held cue, a letter, no photo, no magnet | 1.2 | #FBF7F4 |

pin > flow > pin > flow > pin, about 9.9 viewport-heights. Families: pin,
flow+in, reveal, kinetic, two bespoke transforms. No family twice in a row.

## Nav and CTA

No top bar. A fixed bottom bar, the booking pattern a phone already knows:
her mark, one button, **Message Michal Simkin**, and beside it the one
line of reassurance, "Consultation ₪100. Sun to Thu, 10 to 2, by
appointment. Bet Shemesh." Same label at the close. The academy's enrol
line uses the same label, because her enrolment is the same WhatsApp.

## Sales psychology

- Congruency (4): her headline, her words, her process.
- Specific numbers (2 to 3): ₪100, ₪8,000, ₪12,000, 3 November, 10:00,
  10 students, 2 years later. All hers.
- Reassurance beside the CTA (5): price, hours, place, in the bar.
- Testimonials with names and faces (3): eight on her site, three here
  with their own photographs, chosen for the specific detail.
- One job (4): one label, one action.
- Never: no countdown, no "3 spots left", no invented rating.

## Fingerprint gate

| Dimension | lechem-emek | blazin-boards r3 | michal-simkin |
|---|---|---|---|
| Grammar | Night shoot | Product tumble | Lookbook |
| Nav | wordmark + clock | wordmark + CTA bar, top | fixed bottom bar, mark + CTA + reassurance |
| Hero device | still push-in | 3D cut-out tumble | portraits dealt onto a stack |
| Act shape | 8 acts 14.0vh | pin>pin>flow>flow>pin 10.3vh | pin>flow>pin>flow>pin 9.9vh |
| Close | photo + magnet | photo + spotlight + magnet | a letter, no photo, no magnet |
| Signature | sunrise | grows to scale | the same wig (words rewrite) |

6 of 6 against both.

## Verification plan

scroll-craft harness at desktop, phone, reduced motion; design-loop's
mechanical checks; visual-diff at 1280 / 768 / 375; page-conversion-review
and dead-ends as the critics that did not build it. English only for now,
on instruction.
