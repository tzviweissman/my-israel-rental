"""
Test suite for Property API with all new fields:
- is_tama, has_agent_fee, agent_fee_price, agent_fee_currency
- currency, furniture_option, condition, square_meters
- amenities (list), bedrooms/bathrooms/floor as float
- porches, sukkah_compatible
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
)

class TestAuthAndSetup:
    """Authentication tests to get token for property tests"""
    
    @pytest.fixture(scope="class")
    def auth_token(self):
        """Get auth token for owner account"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": OWNER_EMAIL,
            "password": OWNER_PASSWORD
        })
        if response.status_code != 200:
            pytest.skip(f"Authentication failed: {response.text}")
        data = response.json()
        assert "token" in data
        return data["token"]
    
    def test_login_owner(self, auth_token):
        """Verify owner can login"""
        assert auth_token is not None
        print(f"✓ Owner login successful, token obtained")


class TestPropertyCreateWithNewFields:
    """Test POST /api/properties with all new fields"""
    
    @pytest.fixture(scope="class")
    def auth_token(self):
        """Get auth token for owner account"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": OWNER_EMAIL,
            "password": OWNER_PASSWORD
        })
        if response.status_code != 200:
            pytest.skip(f"Authentication failed: {response.text}")
        return response.json()["token"]
    
    @pytest.fixture(scope="class")
    def headers(self, auth_token):
        return {"Authorization": f"Bearer {auth_token}", "Content-Type": "application/json"}
    
    def test_create_property_with_all_new_fields(self, headers):
        """Test creating property with all new fields including is_tama, agent_fee, condition, etc."""
        unique_id = str(uuid.uuid4())[:8]
        property_data = {
            "title": f"TEST_Property_{unique_id}",
            "description": "Test property with all new fields",
            "rental_type": "long-term",
            "property_type": "apartment",
            "bedrooms": 2.5,  # Float value
            "bathrooms": 1.5,  # Float value
            "area": "Tel Aviv",
            "address": "123 Test Street",
            "square_meters": 85.5,  # New field
            "floor": 3.5,  # Float value
            "has_elevator": True,
            "is_shabbat_elevator": True,
            "is_tama": True,  # New field
            "has_agent_fee": True,  # New field
            "agent_fee_price": 5000.0,  # New field
            "agent_fee_currency": "ILS",  # New field
            "porches": 2,  # New field
            "sukkah_compatible": True,  # New field
            "condition": "renovated",  # New field
            "furniture_option": "furniture_package",  # New field
            "amenities": ["Air conditioning / Central heating", "Dishwasher", "Swimming pool (indoor or outdoor)"],  # List field
            "monthly_price": 8500.0,
            "currency": "ILS"  # New field
        }
        
        response = requests.post(f"{BASE_URL}/api/properties", json=property_data, headers=headers)
        
        # Status assertion
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        # Data assertions
        data = response.json()
        assert "id" in data, "Response should contain property id"
        assert "message" in data, "Response should contain success message"
        
        property_id = data["id"]
        print(f"✓ Property created with ID: {property_id}")
        
        # Verify by GET
        get_response = requests.get(f"{BASE_URL}/api/properties/{property_id}")
        assert get_response.status_code == 200, f"GET failed: {get_response.text}"
        
        fetched = get_response.json()
        
        # Verify all new fields are stored correctly
        assert fetched["is_tama"] == True, "is_tama should be True"
        assert fetched["has_agent_fee"] == True, "has_agent_fee should be True"
        assert fetched["agent_fee_price"] == 5000.0, "agent_fee_price should be 5000.0"
        assert fetched["agent_fee_currency"] == "ILS", "agent_fee_currency should be ILS"
        assert fetched["currency"] == "ILS", "currency should be ILS"
        assert fetched["furniture_option"] == "furniture_package", "furniture_option should be furniture_package"
        assert fetched["condition"] == "renovated", "condition should be renovated"
        assert fetched["square_meters"] == 85.5, "square_meters should be 85.5"
        assert fetched["porches"] == 2, "porches should be 2"
        assert fetched["sukkah_compatible"] == True, "sukkah_compatible should be True"
        assert fetched["bedrooms"] == 2.5, "bedrooms should be 2.5 (float)"
        assert fetched["bathrooms"] == 1.5, "bathrooms should be 1.5 (float)"
        assert fetched["floor"] == 3.5, "floor should be 3.5 (float)"
        assert isinstance(fetched["amenities"], list), "amenities should be a list"
        assert len(fetched["amenities"]) == 3, "amenities should have 3 items"
        
        print("✓ All new fields verified in GET response")
        
        # Cleanup
        delete_response = requests.delete(f"{BASE_URL}/api/properties/{property_id}", headers=headers)
        assert delete_response.status_code == 200, f"Delete failed: {delete_response.text}"
        print(f"✓ Test property cleaned up")
    
    def test_create_property_with_condition_partially_renovated(self, headers):
        """Test property with condition='partially_renovated'"""
        unique_id = str(uuid.uuid4())[:8]
        property_data = {
            "title": f"TEST_PartialReno_{unique_id}",
            "description": "Test partially renovated property",
            "rental_type": "long-term",
            "property_type": "apartment",
            "area": "Jerusalem",
            "address": "456 Test Ave",
            "condition": "partially_renovated",  # Test this specific value
            "monthly_price": 6000.0
        }
        
        response = requests.post(f"{BASE_URL}/api/properties", json=property_data, headers=headers)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        property_id = response.json()["id"]
        
        # Verify condition
        get_response = requests.get(f"{BASE_URL}/api/properties/{property_id}")
        assert get_response.status_code == 200
        assert get_response.json()["condition"] == "partially_renovated"
        print("✓ condition='partially_renovated' accepted and stored")
        
        # Cleanup
        requests.delete(f"{BASE_URL}/api/properties/{property_id}", headers=headers)
    
    def test_create_property_with_condition_good(self, headers):
        """Test property with condition='good'"""
        unique_id = str(uuid.uuid4())[:8]
        property_data = {
            "title": f"TEST_GoodCond_{unique_id}",
            "description": "Test good condition property",
            "rental_type": "short-term",
            "property_type": "house",
            "area": "Haifa",
            "address": "789 Test Blvd",
            "condition": "good",  # Test this specific value
            "nightly_price": 500.0
        }
        
        response = requests.post(f"{BASE_URL}/api/properties", json=property_data, headers=headers)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        property_id = response.json()["id"]
        
        # Verify condition
        get_response = requests.get(f"{BASE_URL}/api/properties/{property_id}")
        assert get_response.status_code == 200
        assert get_response.json()["condition"] == "good"
        print("✓ condition='good' accepted and stored")
        
        # Cleanup
        requests.delete(f"{BASE_URL}/api/properties/{property_id}", headers=headers)
    
    def test_create_property_with_usd_currency(self, headers):
        """Test property with USD currency for both price and agent fee"""
        unique_id = str(uuid.uuid4())[:8]
        property_data = {
            "title": f"TEST_USDProperty_{unique_id}",
            "description": "Test USD currency property",
            "rental_type": "vacation",
            "property_type": "apartment",
            "area": "Eilat",
            "address": "Beach Road 1",
            "currency": "USD",
            "has_agent_fee": True,
            "agent_fee_price": 1000.0,
            "agent_fee_currency": "USD",
            "nightly_price": 200.0
        }
        
        response = requests.post(f"{BASE_URL}/api/properties", json=property_data, headers=headers)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        property_id = response.json()["id"]
        
        # Verify currencies
        get_response = requests.get(f"{BASE_URL}/api/properties/{property_id}")
        assert get_response.status_code == 200
        fetched = get_response.json()
        assert fetched["currency"] == "USD", "currency should be USD"
        assert fetched["agent_fee_currency"] == "USD", "agent_fee_currency should be USD"
        print("✓ USD currency accepted for both price and agent fee")
        
        # Cleanup
        requests.delete(f"{BASE_URL}/api/properties/{property_id}", headers=headers)
    
    def test_create_property_with_empty_amenities(self, headers):
        """Test property with empty amenities list"""
        unique_id = str(uuid.uuid4())[:8]
        property_data = {
            "title": f"TEST_NoAmenities_{unique_id}",
            "description": "Test property without amenities",
            "rental_type": "long-term",
            "property_type": "apartment",
            "area": "Netanya",
            "address": "Simple Street 1",
            "amenities": [],
            "monthly_price": 4000.0
        }
        
        response = requests.post(f"{BASE_URL}/api/properties", json=property_data, headers=headers)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        property_id = response.json()["id"]
        
        # Verify empty amenities
        get_response = requests.get(f"{BASE_URL}/api/properties/{property_id}")
        assert get_response.status_code == 200
        assert get_response.json()["amenities"] == []
        print("✓ Empty amenities list accepted")
        
        # Cleanup
        requests.delete(f"{BASE_URL}/api/properties/{property_id}", headers=headers)
    
    def test_create_property_without_agent_fee(self, headers):
        """Test property with has_agent_fee=False"""
        unique_id = str(uuid.uuid4())[:8]
        property_data = {
            "title": f"TEST_NoAgentFee_{unique_id}",
            "description": "Test property without agent fee",
            "rental_type": "long-term",
            "property_type": "apartment",
            "area": "Ramat Gan",
            "address": "No Fee Street 1",
            "has_agent_fee": False,
            "monthly_price": 5500.0
        }
        
        response = requests.post(f"{BASE_URL}/api/properties", json=property_data, headers=headers)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        property_id = response.json()["id"]
        
        # Verify no agent fee
        get_response = requests.get(f"{BASE_URL}/api/properties/{property_id}")
        assert get_response.status_code == 200
        assert get_response.json()["has_agent_fee"] == False
        print("✓ has_agent_fee=False accepted")
        
        # Cleanup
        requests.delete(f"{BASE_URL}/api/properties/{property_id}", headers=headers)
    
    def test_create_property_with_furniture_options(self, headers):
        """Test all furniture_option values"""
        furniture_options = ["no_furniture", "furniture_package", "furniture_free"]
        
        for option in furniture_options:
            unique_id = str(uuid.uuid4())[:8]
            property_data = {
                "title": f"TEST_Furniture_{option}_{unique_id}",
                "description": f"Test {option} furniture option",
                "rental_type": "long-term",
                "property_type": "apartment",
                "area": "Tel Aviv",
                "address": "Furniture Test St",
                "furniture_option": option,
                "monthly_price": 7000.0
            }
            
            response = requests.post(f"{BASE_URL}/api/properties", json=property_data, headers=headers)
            assert response.status_code == 200, f"Expected 200 for {option}, got {response.status_code}: {response.text}"
            
            property_id = response.json()["id"]
            
            # Verify furniture option
            get_response = requests.get(f"{BASE_URL}/api/properties/{property_id}")
            assert get_response.status_code == 200
            assert get_response.json()["furniture_option"] == option
            print(f"✓ furniture_option='{option}' accepted")
            
            # Cleanup
            requests.delete(f"{BASE_URL}/api/properties/{property_id}", headers=headers)


class TestPropertyGetWithNewFields:
    """Test GET /api/properties/{id} returns all new fields"""
    
    @pytest.fixture(scope="class")
    def auth_token(self):
        """Get auth token for owner account"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": OWNER_EMAIL,
            "password": OWNER_PASSWORD
        })
        if response.status_code != 200:
            pytest.skip(f"Authentication failed: {response.text}")
        return response.json()["token"]
    
    @pytest.fixture(scope="class")
    def headers(self, auth_token):
        return {"Authorization": f"Bearer {auth_token}", "Content-Type": "application/json"}
    
    @pytest.fixture(scope="class")
    def test_property_id(self, headers):
        """Create a test property and return its ID"""
        unique_id = str(uuid.uuid4())[:8]
        property_data = {
            "title": f"TEST_GetFields_{unique_id}",
            "description": "Test property for GET verification",
            "rental_type": "long-term",
            "property_type": "apartment",
            "bedrooms": 3.0,
            "bathrooms": 2.0,
            "area": "Tel Aviv",
            "address": "GET Test Street",
            "square_meters": 120.0,
            "floor": 5.0,
            "has_elevator": True,
            "is_shabbat_elevator": True,
            "is_tama": True,
            "has_agent_fee": True,
            "agent_fee_price": 3000.0,
            "agent_fee_currency": "ILS",
            "porches": 1,
            "sukkah_compatible": True,
            "condition": "renovated",
            "furniture_option": "furniture_free",
            "amenities": ["Gym / Fitness center", "Swimming pool (indoor or outdoor)"],
            "monthly_price": 12000.0,
            "currency": "ILS"
        }
        
        response = requests.post(f"{BASE_URL}/api/properties", json=property_data, headers=headers)
        assert response.status_code == 200
        property_id = response.json()["id"]
        
        yield property_id
        
        # Cleanup after tests
        requests.delete(f"{BASE_URL}/api/properties/{property_id}", headers=headers)
    
    def test_get_property_returns_all_fields(self, test_property_id):
        """Verify GET returns all new fields correctly"""
        response = requests.get(f"{BASE_URL}/api/properties/{test_property_id}")
        
        assert response.status_code == 200, f"GET failed: {response.text}"
        
        data = response.json()
        
        # Verify all expected fields exist
        expected_fields = [
            "id", "title", "description", "rental_type", "property_type",
            "bedrooms", "bathrooms", "area", "address", "square_meters",
            "floor", "has_elevator", "is_shabbat_elevator", "is_tama",
            "has_agent_fee", "agent_fee_price", "agent_fee_currency",
            "porches", "sukkah_compatible", "condition", "furniture_option",
            "amenities", "monthly_price", "currency"
        ]
        
        for field in expected_fields:
            assert field in data, f"Field '{field}' missing from response"
        
        print("✓ All expected fields present in GET response")
        
        # Verify specific values
        assert data["is_tama"] == True
        assert data["has_agent_fee"] == True
        assert data["agent_fee_price"] == 3000.0
        assert data["condition"] == "renovated"
        assert data["furniture_option"] == "furniture_free"
        assert len(data["amenities"]) == 2
        
        print("✓ All field values verified correctly")


