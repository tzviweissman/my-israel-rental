"""The rating badge picture (routes/marketplace/rating_badge.py)."""
from routes.marketplace.rating_badge import badge_svg


def test_with_average_shows_stars_and_count():
    s = badge_svg(4.8, 23, "en", "light")
    assert "4.8" in s and "23 reviews on MyIsraelRental" in s and "clipPath" in s


def test_under_three_reviews_has_no_average():
    s = badge_svg(None, 2, "en", "dark")
    assert "2 reviews on" in s and "clipPath" not in s
    assert "1 review on" in badge_svg(None, 1)
    assert "Find us on" in badge_svg(None, 0)


def test_hebrew_is_embedded_right_to_left():
    s = badge_svg(4.2, 9, "he")
    assert "‫9 ביקורות ב-MyIsraelRental‬" in s
    assert "ביקורת אחת" in badge_svg(None, 1, "he")
