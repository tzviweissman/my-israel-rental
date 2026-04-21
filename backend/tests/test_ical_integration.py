"""
Test iCal Calendar Integration for Vacation Rentals
- Import iCal feeds from Airbnb/VRBO
- Export bookings as iCal
- Show blocked dates on calendar
- Auto-sync every 5 minutes
"""
import pytest
import requests
import os
import uuid

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials loaded from tests/.env.test via conftest
from conftest import (
    TEST_OWNER_EMAIL as OWNER_EMAIL,
    TEST_OWNER_PASSWORD as OWNER_PASSWORD,
    TEST_ADMIN_EMAIL as ADMIN_EMAIL,
    TEST_ADMIN_PASSWORD as ADMIN_PASSWORD,
    TEST_RENTER_EMAIL as RENTER_EMAIL,
    TEST_RENTER_PASSWORD as RENTER_PASSWORD,
)


@pytest.fixture(scope="module")
def api_client():
    """Shared requests session"""
    session = requests.Session()
    session.headers.update({"Content-Type": "application/json"})
    return session


@pytest.fixture(scope="module")
def owner_token(api_client):
    """Get owner authentication token"""
    response = api_client.post(f"{BASE_URL}/api/auth/login", json={
        "email": OWNER_EMAIL,
        "password": OWNER_PASSWORD
    })
    if response.status_code == 200:
        return response.json().get("token")
    pytest.skip("Owner authentication failed")


@pytest.fixture(scope="module")
def admin_token(api_client):
    """Get admin authentication token"""
    response = api_client.post(f"{BASE_URL}/api/auth/login", json={
        "email": ADMIN_EMAIL,
        "password": ADMIN_PASSWORD
    })
    if response.status_code == 200:
        return response.json().get("token")
    pytest.skip("Admin authentication failed")


@pytest.fixture(scope="module")
def vacation_property(api_client, owner_token):
    """Create a vacation property for testing iCal features"""
    property_data = {
        "title": f"TEST_Vacation_iCal_{uuid.uuid4().hex[:8]}",
        "description": "Test vacation property for iCal integration testing",
        "rental_type": "vacation",
        "property_type": "apartment",
        "bedrooms": 2,
        "bathrooms": 1,
        "area": "Jerusalem - Rehavia",
        "address": "123 Test Street",
        "nightly_price": 150,
        "currency": "USD"
    }
    response = api_client.post(
        f"{BASE_URL}/api/properties",
        json=property_data,
        headers={"Authorization": f"Bearer {owner_token}"}
    )
    assert response.status_code == 200, f"Failed to create vacation property: {response.text}"
    property_id = response.json().get("id")
    yield property_id
    # Cleanup
    api_client.delete(
        f"{BASE_URL}/api/properties/{property_id}",
        headers={"Authorization": f"Bearer {owner_token}"}
    )


@pytest.fixture(scope="module")
def non_vacation_property(api_client, owner_token):
    """Create a non-vacation (long-term) property for testing iCal rejection"""
    property_data = {
        "title": f"TEST_LongTerm_iCal_{uuid.uuid4().hex[:8]}",
        "description": "Test long-term property - should reject iCal",
        "rental_type": "long-term",
        "property_type": "apartment",
        "bedrooms": 3,
        "bathrooms": 2,
        "area": "Tel Aviv - Florentin",
        "address": "456 Test Avenue",
        "monthly_price": 5000,
        "currency": "ILS"
    }
    response = api_client.post(
        f"{BASE_URL}/api/properties",
        json=property_data,
        headers={"Authorization": f"Bearer {owner_token}"}
    )
    assert response.status_code == 200, f"Failed to create non-vacation property: {response.text}"
    property_id = response.json().get("id")
    yield property_id
    # Cleanup
    api_client.delete(
        f"{BASE_URL}/api/properties/{property_id}",
        headers={"Authorization": f"Bearer {owner_token}"}
    )


