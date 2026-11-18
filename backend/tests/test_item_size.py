from routes.short_links import _item_size


def test_item_size_from_serves_or_description():
    assert _item_size({"serves": 6}) == "Feeds 6"
    assert _item_size({"description": "Feeds 8 to 10. 5 types of chicken and 4 sauces."}) == "Feeds 8 to 10"
    assert _item_size({"description": "Serves 4 hungry people"}) == "Serves 4 hungry people"
    assert _item_size({"description": "מגש מספיק ל-10 אנשים. טעים"}) == "מגש מספיק ל-10 אנשים"
    assert _item_size({"description": "Crispy and golden"}) == ""
