# Google Search Console — Setup Guide

> Register `myisraelrental.com` in Google Search Console and submit the sitemap
> so Google crawls all **176 URLs** (base pages + 12 categories + 12 locations
> + 144 category×city combinations) within ~24 hours.

Total time: **3 minutes.** No downtime, no code deploy required (the
verification hook is already wired — see step 3).

---

## 1. Register the property

1. Sign in to <https://search.google.com/search-console> with a Google account
   that will own the reporting for this site.
2. Click **Add property → Domain** (this is preferred over URL-prefix — one
   verification covers `http`, `https`, `www`, and any subdomain).
3. Enter `myisraelrental.com` and click **Continue**.

Google will show you a **TXT record** you need to add to your DNS. Skip to
step 4 if you'd rather do DNS-based verification.

Prefer **HTML-tag** verification instead? Click **URL prefix** at the top of
the property picker and enter `https://myisraelrental.com` — Google will
give you a `<meta name="google-site-verification" content="..." />` tag. Use
that content string in step 3 below.

---

## 2. (Option A) DNS verification — no code change

If you added the property as **Domain**:

1. Copy the TXT record Google shows you (looks like
   `google-site-verification=abc123XYZ…`).
2. Log in to your DNS host (Cloudflare, Route 53, whatever manages
   `myisraelrental.com`).
3. Add a **TXT** record on the apex (`@`) with:
   - **Type**: `TXT`
   - **Name**: `@` (or leave blank)
   - **Value**: the string Google gave you (the whole thing, quotes optional)
   - **TTL**: default (usually 5 min or auto)
4. Back in Search Console, click **Verify**. If it fails, wait 5 minutes for
   DNS propagation and click **Verify** again.

Skip to step 4.

---

## 3. (Option B) HTML-tag verification — one env var

If you added the property as **URL prefix**, Google gave you a string like
`abc123XYZ456`. To ship it site-wide with zero code edits:

1. Open `/app/frontend/.env` and add (or update) this line:

   ```env
   REACT_APP_GOOGLE_VERIFICATION=abc123XYZ456
   ```

2. Restart the frontend so React picks up the env var:

   ```bash
   sudo supervisorctl restart frontend
   ```

3. Back in Search Console, click **Verify**. The verification meta tag will
   render on every page's `<head>` via the existing `PageMeta` component.

---

## 4. Submit the sitemap

Once the property is verified:

1. In Search Console, open **Sitemaps** in the left rail.
2. Under **Add a new sitemap**, paste:

   ```
   sitemap.xml
   ```

   (Google appends this to your property root, so the full URL becomes
   `https://myisraelrental.com/sitemap.xml`.)

3. Click **Submit**. Status should switch to **Success** within a few
   minutes. Google will report the URL count — you should see **176**.

---

## 5. What happens next

- **~24 hours**: Google starts crawling the 176 URLs. Long-tail queries like
  `handyman jerusalem` or `photography tel aviv` will start ranking within
  1–2 weeks depending on domain authority.
- **7 days**: Check the **Coverage** report — you should see 176 URLs
  discovered and (ideally) 176 indexed. If some are `Excluded — Duplicate,
  Google chose different canonical`, that means Google decided the base
  `/services` covers the filtered variant. Not fatal, just less long-tail
  reach. To fight it, add a per-filter canonical tag (Phase 2b work).
- **30 days**: Use the **Performance** report to see which category+city
  combinations actually drove clicks. Double-down on the top 5 (add hero
  copy, seed a couple of high-quality gigs in each) and consider retiring
  the bottom 5.

---

## 6. Regenerating the sitemap

If we add/remove categories or cities, re-run the inline Python generator
at the top of `/app/frontend/public/sitemap.xml`. Then in Search Console,
click **Refresh** next to the submitted sitemap and Google will re-crawl.

---

## Troubleshooting

**"Verification failed" on DNS**
: Wait 15 min then retry. Some registrars (GoDaddy, Namecheap) propagate
  slowly.

**"Verification failed" on HTML tag**
: Confirm the meta tag actually renders by hitting `view-source:https://myisraelrental.com/`
  and searching for `google-site-verification`. If missing, the env var
  didn't reach the build — restart the frontend and hard-refresh.

**Sitemap fetch returns "Couldn't fetch"**
: Confirm `https://myisraelrental.com/sitemap.xml` returns HTTP 200 with
  `content-type: application/xml`. Also verify `robots.txt` has the
  `Sitemap:` line pointing to the right URL (it does — already checked).

**"URL not in property" errors**
: You verified the wrong protocol (e.g. `http://` vs `https://`). Add the
  correct one as a second property and re-submit.
