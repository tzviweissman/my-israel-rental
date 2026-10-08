"""How a restaurant's own words are read for its hechsher.

    .venv/Scripts/python -m pytest -q tests/test_kosher_websites.py
"""
from scripts.check_kosher_websites import classify, clean_phone, contact_from, page_text, tidy_contact


def test_real_phone_formats_survive():
    for raw, want in [("02-6223761", "02-6223761"), ("026330646", "026330646"), ("1-700-50-60-70", "1-700-50-60-70"),
                      ("+972-52-481-2450", "+972-52-481-2450"), ("‎0776091780", "0776091780"),
                      ("%2002-6244808", "02-6244808"), ("*2994", "*2994"), ("+972 2 633 0646", "+972 2 633 0646"),
                      ("12345", None), ("", None)]:
        assert clean_phone(raw) == want, raw


def test_tidy_drops_directory_details_and_bad_numbers():
    c = tidy_contact({"website": "https://www.b144.co.il/x", "name_en": "B144", "phone": "03-1234567", "whatsapp": None})
    assert c["website"] is None and c["phone"] is None and "directory site, not their own" in c["needs_review"]
    c = tidy_contact({"website": "https://a.co.il", "name_en": "Bakery", "name_he": None,
                      "phone": "%2002-6244808", "whatsapp": "9720505357811"})
    assert c["phone"] == "02-6244808" and c["whatsapp"] == "972505357811"
    assert c["name_en"] is None and c["needs_review"] == ["no name from their site"]
    assert tidy_contact({"website": "https://a.co.il", "name_en": "A", "phone": None, "whatsapp": "9725400000"})["whatsapp"] is None


def test_contact_from_their_home_page():
    raw = ('<html><head><title>Home | Pizza Hallel | פיצה הלל</title></head><body>'
           '<a href="tel:02-6234567">Call</a> <a href="https://wa.me/972501234567">WhatsApp</a></body></html>')
    c = contact_from(raw, "https://pizzahallel.co.il/")
    assert c == {"website": "https://pizzahallel.co.il/", "name_en": "Pizza Hallel", "name_he": "פיצה הלל",
                 "phone": "02-6234567", "whatsapp": "972501234567"}


def test_contact_phone_from_text_when_no_tel_link():
    c = contact_from("<title>Cafe</title><p>הזמנות: 054-123-4567</p>", "https://x.co.il")
    assert c["phone"] == "054-123-4567" and c["whatsapp"] is None


def test_named_certifier_counts():
    v, cert, _, _ = classify(["Pizza Hallel", "כשר למהדרין בהשגחת הרבנות ירושלים"])
    assert v == "certified" and cert == "Rabbanut, Mehadrin"


def test_badatz_in_the_name_counts():
    v, cert, _, _ = classify(['ברדק פיצה בר – כשר למהדרין בד"ץ חתם סופר'])
    assert v == "certified" and cert == "Badatz Chatam Sofer"


def test_kosher_without_a_certifier_is_doubtful():
    assert classify(["piece and love pizza kosher"])[0] == "kosher_unnamed"


def test_not_kosher_wins():
    assert classify(["Great food. Note: we are not kosher. Rabbanut nearby"])[0] == "says_not_kosher"


def test_certifier_far_from_kosher_does_not_count():
    # A street called Rubin, nowhere near the word kosher.
    text = "Visit us at 4 Rubin Street. " + "x " * 200 + "Ask about our kosher options."
    assert classify([text])[0] == "kosher_unnamed"


def test_nothing_is_no_evidence_and_dairy_is_read():
    assert classify(["Cafe Bastet", ""])[0] == "no_evidence"
    assert classify(["מסעדה חלבית כשרה בהשגחת בד\"ץ העדה החרדית חלבי"])[1:3] == ("Badatz Eida HaChareidit", "dairy")


def test_certificate_image_name_is_read():
    raw = '<img src="/img/teudat-kashrut-rabbanut.jpg" alt="kosher certificate"><script>kosher rubin</script>'
    t = page_text(raw)
    assert "rabbanut" in t and "rubin" not in t
    assert classify([t])[0] == "certified"


def test_lunch_is_not_tzohar():
    assert classify(["ארוחות צהריים כשר"])[0] == "kosher_unnamed"
    assert classify(["כשר בהשגחת צהר"])[1] == "Tzohar"