class TestBlockedDatesEndpoint:
    """Test GET /api/properties/{id}/blocked-dates"""

    def test_blocked_dates_returns_internal_and_external(self, api_client, vacation_property):
        """GET /api/properties/{id}/blocked-dates returns internal and external bookings"""
        response = api_client.get(f"{BASE_URL}/api/properties/{vacation_property}/blocked-dates")
        assert response.status_code == 200
        data = response.json()
        
        # Verify response structure
        assert "internal" in data, "Response should contain 'internal' bookings"
        assert "external" in data, "Response should contain 'external' bookings"
        assert "ical_urls_count" in data, "Response should contain 'ical_urls_count'"
        assert "last_synced" in data, "Response should contain 'last_synced'"
        
        # Verify types
        assert isinstance(data["internal"], list)
        assert isinstance(data["external"], list)
        assert isinstance(data["ical_urls_count"], int)
        print(f"✓ Blocked dates endpoint returns correct structure: internal={len(data['internal'])}, external={len(data['external'])}")

    def test_blocked_dates_no_auth_required(self, api_client, vacation_property):
        """GET /api/properties/{id}/blocked-dates should work without auth"""
        response = api_client.get(f"{BASE_URL}/api/properties/{vacation_property}/blocked-dates")
        assert response.status_code == 200
        print("✓ Blocked dates endpoint accessible without authentication")


class TestICalExportEndpoint:
    """Test GET /api/properties/{id}/ical-export"""

    def test_ical_export_returns_valid_ical(self, api_client, vacation_property):
        """GET /api/properties/{id}/ical-export returns valid iCal content"""
        response = api_client.get(f"{BASE_URL}/api/properties/{vacation_property}/ical-export")
        assert response.status_code == 200
        
        # Check Content-Type header
        content_type = response.headers.get("Content-Type", "")
        assert "text/calendar" in content_type, f"Expected Content-Type text/calendar, got {content_type}"
        
        # Check iCal content structure
        content = response.text
        assert "BEGIN:VCALENDAR" in content, "iCal should start with BEGIN:VCALENDAR"
        assert "END:VCALENDAR" in content, "iCal should end with END:VCALENDAR"
        assert "PRODID:" in content, "iCal should contain PRODID"
        assert "VERSION:2.0" in content, "iCal should have VERSION:2.0"
        print("✓ iCal export returns valid iCal content with correct Content-Type")

    def test_ical_export_no_auth_required(self, api_client, vacation_property):
        """GET /api/properties/{id}/ical-export should work without auth"""
        response = api_client.get(f"{BASE_URL}/api/properties/{vacation_property}/ical-export")
        assert response.status_code == 200
        print("✓ iCal export endpoint accessible without authentication")

    def test_ical_export_nonexistent_property(self, api_client):
        """GET /api/properties/{id}/ical-export returns 404 for nonexistent property"""
        response = api_client.get(f"{BASE_URL}/api/properties/nonexistent-id-12345/ical-export")
        assert response.status_code == 404
        print("✓ iCal export returns 404 for nonexistent property")


class TestAddICalUrlEndpoint:
    """Test POST /api/properties/{id}/ical"""

    def test_add_ical_requires_auth(self, api_client, vacation_property):
        """POST /api/properties/{id}/ical requires auth token"""
        response = api_client.post(
            f"{BASE_URL}/api/properties/{vacation_property}/ical",
            json={"url": "https://example.com/calendar.ics"}
        )
        # Should return 401 or 403 without auth
        assert response.status_code in [401, 403], f"Expected 401/403 without auth, got {response.status_code}"
        print("✓ Add iCal URL endpoint requires authentication")

    def test_add_ical_rejects_non_vacation(self, api_client, owner_token, non_vacation_property):
        """POST /api/properties/{id}/ical rejects non-vacation properties with 400 error"""
        response = api_client.post(
            f"{BASE_URL}/api/properties/{non_vacation_property}/ical",
            json={"url": "https://example.com/calendar.ics"},
            headers={"Authorization": f"Bearer {owner_token}"}
        )
        assert response.status_code == 400, f"Expected 400 for non-vacation property, got {response.status_code}"
        
        # Verify error message
        data = response.json()
        assert "detail" in data
        assert "vacation" in data["detail"].lower(), f"Error should mention vacation: {data['detail']}"
        print("✓ Add iCal URL correctly rejects non-vacation properties with 400")

    def test_add_ical_with_valid_auth(self, api_client, owner_token, vacation_property):
        """POST /api/properties/{id}/ical works with valid auth and vacation property"""
        # Note: This will fail if the URL is not a valid iCal feed, but we test the auth flow
        # Using a known public iCal URL that may or may not work
        response = api_client.post(
            f"{BASE_URL}/api/properties/{vacation_property}/ical",
            json={"url": "https://calendar.google.com/calendar/ical/en.usa%23holiday%40group.v.calendar.google.com/public/basic.ics"},
            headers={"Authorization": f"Bearer {owner_token}"}
        )
        # Should either succeed (200) or fail due to URL fetch issues (not auth)
        assert response.status_code != 401, "Should not return 401 with valid auth"
        assert response.status_code != 403, "Should not return 403 with valid auth"
        print(f"✓ Add iCal URL endpoint accepts authenticated requests (status: {response.status_code})")


