# The open rule questions, decided (22 Nov 2026)

Tzvi: "I want to implement Fable's rules decisions". These are the planner's answers to the open questions in
`docs/rules-reorder-spec.md`, part 4, and the exact edits for each. Question 4 was decided by Tzvi himself.

Checked against branch `rules/fable-decisions` at `3f2c8cdd` (origin/main). Nothing here has been run except the
baseline: 26 builds, 55 passes, 23 failures; `blueprint --order` says 327 rules.

## Read this first

- Work in `C:\Users\tzviw\Documents\mir-reorder`, branch `rules/fable-decisions`.
- Never edit a build folder or anything under `frontend/public/pages/`. Decision 4 is done with one new file beside
  `scrollcraft/published.json`, not inside a build, so no commit check on Krysp or Aaron Kaluszyner is set off.
- Edit with the Edit tool. "Old" text is copied from the files. If it does not match, stop and read the place.
- Short names: **FULL** `docs/page-generation-rules.md`, **DIGEST**
  `.claude/skills/build-business-page/reference/rules-digest.md`, **LIST** `docs/rules-checklist.md`, **REG**
  `docs/rules-as-blueprint/rules.json`, **SKILL** `.claude/skills/build-business-page/SKILL.md`.
- Never edit `reference/full-rules.md`; the sync writes it.
- Rules name a phase by what it does, never by its number (rule of 22 Nov). The new text below keeps to that.
- Save with `scripts/commit-rules.mjs` (last part). Do not push; that is Tzvi's call.

## The decisions, one line each

| # | Question | Decision |
|---|---|---|
| 1 | Labels above headlines | No label on every section. One headline size stays. A label only where it adds a fact. |
| 2 | Button that flips to its price | Not on new sites. Calm prices win. The hover highlight behind a price stays. |
| 3 | Four ids ending in a letter | Renumber them, so every script reads them. Sites already published are spared by the date. |
| 4 | Burnt, Krysp, Aaron Kaluszyner | Tzvi: Burnt takes the new rules. Krysp and Aaron keep the rules as they were before 22 Nov. |
| 5 | Does the one small touch count | Yes, when it is something seen. It is the first of the three decorations. |
| 6 | Two signature sections or one | Two, and the showpiece is one of them. No change. |
| 7 | Staged, side-lit opening | The staging is asked of every site. The deep dark ground is one of the three first screens. |
| 8 | Owner's signed note | Every owner is asked for it in the first message. It is shown only when they give it. |

---

## 1. Labels above headlines

**Decision:** a new site has no label above every section; each section headline is one size, and a small label is
used only where it adds a fact the headline does not carry.

**Why:** R5b.6 bans "a label above every section" and R3ag.5 asked for one on every headline, so a builder could
pass only one of them. The label on every section is one of the marks of an AI-made page (the Cook list in
`docs/inspo/videos-2026-11-22`). What made Cakes by Tova tidy was the one headline size, which `check-look.mjs`
measures. That script never looked for labels, so no script changes and no site is affected.

**LIST.** Replace the line that starts `R3ag.5 |` with:
```
R3ag.5 | Every section headline is one size; the only other size is 3ad.3's one jump. A small label above a headline is used only where it adds a fact the headline lacks (the occasion, the place), in plain small type, never on every section (5b.6) | 3ag.5, 5b.6 | script: `node scripts/check-look.mjs <home url>` (HEADINGS) + LOOK: count the labels
```

