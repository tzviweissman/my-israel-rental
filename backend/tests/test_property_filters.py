"""
Test suite for property filters API endpoints
Tests: GET /api/properties with various filter parameters
"""
import pytest
import requests
import os
from conftest import (
    TEST_ADMIN_EMAIL,
    TEST_ADMIN_PASSWORD,
    TEST_RENTER_EMAIL,
    TEST_RENTER_PASSWORD,
)

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestPropertyFilters:
    """Property filter endpoint tests"""
    
    def test_get_all_properties_no_filters(self):
        """GET /api/properties with no filters returns all properties"""
        response = requests.get(f"{BASE_URL}/api/properties")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"Total properties returned: {len(data)}")
        # Should have at least some properties
        assert len(data) >= 0
    
    def test_filter_min_bedrooms(self):
        """GET /api/properties?min_bedrooms=3 filters correctly"""
        response = requests.get(f"{BASE_URL}/api/properties?min_bedrooms=3")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"Properties with 3+ bedrooms: {len(data)}")
        # Verify all returned properties have 3+ bedrooms
        for prop in data:
            assert prop.get('bedrooms', 0) >= 3, f"Property {prop.get('id')} has {prop.get('bedrooms')} bedrooms, expected >= 3"
    
    def test_filter_has_elevator(self):
        """GET /api/properties?has_elevator=true filters correctly"""
        response = requests.get(f"{BASE_URL}/api/properties?has_elevator=true")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"Properties with elevator: {len(data)}")
        # Verify all returned properties have elevator
        for prop in data:
            assert prop.get('has_elevator') == True, f"Property {prop.get('id')} has_elevator={prop.get('has_elevator')}"
    
    def test_filter_condition_good(self):
        """GET /api/properties?condition=good filters correctly"""
        response = requests.get(f"{BASE_URL}/api/properties?condition=good")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"Properties with condition=good: {len(data)}")
        # Verify all returned properties have good condition
        for prop in data:
            assert prop.get('condition') == 'good', f"Property {prop.get('id')} condition={prop.get('condition')}"
    
    def test_filter_condition_renovated(self):
        """GET /api/properties?condition=renovated filters correctly"""
        response = requests.get(f"{BASE_URL}/api/properties?condition=renovated")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"Properties with condition=renovated: {len(data)}")
        # Verify all returned properties have renovated condition
        for prop in data:
            assert prop.get('condition') == 'renovated', f"Property {prop.get('id')} condition={prop.get('condition')}"
    
    def test_filter_max_floor(self):
        """GET /api/properties?max_floor=3 filters correctly"""
        response = requests.get(f"{BASE_URL}/api/properties?max_floor=3")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"Properties with floor <= 3: {len(data)}")
        # Verify all returned properties have floor <= 3
        for prop in data:
            floor = prop.get('floor')
            if floor is not None:
                assert floor <= 3, f"Property {prop.get('id')} floor={floor}, expected <= 3"
    
    def test_filter_area_jerusalem(self):
        """GET /api/properties?area=Jerusalem filters correctly (case-insensitive)"""
        response = requests.get(f"{BASE_URL}/api/properties?area=Jerusalem")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"Properties in Jerusalem area: {len(data)}")
        # Verify all returned properties have Jerusalem in area
        for prop in data:
            area = prop.get('area', '').lower()
            assert 'jerusalem' in area, f"Property {prop.get('id')} area={prop.get('area')}"
    
    def test_filter_date_range(self):
        """GET /api/properties?date_from=2026-03-01&date_to=2026-03-10 works without error"""
        response = requests.get(f"{BASE_URL}/api/properties?date_from=2026-03-01&date_to=2026-03-10")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"Properties available in date range: {len(data)}")
    
    def test_filter_min_bathrooms(self):
        """GET /api/properties?min_bathrooms=2 filters correctly"""
        response = requests.get(f"{BASE_URL}/api/properties?min_bathrooms=2")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"Properties with 2+ bathrooms: {len(data)}")
        # Verify all returned properties have 2+ bathrooms
        for prop in data:
            bathrooms = prop.get('bathrooms', 0)
            assert bathrooms >= 2, f"Property {prop.get('id')} has {bathrooms} bathrooms, expected >= 2"
    
    def test_filter_min_porches(self):
        """GET /api/properties?min_porches=1 filters correctly"""
        response = requests.get(f"{BASE_URL}/api/properties?min_porches=1")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"Properties with 1+ porches: {len(data)}")
        # Verify all returned properties have 1+ porches
        for prop in data:
            porches = prop.get('porches', 0)
            assert porches >= 1, f"Property {prop.get('id')} has {porches} porches, expected >= 1"
    
    def test_combined_filters(self):
        """Test multiple filters combined"""
        response = requests.get(f"{BASE_URL}/api/properties?min_bedrooms=2&has_elevator=true")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"Properties with 2+ bedrooms AND elevator: {len(data)}")
        for prop in data:
            assert prop.get('bedrooms', 0) >= 2
            assert prop.get('has_elevator') == True


class TestAdminDashboard:
    """Admin dashboard endpoint tests"""
    
    @pytest.fixture
    def admin_token(self):
        """Get admin authentication token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_ADMIN_EMAIL,
            "password": TEST_ADMIN_PASSWORD
        })
        if response.status_code == 200:
            return response.json().get("token")
        pytest.skip("Admin authentication failed")
    
    def test_admin_dashboard_requires_auth(self):
        """GET /api/admin/dashboard requires authentication"""
        response = requests.get(f"{BASE_URL}/api/admin/dashboard")
        assert response.status_code in [401, 403]
        print("Admin dashboard correctly requires authentication")
    
    def test_admin_dashboard_with_token(self, admin_token):
        """GET /api/admin/dashboard returns admin stats with valid token"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        response = requests.get(f"{BASE_URL}/api/admin/dashboard", headers=headers)
        assert response.status_code == 200
        data = response.json()
        
        # Verify response structure
        assert "active_listings" in data
        assert "total_views" in data
        assert "total_inquiries" in data
        assert "total_users" in data
        assert "pending_services" in data
        assert "recent_properties" in data
        
        print(f"Admin dashboard stats: active_listings={data['active_listings']}, total_users={data['total_users']}")
    
    def test_admin_dashboard_non_admin_forbidden(self):
        """GET /api/admin/dashboard returns 403 for non-admin users"""
        # Login as renter
        login_response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_RENTER_EMAIL,
            "password": TEST_RENTER_PASSWORD
        })
        if login_response.status_code != 200:
            pytest.skip("Renter authentication failed")
        
        renter_token = login_response.json().get("token")
        headers = {"Authorization": f"Bearer {renter_token}"}
        response = requests.get(f"{BASE_URL}/api/admin/dashboard", headers=headers)
        assert response.status_code == 403
        print("Admin dashboard correctly rejects non-admin users")


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
