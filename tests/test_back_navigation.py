"""
Frontend regression tests for the back-navigation / filter-preservation
refactor (useBackNavigation hook).

Locks in:
  * saveReturnPath() writes pathname+search to sessionStorage.previousPath
    when a listing card is clicked.
  * PropertyDetail back-button restores the filtered listing URL for
    /properties/:type, /stays, /kosher-stays-in-israel, /manager/:id.
  * ManagerPage mirrors area/bedrooms/type into the URL (previously
    lived only in useState).
  * GigDetail / JobDetail / ProviderProfile back buttons use
    useReturnDestination(prefixWhitelist, fallback) and fall back
    gracefully when previousPath is stale/unrelated.
  * PostJob back button navigates to /services/jobs (was /services).
  * Cross-page: gig → provider → provider-back returns to the specific
    /services/gig/{id}, not the /services hub.

Run manually with:
    python /app/tests/test_back_navigation.py
"""

import asyncio
import os
from playwright.async_api import async_playwright

BASE = os.environ.get("REACT_APP_BACKEND_URL",
                     "https://where-am-i-project.preview.emergentagent.com").rstrip("/")
MANAGER_ID = "b0a59336-f059-4d91-b608-6bbedc63a775"  # owner@test.com


async def run(pw):
    browser = await pw.chromium.launch(headless=True)
    ctx = await browser.new_context(viewport={"width": 1400, "height": 3000})
    page = await ctx.new_page()
    results = {}

    async def goto(url):
        await page.goto(url, wait_until="domcontentloaded", timeout=30000)

    # ---- 1. /properties/long-term filter round-trip -----------------------
    await goto(f"{BASE}/properties/long-term?min_bedrooms=2")
    await page.wait_for_timeout(3000)
    cards = await page.query_selector_all('[data-testid^="property-card-"]')
    assert cards, "No property cards on /properties/long-term"
    await cards[0].click()
    await page.wait_for_timeout(2500)
    prev = await page.evaluate("() => sessionStorage.getItem('previousPath')")
    assert prev == "/properties/long-term?min_bedrooms=2", prev
    await (await page.query_selector('[data-testid="back-button"]')).click()
    await page.wait_for_timeout(2500)
    assert "min_bedrooms=2" in page.url
    results["properties_long_term"] = "PASS"

    # ---- 2. /stays area filter round-trip --------------------------------
    await goto(f"{BASE}/stays?area=Jerusalem")
    await page.wait_for_timeout(5000)
    await page.evaluate("() => window.scrollTo(0, 1500)")
    await page.wait_for_timeout(1200)
    stays_cards = await page.query_selector_all(
        '[data-testid^="stays-card-"]:not([data-testid^="stays-card-like-"]):not([data-testid^="stays-card-fx-"])'
    )
    assert stays_cards, "No stays cards"
    await stays_cards[0].click()
    await page.wait_for_timeout(2500)
    await (await page.query_selector('[data-testid="back-button"]')).click()
    await page.wait_for_timeout(2500)
    assert "area=Jerusalem" in page.url, page.url
    results["stays_area"] = "PASS"

    # ---- 3. /manager/:id filter mirror + round-trip ----------------------
    await goto(f"{BASE}/manager/{MANAGER_ID}")
    await page.wait_for_timeout(2500)
    await page.select_option('[data-testid="manager-area-filter"]', "Jerusalem")
    await page.wait_for_timeout(1500)
    assert "area=Jerusalem" in page.url, page.url
    mprops = await page.query_selector_all('[data-testid^="manager-property-"]')
    assert mprops, "No manager properties after filter"
    await mprops[0].click()
    await page.wait_for_timeout(2500)
    prev = await page.evaluate("() => sessionStorage.getItem('previousPath')")
    assert "area=Jerusalem" in prev, prev
    await (await page.query_selector('[data-testid="back-button"]')).click()
    await page.wait_for_timeout(2500)
    assert "area=Jerusalem" in page.url
    val = await page.evaluate('() => document.querySelector(\'[data-testid="manager-area-filter"]\').value')
    assert val == "Jerusalem", val
    results["manager_filter_roundtrip"] = "PASS"

    # ---- 4. /services back preservation ----------------------------------
    await goto(f"{BASE}/services")
    await page.wait_for_timeout(5000)
    await page.evaluate("() => window.scrollTo(0, 1400)")
    await page.wait_for_timeout(1200)
    gigs = await page.query_selector_all('[data-testid^="services-gig-"]')
    assert gigs, "No gigs"
    await gigs[0].scroll_into_view_if_needed()
    await gigs[0].click()
    await page.wait_for_timeout(2500)
    prev = await page.evaluate("() => sessionStorage.getItem('previousPath')")
    assert prev == "/services", prev
    await (await page.query_selector('[data-testid="gig-back"]')).click()
    await page.wait_for_timeout(2500)
    assert page.url.rstrip("/").endswith("/services")
    results["services_back"] = "PASS"

    # ---- 5. gig -> provider -> back to specific gig ----------------------
    gigs = await page.query_selector_all('[data-testid^="services-gig-"]')
    await gigs[0].scroll_into_view_if_needed()
    await gigs[0].click()
    await page.wait_for_timeout(2500)
    gig_url = page.url
    await (await page.query_selector('[data-testid="gig-view-provider"]')).click()
    await page.wait_for_timeout(2500)
    await (await page.query_selector('[data-testid="provider-back"]')).click()
    await page.wait_for_timeout(2500)
    assert "/services/gig/" in page.url and page.url == gig_url, (page.url, gig_url)
    results["provider_back_to_gig"] = "PASS"

    # ---- 6. /services/jobs with category filter --------------------------
    await goto(f"{BASE}/services/jobs")
    await page.wait_for_timeout(2500)
    cat_btns = await page.query_selector_all('[data-testid^="jobs-cat-"]')
    matched = None
    for b in cat_btns:
        tid = await b.get_attribute("data-testid")
        if tid == "jobs-cat-all":
            continue
        await b.click()
        await page.wait_for_timeout(1200)
        rows = await page.query_selector_all('[data-testid^="jobs-row-"]')
        if rows:
            matched = tid
            await rows[0].click()
            await page.wait_for_timeout(2500)
            await (await page.query_selector('[data-testid="job-detail-back"]')).click()
            await page.wait_for_timeout(2500)
            assert "category=" in page.url, page.url
            break
    assert matched, "No category had jobs"
    results["jobs_category_roundtrip"] = "PASS"

    # ---- 7. PostJob back → /services/jobs (renter@test.com) --------------
    login = await page.evaluate(
        "async () => (await fetch('/api/auth/login', {method:'POST', "
        "headers:{'Content-Type':'application/json'}, "
        "body: JSON.stringify({email:'renter@test.com', password:'Test1234!'})})).json()"
    )
    assert login.get("token")
    await page.evaluate(f"() => sessionStorage.setItem('token', '{login['token']}')")
    await goto(f"{BASE}/services/post-job")
    await page.wait_for_timeout(2500)
    await (await page.query_selector('[data-testid="post-job-back"]')).click()
    await page.wait_for_timeout(2000)
    assert page.url.rstrip("/").endswith("/services/jobs"), page.url
    results["postjob_back_to_jobs"] = "PASS"

    # ---- 8. Gig back fallback ignores stale /dashboard -------------------
    await goto(f"{BASE}/services")
    await page.wait_for_timeout(4000)
    gigs = await page.query_selector_all('[data-testid^="services-gig-"]')
    gid = (await gigs[0].get_attribute("data-testid")).replace("services-gig-", "")
    await page.evaluate("() => sessionStorage.setItem('previousPath', '/dashboard')")
    await goto(f"{BASE}/services/gig/{gid}")
    await page.wait_for_timeout(2500)
    await (await page.query_selector('[data-testid="gig-back"]')).click()
    await page.wait_for_timeout(2500)
    assert page.url.rstrip("/").endswith("/services") and "dashboard" not in page.url
    results["gig_back_fallback"] = "PASS"

    # ---- 9. JobDetail back fallback ignores /dashboard -------------------
    await goto(f"{BASE}/services/jobs")
    await page.wait_for_timeout(2500)
    rows = await page.query_selector_all('[data-testid^="jobs-row-"]')
    jid = (await rows[0].get_attribute("data-testid")).replace("jobs-row-", "")
    await page.evaluate("() => sessionStorage.setItem('previousPath', '/dashboard')")
    await goto(f"{BASE}/services/jobs/{jid}")
    await page.wait_for_timeout(2500)
    await (await page.query_selector('[data-testid="job-detail-back"]')).click()
    await page.wait_for_timeout(2500)
    assert page.url.rstrip("/").endswith("/services/jobs")
    results["jobdetail_back_fallback"] = "PASS"

    await browser.close()
    print("\n=== RESULTS ===")
    for k, v in results.items():
        print(f"  {v}  {k}")
    return results


async def main():
    async with async_playwright() as pw:
        await run(pw)


if __name__ == "__main__":
    asyncio.run(main())