class TestPropertyListWithNewFields:
    """Test GET /api/properties returns properties with all new fields"""
    
    def test_list_properties_includes_new_fields(self):
        """Verify newly created properties have new fields in the OWNER'S list.

        The public list is a lean card projection on purpose (id, title,
        price, one image, area); the full document - amenities, condition,
        agent fee - comes back on the owner-scoped list the dashboard edits
        from. This asserted the rich shape against the lean one."""
        login = requests.post(f"{BASE_URL}/api/auth/login", json={"email": OWNER_EMAIL, "password": OWNER_PASSWORD})
        assert login.status_code == 200, login.text
        token = login.json()["token"]
        me = requests.get(f"{BASE_URL}/api/auth/me", headers={"Authorization": f"Bearer {token}"}).json()
        response = requests.get(f"{BASE_URL}/api/properties", params={"owner_id": me["id"]})
        
        assert response.status_code == 200, f"GET failed: {response.text}"
        
        properties = response.json()
        
        if len(properties) > 0:
            # Find a property with new fields (created after schema update)
            new_fields = ["is_tama", "has_agent_fee", "condition", "furniture_option", "amenities", "currency"]
            
            # Check if any property has all new fields (newer properties should)
            properties_with_new_fields = 0
            for prop in properties:
                has_all_fields = all(field in prop for field in new_fields)
                if has_all_fields:
                    properties_with_new_fields += 1
            
            # At least one property should have all new fields (from our tests)
            assert properties_with_new_fields > 0, "No properties found with all new fields"
            
            print(f"✓ {properties_with_new_fields}/{len(properties)} properties have all new fields")
        else:
            print("⚠ No properties in database to verify")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
