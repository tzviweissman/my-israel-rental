---
name: video-notes
description: Pull the transcript of a YouTube (or other web) video and turn it into usable notes - what is worth acting on, what to discount, and what it means for the current project. Use whenever asked to watch, summarise, or extract from a video, or when a video URL is shared.
---

# video-notes

**You can watch video, within limits.** You can drive the player, seek to
any timestamp, and capture and inspect real frames. What you cannot do is
watch continuously or hear audio. So the job is: **get the words, sample
the pictures where they carry the meaning, then judge both.** Never
summarise from a title, a thumbnail, or a description.

## Before anything else: check tab visibility

This is the cheapest diagnosis and it masquerades as every other failure.

```js
const v = document.querySelector('video');
JSON.stringify({vis: document.visibilityState, ready: v && v.readyState, dur: v && v.duration});
```

- `"hidden"` → `readyState: 0`, `duration: null`, `videoWidth: 0`. Nothing
  decodes, seeks are accepted but do nothing, and the transcript may not
  load either. **It looks exactly like a broken pipeline.**
- `"visible"` → decodes normally.

A tab is hidden whenever its window is behind something else — including
when the in-app Browser pane is displayed in front of Chrome. Verified
29 Aug 2026: that exact situation cost several wasted attempts before
being diagnosed. Check this first, always.

## Getting the transcript

### 1. Find the video

If the user says it is open, check rather than asking:

- `mcp__claude-in-chrome__tabs_context_mcp` — their real Chrome
- `mcp__Claude_Browser__tabs_context` — the in-app Browser pane

### 2. Clear the ad FIRST, and do not pause it

**Pausing the video pauses the ad, so the ad never ends.** This wedges
the whole flow and is easy to cause, because pausing is the natural first
move. Verified repeatedly.

The reliable opener: `muted = true`, **`play()`**, wait ~7s, click
`.ytp-skip-ad-button, .ytp-ad-skip-button-modern`, wait, click again.
Confirm with `!document.querySelector('.ad-showing')` and a real
`duration` before doing anything else. A `duration` of 32s or 58s is the
ad, not the video.

Mid-roll ads reset `currentTime` to 0 and silently swallow seeks. If a
seek lands at 0, check for an ad before assuming the seek failed.

### 3. Open the transcript panel — click ONE button, once

```js
const btn = [...document.querySelectorAll('button, tp-yt-paper-button')]
  .find(e => /^show transcript/i.test(((e.innerText||'') + ' ' + (e.getAttribute('aria-label')||'')).trim()));
if (btn) btn.click();
```

Anchor on `^show transcript`. A loose `/transcript/i` match also selects
**"Close transcript"**, and clicking the whole set toggles the panel shut
— indistinguishable from it never opening. Click once, then poll for up
to ~20s.

If the panel opens but stays empty, **`navigate` to the same URL and
retry**. That fixes it most of the time.

### 4. Read it

`ytd-transcript-segment-renderer` is **one of two** transcript formats
YouTube now serves. Verified 15 Sep 2026 on consecutive videos: one
returned 774 of those segments; the next returned **0** — and its
transcript was fully loaded anyway, in a newer format with `Chapter N:`
headings and `"N seconds"` labels under each line.

So **a segment count of 0 does not mean the transcript failed.** Poll
`ytd-transcript-segment-renderer` as a hint, but if it stays at 0, call
`get_page_text` before retrying or reloading — the text is usually there.
Retrying on a false zero wastes a reload and can re-trigger an ad.

`get_page_text` returns the whole transcript in one call in either format.

**Output limits differ by surface.** `claude-in-chrome`'s
`javascript_tool` truncates around 1,000 characters, so never return a
transcript through it. `Claude_Browser`'s returns several thousand
comfortably (6,200 verified).

For a very long video `get_page_text` truncates around 50k and saves the
rest to a file — read that file rather than re-fetching.

## Fallback: harvest the caption track

When the transcript panel never populates — spinner forever, across
reloads and viewport widths — the captions still render, and they are a
complete substitute.

1. Enable captions: click `.ytp-subtitles-button` if its `aria-pressed`
   is not `"true"`.