**FULL, section 3ag, item 5.** Old:
```
5. **One headline size.** Every section's headline is one size, with a small label above it (Tova's ribbon:
   "Chanukah", "From abroad"), and 3ad.3's one jump is the only other size. Hers were 36, 36, 76 and 52 px, and it read
   as untidy. Checked by `scripts/check-look.mjs` (HEADINGS: at most 2 sizes within 3 px).
```
New:
```
5. **One headline size.** Every section's headline is one size, and 3ad.3's one jump is the only other size. Hers
   were 36, 36, 76 and 52 px, and it read as untidy. A small label above a headline is used only where it adds a
   fact the headline lacks (Tova's "Chanukah", "From abroad"), in plain small type, and never on every section
   (5b.6; changed 22 Nov 2026: this rule asked for a label on every headline, which 5b.6 bans and which marks a page
   as AI-made). Checked by `scripts/check-look.mjs` (HEADINGS: at most 2 sizes within 3 px); the labels are a LOOK.
```

**DIGEST, section 3ag.** Old: `(5) One headline size with a small label above, plus 3ad.3's one jump (check-look`
New: `(5) One headline size, plus 3ad.3's one jump; a small label only where it adds a fact, never on every section (5b.6) (check-look`

**REG, record `R3ag.5`.** Set `rule` to `One headline size for every section, plus 3ad.3's one jump; a label only where it adds a fact, never on every section`
and `built_by` to `One --h token for section headlines, set in the section plan; labels named there only where they add a fact`.

R5b.6 and its text stay exactly as they are.

## 2. The button that flips to its price

**Decision:** a new site never uses a button that flips or turns to show its price; the price is always in view
beside its button, and the hover highlight behind a price stays allowed.

**Why:** rule 3ak.4 (approved today) already says so. A price that shows only on hover does not show at all on a
phone, where most orders are made, and 3c.6 wants price, unit and action together. Only two stale sentences still
offer B5 to the next business.

**DIGEST, section 0.** Old:
```
  marked with what it suits. B2 and T1 are on Michal Yodaiken's page; B5 (flips
  to the price) is liked and kept for another business. Pick per business, never
```
New:
```
  marked with what it suits. B2 and T1 are on Michal Yodaiken's page; B5 (flips
  to the price) is not used on a new site (3ak.4: the price stays in view). Pick per business, never
```

**FULL, section 8a.** Old:
```
never share the same set; a piece Tzvi likes but did not choose is kept for
another business (B5, the button that flips to show the price). Every new piece
```
New:
```
never share the same set; a piece Tzvi likes but did not choose is kept for
another business. B5, the button that flips to show the price, is not used on a
new site since 22 Nov 2026 (3ak.4: the price stays in view). Every new piece
```
No checklist or script change: R3ak.4 already carries it.

## 3. The four ids that end in a letter

**Decision:** renumber R0b.4i, R3e.16b, R3e.11b and R3e.16c to R0b.15, R3e.26, R3e.27 and R3e.28, and make
`check-rule-homes` refuse any future id that ends in a letter.

**Why:** `blueprint.mjs`, `check-rules.mjs`, `rule-dates.mjs`, `check-push-rules.mjs` and the commit check all read
an id as letters and digits, a dot, then digits only. So these four lines were never planned, never answered, and
never dated. Because they were never dated, `check-motion-feel` and `check-break-ui` ran at every publish on every
site, however old. Widening the pattern would mean the same edit in five scripts. A new number needs none: the
scripts read it at once, and its first day in git is today, so `rule-dates.mjs` spares every site already
published. That spares a little more than the rule's true date would (sites published since 20 Nov), which is the
safe side. No RULES.md answers the old ids (the scripts could not read such a line), so nothing needs retiring.

**LIST.** In each of the four lines change only the id at the start. The rest of each line, its third column
included (`0b.4`, `3e.16b`, `3e.11b, 3e.11`, `3e.16c`), stays, because that column names the rule.
- `R0b.4i | The opening ideas came from the saved sources` becomes `R0b.15 | The opening ideas came from the saved sources`
- `R3e.16b | Controls answer in 300 ms or less` becomes `R3e.26 | Controls answer in 300 ms or less`
- `R3e.11b | With a very long name, a four-digit price` becomes `R3e.27 | With a very long name, a four-digit price`
- `R3e.16c | CONCEPT.md - motion: plans the opening` becomes `R3e.28 | CONCEPT.md - motion: plans the opening`

