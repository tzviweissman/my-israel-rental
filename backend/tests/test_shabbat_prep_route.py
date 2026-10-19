"""Closed for Shabbat and holidays (shabbat.py), order limits (orders.py),
the prep list and the delivery route (prep_route.py). Local dev only."""
import datetime as dt
import os
import sys
import uuid
from pathlib import Path
from zoneinfo import ZoneInfo

import pytest
import requests
from dotenv import load_dotenv

load_dotenv(Path(__file__).resolve().parents[1] / ".env")
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from pymongo import MongoClient  # noqa: E402

API = os.environ.get("TEST_API", "http://localhost:8001/api")
LOCAL = any(h in os.environ.get("MONGO_URL", "") for h in ("localhost", "127.0.0.1"))
IL = ZoneInfo("Asia/Jerusalem")
M = "_spr_test"


# ---------------------------------------------------------------- pure

def test_closures_follow_shabbat_and_the_autumn_holidays_in_jerusalem():
    from routes.marketplace.shabbat import closures
    rows = closures({"shabbat_closing": True, "areas": ["jerusalem"]}, days=40, today=dt.date(2026, 9, 10))
    got = [(a.strftime("%a %d %H:%M"), b.strftime("%a %d %H:%M"), k) for a, b, k in rows]
    assert got[0] == ("Fri 11 18:13", "Sun 13 19:27", "holiday")      # Rosh Hashanah after Shabbat
    assert ("Sun 20 18:01", "Mon 21 19:16", "holiday") in got          # Yom Kippur
    assert ("Fri 18 18:04", "Sat 19 19:18", "shabbat") in got
    assert closures({"areas": ["jerusalem"]}) == []                     # not switched on


def test_tel_aviv_lights_later_than_jerusalem():
    from routes.marketplace.shabbat import closures
    j = closures({"shabbat_closing": True, "areas": ["jerusalem"]}, days=7, today=dt.date(2026, 10, 20))[0][0]
    t = closures({"shabbat_closing": True, "areas": ["tel-aviv"]}, days=7, today=dt.date(2026, 10, 20))[0][0]
    assert t > j


def test_route_orders_by_time_then_nearest_and_keeps_unfound_stops():
    from routes.marketplace.prep_route import google_routes, order_stops
    jlm = (31.78, 35.22)
    stops = [
        {"id": "far", "time": "10:00", "geo": {"lat": 31.70, "lng": 35.20}},
        {"id": "near", "time": "10:00", "geo": {"lat": 31.785, "lng": 35.22}},
        {"id": "early", "time": "09:00", "geo": {"lat": 31.60, "lng": 35.10}},
        {"id": "lost", "time": "10:00", "geo": None, "address": "Nowhere 1"},
    ]
    # 09:00 first; then from there, the nearer of the 10:00 stops; unfound last.
    assert [s["id"] for s in order_stops(stops, jlm)] == ["early", "far", "near", "lost"]
    many = [{"geo": {"lat": 31 + i / 100, "lng": 35}} for i in range(23)]
    assert len(google_routes(many)) == 3


# ---------------------------------------------------------------- live

def _up():
    try:
        return requests.get(f"{API}/health", timeout=3).ok
    except requests.RequestException:
        return False


live = pytest.mark.skipif(not (LOCAL and _up()), reason="needs the local API and the local MongoDB")


def _db():
    return MongoClient(os.environ["MONGO_URL"])[os.environ["DB_NAME"]]


def _next(weekday: int) -> dt.date:
    d = dt.datetime.now(IL).date() + dt.timedelta(days=1)
    while d.weekday() != weekday:
        d += dt.timedelta(days=1)
    return d


@pytest.fixture(scope="module")
def shop():
    stamp = uuid.uuid4().hex[:10]
    r = requests.post(f"{API}/auth/register", json={"email": f"spr-{stamp}@example.com", "password": f"Pw-{stamp}-ok1",
                                                   "name": "Bakery owner", "role": "owner"}, timeout=30)
    h = {"Authorization": f"Bearer {r.json()['token']}"}
    b = requests.post(f"{API}/marketplace/businesses", json={"name": f"TEST_spr {stamp}"}, headers=h, timeout=30).json()
    requests.patch(f"{API}/marketplace/businesses/{b['id']}", json={"areas": ["jerusalem"], "shabbat_closing": True}, headers=h, timeout=30)
    store = f"{M}-store-{stamp}"
    _db().marketplace_gigs.insert_one({"_id": store, "marker": M, "business_id": b["id"], "gig_type": "store", "status": "published",
                                       "title": "Bakery", "products": [{"id": "challah", "name": "Challah", "price": 18},
                                                                       {"id": "cake", "name": "Honey cake", "price": 60}]})
    yield {"h": h, "biz": b["id"], "store": store}
    db = _db()
    db.marketplace_gigs.delete_many({"marker": M})
    db.store_orders.delete_many({"business_id": b["id"]})
    db.businesses.delete_one({"_id": b["id"]})


def _order(shop, day, qty=1, product="challah", window=None, phone="054-1234567"):
    return requests.post(f"{API}/marketplace/order-form/{shop['store']}/orders", timeout=30, json={
        "lines": [{"product_id": product, "qty": qty}], "fulfilment": "pickup", "date": day.isoformat(),
        "customer_name": "Dana", "customer_phone": phone, "lang": "en", **({"window": window} if window else {})})


