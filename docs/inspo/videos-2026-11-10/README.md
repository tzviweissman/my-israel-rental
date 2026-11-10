# Ben AI, "Copy These 5 Claude Mods, Never Hit a Token Limit Again" (10 Nov 2026)

https://youtu.be/4d6OK7IGdBU, 13:52, posted 10 Nov 2026. Method: the auto captions (yt-dlp, en-orig), the
description and all 21 comments. No frames were taken, because every number is said aloud and what's on screen is
side panels.

**The one idea:** send the bulky, simple work to a cheaper model or plain code, so that the expensive main model
never holds it in the chat.

## The six mods, with his measured figures

| Mod | What it does | His test |
|---|---|---|
| Input Router | A file or connector result over ~2,000 tokens goes to Haiku with the task. Haiku sends back short notes and the file's path. Plain code strips connector junk first. | Five transcripts: 74k to 5.9k tokens, $3.81 to $0.94 (75%). Circle connector: 65k to 981 tokens. |
| Effort Optimizer | Sonnet reads each prompt and suggests a better effort level. You approve the switch. The model picker doesn't show the change. | No figure of his own. He quotes Anthropic's example of a redesign that took 1 min on low and 28 min on max. |
| Subagent Model Selector | Judges each subagent's job: easy goes to Haiku, normal to Sonnet, risky stays on Opus. | Research task: $6.58 to $3.82 (42%). |
| Cache Clock | A countdown until the chat's cache goes cold (1 h on a subscription, 5 min on an API key), plus a "keep warm" ping. | No figure of his own. He says a cold restart costs "up to 40x" more. |
| Handoff | At 250k tokens it offers a fresh chat with a detailed handoff prompt. Also runs on /handoff. | No figure. |
| Efficient Browser Use | Plain code halves every browser screenshot before Claude reads it. | 48 screenshots: 58k to 14k tokens, $0.68 to $0.17. |

Extras: a Switchboard panel turns mods on and off, and /savings shows the tokens each mod saved. He reports about 1.2M
tokens saved in one day.

## What to discount

- The title promises 5 mods, the video calls it 6, and the chapters list 6. The intro claims "up to 90%", but his
  own tests show 42 to 75%.
- Each figure is one demo run on his own task. A top comment asks whether the savings hold up on "long, messy real
  projects vs. clean demos", and he doesn't answer it.
- He says himself that Haiku "can miss some small things on very detailed work".
- The pack sits behind a lead-magnet link (c.benai.co). The video is also a funnel for his paid "AI Accelerator".

## What it means here

- **Already installed:** Cache Clock and Handoff, from his earlier bundle (see the benai-mods memory; the Windows fixes
  live in `~/.claude/mod-sources/benai-mods`). Subagents already run on Sonnet by Tzvi's 16 Sep rule, which covers
  most of the Subagent Model Selector.
- **Worth adding: Efficient Browser Use.** Site builds take many screenshots. It's plain code with no AI and nothing
  to lose, and the built-in browser's `computer screenshot` already takes a `scale` (0.5 does the same by hand).
- **Be careful with the Input Router.** Our rules files (`page-generation-rules.md`, `rules-checklist.md`, the ad
  checklist) are long, and they're exactly where "rules right first time" needs every line read. A Haiku summary
  would bring back the skipped-rule problem. If it's adopted, exclude `docs/*rules*`, `RULES.md`, `BLUEPRINT.md` and
  `brand/`, or use it only for transcripts and connector results (Gmail, Higgsfield histories).
- **Effort Optimizer:** low value here. It needs approval on every prompt, and the picker doesn't show the switch.

---

# Chase AI, "Anthropic's Ten NEW Rules for Prompting Fable 5.2" (10 Nov 2026)

https://youtu.be/c_McosB62a4, 10:41, posted the day Fable 5.2 came out. Method: auto captions (yt-dlp), the
description, 40 comments, and 13 frames (`fable-prompts.jpg`, `fable-system-card.jpg`). The frames show Anthropic's
prompting guide and system card on screen, so the quoted wording below is checked against the frames.

**The one idea:** Fable 5.2 follows written instructions very closely, so old, strict or cautious rules now cost more
than they used to. Ask it plainly to prove its work and to finish the job.

## The ten rules