In `## Retired`, under its last `- R... ->` line, add this plain note (it does not start with `- R`, on purpose):
```

Renumbered 22 Nov 2026, because the scripts cannot read an id that ends in a letter: R0b.4i is now R0b.15, R3e.16b is
R3e.26, R3e.11b is R3e.27, R3e.16c is R3e.28. An id always ends in a number.
```

**REG.** In the four records change only `"id"`: `R0b.4i` to `R0b.15`, `R3e.16b` to `R3e.26`, `R3e.11b` to `R3e.27`,
`R3e.16c` to `R3e.28`.

**`scripts/publish-page.mjs`.** Old:
```js
    ['check-motion-feel.mjs', 'has controls that are slow, bounce, pop from nothing or give no press', 'R3e.16b'],
    ['check-break-ui.mjs', 'breaks with a long name, a big price or a missing photo', 'R3e.11b'],
```
New:
```js
    ['check-motion-feel.mjs', 'has controls that are slow, bounce, pop from nothing or give no press', 'R3e.26'],
    ['check-break-ui.mjs', 'breaks with a long name, a big price or a missing photo', 'R3e.27'],
```

**`scripts/check-rule-homes.mjs`.** Directly above the line
`  const checklist = [...read('docs/rules-checklist.md').matchAll(/^(R[0-9][0-9a-z]*\.[0-9]+[a-z]?)\s*\|/gm)].map((m) => m[1]);` add:
```js
  // an id ends in a number: blueprint, check-rules and rule-dates cannot read one that ends in a letter, so such a rule
  // was never planned, answered or dated (R3e.16b and three more, found 22 Nov 2026)
  for (const m of read('docs/rules-checklist.md').matchAll(/^(R[0-9][0-9a-z]*\.[0-9]+[a-z]+)\s*\|/gm)) bad.push(`${m[1]}: a checklist id must end in a number (take the next free one; the third column names the rule)`);
```

`docs/rules-as-blueprint/inventory.md` names R0b.4i three times. It is a dated study, not read by any script. Leave it.

What changes for builds: a build not yet published (Burnt) gets four more blueprint lines after
`node scripts/blueprint.mjs --update <build>`; they are rules it was already built to. Krysp and Aaron are spared
by decision 4. Published sites are spared by the date, and `publish-page` now prints "not run, rule R3e.26 was
added after this site was made" for them.

## 4. Burnt takes the new rules; Krysp and Aaron Kaluszyner are spared (Tzvi's decision)

**Decision (Tzvi):** Burnt builds to the board and the page-plan yes. Krysp and Aaron Kaluszyner keep the rules as
they were before 22 Nov 2026.

**How, the smallest change:** `rule-dates.mjs` already answers "which rules is this site held to" for every script
(check-rules, check-concept, check-ideas, check-compared, check-references, check-build, publish-page). It only
knows published sites. One small file names a build and the moment its rules were frozen, and `siteMade` reads it.
Nothing is needed for Burnt: an unpublished build with no entry is held to every rule, as today.

**NEW file `scrollcraft/rules-as-of.json`:**
```json
{
  "krysp": { "as_of": "2026-11-22T00:00:00+02:00", "why": "Tzvi, 22 Nov 2026: keeps the rules as they were before 22 Nov" },
  "aaron-kaluszyner": { "as_of": "2026-11-22T00:00:00+02:00", "why": "Tzvi, 22 Nov 2026: keeps the rules as they were before 22 Nov" }
}
```
The first rule commit of 22 Nov was at 14:12 and the last of 21 Nov at 21:04 (Israel time), so midnight between
them is the line.

