# Jason Zubiate: Awwwards-level portfolio (_BZZkFzuLQs), notes 2026-10-31

**What it is:** a design engineer's making-of of his own portfolio (about 6 min). Mostly talking head about process: one goal, a mood board, a restrained Tailwind zinc/stone palette, a Swiss-modern font, paper wireframes, Figma, then Next.js + Motion + GSAP. The finished site only appears from about 4:15, filmed off a monitor (low quality). Sales pitch: subscribe, "hire me". No fake reviews, but the site has a loading counter (65, 92, 100) and decorative number labels; ignore those.
Lessons said aloud: the first 10 seconds must wow; pick ONE goal and design for it; stay in a minimal palette so the work is the colour.

## EFFECTS (final site, what the frames show)
1. **Preloader counter 0 to 100** on a pale ground with small tiles shuffling in an arc, then the page reveals. ALREADY-HAVE as a rule against invented counters (3j, 5a). Skip for local businesses (adds waiting).
2. **Cursor-driven fan of own work in the hero.** Under a giant "DESIGN ENGINEER" headline (wider than the screen, cropped at the sides) a small window shows project clips; as the mouse moves left/right a stack of 4 to 5 tilted cards fans out in an arc and settles, with smooth lag (about 0.3 to 0.5 s ease, GSAP quickTo style). Trigger: horizontal mouse position.
   - Suits: trainer, hair/nail salon, decorator (their own finished work as the cards). Wrong for bakery and home services (little variety) and holiday rentals (one big photo is the point).
   - **NEW.** Nearest rules: floating cut-out tiles 3i.6 (drift with scroll, not cursor), 3q.5 small unique touch. Needs 5+ real photos; no mouse on a phone, so give a scroll or slow auto-drift fallback.
3. **Showreel window grows with scroll and becomes the next section** (voice-over plus frames: black video window widens into a black band, then cuts to About). ALREADY-HAVE (scroll-scrubbed video, film openings, pinned scenes: 3h).
4. **Fixed floating pill menu, bottom centre** (avatar, name, role line, hamburger), stays over every section including full-bleed photos. ALREADY-HAVE (3i.7). Top corners carry only tiny fixed labels ("Building at", "Freelance availability") plus a "Get in touch" pill at top right; there is no full top menu bar.
5. **Huge cropped headline words** ("WORK '25", "DESIGN ENGINEER") and colour breaks (pink band with oversized pale headline; yellow tile "LET'S CREATE SOMETHING SPECIAL TOGETHER"). ALREADY-HAVE (3g.7 cropped wordmark, 3i.5 colour per section).
6. **Staggered bio paragraph that ripples on scroll**: words spread with wide uneven gaps, spacing shifts as you scroll, a small portrait scrolls at a different speed. NEW but hurts readability (readable.mjs); only with large type and short text. Low priority.
7. **Tech-stack box**: dark dot-grid panel, list lines go from grey to white in turn. Not for us (tool names mean nothing to our customers); the services-list equivalent is flagged as overused (no-repeat-light-up-steps).
8. **Work cards, 2-up**: big picture, one-line title bottom-left, year/type bottom-right. ALREADY-HAVE (gallery/card pattern).
9. **Vertical-slice image strip**: a black box showing a photo cut into about 10 thin vertical bars that open as the window grows. NEW one-off flourish for salon/decorator portfolios; low priority.
10. **Mobile versions** (end of video): one column, same bottom pill menu, big headline, cursor effects removed, content kept. Confirms mouse-only effects must drop out on phones.

## STRUCTURE (order on the portfolio)
Preloader, hero (giant headline + reel), About (bio + photo), Work (2-up cards), skills/tools box, Services (coloured cards numbered (01) (02) like stacked folders, each with a big title and short blurb), selected projects strip, contact footer ("Let's create something special together", send-a-message button, location and local time, social links as plain text, copyright). Header: no top bar; tiny fixed corner labels, one Get-in-touch pill, bottom pill menu. Spacing: very large empty margins, one grid, type does the work. Project inner pages exist (one per card), not shown.
- Bottom pill menu, contact CTA in footer, big type: ALREADY-HAVE (3g, 3i, 3k).
- **Footer with live local time and place** (for us: "Open now, Haifa, 14:22", true open/closed from the real hours): **NEW**, suits every local category (bakery, salon, trainer, home services). Not found in rules.
- **Stacked-folder service cards** (each service a coloured card sliding over the last while pinned): **NEW** as a shape for a services/packages section. Pinned scenes exist (3h) but not this; keep to 3 cards (3h.20).

## Live site addresses
His site address is not on screen (it is in the video description; channel @jason.zubiate). Mood-board references flashed: Kick & Bass (coaches, dark, pink-outlined card), LIV Golf, Directors Cut, Vincent Navarro (skater portfolio), Zajno. None fetched.

## Frames
- frames/2026-10-31/_BZZkFzuLQs-1.jpg: hero, cursor-driven card fan under the giant headline, contact tile, tools box.
- frames/2026-10-31/_BZZkFzuLQs-2.jpg: preloader count, yellow tile, showreel window, vertical slice strip, bio text with parallax portrait.