1. **Use high effort.** Claude Code defaults to medium. His benchmark ("Frontier Code 2.0"): high scores 45.3% at
   $6.72, Opus 5.5 max about the same at $12.82, and medium scores 37.6%. Avoid max, which is often no better than
   xhigh. One comment says Fable on high used far more of a Max plan's 5-hour limit than Opus 5.5.
2. **Ask for proof.** The system card (frame) says it made up a stand-in for a missing file in 2.0% of runs and took
   shortcuts more often. The wording shown on screen: *"Before you say it's done, run the tests and show me the
   output. If something is missing or broken, tell me instead of working around it."*
3. **Tell it to finish.** The prompting guide (frame) says it "sometimes ends a turn before the work is done", more
   often at low and medium effort: 6-13% of sessions, against 4% for Fable 5.1. The guide's text starts with
   *"Please avoid stopping while you still owe work the user asked for. Be persistent and do not stop unless
   needed."* With it, early stops drop to about half.
4. **Clean up old instructions.** Strict style rules and over-prescriptive CLAUDE.md lines hold it back. The guide's
   "Keep caution from piling up" section (frame): cautious instructions build up in memory, notes and instruction
   files, and 5.2 "might ask for approvals it doesn't need or hold back routine work".
5. **A prompt can't stop it from thinking.** Only the effort level changes how much it thinks.
6. **Don't ask for its step-by-step reasoning.** A distillation classifier may refuse. Asking for a short "why" is fine.
7. **Say who owns the code.** Told it owns the codebase, it writes less repeated code but adds features and tests,
   which means more tokens. For small changes, don't say it, and be specific.
8. **Don't tell it when to use subagents.** It spawns its own, and "always use subagents" rules get followed to
   the letter and burn usage.
9. **Ask for updates on long runs** if you want them. The guide's wording (frame): *"Before you start, say in a line
   what you're about to do; brief updates while you work help the user follow along. Close with a short recap..."*
   Updates after every tool call can add about 20% more tokens.
10. **Effort doesn't change tone or length.** Set those in the prompt or in CLAUDE.md.

## What to discount

- He's selling a course; the description and a pinned comment point to it.
- The benchmark is one chart, with no source named on screen.
- Comments are mixed. Some say it "fakes things" more, and one reverted a day of its CLI work. The "5x the cost on a
  subscription" comment is unverified.

## What it means here

- **We run Opus 5.5 now**, so none of this applies until we switch to Fable 5.2.
- **Rules 2 and 3 already match ours** ("read the error, not the result", verification before done). The proof
  wording is worth copying into any brief we hand a subagent.
- **Rule 4 conflicts with how this project works.** Tzvi's rules are long on purpose ("the rules get skipped a
  lot"), and the commit hooks and gates enforce them in code, not by caution in prose. If we move to Fable 5.2, the
  thing to cut is cautious *approval* wording that the hooks already cover, not the build rules.
- **Rule 9 conflicts with Tzvi's "no running commentary" rule** (18 Sep). Keep the one plain summary at the end.
- **Rule 8:** our "subagents use Sonnet" rule names a model, not when to delegate, so it doesn't trigger the
  over-delegation he warns about.

---

# Three site-build videos (Tzvi, 10 Nov 2026: "see what we can use to make our site builds better and look and feel more like a real website ... how they structure their sites")