**`scripts/rule-dates.mjs`, in `siteMade`.** Old:
```js
    if (first) made = Math.min(made ?? Infinity, Number(first) * 1000);
  }
  return made;
}
```
New:
```js
    if (first) made = Math.min(made ?? Infinity, Number(first) * 1000);
  }
  // a build Tzvi spared from later rules before it was published (scrollcraft/rules-as-of.json: "<folder>": { "as_of":
  // "<time>", "why": "Tzvi, <date>: ..." }) is held to the rules as they were at that time, then and after it is published
  // (22 Nov 2026: Krysp and Aaron Kaluszyner keep the rules of before that day)
  try {
    const asOf = Date.parse(JSON.parse(fs.readFileSync(path.join(root, 'scrollcraft', 'rules-as-of.json'), 'utf8'))[folder]?.as_of);
    if (asOf) made = Math.min(made ?? Infinity, asOf);
  } catch { /* no such file, or no entry: held to every rule */ }
  return made;
}
```
In the same file's header comment, old:
` * day the site was first published, or when its RULES.md answers it (it took the rule on). A site never`
` * published is held to every rule. check-rules and publish-page both ask here.`
New:
` * day the site was first published, or when its RULES.md answers it (it took the rule on). A site never`
` * published is held to every rule, unless Tzvi spared it: scrollcraft/rules-as-of.json then names the time its`
` * rules were frozen. check-rules and publish-page both ask here.`

`Math.min` keeps the frozen time after the site is published. Without it, the first publish would move the date
forward and bring the 22 Nov rules back.

**FULL, the top part "How a rule is added".** Old:
`   "not required" and publish-page does not run that rule's check (`scripts/rule-dates.mjs`). Show Tzvi`
New:
`   "not required" and publish-page does not run that rule's check (`scripts/rule-dates.mjs`). A build not yet`
`   published is held to every rule, unless Tzvi spares it by name: its folder and the time its rules were frozen go`
`   in `scrollcraft/rules-as-of.json`, with his words (22 Nov 2026: Krysp and Aaron Kaluszyner). Show Tzvi`

Both builds fail their checks today for older reasons as well, so sparing them does not make them pass. It
removes the 22 Nov rules from what they are asked (today: 4 such lines in Krysp's check-rules output, 16 in its
check-concept output).

## 5. The one small touch counts as a decoration

**Decision:** the one small touch (3p.5) counts as one of the three decorations when it is something the visitor
sees, and it is written first on the `- treatments:` line.

**Why:** 3ai exists because a judge marked a site down for too many treatments side by side. A cloud for a pointer
or a sweep in the chosen shade is a treatment like any other, and since today a custom cursor is on the menu and
counts. Counting the same thing in one place and not in another would be a rule nobody can follow. It also makes
the build quicker: one touch and two more is less to design, and the result is calmer. A touch that is only words
or a true fact (cookie wording in their voice) still does not count, as 3bb already says. `check-compared.mjs`
counts the parts of the treatments line, so writing the touch there enforces it with no script change.

**FULL, section 3ai, item 2.** Old:
```
   - any small touch of 3bb that is there for looks.
   One that is not picked is answered `n/a: not picked (treatments)`. A site that wants a fourth asks Tzvi first.
```
New:
```
   - any small touch of 3bb that is there for looks.
   The one small touch of 3p.5 is the first of the three (decided 22 Nov 2026): when it is something the visitor sees
   (a pointer, a sweep, a mark), it is written first on the `- treatments:` line as `touch: <what>`, so a site has
   that touch and two more at most. A touch that is only words or a true fact does not count.
   One that is not picked is answered `n/a: not picked (treatments)`. A site that wants a fourth asks Tzvi first.
```
In the same item, old: `   which may be the showpiece (3ad.1, 3ah.5); the rhythm (3ad.3); the one small touch (3p.5); and every honesty,`
New: `   which may be the showpiece (3ad.1, 3ah.5); the rhythm (3ad.3); the one small touch (3p.5, counted above); and every honesty,`

