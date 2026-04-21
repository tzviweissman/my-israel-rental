"""
Test: Description and Address fields are now optional when creating properties
Feature: POST /api/properties should accept properties without description and address
"""
import pytest
import requests
import os
from conftest import TEST_OWNER_EMAIL, TEST_OWNER_PASSWORD

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestOptionalPropertyFields:
    """Test that description and address fields are optional for property creation"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup: Login as owner and get token"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
        # Login as owner
        login_response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_OWNER_EMAIL,
            "password": TEST_OWNER_PASSWORD
        })
        
        if login_response.status_code != 200:
            pytest.skip("Could not login as owner - skipping tests")
        
        self.token = login_response.json().get("token")
        self.session.headers.update({"Authorization": f"Bearer {self.token}"})
        self.created_property_ids = []
        
        yield
        
        # Cleanup: Delete test properties
        for prop_id in self.created_property_ids:
            try:
                self.session.delete(f"{BASE_URL}/api/properties/{prop_id}")
            except:
                pass
    
    def test_create_property_without_description_and_address(self):
        """Test: Create property WITHOUT description and address fields"""
        payload = {
            "title": "TEST_Property_No_Desc_No_Addr",
            "rental_type": "long-term",
            "property_type": "apartment",
            "area": "Jerusalem - Rehavia",
            "monthly_price": 5000,
            "currency": "ILS"
            # NOTE: description and address are intentionally omitted
        }
        
        response = self.session.post(f"{BASE_URL}/api/properties", json=payload)
        
        # Should succeed with 200 status
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "id" in data, "Response should contain property id"
        assert data.get("message") == "Property created successfully"
        
        self.created_property_ids.append(data["id"])
        
        # Verify property was created by fetching it
        get_response = self.session.get(f"{BASE_URL}/api/properties/{data['id']}")
        assert get_response.status_code == 200
        
        property_data = get_response.json()
        assert property_data["title"] == "TEST_Property_No_Desc_No_Addr"
        # description and address should be None or empty
        assert property_data.get("description") is None or property_data.get("description") == ""
        assert property_data.get("address") is None or property_data.get("address") == ""
        
        print("PASS: Property created successfully without description and address")
    
    def test_create_property_with_description_only(self):
        """Test: Create property WITH description but WITHOUT address"""
        payload = {
            "title": "TEST_Property_With_Desc_Only",
            "description": "This is a test property with description",
            "rental_type": "long-term",
            "property_type": "apartment",
            "area": "Tel Aviv - Florentin",
            "monthly_price": 6000,
            "currency": "ILS"
            # NOTE: address is intentionally omitted
        }
        
        response = self.session.post(f"{BASE_URL}/api/properties", json=payload)
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        self.created_property_ids.append(data["id"])
        
        # Verify
        get_response = self.session.get(f"{BASE_URL}/api/properties/{data['id']}")
        property_data = get_response.json()
        assert property_data["description"] == "This is a test property with description"
        assert property_data.get("address") is None or property_data.get("address") == ""
        
        print("PASS: Property created successfully with description only (no address)")
    
    def test_create_property_with_address_only(self):
        """Test: Create property WITH address but WITHOUT description"""
        payload = {
            "title": "TEST_Property_With_Addr_Only",
            "address": "123 Test Street, Jerusalem",
            "rental_type": "long-term",
            "property_type": "apartment",
            "area": "Jerusalem - Baka",
            "monthly_price": 7000,
            "currency": "ILS"
            # NOTE: description is intentionally omitted
        }
        
        response = self.session.post(f"{BASE_URL}/api/properties", json=payload)
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        self.created_property_ids.append(data["id"])
        
        # Verify
        get_response = self.session.get(f"{BASE_URL}/api/properties/{data['id']}")
        property_data = get_response.json()
        assert property_data.get("description") is None or property_data.get("description") == ""
        assert property_data["address"] == "123 Test Street, Jerusalem"
        
        print("PASS: Property created successfully with address only (no description)")
    
    def test_create_property_with_both_description_and_address(self):
        """Test: Create property WITH both description and address (original behavior)"""
        payload = {
            "title": "TEST_Property_With_Both",
            "description": "Full description for this property",
            "address": "456 Full Address Street, Tel Aviv",
            "rental_type": "vacation",
            "property_type": "house",
            "area": "Tel Aviv - Neve Tzedek",
            "nightly_price": 500,
            "currency": "USD"
        }
        
        response = self.session.post(f"{BASE_URL}/api/properties", json=payload)
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        self.created_property_ids.append(data["id"])
        
        # Verify
        get_response = self.session.get(f"{BASE_URL}/api/properties/{data['id']}")
        property_data = get_response.json()
        assert property_data["description"] == "Full description for this property"
        assert property_data["address"] == "456 Full Address Street, Tel Aviv"
        
        print("PASS: Property created successfully with both description and address")
    
    def test_create_property_with_empty_strings(self):
        """Test: Create property with empty strings for description and address"""
        payload = {
            "title": "TEST_Property_Empty_Strings",
            "description": "",
            "address": "",
            "rental_type": "short-term",
            "property_type": "apartment",
            "area": "Haifa - Carmel Center",
            "monthly_price": 4000,
            "currency": "ILS"
        }
        
        response = self.session.post(f"{BASE_URL}/api/properties", json=payload)
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        self.created_property_ids.append(data["id"])
        
        print("PASS: Property created successfully with empty strings for description and address")
    
    def test_update_property_without_description_and_address(self):
        """Test: Update existing property without description and address"""
        # First create a property with description and address
        create_payload = {
            "title": "TEST_Property_For_Update",
            "description": "Original description",
            "address": "Original address",
            "rental_type": "long-term",
            "property_type": "apartment",
            "area": "Jerusalem - Katamon",
            "monthly_price": 5500,
            "currency": "ILS"
        }
        
        create_response = self.session.post(f"{BASE_URL}/api/properties", json=create_payload)
        assert create_response.status_code == 200
        
        property_id = create_response.json()["id"]
        self.created_property_ids.append(property_id)
        
        # Now update without description and address
        update_payload = {
            "title": "TEST_Property_Updated",
            "rental_type": "long-term",
            "property_type": "apartment",
            "area": "Jerusalem - Katamon",
            "monthly_price": 6000,
            "currency": "ILS"
            # NOTE: description and address omitted
        }
        
        update_response = self.session.put(f"{BASE_URL}/api/properties/{property_id}", json=update_payload)
        
        assert update_response.status_code == 200, f"Expected 200, got {update_response.status_code}: {update_response.text}"
        
        print("PASS: Property updated successfully without description and address")


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