- AI LABS, "How To Use Codex To Build Insanely Beautiful Websites" (https://youtu.be/pHstb0JGGhE, 25 min, Jul 2026)
- MotionSites AI, "Claude Fable 5 + MotionSites AI = $15K Cinematic Websites" (https://youtu.be/65pnv0H_ikM, 13 min, Jul 2026)
- Nate Herk, "I Studied 10,000 AI Websites" (https://youtu.be/mImbbszCjCI, 11 min, 9 Nov 2026)

Method: the auto captions and comments for all three. About 90 frames were taken from the video streams and read by
three Sonnet helpers, and one sheet was checked by hand. Kept sheets: `sites/`. Motion was not verified frame by
frame, so any scroll-effect claims come from narration only.

## How their finished sites are laid out (seen in frames)

All three show one-page sites. None shows a real multi-page site, and the MotionSites pages beyond home were named
but never shown. So for page count and footer, our 3k and 3v rules are already ahead of these videos.

**Menu bar:** logo on the left, 3 or 4 page links, and one pill button on the right ("Request access", "Join now",
"Join free"). All three do this, and it matches our 3v.2.

**First screen, top to bottom:**
1. A small badge line ("Global community, 450,000 members").
2. A big headline of two lines.
3. One short subline.
4. One main button (sometimes a quiet second one).
5. The product itself, right under it or overlapping the fold: a dashboard picture, a laptop showing the app, or a
   booking card with open slots.

**Section order, one page:**
- AI LABS (seen in frames): hero with the product, a strip of logos, a bento of 4 tiles (a small label, one sentence,
  a small graphic), a pinned product story, then a testimonial, a closing form and the footer.
- MotionSites (named in the narration, about 5 of 9 seen): hero, about with three pillars, a manifesto paragraph in
  very large type with 3 stats under it, 4 programme cards with photos, how it works in 4 steps, 3 testimonials,
  pricing in 3 tiers with the middle one raised, FAQ (a light section in a dark site), then a closing call merged
  into the footer, which sits over a full-bleed video.

## What's new to us (not yet in our rules)

1. **One card hangs over the edge of the next section** (Herk, depth step 2). A booking card ("Next open slots, Tue
   Nov 17, 5:00 PM") sits half in the hero and half below it, so the page stops reading as a stack of boxes. Seen in
   frames. We have no such rule.
2. **Three layers on the first screen** (Herk): at the back a real photo or shape, in the middle the words and
   cards, in front the one button with the only soft shadow. Ours has the parts (3s.3, one shadow) but not the
   layering as a step.
3. **The first screen's words never fade or fly in** (Herk, motion rule 2): headline, text and button are readable
   the moment the page opens; fly-ins only further down. **This conflicts with our openings** (an event on the first
   screen, film chapter lines), so it would need Tzvi's call: for example, the offer words of 3g.18 are present
   from the first frame while the film moves behind them.
4. **A free sample before the contact form** (Herk): a short quiz ("which service is right for you"), a price
   estimator, or a small useful tool. For us that would be "How many people? Then this platter, ₪X" for food, "Your
   dates, then the price" for a rental, or "Which treatment?" for a salon. The numbers come from vendors (Outgrow's
   own 45% claim), so the evidence is weak, but the idea fits our honest-psychology rules (3j).
5. **No dark overlay on photos and videos by default** (MotionSites). AI builders darken every image, and the fix
   is to show it at full brightness and put the words in a contained card. Ours is close (3s.8, buttons in a soft
   container; phone-photo-stays-seen, 40%) but has no "no default darkening" line.
6. **One light section in a dark site, with a hard edge rather than a fade** (MotionSites, the FAQ). Our category
   table gives `service` one dark section in a light site; this is the reverse, for dark sites.
7. **Headline in the visitor's own search words** (Herk, Campaign Monitor's +31.4%, a vendor figure). Our 3g.13
   says "plainly what you get" but not "in the words people type into Google".
8. **Pictures as one set made from a real site's grid** (MotionSites): screenshot a real site's 3x2 image grid and
   ask for "an image like this, remove the text, 6 images, 3 per row, about <business>", one line per tile. This
   gives a consistent look across cards. It's only for sites without owner photos, under [[code-first-generate-when-better]].

## Already ours (confirms what we do)

- The first screen answers who, what and the next step (Herk's "mirror test") = our 3a.1 four questions.
- One accent colour, on the button only (Herk's "highlighter", 60-30-10) = our 3c.3, which is stricter.
- Motion with one job, one thing moving per screen, reduced motion = 3h.20 and 3u.
- State the page's one job first (AI LABS: "the function of the landing page is to get users to join the
  waitlist") = blueprint stage 1.
- A brand file that changes colour and type without touching the layout (AI LABS DESIGN.md) = BRAND.md (3x).
- Pricing middle tier "Most popular" only when the owner says so = 3j.

## What to discount

- AI LABS: a Codex/GPT tutorial with a sponsor read and a paid skill. One SaaS waitlist page, glimpsed fast.
- MotionSites: the vendor's own promo. The site is a reskinned paid template, "$15K" is a title claim, and the
  extra pages were never shown.
- Herk: "10,000 websites" isn't measured (top comment: "Your AI studied 10,000 websites"). The stats come from
  vendors and agencies, and the video funnels to his free skill and Skool. The five patterns are standard
  conversion advice.