**DIGEST, section 3ai.** Old: `rhythm, the one touch (3p.5), and every honesty, phone, speed and accessibility rule. check-compared TREATMENTS.`
New: `rhythm, the one touch (3p.5), which counts as the first of the three when it is something seen and is written first on the treatments line, and every honesty, phone, speed and accessibility rule. check-compared TREATMENTS.`

**LIST.** Replace the line that starts `R3p.5 |` with:
```
R3p.5 | One small touch only this business would have, from their product, tagline or craft; when it is something seen it is the first of the three decorations and is written first on the "- treatments:" line (3ai.2) | 3p.5, 3ai | script: concept (the `- touch:` line) plus LOOK that it works and is on the treatments line
```
Replace the line that starts `R3ai.1 |` with:
```
R3ai.1 | Three decorations at most beyond photos, grounds and type, the one small touch (3p.5) first among them, picked from the menu of 3ai.2 and the site's references and listed on CONCEPT.md's - treatments: line; a fourth only with (Tzvi OK, date) | 3ai | script: `node scripts/check-compared.mjs <build>` (TREATMENTS) + LOOK
```
**REG.** `R3p.5`: set `rule` to `One small touch only this business would have; when seen, it is the first of the three decorations`.
`R3ai.1`: set `rule` to `Three decorations at most beyond photos, grounds and type, the one touch first among them, on CONCEPT's - treatments: line`.

Rewording keeps each id's date, and 3ai is not asked of a site published before 20 Nov, so no live site is touched.

## 6. Two signature sections

**Decision:** keep two signature sections after the opening, and the showpiece is one of them.

**Why:** Tzvi's complaint of 17 Nov was that our sites "dont have any uniqueness to them other than the hero". One
special section is the showpiece every site already has; a second is what makes the body the business's own. Since
the reorder the showpiece counts as one of the two, so the cost is one more section, not two. Dropping to one
would bring back the sameness the rule was written for.

**Edits:** none. R3ad.1, `check-signature-body.mjs`, FULL 3ad.1 and DIGEST 3ad already say this.

## 7. The staged, side-lit opening

**Decision:** every site still opens on a staged moment (the owner's own product as a styled hero shot, the words
on its plain side, one wow as it arrives), but the deep dark ground with dramatic side light is one of the three
first screens Tzvi picks from, always offered, never forced.

**Why:** Tzvi said "we should always make it more like this", so the staging stays for all, and the look he liked
is in front of him on every build. But asked of every site, a dark ground under a side-lit product gives every
business the same first screen, which is the sameness the menu was made to end, and it fights rule 3t: a food shop
is bright, a beauty site is cream, the owner's own look wins. Three first screens that all had to be the same dark
stage would not be a choice at all. This way he compares the look he chose with two others on the real business,
for free, before any picture is paid for.

**LIST.** Replace the line that starts `R3ah.8 |` with:
```
R3ah.8 | The opening is a staged moment: the owner's own product as a styled hero shot, whole, lit from one side, the words on its plain side, and one wow as it arrives (under 2 s, once, still under reduced motion). The deep dark ground is one of the three first screens (3aj.2), always shown, used when Tzvi picks it; otherwise the ground follows the category and the brand (3t) | 3ah.8, 3ag.1, 3aj.2 | LOOK: 1366x800 and 390x844 + check-arrival
```
Replace the line that starts `R3aj.2 |` with:
```
R3aj.2 | Three first screens as plain HTML, one per reference, the same words, fonts and photos, the layout different, one of them the staged opening on a deep ground (3ah.8), shown side by side; Tzvi's pick quoted on CONCEPT.md's - first screens: line | 3aj.2, 3ah.8 | script: `node scripts/check-concept.mjs <build>` (First screens)
```

