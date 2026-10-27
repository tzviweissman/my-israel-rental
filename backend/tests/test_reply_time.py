from utils.reply_time import reply_hours

O = "owner"


def m(sender, minutes, prop="p1", other="r1", auto=False):
    h, mi = divmod(minutes, 60)
    return {"sender_id": sender, "receiver_id": other if sender == O else O, "property_id": prop,
            "created_at": f"2026-10-01T{h:02d}:{mi:02d}:00+00:00", "auto": auto}


def test_median_rounded_up_and_away_replies_ignored():
    msgs = [m("r1", 0), m(O, 1, auto=True), m(O, 30),            # 0.5h (auto reply not counted)
            m("r2", 60, other="r2"), m(O, 150, other="r2"),      # 1.5h
            m("r3", 200, other="r3"), m("r3", 210, other="r3"), m(O, 380, other="r3")]  # 3h from first
    assert reply_hours(O, msgs) == 2  # median 1.5h -> 2


def test_needs_three_replies():
    assert reply_hours(O, [m("r1", 0), m(O, 10), m("r2", 20, other="r2"), m(O, 30, other="r2")]) is None
