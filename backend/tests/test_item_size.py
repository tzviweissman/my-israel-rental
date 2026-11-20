from routes.short_links import _item_size


def test_item_size_from_serves_or_description():
    assert _item_size({"serves": 6}) == "Feeds 6"
    assert _item_size({"description": "Feeds 8 to 10. 5 types of chicken and 4 sauces."}) == "Feeds 8 to 10"
    assert _item_size({"description": "Serves 4 hungry people"}) == "Serves 4 hungry people"
    assert _item_size({"description": "מגש מספיק ל-10 אנשים. טעים"}) == "מגש מספיק ל-10 אנשים"
    assert _item_size({"description": "Crispy and golden"}) == ""


def test_item_size_ignores_unrelated_sentences():
    # Code review 19 Nov 2026: any sentence with מנות, and a price's decimal point read as a full stop.
    assert _item_size({"description": "קוגל ירושלמי ביתי. כל המנות מוכנות טריות כל בוקר"}) == ""
    assert _item_size({"description": "Price 4.50 serves 2"}) == "Price 4.50 serves 2"
    assert _item_size({"description": "מגש גדול. 4 מנות לשולחן"}) == "4 מנות לשולחן"