**FULL, section 3ah, item 8.** Old:
```
   motion. One API picture, about 1 credit. The old daylight-on-linen opening scored 4 of 5; this one is what Tzvi
   chose. LOOK at 1366x800 and 390x844, with check-arrival and check-says-offer.
```
New:
```
   motion. One API picture, its price from get_cost. The old daylight-on-linen opening scored 4 of 5; this one is
   what Tzvi chose. LOOK at 1366x800 and 390x844, with check-arrival and check-says-offer.
   **What is asked of every site, and what is a choice** (decided 22 Nov 2026). Asked of every site: the product as
   a styled hero shot, whole, lit from one side, the words on its plain side, and the one wow as it arrives. A
   choice: the deep dark ground. It is always one of the three first screens (3aj.2), so Tzvi can pick it on every
   build, and it is used when he does. Otherwise the ground follows the category and the brand (3t: a food shop is
   bright, the owner's own look wins). Asked of every site it gave every business the same first screen.
```

**FULL, section 3aj, item 2.** Old:
```
   - The three share the same colours, fonts, words and the owner's real photos, with grey boxes where a picture will
     be generated. Only the layout differs.
```
New:
```
   - The three share the same fonts, words and the owner's real photos, with grey boxes where a picture will
     be generated. The layout differs, and one of the three is always the staged opening on a deep ground (3ah.8);
     the other two keep the brand's own ground.
```

