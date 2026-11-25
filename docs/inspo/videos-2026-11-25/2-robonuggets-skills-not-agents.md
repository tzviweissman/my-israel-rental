# Jay E (RoboNuggets), "Anthropic's Engineers Stopped Building AI Agents (Here's What They Build Instead)"

youtu.be/IMSYKloMFrE, 16:33, 488K views, posted 24 Nov 2026.

How it was read: the YouTube transcript panel in Chrome (the page took three loads; the first tab froze in an ad),
plus the top comments. No frames: a talking head with animated slides, nothing about site design on screen.

## The one idea

Fewer agents, better skills, and test whether a skill now holds the model back. Boris Cherny's word for it is
"hobbling": "when the model could do something, and you're just probably getting in its way." He suggests running a
task once with the skill and once without and comparing. The Claude Code team cut its own system prompt by 80% for
this reason.

## The six levels, briefly

0. Writing a skill by hand (he skips it).
1. Asking skill-creator to write one.
2. **"Skillify":** do the job once with Claude, correct it like an intern, then "turn this session into a skill". Every
   later run adds edge cases. His `/animate` skill grows from each correction.
3. Record a skill from a screen recording with talk-over (desktop app, "record a skill").
4. Skills that are not steps: a **database skill** (links to each customer's history), an **artifact skill** (brand
   colours and layouts), **definition skills** (one word pinned down, for example his `/wildcard`, "what I mean when I
   ask for wild card ideas"), and one-liners like "Grill Me" (interview me one question at a time).
5. Borrowed skills (Anthropic's marketplace, skills.sh), checked for safety first.
6. Sometimes no skill at all (hobbling, above). He uses `/wildcard` so the model can "surprise me a bit with
   different styles" beyond the agreed ones, and says that "more often than not" gives styles he had not thought of.

## What to ignore

- The Skool community, the PDF funnel, his Rubric and Rendo products and five affiliate links.
- "Better than 99% of people" and the 600,000-file second brain.
- Comments push back: one says agents still matter because long sessions drift; another says the trend is fewer
  skills, and that trimming theirs gave better results with fewer tokens. A third says hooks with hard gates keep
  agents in line better than skills, which is what our commit check does.

## What it means here

- Skillify is what we already do: the "How we can do better" step and the build skill growing from Tzvi's
  corrections.
- **Hobbling is a real risk for us.** The rulebook is 3,929 lines and the digest 1,537. Nobody has ever checked
  whether a build with the rules makes a better first screen than the same model with only the business record and
  the inspo. Worth one test, never a deletion.
- A **wildcard** slot fits the three first screens of 3aj.2: today all three follow a reference. One could be the
  model's own idea, so Tzvi sees something no reference suggested.
