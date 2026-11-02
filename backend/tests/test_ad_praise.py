"""The ad maker drops praise the owner's listing never used (routes/short_links.py)."""
from routes.short_links import _strip_praise


def test_unclaimed_praise_is_dropped():
    source = '{"title": "Sunny 3-room in Rehavia", "area": "Jerusalem"}'
    out = _strip_praise({
        "headline": "דירת 3 חדרים בשכונת רחביה היוקרתית",
        "points": ["3 חדרי שינה", "שכונת רחביה היוקרתית", "Central location"],
        "caption": "דירה ברחביה. הזדמנות במיקום מרכזי ומבוקש. צרו קשר.",
    }, source, "Sunny 3-room in Rehavia")
    assert out["headline"] == "Sunny 3-room in Rehavia"
    assert out["points"] == ["3 חדרי שינה"]
    assert out["caption"] == "דירה ברחביה. צרו קשר."


def test_praise_the_owner_wrote_stays():
    source = '{"description": "A quiet, renovated flat"}'
    out = _strip_praise({"headline": "Quiet renovated flat", "points": ["Quiet street"], "caption": "Quiet and renovated."},
                        source, "x")
    assert out == {"headline": "Quiet renovated flat", "points": ["Quiet street"], "caption": "Quiet and renovated."}
