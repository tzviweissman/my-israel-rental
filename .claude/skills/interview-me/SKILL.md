---
name: interview-me
description: Interview the user one question at a time to pull a complete brief out of their head before doing the work. Use when the request is vague, when there is no mockup or example to work from, when you are about to guess at what they want, or whenever they say "interview me". Works for code, copy, business and design decisions alike.
---

# interview-me

The premise, in Austin Marchese's words: **"you do know the details, you just don't know the right questions to ask."** The user is not missing information — they are missing the prompt to say it out loud. Your job is to ask, not to invent.

Confirmed independently by five creators in Tzvi's video backlog, which is well past the point of needing more evidence. Just use it.

## When to run this

Run it when you are about to guess. Concretely:

- The request has no mockup, no example, no reference to copy from.
- You catch yourself about to write "I'll assume..." about something that would change the work.
- It's a naming, positioning, pricing or audience decision — these are pure preference, and guessing wastes a whole round.
- The user says "interview me", "ask me questions", or "what do you need to know".

**Do not run it** for a bounded, obvious task. If the answer is already in the repo, CLAUDE.md, the vault, or the conversation, read it instead of asking. Asking a question you could have answered yourself is the main way this skill goes wrong.

**Boundary with `superpowers:brainstorming`:** that one is the heavyweight gate for building software — three paths, spec documents, approval before implementation. This one is lighter and is not limited to code. If the task is a real feature build, brainstorming owns it; use this when the thing being decided is a brief, a name, a piece of copy, a direction.

## The rules

**One question at a time.** This is the whole skill. A numbered list of eight questions gets one skimmed reply that answers three of them. One question gets a real answer, and the answer changes what you ask next — which is the entire point of interviewing rather than surveying.

**Ask only what they know.** Good: "when a shop owner finds a courier on the site, who pays — the shop or the customer?" Bad: "what should the data model for the connection be?" The first they can answer instantly; the second asks them to do your job.

**Plain language, no jargon.** Tzvi is not technical. Never ask a question that requires knowing what an endpoint, a schema or a component is. Ask about what happens, who sees it, and what should be true at the end.

**Offer options when the field is open.** A blank "what tone do you want?" is harder to answer than "more like Airbnb's friendly, or more like a trade directory's plain?" Use AskUserQuestion when two or three concrete choices would genuinely change the work — it is faster for them than typing prose.

**Follow the surprise.** When an answer doesn't fit what you assumed, drop your next planned question and chase that instead. The unexpected answer is where the real brief is.

**Say when an answer is vague or contradicts an earlier one.** Not every gap is something they left out; sometimes they said two opposite things and nobody noticed. Name it at the time, in their terms: "earlier you said under 200 words, but this needs the whole list, which is about 400 — which gives?" Left alone it surfaces as rework. Sixth independent source, from the FORGE video, and the only part of its reverse interview this skill was missing.

**Stop when you can write the brief.** Usually four to eight questions. Not twenty — an interview that outlasts the work is its own failure. When you could now do the job without guessing, stop asking.

## Questions that consistently earn their place

- **"What must someone believe by the end? One sentence, not a feature list."** The best question in the whole backlog, from the Scrollcraft skill. It forces the point of the thing.
- **"Who is this for — and who is it explicitly not for?"** The exclusion is where the real answer hides.
- **"Show me one that already does this well, and one that gets it wrong."** A reference beats any amount of description.
- **"What would make you reject this on sight?"** Cheaper to learn now than after you build it.
- **"What happens after they click?"** Flushes out the half of the flow people forget to describe.
- **"Is this replacing something, or sitting alongside it?"** Catches the scope question nobody states.

## Finish by playing it back

When you stop asking, write the brief back in **6–12 lines**: what you're making, for whom, what it must do, what it must not do, what "done" looks like. Mark anything you inferred rather than heard as an assumption, explicitly.

Then get a yes before starting. The playback is not a formality — it is where they see their own scattered answers as one thing and say "no, not that." Cheapest correction available.

**Leave the door open.** End with "anything I did not ask about that I should have?" The question costs one line and regularly turns up the thing that would have derailed the work.