2. `muted = true`, `currentTime = 0`, `playbackRate = 5`, `play()`.
3. Start a `setInterval` at ~150ms that pushes the joined innerText of
   `.ytp-caption-segment` into an array whenever it changes.
4. **Return immediately.** Do not await the run inside one call — the
   renderer freezes and every tool times out at 45s. Wait in separate
   short calls (`computer wait` maxes at 10s per action; batch several).
5. A 12.5-minute video takes ~150s of wall clock at 5×.

**Reconstruct by overlap, not by deduplication.** YouTube repaints the
caption box cumulatively, so the raw capture is hugely duplicated —
51,120 characters for a 12-minute video. For each new capture, find the
longest suffix of the accumulated output that is a prefix of the new
text, and append only the remainder. That yielded 12,162 characters of
clean, readable prose from the same capture.

Caveat: captions drop speaker changes and punctuation is approximate.
Mark quotes obtained this way as caption-derived when precision matters.

## Two dead ends — do not repeat these

1. **Fetching the caption `baseUrl` directly.** Returns **HTTP 200 with
   an empty body**; it needs a proof-of-origin token. `&fmt=json3` and
   `&fmt=vtt` fail identically, signed in or not.
2. **The InnerTube `get_transcript` endpoint.** Returns **400
   "Precondition check failed"**.

(A third, POSTing to a local HTTP server, is blocked by Chrome's Private
Network Access and hangs until timeout.)

## Frames — when to spend them

Once the tab is visible, seeking and screenshotting works and is often
the difference between a good note and a wrong one. On this backlog,
frames repeatedly contained the thing the narration skipped or got vague
about.

**For design, UI, or website-psychology videos, always sample frames** —
never transcript alone. Standing instruction, and it has repeatedly
proved right: the layout constructions, the before/after states, the
actual numbers on a chart and the anatomy of a reference are all things
the narration gestures at and never states. Nearly every "frame-verified"
line worth keeping came from looking after the words went vague.

**Also sample when the value is in what it SHOWS:** redesign
walkthroughs, real dashboards, ad libraries, layout critiques.

**Skip them for talking heads and tool round-ups** — check one frame, and
if there is no screen content, stop.

Zoom to the player rect rather than screenshotting the whole page; it
costs less and reads better:

```js
document.querySelector('video').getBoundingClientRect();
```

Scroll to top first, or the player will be off-screen.

**For motion** — animation, transitions, scroll effects — a single still
cannot settle the question. Capture a burst of frames a few hundred ms
apart and compare, and say plainly when a motion claim could only be
partly verified.

Do not call `.ytp-fullscreen-button`; it wedged the renderer in testing.

### Three capture traps that produce valid-looking wrong frames

All verified 15 Sep 2026. The first two are dangerous precisely because
the capture **succeeds** — nothing errors, and the image looks plausible.

**1. A paused seek can leave the thumbnail on top.** Setting
`currentTime` on a paused video sometimes leaves YouTube's poster overlay
(the video thumbnail with a play button) covering the player. The zoom
captures it cleanly. Six frames of one video came back as the same
thumbnail before this was noticed. **Fix: play ~1.5s at each timestamp,
then pause, then capture:**

```js
const v = document.querySelector('video');
v.muted = true; v.currentTime = 248;
await v.play(); await new Promise(r => setTimeout(r, 1500)); v.pause();
```

And **look at each frame before trusting it** — if consecutive frames at
different timestamps are identical, it is the overlay.

**2. A navigated page has no user activation, so `play()` gets refused.**
A page reached by `navigate` has `navigator.userActivation.hasBeenActive
=== false`. Chrome then permits only muted autoplay — and YouTube re-syncs
its own volume state onto the element, so `muted = true` does not reliably
stick. Symptom: `NotAllowedError: play() failed because the user didn't
interact with the document first`, often after several captures already
failed with "Image omitted due to error".

**Fix: one trusted click on a neutral element** — the video title, not
the player, so playback is not toggled — via `computer left_click`. That
sets `hasBeenActive` to `true` and every later `play()` works. Script
`.click()` does not count; it must be real input.

