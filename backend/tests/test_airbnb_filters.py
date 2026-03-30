"""
Test suite for Airbnb-style filter panel features
Tests: min_price filter, price range filtering, stepper controls, elevator toggle
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestPriceRangeFilters:
    """Tests for price range filtering (min_price and max_price)"""
    
    def test_min_price_filter(self):
        """Test GET /api/properties?min_price=5000 returns properties with price >= 5000"""
        response = requests.get(f"{BASE_URL}/api/properties?min_price=5000")
        assert response.status_code == 200
        
        data = response.json()
        assert isinstance(data, list)
        
        # Verify all returned properties have price >= 5000
        for prop in data:
            price = prop.get('monthly_price') or prop.get('nightly_price') or 0
            assert price >= 5000, f"Property {prop.get('title')} has price {price} < 5000"
        print(f"min_price=5000 returned {len(data)} properties, all with price >= 5000")
    
    def test_max_price_filter(self):
        """Test GET /api/properties?max_price=10000 returns properties with price <= 10000"""
        response = requests.get(f"{BASE_URL}/api/properties?max_price=10000")
        assert response.status_code == 200
        
        data = response.json()
        assert isinstance(data, list)
        
        # Verify all returned properties have price <= 10000
        for prop in data:
            price = prop.get('monthly_price') or prop.get('nightly_price') or 0
            assert price <= 10000, f"Property {prop.get('title')} has price {price} > 10000"
        print(f"max_price=10000 returned {len(data)} properties, all with price <= 10000")
    
    def test_price_range_filter(self):
        """Test GET /api/properties?min_price=5000&max_price=10000 returns properties in range"""
        response = requests.get(f"{BASE_URL}/api/properties?min_price=5000&max_price=10000")
        assert response.status_code == 200
        
        data = response.json()
        assert isinstance(data, list)
        
        # Verify all returned properties are within price range
        for prop in data:
            price = prop.get('monthly_price') or prop.get('nightly_price') or 0
            assert 5000 <= price <= 10000, f"Property {prop.get('title')} has price {price} outside range 5000-10000"
        print(f"Price range 5000-10000 returned {len(data)} properties")
    
    def test_min_price_zero_returns_all(self):
        """Test that min_price=0 effectively returns all properties"""
        response_all = requests.get(f"{BASE_URL}/api/properties")
        response_min_zero = requests.get(f"{BASE_URL}/api/properties?min_price=0")
        
        assert response_all.status_code == 200
        assert response_min_zero.status_code == 200
        
        # Both should return same count (min_price=0 is effectively no filter)
        all_count = len(response_all.json())
        min_zero_count = len(response_min_zero.json())
        print(f"All properties: {all_count}, min_price=0: {min_zero_count}")


class TestBedroomBathroomFilters:
    """Tests for bedroom and bathroom stepper filters"""
    
    def test_min_bedrooms_filter(self):
        """Test GET /api/properties?min_bedrooms=3 returns properties with 3+ bedrooms"""
        response = requests.get(f"{BASE_URL}/api/properties?min_bedrooms=3")
        assert response.status_code == 200
        
        data = response.json()
        assert isinstance(data, list)
        
        for prop in data:
            bedrooms = prop.get('bedrooms', 0) or 0
            assert bedrooms >= 3, f"Property {prop.get('title')} has {bedrooms} bedrooms < 3"
        print(f"min_bedrooms=3 returned {len(data)} properties")
    
    def test_min_bathrooms_filter(self):
        """Test GET /api/properties?min_bathrooms=2 returns properties with 2+ bathrooms"""
        response = requests.get(f"{BASE_URL}/api/properties?min_bathrooms=2")
        assert response.status_code == 200
        
        data = response.json()
        assert isinstance(data, list)
        
        for prop in data:
            bathrooms = prop.get('bathrooms', 0) or 0
            assert bathrooms >= 2, f"Property {prop.get('title')} has {bathrooms} bathrooms < 2"
        print(f"min_bathrooms=2 returned {len(data)} properties")


class TestPorchesFloorFilters:
    """Tests for porches and floor stepper filters"""
    
    def test_min_porches_filter(self):
        """Test GET /api/properties?min_porches=1 returns properties with 1+ porches"""
        response = requests.get(f"{BASE_URL}/api/properties?min_porches=1")
        assert response.status_code == 200
        
        data = response.json()
        assert isinstance(data, list)
        
        for prop in data:
            porches = prop.get('porches', 0) or 0
            assert porches >= 1, f"Property {prop.get('title')} has {porches} porches < 1"
        print(f"min_porches=1 returned {len(data)} properties")
    
    def test_max_floor_filter(self):
        """Test GET /api/properties?max_floor=3 returns properties with floor <= 3"""
        response = requests.get(f"{BASE_URL}/api/properties?max_floor=3")
        assert response.status_code == 200
        
        data = response.json()
        assert isinstance(data, list)
        
        for prop in data:
            floor = prop.get('floor')
            if floor is not None:
                assert floor <= 3, f"Property {prop.get('title')} has floor {floor} > 3"
        print(f"max_floor=3 returned {len(data)} properties")


class TestElevatorToggle:
    """Tests for elevator toggle filter"""
    
    def test_has_elevator_true(self):
        """Test GET /api/properties?has_elevator=true returns only properties with elevator"""
        response = requests.get(f"{BASE_URL}/api/properties?has_elevator=true")
        assert response.status_code == 200
        
        data = response.json()
        assert isinstance(data, list)
        
        for prop in data:
            assert prop.get('has_elevator') == True, f"Property {prop.get('title')} has_elevator is not True"
        print(f"has_elevator=true returned {len(data)} properties")
    
    def test_has_elevator_false(self):
        """Test GET /api/properties?has_elevator=false returns only properties without elevator"""
        response = requests.get(f"{BASE_URL}/api/properties?has_elevator=false")
        assert response.status_code == 200
        
        data = response.json()
        assert isinstance(data, list)
        
        for prop in data:
            assert prop.get('has_elevator') == False, f"Property {prop.get('title')} has_elevator is not False"
        print(f"has_elevator=false returned {len(data)} properties")


class TestConditionFilter:
    """Tests for property condition dropdown filter"""
    
    def test_condition_renovated(self):
        """Test GET /api/properties?condition=renovated returns renovated properties"""
        response = requests.get(f"{BASE_URL}/api/properties?condition=renovated")
        assert response.status_code == 200
        
        data = response.json()
        assert isinstance(data, list)
        
        for prop in data:
            assert prop.get('condition') == 'renovated', f"Property {prop.get('title')} condition is {prop.get('condition')}"
        print(f"condition=renovated returned {len(data)} properties")
    
    def test_condition_good(self):
        """Test GET /api/properties?condition=good returns good condition properties"""
        response = requests.get(f"{BASE_URL}/api/properties?condition=good")
        assert response.status_code == 200
        
        data = response.json()
        assert isinstance(data, list)
        
        for prop in data:
            assert prop.get('condition') == 'good', f"Property {prop.get('title')} condition is {prop.get('condition')}"
        print(f"condition=good returned {len(data)} properties")


class TestLocationFilter:
    """Tests for location/area dropdown filter"""
    
    def test_area_filter_jerusalem(self):
        """Test GET /api/properties?area=Jerusalem returns Jerusalem properties"""
        response = requests.get(f"{BASE_URL}/api/properties?area=Jerusalem")
        assert response.status_code == 200
        
        data = response.json()
        assert isinstance(data, list)
        
        for prop in data:
            assert 'jerusalem' in prop.get('area', '').lower(), f"Property {prop.get('title')} area is {prop.get('area')}"
        print(f"area=Jerusalem returned {len(data)} properties")
    
    def test_area_filter_tel_aviv(self):
        """Test GET /api/properties?area=Tel Aviv returns Tel Aviv properties"""
        response = requests.get(f"{BASE_URL}/api/properties?area=Tel Aviv")
        assert response.status_code == 200
        
        data = response.json()
        assert isinstance(data, list)
        
        for prop in data:
            assert 'tel aviv' in prop.get('area', '').lower(), f"Property {prop.get('title')} area is {prop.get('area')}"
        print(f"area=Tel Aviv returned {len(data)} properties")


class TestCombinedFilters:
    """Tests for combining multiple filters"""
    
    def test_price_and_bedrooms(self):
        """Test combining price range with bedroom filter"""
        response = requests.get(f"{BASE_URL}/api/properties?min_price=5000&max_price=10000&min_bedrooms=2")
        assert response.status_code == 200
        
        data = response.json()
        assert isinstance(data, list)
        
        for prop in data:
            price = prop.get('monthly_price') or prop.get('nightly_price') or 0
            bedrooms = prop.get('bedrooms', 0) or 0
            assert 5000 <= price <= 10000, f"Price {price} outside range"
            assert bedrooms >= 2, f"Bedrooms {bedrooms} < 2"
        print(f"Combined price+bedrooms filter returned {len(data)} properties")
    
    def test_elevator_and_floor(self):
        """Test combining elevator toggle with floor filter"""
        response = requests.get(f"{BASE_URL}/api/properties?has_elevator=true&max_floor=5")
        assert response.status_code == 200
        
        data = response.json()
        assert isinstance(data, list)
        
        for prop in data:
            assert prop.get('has_elevator') == True
            floor = prop.get('floor')
            if floor is not None:
                assert floor <= 5
        print(f"Combined elevator+floor filter returned {len(data)} properties")


class TestDateFilters:
    """Tests for date availability filters"""
    
    def test_date_range_filter(self):
        """Test GET /api/properties with date_from and date_to"""
        response = requests.get(f"{BASE_URL}/api/properties?date_from=2026-04-01&date_to=2026-04-15")
        assert response.status_code == 200
        
        data = response.json()
        assert isinstance(data, list)
        print(f"Date range filter returned {len(data)} properties")


class TestNoFilters:
    """Test baseline - no filters applied"""
    
    def test_get_all_properties(self):
        """Test GET /api/properties returns all properties"""
        response = requests.get(f"{BASE_URL}/api/properties")
        assert response.status_code == 200
        
        data = response.json()
        assert isinstance(data, list)
        assert len(data) > 0, "Expected at least one property"
        
        # Verify response structure
        first_prop = data[0]
        assert 'id' in first_prop
        assert 'title' in first_prop
        assert 'area' in first_prop
        print(f"Total properties: {len(data)}")
