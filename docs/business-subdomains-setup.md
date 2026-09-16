# Turning on business web addresses — the steps for Tzvi

Every business already has its own web address built and tested
(`bakery.myisraelrental.com`), and it is switched off. It stays off until
the certificate exists, and this page is the four things that have to happen
first, in order.

DNS is on **Cloudflare** (confirmed 16 September 2026).

**Why the order matters, and why it cannot be rushed:** the site tells every
browser "only ever reach me over a secure connection, and that goes for
every address under my name too". So a business address without a valid
certificate does not show a warning a visitor can click past. **It does not
open at all.** Switching the feature on before the certificate is issued
would hand owners links that are simply broken. That is the whole reason it
shipped dark.

---

## Step 1 — Upgrade Railway to Pro

The current plan allows two custom web addresses and both are in use
(`myisraelrental.com` and `www.myisraelrental.com`). The wildcard needs a
third. Pro allows twenty.

1. Go to **https://railway.com** and sign in.
2. Click your **workspace name** in the top-left corner.
3. Click **Settings**, then **Plans** (or **Billing**).
4. Choose **Pro** and confirm. It is billed per seat per month, plus usage.

---

## Step 2 — Add the wildcard address in Railway

1. Still in Railway, open the **MyIsraelRental project**.
2. Click the **frontend** service — the one that serves the website, not the
   one named for the API.
3. Click the **Settings** tab, then **Networking**.
4. Under **Custom Domain**, click **+ Custom Domain**.
5. Type exactly: `*.myisraelrental.com`
   The star is deliberate. It means "every address under this name".
6. Click **Add**.

Railway now shows you **two records to create**. Leave this page open — you
need to copy from it in the next step. One is a CNAME for the wildcard. The
other starts with `_acme-challenge`, and that one is what actually issues
the certificate: skip it and the address never works.

---

## Step 3 — Create the two records in Cloudflare

1. Go to **https://dash.cloudflare.com** and sign in.
2. Click **myisraelrental.com** in your list of sites.
3. In the left sidebar, click **DNS**, then **Records**.
4. Click **+ Add record**.
5. First record — the wildcard:
   - **Type:** `CNAME`
   - **Name:** `*`
   - **Target:** paste the value Railway showed you (it ends in
     `.up.railway.app`)
   - **Proxy status:** click the orange cloud so it turns **grey** and reads
     **DNS only**
   - Click **Save**
6. Click **+ Add record** again.
7. Second record — the one that issues the certificate:
   - **Type:** `CNAME`
   - **Name:** paste what Railway showed, starting `_acme-challenge`
   - **Target:** paste the matching value from Railway
   - **Proxy status:** **grey cloud / DNS only** again
   - Click **Save**

### The orange cloud — the one thing most likely to go wrong

Cloudflare turns the cloud **orange** by default, which means it answers for
your site itself instead of passing the request to Railway. With it orange,
Railway can never prove it owns the address, the certificate is never
issued, and the business addresses never open. Both records must be
**grey**.

If you have already saved one as orange: click the record, click the orange
cloud to grey it, and save. It takes effect within a minute or two.

---

## Step 4 — Wait, then tell me

Back on the Railway Networking page, the wildcard entry shows its status.
It usually goes green within a few minutes, occasionally up to an hour.

When it is green, open a business address in your browser — any real
business, for example `https://<business-name>.myisraelrental.com` — and
look for the **padlock** next to the address. If the padlock is there and
the page loads, the certificate is live.

**Then tell me, and I will do the last part**: switching the feature on for
the frontend service and rebuilding, which is what makes owners see and
share their address. That is one setting and one deploy, and I will check a
real business address afterwards before saying it is done.

---

## If it does not come up

| What you see | What it means |
|---|---|
| Railway still says "waiting" after an hour | One of the two records is wrong, or the `_acme-challenge` one is missing. Compare both against Railway's page character by character. |
| The address does not open at all, no warning | Expected before the certificate exists. Not a fault; it is the security rule described at the top. |
| The main site breaks | Unlikely — you only added records, you changed nothing existing. If it happens, delete the `*` record and the site returns to how it was. |

Nothing in these steps touches `myisraelrental.com` or `www`, so the live
site is not at risk at any point.

Background on how the feature works: the vault note **Business Web
Addresses**.
