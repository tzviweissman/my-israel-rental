"""Tests for the auto-detect schema kind heuristic in admin_import."""
from routes.admin_import import _detect_schema_kind


def test_detect_property_from_rent_headers():
    headers = ["Title", "Neighborhood", "Beds", "Rent/month", "Owner Email"]
    assert _detect_schema_kind(headers) == "property"


def test_detect_property_from_address_size():
    headers = ["Property Name", "Address", "Floor", "Square Meters", "Nightly Price"]
    assert _detect_schema_kind(headers) == "property"


def test_detect_user_from_email_role_phone():
    headers = ["email", "name", "phone", "role"]
    assert _detect_schema_kind(headers) == "user"


def test_detect_user_from_email_role_minimal():
    headers = ["Email Address", "User Role"]
    assert _detect_schema_kind(headers) == "user"


def test_detect_user_email_name_phone_only():
    # No role column but no property hints either — should still be users
    headers = ["Email", "Full Name", "Phone Number"]
    assert _detect_schema_kind(headers) == "user"


def test_detect_property_wins_when_email_plus_property_signals():
    # Owner email column should NOT cause a property CSV to be classified
    # as a user import.
    headers = ["title", "area", "monthly_price", "owner_email", "phone"]
    assert _detect_schema_kind(headers) == "property"


def test_detect_defaults_to_property_on_empty_signal():
    headers = ["foo", "bar", "baz"]
    assert _detect_schema_kind(headers) == "property"


def test_detect_property_with_images_only():
    headers = ["Listing Name", "Photo URLs", "Bedrooms"]
    assert _detect_schema_kind(headers) == "property"