**3. Driving two tabs in one window breaks both.** Only the foreground
tab decodes. Acting on a second tab pulls focus, so the first goes
hidden mid-capture (errored images, interrupted `play()`), while the
second — hidden from the start — never decodes (`duration: null`, empty
transcript) and a long await in it freezes the renderer past the 45s
timeout. **Watch one video at a time, in one tab.** Parallelise the
note-writing, not the watching.

## When the page wedges

Long JS calls freeze the renderer and every tool then times out at 45s.
`navigate` to the same URL to reset, wait ~5s, retry.

## Turning it into notes

A transcript is not a summary. Structure around what the reader can do:

**Lead with the single transferable idea**, in their words if it is
sharp. Most videos have exactly one.

**Then the mechanics** — actual prompts, settings, numbers, commands.
Quote precise figures; these cannot be reconstructed later.

**Mark what was frame-verified** and what came only from narration. The
distinction is the whole value of having looked.

**Then what to discount, plainly.** Nearly every such video has a funnel:
a free community, a paid course, an affiliate link, a "10X" title. Say
so. Note where the presenter skipped something hard (mobile,
accessibility, cost) and where a claim is asserted rather than measured.
**Read the comments** — on this backlog the sharpest correction was in
the comments more often than not. An empty or astroturfed comment section
is itself a signal about how much scrutiny the claims have had.

**Then what it means here.** Does this apply, does it duplicate something
that already exists, what would it cost to adopt. A tip that conflicts
with the project's locked decisions is a conflict to flag, not advice to
relay.

**Where a video runs long or lists many items**, group by theme rather
than replaying the order, and drop the padding. A "50 tips" video does
not contain 50 useful tips.

**Count sources across videos.** A claim made by four unrelated creators
is worth more than one made emphatically by one. Say which number it is.

## Rules

- **Never invent content.** If the transcript could not be retrieved, say
  so and offer alternatives. A plausible summary of an unwatched video is
  the worst possible output.
- **Auto-generated captions mangle names and jargon.** "Clling" is Kling,
  "Claude" appears as "cloud", "ROAS" as "rorowaz". Correct silently when
  the intent is obvious; flag it when it is not.
- **Attribute ideas to whoever the video credits**, not the presenter.
- **Say which method you used** — transcript panel, caption harvest,
  frames, or the presenter's own live site. Never imply more than you did.
- If the project keeps durable notes (an Obsidian vault, a docs folder),
  write the extraction there rather than leaving it in chat.

## Batch mode: a whole queue in one tab (verified 21 Sep 2026, 8 videos)

The route that finally worked end to end, after the in-app pane and the
transcript panel both failed repeatedly:

- **Use the user's real browser (claude-in-chrome) and have them bring it to
  the front.** The in-app pane goes `hidden` the moment the user types in the
  chat, and hidden means captions freeze (rAF suspended) while playback keeps
  running. A real browser window the user leaves in front stays `visible`.
- **One tab, one in-page `setInterval`, and `#movie_player.loadVideoById(id)`
  to advance.** It swaps videos without a navigation, so the interval, the
  capture array and all state survive the whole queue. Pause the video when
  `visibilityState !== 'visible'` so nothing is skipped if the user looks away.
- **Save each line to `localStorage` as you go.** A reload wiped an unsaved
  capture once; never again.
- **Detect the end with `mp.getPlayerState() === 0` or
  `mp.getCurrentTime() >= mp.getDuration() - 0.8`, NOT with the `<video>`
  element.** When a mid-roll ad finishes, `.ad-showing` drops a tick before
  the element switches back, so `v.currentTime >= v.duration` fires on the
  AD's duration and the queue jumps to the next video, silently dropping the
  rest. The player API reports the real video.
- **Scripted clicks on Skip are ignored.** Real clicks work: compute the
  button's rect × (screenshot frame width / `innerWidth`) and click it with
  `computer`. On a 1272-wide frame at scale 1 it sat at (716, 405).
- **Reading it back:** YouTube's page enforces Trusted Types, so
  `innerHTML` throws. Build a `<pre>` with `textContent`, replace the body,
  then `get_page_text` returns ~45k characters in one call.
- **Frames while it runs:** `computer zoom` on the player rect every ~8-16 s
  of wall clock (40-80 s of video at 5×) at scale 0.45 was enough to catch
  the on-screen prompts, prices and UI the narration skipped.
