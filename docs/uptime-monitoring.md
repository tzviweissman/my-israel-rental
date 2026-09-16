# Being told when the site goes down

Nothing currently watches the live site. If it stops answering at 2am, the
first person to find out is a visitor. This is the setup that fixes that,
and the reasoning behind the two choices in it that are not obvious.

Decided 16 September 2026. Tzvi chose email alerts.

---

## What gets watched

Two checks, because they can fail independently and the difference tells you
where to look.

| Check | Address | What it proves |
|---|---|---|
| **The site** | `https://myisraelrental.com` | A visitor can load the page at all |
| **The API** | `https://myisraelrental.com/api/health` | The backend is up *and* the database answers |

The API is checked through `myisraelrental.com`, not through
`my-israel-rental-production.up.railway.app`. The site proxies `/api` from
its own origin (`frontend/server.js`), so this path is the one real visitors
use. Watching the Railway host directly would keep reporting healthy through
exactly the kind of failure that took the site down in September, when a
visitor's network passed reads and dropped cross-origin posts.

---

## The keyword, and why it is not a status code

`/api/health` answers like this:

```json
{"status":"ok","database":true,"cloudinary":true}
```

and, when the database cannot be reached, like this:

```json
{"status":"degraded","database":false,"cloudinary":true}
```

**Both of those are HTTP 200.** A monitor that only watches for a failed
response would sit quietly through a total database outage. So the monitor
is set to look for the text `"status":"ok"` in the body and alert when it is
missing.

**Do not "fix" this by returning 503 when degraded.** `backend/railway.json`
points Railway's own health check at this same path with
`restartPolicyType: ON_FAILURE` and `restartPolicyMaxRetries: 10`. A 503
during an Atlas blip would fail Railway's probe, restart the service, and on
a sustained outage burn through all ten retries and stop it — turning a
database wobble that would have healed by itself into a dead site needing a
manual redeploy. The keyword check gets the same alert with none of that.

If a separate status code is ever genuinely wanted, it belongs on a *second*
path that Railway does not probe.

---

## Setting it up — UptimeRobot, about five minutes

Free plan covers this: 50 monitors, a check every 5 minutes, email alerts.

1. Go to **https://uptimerobot.com** and click **Register for FREE**.
2. Sign up with your email address and confirm the email it sends you.
3. Once you are in, click **+ New monitor** (top left).
4. Fill in the first monitor:
   - **Monitor type:** `HTTP(s)`
   - **Friendly name:** `MyIsraelRental — site`
   - **URL:** `https://myisraelrental.com`
   - **Monitoring interval:** `5 minutes`
5. Scroll down to **Alert contacts to notify** and tick your email address.
6. Click **Create monitor**.
7. Click **+ New monitor** again for the second one:
   - **Monitor type:** `Keyword`
   - **Friendly name:** `MyIsraelRental — API and database`
   - **URL:** `https://myisraelrental.com/api/health`
   - **Keyword type:** choose **`Keyword not exists`** — this is the
     important one. It means "alert me when this text is missing".
   - **Keyword value:** `"status":"ok"` — including the quote marks.
   - **Monitoring interval:** `5 minutes`
8. Tick your email address under **Alert contacts to notify** again.
9. Click **Create monitor**.

Both monitors should show a green **Up** within a minute or two.

### Check it actually works

Do not trust a monitor you have never seen fire. On the first monitor, open
it, click **Edit**, change the URL to `https://myisraelrental.com/this-does-not-exist`,
and save. Within about five minutes you should get an email saying it is
down. Change the URL back to `https://myisraelrental.com` and you should get
a second email saying it is up again.

If no email arrives, check your spam folder and that the alert contact is
ticked on that monitor — an alert contact added to the account is not
automatically attached to a monitor that already existed.

---

## What an alert means

| Email says | Most likely |
|---|---|
| **site is down** | The frontend service on Railway is down or redeploying. Check the Railway dashboard. |
| **API and database** down, site up | The page loads but nothing on it works. Either the backend service is down, or MongoDB Atlas is unreachable. Check Atlas first — the site itself is fine. |
| **both** down | Railway itself, or something that took out both services. |

A deploy causes a short blip on the service being deployed. Two or three
minutes of "down" immediately after a push is a deploy, not an incident.

---

## Not done

- **No phone or SMS alert.** Email only, by choice. Worth revisiting if the
  site ever earns money while you are asleep.
- **Nothing watches the scheduled jobs** — the nightly digests, the booking
  hold sweep, the monthly restore drill. They can stop silently and these
  two checks would still be green. A dead-man's-switch service
  (healthchecks.io and similar) is the usual answer: the job pings a URL
  when it finishes, and you are told when a ping does not arrive. Not built.
- **Nothing watches certificate expiry.** Railway renews automatically, and
  UptimeRobot's free plan will report an expiry-soon warning on the site
  monitor anyway.
