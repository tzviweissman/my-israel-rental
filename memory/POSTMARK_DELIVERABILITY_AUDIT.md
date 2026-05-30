# Postmark Deliverability Audit — myisraelrental.com

Audit date: 2026-05-31
Sending domain: `myisraelrental.com`
From address: `no-reply@myisraelrental.com`
Mail provider: Postmark
DNS provider: (looks like Namecheap PrivateEmail handles inbound MX)

---

## TL;DR

**Two DNS records are missing.** This is the #1 reason your emails (signup, booking
confirmations, etc.) keep landing in spam. Code is fine; setup is not.

| Check | Status | Impact |
|---|---|---|
| SPF includes Postmark | ❌ FAIL — SPF only authorizes PrivateEmail, **not Postmark** | High — Gmail/Outlook will mark as suspicious |
| DKIM signature for Postmark | ❌ FAIL — no Postmark DKIM CNAME at any selector | **Critical** — emails fail authentication |
| DMARC policy | ⚠️ p=none (monitoring) | OK, but failing SPF+DKIM still hurts |
| Sender signature in Postmark dashboard | ⚠️ Verify in Postmark UI | Must be confirmed |
| TextBody alt-part | ✅ Implemented (`_strip_html`) | Good |
| MessageStream=outbound | ✅ Correct stream for transactional | Good |
| Suppression-list handling | ✅ Hard-bounce / spam-complaint webhook respected | Good |
| Tag per email type | ✅ Tagged per template | Good |

---

## What's actually in DNS right now

```
v=spf1 include:spf.privateemail.com ~all                 <-- SPF (Postmark NOT included)
v=DMARC1; p=none; rua=mailto:dmarc@myisraelrental.com    <-- DMARC OK
(no records under _domainkey.myisraelrental.com)         <-- NO DKIM
```

## What it should look like

### 1. Update SPF — add `spf.mtasv.net` (Postmark's domain)

Replace your existing TXT record at the apex with:

```
v=spf1 include:spf.privateemail.com include:spf.mtasv.net ~all
```

> NB: An SPF record must be a **single** TXT entry. Don't add a second `v=spf1` —
> SPF will silently fail. Always edit the existing one in place.

### 2. Add Postmark DKIM CNAME

In **Postmark dashboard → Sender Signatures → myisraelrental.com → DNS Settings**,
Postmark will give you a CNAME record that looks like:

```
20240122._domainkey   CNAME   20240122.dkim.mtasv.net.
```

(The selector value `20240122` is just an example — copy whatever Postmark shows for your account.)

Once published, click **Verify** in the Postmark UI. Status should flip to ✅ Verified.

### 3. (Optional but recommended) Sender Signature

In Postmark → **Sender Signatures**, make sure `no-reply@myisraelrental.com`
appears with a green ✅ next to "Domain verified" and "DKIM verified".

### 4. (Optional) Tighten DMARC after SPF+DKIM are green

Once SPF and DKIM are passing for a week, you can bump DMARC from `p=none` to
`p=quarantine` to make spoofing impossible.

---

## After publishing DNS

1. Send yourself a verification email from the live signup flow.
2. Open the raw source in Gmail and look at the header — both lines below should say `pass`:
   ```
   Authentication-Results: ... spf=pass ... dkim=pass ...
   ```
3. Run https://www.mail-tester.com — should score ≥ 9/10.
4. If you have an existing user-facing email list, **don't blast it on day 1**.
   Send transactional emails normally for a few days so Postmark builds reputation
   for the now-signed sender, then resume.

## Why this fixes it

Gmail and Outlook silently filter mail that fails **both** SPF and DKIM into spam
even if DMARC is `p=none`. Right now `no-reply@myisraelrental.com` fails both,
so receivers treat every email as "could be a phisher pretending to be that
domain". Add the two DNS records and the same emails will land in the inbox.

## No code changes needed

Backend Postmark integration in `/app/backend/utils/email.py` is already
following best practice (alt-text body, outbound stream, tagged, suppression
list, async send). Nothing to ship from our end.
