"""A listing's hours and lengths as a browser really sends them (shared.py
clean_weekly / blank_to_none). A salon's Publish was refused 14 times on
25 Oct 2026 for a cleared time box and an emptied number box."""
from routes.marketplace.shared import GigIn, GigPatch


def test_blank_and_short_times_do_not_refuse_the_listing():
    g = GigIn(title="Salon", category="personal-care", gig_type="appointment",
              tiers=[{"name": "Cut", "price": 80, "duration_minutes": "", "delivery_days": ""}],
              weekly_availability={"sun": [{"start": "9:00", "end": "17:00:00"}], "mon": [{"start": "", "end": "17:00"}]},
              slot_duration_minutes="")
    assert (g.weekly_availability["sun"][0].start, g.weekly_availability["sun"][0].end) == ("09:00", "17:00")
    assert g.weekly_availability["mon"] == []
    assert g.slot_duration_minutes == 30 and g.tiers[0].duration_minutes is None
    p = GigPatch(weekly_availability={"wed": [{"start": "08:30", "end": ""}]}, slot_duration_minutes="")
    assert p.weekly_availability["wed"] == [] and p.slot_duration_minutes is None