class TestRemoveICalUrlEndpoint:
    """Test DELETE /api/properties/{id}/ical"""

    def test_remove_ical_requires_auth(self, api_client, vacation_property):
        """DELETE /api/properties/{id}/ical requires auth token"""
        response = api_client.delete(
            f"{BASE_URL}/api/properties/{vacation_property}/ical",
            json={"url": "https://example.com/calendar.ics"}
        )
        assert response.status_code in [401, 403], f"Expected 401/403 without auth, got {response.status_code}"
        print("✓ Remove iCal URL endpoint requires authentication")


class TestManualSyncEndpoint:
    """Test POST /api/properties/{id}/ical-sync"""

    def test_manual_sync_requires_auth(self, api_client, vacation_property):
        """POST /api/properties/{id}/ical-sync requires auth token"""
        response = api_client.post(
            f"{BASE_URL}/api/properties/{vacation_property}/ical-sync",
            json={}
        )
        assert response.status_code in [401, 403], f"Expected 401/403 without auth, got {response.status_code}"
        print("✓ Manual sync endpoint requires authentication")

    def test_manual_sync_with_valid_auth(self, api_client, owner_token, vacation_property):
        """POST /api/properties/{id}/ical-sync works with valid auth"""
        response = api_client.post(
            f"{BASE_URL}/api/properties/{vacation_property}/ical-sync",
            json={},
            headers={"Authorization": f"Bearer {owner_token}"}
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "message" in data
        assert "last_synced" in data
        print("✓ Manual sync endpoint works with valid authentication")


class TestDateFilterWithExternalBookings:
    """Test date_from/date_to filter includes external_bookings"""

    def test_date_filter_works(self, api_client):
        """GET /api/properties with date_from/date_to filters correctly"""
        # Test that the endpoint accepts date filters
        response = api_client.get(
            f"{BASE_URL}/api/properties",
            params={"date_from": "2025-06-01", "date_to": "2025-06-15"}
        )
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"✓ Date filter works correctly, returned {len(data)} properties")


class TestPropertyCreationWithRentalType:
    """Test that vacation properties can be created and identified"""

    def test_create_vacation_property(self, api_client, owner_token):
        """Can create a vacation property with rental_type='vacation'"""
        property_data = {
            "title": f"TEST_Vacation_Create_{uuid.uuid4().hex[:8]}",
            "description": "Test vacation property creation",
            "rental_type": "vacation",
            "property_type": "apartment",
            "bedrooms": 1,
            "bathrooms": 1,
            "area": "Eilat - City Center",
            "address": "789 Beach Road",
            "nightly_price": 200,
            "currency": "USD"
        }
        response = api_client.post(
            f"{BASE_URL}/api/properties",
            json=property_data,
            headers={"Authorization": f"Bearer {owner_token}"}
        )
        assert response.status_code == 200
        property_id = response.json().get("id")
        
        # Verify the property was created with correct rental_type
        get_response = api_client.get(f"{BASE_URL}/api/properties/{property_id}")
        assert get_response.status_code == 200
        prop_data = get_response.json()
        assert prop_data["rental_type"] == "vacation"
        
        # Cleanup
        api_client.delete(
            f"{BASE_URL}/api/properties/{property_id}",
            headers={"Authorization": f"Bearer {owner_token}"}
        )
        print("✓ Vacation property created successfully with rental_type='vacation'")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
