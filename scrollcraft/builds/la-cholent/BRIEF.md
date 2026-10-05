# L.A. Cholent by Rabbi Samuels, a scroll-driven page

**Self-authored from Tzvi's own answers, not re-interviewed.** In the owner
walkthrough (24 Sep 2026) Tzvi answered for this business and ruled that
design questions should not be put to him ("doesn't our design skills deal
with this"). On 5 Oct 2026: "its ok if you make a cinematic not using their
own photos ... use their photos when you feel its best and add in others
that will enhance the page. make the page look like an award winning website
home page which describes their business and uses buyer psychology to help
push more sales." Local only, nothing deployed.

## What the business actually has (every fact on the page comes from here)

- Our record (public GET of `/api/marketplace/business/l-a-cholent-by-rabbi-samuels`):
  name, Jerusalem, delivers all of Israel, kosher supervision Rabbi Weiner,
  description, one listing "Catering" with three sizes: Medium, feeds 4-6,
  ₪100; Large, feeds 8-12, ₪180; Extra Large / Kiddush, "sizes are
  customizable depending on amount of guests", ₪250.
- Their own flyers (on our platform): "Our secret recipe, your new Shabbos
  favorite"; "Catering any size, any occasion"; "Yom Tov and Shabbos meals /
  Kiddushim and Thursday nights / Bar mitzvahs and shalom zachors"; steps
  "Select your cholent size. Place raw LA Cholent kit in your crock pot and
  add water. Cook on low for about 20 hours."; menu: recipes Original and
  Spicy (Heimish "coming soon", left out); add your own meat or parve for
  ₪55 (half) / ₪85 (full); add-ons: slow cooker liner free, extra meat ₪50/lb,
  marrow bones ₪40/lb; "Free local delivery on your first order"; Vaad
  HaKashrus, Rabbi Shmuel Weiner, Kehal Zichron Nosson Tzvi, home business.
- Their logo seal: "Convenient and consistent", "A higher standard of flavor",
  and a steam heart rising from a crock pot.
- Their product photo: four sealed tubs, label "L.A. CHOLENT By Rabbi
  Samuels", "Yields approx. 3-4 pounds", "Slow cook on low for about 20 hours".

Two conflicts, settled for the record over the flyer: Large feeds 8-12 (flyer
says 8-10); size names Medium/Large (flyer says Half/Full). The ₪55/₪85
own-meat prices are flyer-only and are shown as theirs.

Chat-only (Tzvi, 5 Oct 2026): no phone or email on the page, though the
flyers carry both. The one action opens their page on MyIsraelRental, where
the chat is.

Generated imagery, as allowed: the setting and props only. The kitchen of
someone cooking from scratch (the alternative, not their product), and a
closed slow cooker in candlelight. No generated food is shown as theirs; the
only cholent on the page is their own photograph.

## The eight answers, from what Tzvi said

1. **Vibe:** Friday-afternoon calm. Candlelight, steel, marble, gold. The
   references are their own flyer (gold script, thin caps, the steel pot on
   marble) and a lit Shabbos table.
2. **Journey:** first the thing they would otherwise have to do, then how
   little this takes, then who it is for, then pick a size and order. Tzvi:
   "the first thing people should see is something which will statistically
   make it the highest likelihood they will buy".
3. **Energy:** busy and cluttered at the top, quiet in the middle, warm at the
   end.
4. **Feeling, and the one moment:** recognition of the Thursday-night chore,
   relief when it is taken away. The moment: the mess is pushed off the screen
   and the pot clicks to Low.
5. **What no site does:** the crock-pot dial runs the page.
6. **Range:** premium, warm, a little maximal where the brand is (gold script).
7. **One world or scenes:** two worlds side by side, then one.
8. **Assets:** their logo, three flyers, one real product photograph.

## Grammar: split stage

The pitch is a comparison: cholent from scratch against their kit. Split
stage is the grammar whose ending is one side winning, which is the sale.
The other seven lost: filmic one-shot has no second side to beat; chaptered
editorial and typographic poster are for a brand whose asset is long copy or
one sentence; live surface needs a product that runs; continuous world needs
a place to travel; gallery treats the three sizes as the point, when the
point is the effort saved; rhythmic cutlist is the wrong pulse for Shabbos.

## The feeling curve

```
1  Recognition  two worlds at 50/50: the harsh-lit scratch counter beside
                their tubs in candlelight. The knob in the divider sits at Off
2  Fatigue      the from-scratch list keeps arriving, line by line, and the
                scratch side widens as it piles up; their side holds three steps
3  Silence      the scratch side wipes away to nothing. One line of theirs,
                alone: "Just throw our raw ingredients into your crock pot,
                add water, and enjoy!"  (authored silence, intended)
4  Relief       THE PEAK. Their side takes the whole screen: the closed pot in
                candlelight, the knob clicks to Low, the steam rises and draws
                the heart from their seal while 20 hours pass
5  Belonging    the occasions in their words, at large size; the supervision
6  Resolve      the knob becomes the size picker. Turn it: the size, who it
                feeds, the price. One button
```

**The peak:** "the kitchen mess got shoved off the screen, the knob clicked to
Low, and twenty hours of cooking went by while I scrolled." Act 4, the
largest span on the page.

**Tell-someone:** it's the site where you turn a crock-pot knob to pick how
much cholent you want, after watching it take your Thursday night off your
hands.

## Signature move

The knob. One crock-pot dial, drawn in SVG, lives on the split's divider from
the first screen and rotates with the argument from Off toward Low. At the
peak it clicks to Low and the cooking starts. At the close it becomes the
control: drag it, use the arrow keys, or press a size, and the size, who it
feeds and the price change together. One object carries the story and the
order.

## Buyer psychology, in the build

- Contrast effect: the cost of the alternative is shown before the price.
- Effort reduction as the headline benefit (their own "Convenient and
  consistent").
- Anchoring and choice: three sizes on one dial, the price visible as it turns.
- Risk reversal beside the button: free local delivery on the first order,
  kosher supervision named, delivered all over Israel.
- Authority and familiarity in their words only: "a fan favorite for over a
  decade" is quoted as theirs. No invented ratings, counts or reviews.
- One action, one label: "Message to order", everywhere.

## Fingerprint gate

Against every row on six dimensions: lechem-emek 6/6, blazin-boards 6/6,
michal-simkin 6/6 (different grammar, chrome, hero, shape, close and move).

## Feel check (cold scroll, one word per act, then diffed)

```
intended   recognition  fatigue  silence  relief (peak)  belonging  resolve
felt       recognition  clutter  pause    relief         warmth     choosing
```

Changed on the way: the "Just throw..." line sat over the pot as it
arrived, so the silence now ends before the pot fades in; on phones their
copy was squeezed into the light half, so their side starts with more of
the screen; the knob drifted off the dial while the stage slid away, so it
is measured against the moving frame every frame.

## Verified, and not

Harness (`shoot.mjs`) at 1440x900, 390x844 and reduced motion: no dead
scroll, every cue peaks, no contrast failures. The flow section and the
knob landing were checked by screenshot. Not verified: a real phone (iOS
video decoding and autoplay policy), and keyboard focus order beyond the
dial (arrow keys and the three size buttons work in code; not tabbed on a
device).
