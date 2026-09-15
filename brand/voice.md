# Voice

How MyIsraelRental sounds, in English and Hebrew.

Read this before writing any words a visitor will see: headings, buttons, empty
states, toasts, emails, flyers, the prompts on a form. Code comments are out of
scope.

This file covers words only. Colour and type live beside it in
`design-tokens.css`. Where a rule here already exists somewhere else, the source
is named in brackets, so the two cannot drift apart.

## The one rule

**Say the specific thing.** If a line would fit any website, it is wrong for
this one.

- "Trusted, reliable and built to last" fits anything.
- "Free to list, free to be found, no commission" fits only us.

## Never claim what we cannot back

The code already works this way. The copy has to match it.

- **Every number comes from the database, or it is not shown.** Never round up,
  never estimate, never type a count by hand. (`FinaleStats.jsx`, `TrustLine.jsx`)
- **A claim needs the feature behind it.** No "Verified" badge while there is no
  verification feature. (`FeaturedProviders.jsx`)
- **Prefer the smaller true number to the larger flattering one.** Show reviews,
  not "jobs completed", when jobs completed is a number we do not store.
  (`FeaturedProviders.jsx`)
- **Words that depend on data appear only when the data exists.** "Near you"
  only when we know where the visitor is. "New on MyIsraelRental" only for a
  business that joined this year. (`FeaturedProviders.jsx`, Business Storefront)
- **No testimonials, ratings, counts, urgency or scarcity we have not earned.**
  Never "2 people are looking at this".

## Who we are talking to

From `CLAUDE.md`, repeated here because copy is where it breaks:

- The site is for anyone with something to offer or something they need.
  **Never address "owners" as the default reader.**
- Where a page has to choose, rentals come first. Services are equally supported.
- The standing supply-side call to action is *Add your business, free*.
- The cinematic home page is exempt from this section. Its copy stays as built.

## Free

Free is the central promise, and it is true: nothing on the site charges.

Say it with specifics. "No listing fee, no booking fees, no commission" is
stronger than "Free!".

A zero with no explanation reads as cheap, or as a catch. So where there is
room, free should carry a reason.

> **Open decision for Tzvi: what the public reason is.** Internally the site is
> free by choice, to draw people in (`MARKETPLACE_IS_FREE`). Do not write a
> reason into copy until one has been chosen.

## Write what it does for the person

- **The outcome, not the feature.** "Keep every shekel", not "a zero-commission
  model".
- **Active voice.** "We translate your post", not "posts are translated".
- **Say what happens next.** After any action the reader should know what comes
  next, and roughly when.
- **Short sentences.** One idea in each.

## Banned

- **The em dash, anywhere.** Headlines, buttons, toasts, alt text, placeholders.
  Use a spaced hyphen, a comma, a colon, or rewrite the sentence.
  (taste-skill 9.G, enforced by the UI audit)
- **The middle dot as the default separator.** One per line at most.
  (taste-skill 9.F)
- **Three adjectives, or three matching phrases, in a row.** "Fast, simple and
  secure" is a rhythm, not an argument. One specific fact beats all three.
- **"It's not X, it's Y."**
- **Hype words:** seamless, unparalleled, industry-leading, world-class,
  effortless, elevate, leverage, unlock, empower, revolutionise, cutting-edge.
- **"Quietly"**, in any form. (taste-skill 9.F)
- **Generic step labels** like "Step 1" and "Step 2". The action is the label.
  (taste-skill 9.F)
- **The company name as a headline.** "Join My Israel Rental" pays off nothing.
  Say what joining gets you.
- **Placeholder figures that read as claims.** The stat strip once carried
  "1,200+ active rentals" and "19 cities" from a preview file. The real numbers
  were 196 listings, all in one city. (`FinaleStats.jsx`)

## Hebrew

Hebrew readers notice every seam.

- **Every string needs a key in both `en.js` and `he.js`.** A missing Hebrew key
  shows English to Hebrew readers with no error. (frontend skill)
- **Never hardcode display copy in a component**, because then it cannot be
  translated. (frontend skill)
- **Every plural form is a whole sentence in the same register, including
  zero.** Zero renders for every request with no replies yet, and a leftover
  fragment reads as broken Hebrew. Write a real `_zero`. (UI audit, 3 Sep 2026)
- **A translation has to be a translation.** Model output that answered the
  prompt instead of translating it once shipped as a Hebrew title. Read the
  Hebrew before it goes live. (commit `d421a26`)
- **Everything in Banned applies in Hebrew too**, the em dash included.

> **Open question, not yet a rule:** whether headlines and marketing copy should
> be written in Hebrew from the start rather than translated from English.
> Probably right, but nobody has decided it or recorded a reason.

## Before copy ships

1. Could this line sit on a competitor's site unchanged? Rewrite it.
2. Is every number and every claim backed by real data or a real feature?
3. Search the string for the em dash, the middle dot and the hype words.
4. Is it in both `en.js` and `he.js`, and does it read correctly at a count of 0?
5. Read the Hebrew itself, not just the English it came from.

## Changing this file

When copy comes out wrong, add the rule that would have caught it, in the
smallest place, and name where it came from. Do not add rules nobody has broken
yet.
