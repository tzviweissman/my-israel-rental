# Making owners want to send their page

Written 31 Aug 2026. Two features, one goal: a business owner who currently
advertises by posting photos into a WhatsApp group sends their MyIsraelRental
link instead, because it is better for them.

Related: `docs/qr-and-short-links-spec.md` (the `/p/{slug}` machinery this reuses),
`docs/business-page-spec.md` (B2 share image, shipped), `docs/dashboard-ux-spec.md`
(D6, the share panel), `docs/leads-and-views-spec.md`.

---

## The framing that decides every detail below

**We are not competing with WhatsApp. We are competing with a WhatsApp message.**

The owner's current behaviour works: photos, a price, a phone number, posted into
a group. It costs them nothing and they understand it. They will only change if
the link does something the message cannot, **for them**. Not for us.

Two consequences:

1. **Never ask an owner to advertise us.** The link has to advertise *them*. Any
   design decision that makes the page feel like ours rather than theirs makes
   them less likely to send it, and costs us the distribution we were after.
2. **Do not ask them to stop posting an image.** That is the behaviour, and
   fighting it loses. Give them a better image, with the link attached.

---

## S1 — The share card

One tap in the dashboard produces a designed image of their business, prefilled
text, and their short link. They post the image into the group exactly as they do
today. The link rides along.

### What is on the card

- Their cover or best product photo, full bleed
- Their business name, set in the brand serif
- Their trade and area, one line
- **`from ₪79`** if a real price exists. Omitted entirely if not. Never a guess
- Their logo if they have one
- The short link as text, and a small QR of the same link
- **Our mark, small, at the foot.** Present, not shouting

Two sizes: **1080x1080** for a group post, **1080x1920** for a status. Nothing
else. A size picker is a decision they did not ask for.

### Generation

Client-side canvas, same approach as the QR. No server render, no queue, no cost
per card.

- Fonts and colours from `brand/design-tokens.css`. The card must look like the
  site, because that is the point.
- **Bilingual**: the card renders in the language the dashboard is in, and the
  owner can switch before saving. Hebrew uses the RTL font variables.
- If the business has no photo, use the deterministic `CoverPlaceholder` tint
  from their name, and prompt: *"Add a photo. This is what people will see."*
  **Never ship a card with an empty grey rectangle.**

### Sharing it

- `navigator.share({ files: [png], text, url })` where supported. On a phone this
  opens the native sheet with WhatsApp in it, which is one tap from their
  dashboard to the group.
- **Fallback: download the PNG and copy the text to the clipboard**, with one
  line telling them what to do next. Never a dead end on desktop.
- The prefilled text is short, in their language, and **editable before sending**.
  Owners know their own groups better than we do.

### The text

Default, and it should read like a person wrote it, not a platform:

> **Blazin' Boards, Jerusalem. Meat boards from ₪149.**
> Everything, prices and how to reach me: myisraelrental.com/p/k3f9x2

No exclamation marks. No "Check out my page!". No emoji unless the owner adds
them.

## S2 — Tell them who looked

A WhatsApp post tells an owner nothing. This is the asymmetry to exploit, and
most of the machinery already exists.

### What already works

`/p/{slug}` short links count follows, stamp `last_scanned_at`, and **already
exclude preview bots** by user agent (WhatsApp, facebookexternalhit, Telegram)
so a pasted link does not inflate the number. See
`docs/qr-and-short-links-spec.md`.

### What to add

**1. Distinguish shares from scans, without minting a second slug.**
A printed QR is permanent by policy, so the slug cannot change. Instead the share
action appends a source marker: `/p/{slug}?s=w`. `/follow` reads it and records
`source: share | qr | direct`. **One slug, three provenances.**

**2. Attribute the message, not just the open.**
Store the arrival source in the session on landing, and stamp it on any chat
thread or lead created in that session. This is the harder half and it is the
half that produces the sentence that changes behaviour:

> **"34 people opened your link this week. 6 messaged you."**

**3. Show it where the sharing happens**, in the share panel, next to the button.
Not buried in an analytics tab.

**4. One weekly email, and only when there is something to say.**
*"Your link was opened 34 times last week."* If the number is zero, **the email
does not send.** A weekly report of nothing trains people to ignore the sender.

### The honesty rules, which are not negotiable here

- **Real counts or no line.** If a number cannot be computed, the line does not
  render. No estimates, no rounding up, no "about".
- **Never inflate by counting bots, our own admin traffic, or the owner's own
  visits.** Exclude the owner's user id.
- **"Opened" and "messaged" are different numbers and must be labelled
  differently.** Do not merge them into "engagements".
- Zero is a real answer: *"Not opened yet."* Never omit the row to hide a zero,
  because an owner who notices the row appearing and disappearing stops trusting
  all of it.

## S3 — The three lines of copy that do the persuading

Wherever the share panel appears, one line, rotated or chosen by context. These
are the arguments, and each is true:

- **"Answer it once."** *"How much? Do you deliver? Are you open Friday? Your page
  answers all of it, so you do not have to type it again."*
- **"A post disappears by Thursday."** *"A link still works in six months, and it
  is still right, because you can change it."*
- **"You will know if it worked."** *"A group post tells you nothing. This tells
  you how many people opened it."*

**Do not write "share your page and help us grow."** It is the truth about our
motives and it is exactly the wrong thing to say to someone deciding whether to
do us a favour.

---

## What not to build

- **No reward, no credit, no badge for sharing.** Free means free with no strings,
  and an incentive turns a genuine recommendation into a transaction the recipient
  can smell.
- **No obligation.** Never gate a feature behind having shared.
- **No loud branding on their page.** Their brand dominant, ours quiet. The
  acquisition ask belongs in the footer band (`business-page-spec.md` B7), which
  is seen by exactly the right audience without hijacking their storefront.
- **No auto-posting on their behalf**, ever, in any channel.

## Order

1. **S2.1** share-source marker on `/p/{slug}` — small, and everything else reads
   from it
2. **S1** the share card, 1080x1080 first
3. **S2.3** the counts in the share panel
4. **S3** the copy
5. **S2.2** message attribution — the harder half, and worth doing properly
6. **S2.4** the weekly email, only once the numbers are trustworthy

## Constraints

- Card generation is client-side. No server cost per card.
- Every string in `en.js` and `he.js`. The card itself renders in both, RTL
  included.
- `brand/design-tokens.css` is law. Green stays functional-only.
- Real counts or the line does not render.
- Verify the card at both sizes, in both languages, for a business with a photo
  and one without.