@live
def test_order_form_lists_closures_and_refuses_shabbat(shop):
    form = requests.get(f"{API}/marketplace/order-form/{shop['store']}", timeout=30).json()
    sc = form["business"]["shabbat_closing"]
    assert sc["on"] and sc["closures"] and sc["closures"][0]["start"] < sc["closures"][0]["end"]
    r = _order(shop, _next(5))          # Saturday
    if sc["closed_now"]:
        assert r.status_code == 409 and "Closed for" in r.json()["detail"]
    else:
        assert r.status_code == 400 and "Shabbat" in r.json()["detail"]
    assert _order(shop, _next(3)).status_code in (200, 409)   # a Thursday is fine (409 only if closed right now)


@live
def test_a_full_day_is_refused_and_listed(shop):
    h, biz = shop["h"], shop["biz"]
    cur = requests.get(f"{API}/marketplace/businesses/{biz}/orders/settings", headers=h, timeout=30).json()
    body = {k: cur.get(k) for k in ("delivery_on", "cutoffs", "pickup_windows", "delivery_windows", "delivery_fee",
                                    "min_order", "free_over", "area_fees")}
    r = requests.put(f"{API}/marketplace/businesses/{biz}/orders/settings", headers=h, timeout=30,
                     json={**body, "area_fees": body["area_fees"] or {}, "max_per_day": 2})
    assert r.status_code == 200 and r.json()["max_per_day"] == 2
    day = _next(1)                       # a Tuesday
    first = _order(shop, day)
    if first.status_code == 409:
        pytest.skip("closed for Shabbat right now")
    assert first.status_code == 200 and _order(shop, day, phone="054-7654321").status_code == 200
    third = _order(shop, day, phone="054-1111111")
    assert third.status_code == 409 and "full" in third.json()["detail"]
    form = requests.get(f"{API}/marketplace/order-form/{shop['store']}", timeout=30).json()
    assert day.isoformat() in form["full"]["days"]


@live
def test_prep_list_adds_up_the_day(shop):
    h, biz = shop["h"], shop["biz"]
    day = _next(6)                       # a Sunday: no other test orders for it
    db = _db()
    for qty, product, name, time in ((3, "challah", "Challah", "09:00"), (2, "challah", "Challah", "11:00"), (1, "cake", "Honey cake", "11:00")):
        db.store_orders.insert_one({"_id": str(uuid.uuid4()), "business_id": biz, "status": "new", "source": "website",
                                    "needed_by": f"{day.isoformat()}T{time}", "window": {"start": time, "end": "12:00"},
                                    "lines": [{"product_id": product, "name": name, "price": 1, "qty": qty}]})
    db.store_orders.insert_one({"_id": str(uuid.uuid4()), "business_id": biz, "status": "new", "source": "manual",
                                "needed_by": day.isoformat(), "items": "2 kugel", "customer_name": "Rivka"})
    db.store_orders.insert_one({"_id": str(uuid.uuid4()), "business_id": biz, "status": "cancelled", "source": "website",
                                "needed_by": day.isoformat(), "lines": [{"name": "Challah", "qty": 50}]})
    p = requests.get(f"{API}/marketplace/businesses/{biz}/prep", params={"date": day.isoformat()}, headers=h, timeout=30).json()
    totals = {r["name"]: r["qty"] for r in p["totals"]}
    assert totals["Challah"] == 5 and totals["Honey cake"] == 1
    assert [g["time"] for g in p["by_time"]][:2] == ["09:00", "11:00"]
    assert p["typed"] and p["typed"][0]["items"] == "2 kugel"


@live
def test_route_uses_saved_places_and_gives_waze_links(shop):
    h, biz = shop["h"], shop["biz"]
    day = _next(2)
    db = _db()
    for name, lat, time in (("Far", 31.70, "10:00"), ("Near", 31.785, "10:00"), ("Early", 31.60, "09:00")):
        db.store_orders.insert_one({"_id": f"{M}-{name}-{uuid.uuid4().hex[:6]}", "business_id": biz, "status": "new",
                                    "fulfilment": "delivery", "customer_name": name, "address": f"{name} street 1",
                                    "needed_by": f"{day.isoformat()}T{time}", "window": {"start": time, "end": "12:00"},
                                    "geo": {"lat": lat, "lng": 35.22}})
    r = requests.get(f"{API}/marketplace/businesses/{biz}/route", params={"date": day.isoformat()}, headers=h, timeout=60).json()
    assert [s["customer_name"] for s in r["stops"]] == ["Early", "Far", "Near"]
    assert r["stops"][0]["waze"].startswith("https://waze.com/ul?ll=31.6,35.22")
    assert r["google"] and r["google"][0].startswith("https://www.google.com/maps/dir/")


@live
def test_appointments_cannot_be_booked_on_shabbat(shop):
    db = _db()
    appt = f"{M}-appt-{uuid.uuid4().hex[:6]}"
    db.marketplace_gigs.insert_one({"_id": appt, "marker": M, "business_id": shop["biz"], "gig_type": "appointment",
                                    "status": "published", "title": "Haircut", "slot_duration_minutes": 30})
    taken = requests.get(f"{API}/marketplace/gigs/{appt}/taken-slots", timeout=30).json()
    sat = _next(5).isoformat()
    assert "12:00" in str(taken.get(sat, taken))