**DIGEST, section 3ah.** Old:
```
the offers in the line under it, one button, one photo (check-five OPENING). (8) The opening is a staged moment: the
owner's own product as a styled hero, side-lit on a deep ground, words on the dark side, and one wow as it arrives
(Tova: a light sweeps across her cake), under 2 s. (2) A product card is its photo, edge to edge, then name,
```
New:
```
the offers in the line under it, one button, one photo (check-five OPENING). (8) The opening is a staged moment: the
owner's own product as a styled hero, lit from one side, words on its plain side, and one wow as it arrives
(Tova: a light sweeps across her cake), under 2 s. The deep dark ground is one of the three first screens, always
shown, used when Tzvi picks it; otherwise the ground follows the category (3t). (2) A product card is its photo, edge to edge, then name,
```
**DIGEST, section 3aj, item 2.** Old:
```
2. In phase 4, three first screens are made as plain HTML, one per reference: same colours, fonts, words and photos,
   grey boxes for pictures to be generated, only the layout differs. They are part B of the design board (8), Tzvi picks one, and
```
New:
```
2. In phase 4, three first screens are made as plain HTML, one per reference: same fonts, words and photos,
   grey boxes for pictures to be generated, the layout differs, and one is always the staged opening on a deep ground
   (3ah.8). They are part B of the design board (8), Tzvi picks one, and
```
(The digest's "In phase 4" is already there; leave it.)

**SKILL, the steps, phase 4.** Old:
```
   reference. Same colours and fonts from BRAND.md, same words, the owner's photos as they are. Only the layout
   differs. A picture still to be made is a plain grey picture of its final shape. A photo of the wrong shape
```
New:
```
   reference. Same fonts from BRAND.md, same words, the owner's photos as they are. The layout differs, and one
   of the three is always the staged opening on a deep ground (§3ah): Tzvi chose that look, so he can pick it on
   every build, but a bright business is not forced into it. A picture still to be made is a plain grey picture
   of its final shape. A photo of the wrong shape
```
**REG, record `R3ah.8`.** Set `rule` to `The opening is a staged moment: owner's product as a styled hero lit from one side, words on its plain side, one wow as it arrives; the deep dark ground is one of the three first screens`.
`R3aj.2`: set `rule` to `Three first screens, one per reference, the layout different, one of them the staged deep-ground opening; Tzvi picks`.

No script reads any of these words.

## 8. The owner's signed note

**Decision:** every owner is asked, in the one first message, for a short note in their own words and a photo of
themselves; the note is on the site only when they give it.

**Why:** only the owner can write it, and one more line in a message that is being sent anyway costs nothing.
Asked later, it is a second round with the owner and a rebuilt section. The best food sites in our inspo have it
(Pizza Amici's letter), and it is the cheapest way to make a site unlike any other. It is still never written for
them, and a site without it is not held back.

**SKILL, the steps, phase 1.** Old:
```
   message, only about their business: missing facts, more photos, guarantee (§3j.1), FAQ with 5 to 8 example
```
New:
```
   message, only about their business: missing facts, more photos, a short note in their own words with a photo
   of themselves (§3af), guarantee (§3j.1), FAQ with 5 to 8 example
```

**FULL, section 3af, item 2.** Old:
```
   When the owner has not given the words or a photo, it is a content gap (section 4), asked for, never filled with
   invented words. Planned on a `- owner:` line (the words' source and the photos).
```
New:
```
   Every owner is asked for it in the first message, with a photo of themselves (decided 22 Nov 2026: only they can
   write it, and a line in a message already being sent costs nothing; asked later it is a second round). When the
   owner has not given the words or a photo, it is a content gap (section 4), never filled with invented words, and
   the site is not held back for it. Planned on a `- owner:` line (the words' source and the photos).
```

**DIGEST, section 3af.** Old: `Amici's letter; missing words are a content gap, never invented. (3) `- loose:` with 4+ work photos, one set laid loose`
New: `Amici's letter; every owner is asked for it in the first message; missing words are a content gap, never invented. (3) `- loose:` with 4+ work photos, one set laid loose`

**LIST.** Replace the line that starts `R3af.2 |` with:
```
R3af.2 | Every owner is asked in the first message for a short note in their own words and a photo of themselves. When they gave them: the note, signed with their name, beside their real photo and photos of the place or customers, planned on a "- owner:" line; never invented, and not a decoration; n/a, and listed as a content gap, when they have not | 3af.2, 1.1 | LOOK: `message-to-owner.md` asked for it; the note's words against what the owner gave
```
**REG, record `R3af.2`.** Set `rule` to `Every owner is asked for a short signed note and a photo in the first message; shown beside their real photos when given, never invented` and `built_by` to `message-to-owner.md asks for the note and a photo; CONCEPT.md ## Body '- owner:' line`.

Not asked of a site published before 18 Nov 2026, as before. No owner of a live site is written to because of this.

---

## How to verify

Run from `C:\Users\tzviw\Documents\mir-reorder`.

**Before any edit:**
```bash
node scripts/check-all-builds.mjs --save "$TEMP/decisions-before.json"     # 26 builds, 55 passes, 23 failures
node scripts/check-rules.mjs scrollcraft/builds/krysp > "$TEMP/krysp-before.txt" 2>&1
```

**After the edits:**
```bash
node scripts/blueprint.mjs --order            # "blueprint: all 331 checklist rules have a build stage" (327 + the 4 now readable)
node scripts/check-rule-copies.mjs --sync
node scripts/check-rule-homes.mjs             # "rule homes: every page and ad rule has its section"
grep -cE '^R[0-9][0-9a-z]*\.[0-9]+[a-z]+\s*\|' docs/rules-checklist.md     # 0: no id ends in a letter
node scripts/check-all-builds.mjs --compare "$TEMP/decisions-before.json"  # ends "no build got worse", exit 0
```
`check-all-builds` must show no published build going from pass to FAIL. The four renumbered rules are new by
date, so check-rules lists them for a published site under "not required, added after ... was made".

**The letter guard works** (do not save this):
```bash
cp docs/rules-checklist.md "$TEMP/list.bak" && echo "R9.9z | a test line | 9 | LOOK" >> docs/rules-checklist.md && node scripts/check-rule-homes.mjs | grep "R9.9z"; cp "$TEMP/list.bak" docs/rules-checklist.md
```
Passing: it prints `R9.9z: a checklist id must end in a number`, and the checklist is back as it was
(`git diff --stat docs/rules-checklist.md` shows only your real edits).

**Krysp and Aaron are spared, Burnt is not:**
```bash
node scripts/check-rules.mjs scrollcraft/builds/krysp | grep "not required"                 # the list now names R3aa.38, R3aj.1 to R3aj.8, R3ak, R3al and R0b.15, R3e.26 to R3e.28
node scripts/check-rules.mjs scrollcraft/builds/krysp | grep -c "FAIL R3a[jkl]\|FAIL R3aa.38"   # 0 (it was 4 before)
node scripts/check-concept.mjs scrollcraft/builds/krysp 2>&1 | grep -c "3aj"                   # 0 (it was 16 before)
node scripts/check-concept.mjs scrollcraft/builds/aaron-kaluszyner 2>&1 | grep -c "3aj"        # 0
node -e "import('./scripts/rule-dates.mjs').then(m=>console.log(new Date(m.siteMade('.', 'scrollcraft/builds/krysp')).toISOString(), m.siteMade('.', 'scrollcraft/builds/no-such-build')))"
```
Passing: the last line prints `2026-11-21T22:00:00.000Z null`. The `null` is any build with no entry and no
publish, which is how Burnt is still held to every rule. Both spared builds may still fail on older rules; that
is their state today and is not part of this change.

**A published site still skips the two renumbered checks.** Read the code path, do not publish: in
`scripts/publish-page.mjs` the two rows now carry `R3e.26` and `R3e.27`, and
`node -e "import('./scripts/rule-dates.mjs').then(m=>console.log(m.newerRules('.', 'scrollcraft/builds/bake-away').has('R3e.26')))"`
prints `true` once the checklist edit is committed (before the commit it also prints `true`: an uncommitted line
counts as added now).

**Read once by eye:** SKILL phases 1 and 4; FULL 3ag.5, 3ah.8, 3ai.2, 3aj.2, 3af.2; no long dash in any new text.

**Save (no push):**
```bash
node scripts/commit-rules.mjs "Rules decisions (Tzvi, 22 Nov 2026: \"I want to implement Fable's rules decisions\"): no label on every section, one headline size stays (3ag.5 with 5b.6); the flip-to-price button is not used on new sites (3ak.4); the four ids ending in a letter renumbered so the scripts read them (R0b.15, R3e.26 to R3e.28) and check-rule-homes refuses another; Krysp and Aaron Kaluszyner keep the rules of before 22 Nov (scrollcraft/rules-as-of.json, read by rule-dates); the one small touch is the first of the three decorations; two signature sections stay; the staging of 3ah.8 is for every site and its deep ground is one of the three first screens; every owner is asked for a signed note in the first message" scripts/rule-dates.mjs scripts/publish-page.mjs scripts/check-rule-homes.mjs scrollcraft/rules-as-of.json docs/rules-decisions-spec.md
node scripts/check-push-rules.mjs HEAD
```
End the commit message with the attribution line the session gives. If the commit check refuses, fix what it
names; never `--no-verify`. After the commit, any build in progress runs `node scripts/blueprint.mjs --update
<build>` once to pick up the four renumbered lines.

## How we can do better

1. Sparing a build was a one-off hand edit until now. Home: `scrollcraft/rules-as-of.json` and the line in "How a
   rule is added". Use it whenever Tzvi spares a build by name; never spare one without his words in `why`.
2. Two rules contradicted each other for three days (5b.6 and 3ag.5) and only a video note caught it. Home: "How a
   rule is added", step 1 ("find every line it touches") could say: search the checklist for the opposite of the
   new rule's key word before writing it. Add it?
3. The product itself: the first two sites built with three first screens will show whether the deep-ground
   opening wins every time. If Tzvi picks it on both, look at whether the other two options were strong enough,
   set beside Ruben Stom's split opening and panel wipe frames in `docs/inspo/videos-ruben-stom-2026-11-22`.
