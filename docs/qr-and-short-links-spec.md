# QR codes and short links

Give owners and service providers something physical to hand out: a branded QR that leads to their listings, one property, or their business page — and count the scans so they know whether it worked.

Related: `docs/dashboard-ux-spec.md` (D6, the share panel), `docs/multi-business-spec.md` (M4, public business pages).

---

## Q1 — Short links first (do this before any QR work)

The current share URL is `/manager/e1134e55-f176-44e2-b64e-2abb26347c8c`. A 36-character UUID makes a dense, fragile QR that needs to be printed large and fails at an angle or in poor light. It also reads badly when someone types it off a sign.

- Add a `short_links` collection: `slug` (6–7 chars, unambiguous alphabet — no `0/O/1/l`), `target_type` (`manager` | `property` | `business`), `target_id`, `owner_user_id`, `created_at`, `scan_count`, `last_scanned_at`.
- Route `/p/{slug}` → 302 to the canonical URL.
- Generate lazily: create the slug the first time someone opens the share panel or requests a QR, then reuse it. Never regenerate — printed codes must keep working forever.
- Keep every existing long URL working. Short links are an addition, never a replacement.

**Slugs are guessable by design, so they must only ever point at content that is already public.** Never mint a short link for a private or permissioned URL — no contracts, no dashboards, no chat threads.

### The domain is part of the printed code — a permanent commitment

A printed QR encodes the **whole URL, domain included**, not just the slug. From the first sign that goes up, `myisraelrental.com/p/{slug}` must keep resolving **forever** — through any rebrand, rehost or later purchase of a shorter domain. A new domain may be *added*; this one may never stop answering. (Recorded 2026-08-18, when the first slugs were minted.)

### How the redirect is actually served (built 2026-08-18)

The spec asked for a server 302. `myisraelrental.com` resolves to the static frontend, which cannot compute redirects itself — but its `serve` static server evaluates `serve.json` **redirects before the SPA rewrite** (verified empirically), so:

1. `myisraelrental.com/p/{slug}` → `serve` issues a real 302 (rule in `frontend/public/serve.json`, shipped into `build/` by CRA) →
2. `…railway.app/api/short-links/{slug}/follow` counts the scan and 302s →
3. `myisraelrental.com/manager/…?src=qr` (or property/business).

Both hops are genuine HTTP redirects; no interstitial renders, and link-preview crawlers follow through to the canonical page, so a pasted `/p/` link previews identically to the long URL. The React `/p/:slug` route stays as the dev-server fallback (the CRA dev server does not read `serve.json`).

Gotchas encoded in that config: `serve-handler` parses the redirect **destination** with `:token` syntax too, so a destination containing a port (`localhost:8001`) crashes the server — the production URL is portless and safe. 302 not 301, so caches can't absorb hops that should be counted. And preview bots (WhatsApp, facebookexternalhit, Telegram…) follow the chain every time a link is pasted into a chat, so `/follow` and `/resolve` recognise their user agents and redirect **without counting** — "Scanned 34 times" means people.

## Q2 — Scan counting

- `/p/{slug}` increments `scan_count` and stamps `last_scanned_at`, then redirects.
- Append `?src=qr` to the redirect target so existing analytics can separate QR traffic.
- Show the count in the dashboard next to the QR: *"Scanned 34 times."* Real number or nothing — if it's zero, say "Not scanned yet," never omit or estimate.
- Count on redirect, not on page load, so it works even when the target 404s or the visitor bounces.

## Q3 — QR generation (client-side)

- Use `qrcode.react` — renders SVG in the browser. **Do not use a third-party QR image service**: it leaks every URL to a third party and those services change terms, add watermarks, or disappear, breaking printed material that can't be recalled.
- Downloads: **PNG** (1024px, for screens and messaging) and **SVG** (for print, scales without loss).
- Encode the short link from Q1.

## Q4 — Branding the code

- Ink modules `#23201B` on white. Not gold — gold on white is roughly 2:1 and scanners need high contrast. **The code itself is functional, not decorative.**
- Optional logo mark in the centre, which **requires error-correction level `H`**. Without it the logo destroys enough modules to break scanning. If no logo, level `M` is fine and produces a sparser, easier-to-scan code.
- Always render the URL as text beneath the code — many people won't scan, and it makes the printed piece usable if the code is damaged.
- Quiet zone: at least 4 modules of white on all sides. Do not crop it.
- Note the minimum print size in the UI: **2cm × 2cm**, larger for a building sign.

## Q5 — Where QRs appear

| Surface | Target | Where in the UI |
|---|---|---|
| **All my listings** | manager page | Dashboard → My Properties share panel (D6) |
| **One property** | that listing | Property detail, owner view |
| **A business** | `/business/{slug}` | Business settings (M8) — one QR per business |

Not for: requests (they expire — a printed code that dies in 30 days is a bad artefact), or chat threads (private).

## Q6 — The printable card (worth more than the QR alone)

A "Download a sign" action producing a **print-ready A4/Letter PDF**, since the realistic use is a sign taped in a building entrance:

- The QR, large and centred, with the short URL beneath it
- The property title, or the business name and trade
- The MyIsraelRental mark and one line: *"Free to browse — no booking fees"*
- Limestone background, blue and gold per the locked palette
- **Hebrew and English versions** — an Israeli building entrance needs the Hebrew one; generate both and let them choose, or produce a bilingual layout

This is the part an owner actually wants. A bare QR PNG makes them do the design work; a finished sign gets used.

---

## Order

1. **Q1** short links (useful on its own — a shareable `/p/abc123` beats a UUID everywhere)
2. **Q3 + Q4** QR generation and branding, in the existing share panel
3. **Q2** scan counting
4. **Q5** the property and business surfaces
5. **Q6** the printable PDF

## Constraints

- Client-side generation only; no external QR service, no new third-party dependency beyond `qrcode.react`.
- Short-link slugs never point at permissioned content.
- Printed codes are permanent — never change or recycle a slug once issued.
- Strings in both `en.js` and `he.js`; the PDF ships in both languages; verify RTL per `docs/acceptance-checklist.md`.
- Real scan counts only. No estimates, no rounding.
