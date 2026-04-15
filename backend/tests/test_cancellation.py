"""
Test suite for booking cancellation functionality
Tests:
1. Owner direct cancellation
2. Renter cancellation request
3. Owner approve cancellation
4. Owner deny cancellation
5. Cancellation policy for vacation rentals
"""
import pytest
import requests
import os
import uuid

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials from test_credentials.md
OWNER_EMAIL = "owner@test.com"
OWNER_PASSWORD = "Test1234!"
RENTER_EMAIL = "renter@test.com"
RENTER_PASSWORD = "Test1234!"


class TestCancellationWorkflow:
    """Test booking cancellation workflow"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test data"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
    def get_owner_token(self):
        """Login as owner and get token"""
        response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": OWNER_EMAIL,
            "password": OWNER_PASSWORD
        })
        if response.status_code == 200:
            return response.json().get("token"), response.json().get("user", {}).get("id")
        return None, None
    
    def get_renter_token(self):
        """Login as renter and get token"""
        response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": RENTER_EMAIL,
            "password": RENTER_PASSWORD
        })
        if response.status_code == 200:
            return response.json().get("token"), response.json().get("user", {}).get("id")
        return None, None
    
    def test_01_owner_login(self):
        """Test owner can login"""
        response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": OWNER_EMAIL,
            "password": OWNER_PASSWORD
        })
        print(f"Owner login response: {response.status_code}")
        assert response.status_code == 200, f"Owner login failed: {response.text}"
        data = response.json()
        assert "token" in data
        assert data["user"]["role"] == "owner"
        print("✓ Owner login successful")
    
    def test_02_renter_login(self):
        """Test renter can login"""
        response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": RENTER_EMAIL,
            "password": RENTER_PASSWORD
        })
        print(f"Renter login response: {response.status_code}")
        assert response.status_code == 200, f"Renter login failed: {response.text}"
        data = response.json()
        assert "token" in data
        assert data["user"]["role"] == "renter"
        print("✓ Renter login successful")
    
    def test_03_create_property_with_cancellation_policy(self):
        """Test creating vacation property with cancellation policy"""
        owner_token, owner_id = self.get_owner_token()
        assert owner_token, "Failed to get owner token"
        
        # Create vacation property with cancellation policy
        property_data = {
            "title": f"TEST_Vacation_Property_{uuid.uuid4().hex[:8]}",
            "description": "Test vacation property for cancellation testing",
            "rental_type": "vacation",
            "property_type": "apartment",
            "bedrooms": 2,
            "bathrooms": 1,
            "area": "Tel Aviv",
            "address": "123 Test Street",
            "nightly_price": 150,
            "currency": "USD",
            "cancellation_policy": "moderate",
            "custom_cancellation_policy": None
        }
        
        response = self.session.post(
            f"{BASE_URL}/api/properties",
            json=property_data,
            headers={"Authorization": f"Bearer {owner_token}"}
        )
        print(f"Create property response: {response.status_code}")
        assert response.status_code == 200, f"Failed to create property: {response.text}"
        data = response.json()
        assert "id" in data
        
        # Verify property was created with cancellation policy
        prop_response = self.session.get(f"{BASE_URL}/api/properties/{data['id']}")
        assert prop_response.status_code == 200
        prop_data = prop_response.json()
        assert prop_data.get("cancellation_policy") == "moderate"
        print(f"✓ Property created with cancellation_policy: {prop_data.get('cancellation_policy')}")
        
        # Store property ID for cleanup
        self.__class__.test_property_id = data['id']
    
    def test_04_create_booking_without_guest_count(self):
        """Test creating booking without guest_count field"""
        renter_token, renter_id = self.get_renter_token()
        assert renter_token, "Failed to get renter token"
        
        # Get a property to book
        props_response = self.session.get(f"{BASE_URL}/api/properties")
        assert props_response.status_code == 200
        properties = props_response.json()
        assert len(properties) > 0, "No properties available"
        
        property_id = properties[0]['id']
        
        # Create booking WITHOUT guest_count (should work)
        booking_data = {
            "property_id": property_id,
            "start_date": "2026-03-01",
            "end_date": "2026-03-05",
            "message": "Test booking for cancellation testing"
        }
        
        response = self.session.post(
            f"{BASE_URL}/api/bookings",
            json=booking_data,
            headers={"Authorization": f"Bearer {renter_token}"}
        )
        print(f"Create booking response: {response.status_code}")
        assert response.status_code == 200, f"Failed to create booking: {response.text}"
        data = response.json()
        assert "id" in data
        print(f"✓ Booking created without guest_count: {data['id']}")
        
        # Store booking ID for later tests
        self.__class__.test_booking_id = data['id']
        self.__class__.test_property_id_for_booking = property_id
    
    def test_05_renter_request_cancellation(self):
        """Test renter can request cancellation"""
        renter_token, renter_id = self.get_renter_token()
        assert renter_token, "Failed to get renter token"
        
        # First create a new booking for this test
        props_response = self.session.get(f"{BASE_URL}/api/properties")
        properties = props_response.json()
        property_id = properties[0]['id']
        
        booking_data = {
            "property_id": property_id,
            "start_date": "2026-04-01",
            "end_date": "2026-04-05",
            "message": "Test booking for renter cancellation request"
        }
        
        create_response = self.session.post(
            f"{BASE_URL}/api/bookings",
            json=booking_data,
            headers={"Authorization": f"Bearer {renter_token}"}
        )
        assert create_response.status_code == 200
        booking_id = create_response.json()['id']
        
        # Request cancellation
        response = self.session.post(
            f"{BASE_URL}/api/bookings/{booking_id}/request-cancel",
            json={"reason": "Change of plans - need to reschedule"},
            headers={"Authorization": f"Bearer {renter_token}"}
        )
        print(f"Request cancellation response: {response.status_code}")
        assert response.status_code == 200, f"Failed to request cancellation: {response.text}"
        print("✓ Renter cancellation request submitted")
        
        # Verify booking status changed
        bookings_response = self.session.get(
            f"{BASE_URL}/api/bookings",
            headers={"Authorization": f"Bearer {renter_token}"}
        )
        assert bookings_response.status_code == 200
        bookings = bookings_response.json()
        booking = next((b for b in bookings if b['id'] == booking_id), None)
        assert booking is not None
        assert booking['status'] == 'cancellation_requested'
        assert booking.get('cancellation_reason') == "Change of plans - need to reschedule"
        print(f"✓ Booking status updated to: {booking['status']}")
        
        self.__class__.cancellation_request_booking_id = booking_id
    
    def test_06_owner_approve_cancellation(self):
        """Test owner can approve cancellation request"""
        owner_token, owner_id = self.get_owner_token()
        renter_token, renter_id = self.get_renter_token()
        assert owner_token, "Failed to get owner token"
        assert renter_token, "Failed to get renter token"
        
        # Create a new booking and request cancellation
        props_response = self.session.get(f"{BASE_URL}/api/properties?owner_id={owner_id}")
        if props_response.status_code != 200 or len(props_response.json()) == 0:
            # Use any property
            props_response = self.session.get(f"{BASE_URL}/api/properties")
        properties = props_response.json()
        
        if len(properties) == 0:
            pytest.skip("No properties available for testing")
        
        property_id = properties[0]['id']
        
        # Create booking as renter
        booking_data = {
            "property_id": property_id,
            "start_date": "2026-05-01",
            "end_date": "2026-05-05",
            "message": "Test booking for approve cancellation"
        }
        
        create_response = self.session.post(
            f"{BASE_URL}/api/bookings",
            json=booking_data,
            headers={"Authorization": f"Bearer {renter_token}"}
        )
        assert create_response.status_code == 200
        booking_id = create_response.json()['id']
        
        # Request cancellation as renter
        request_response = self.session.post(
            f"{BASE_URL}/api/bookings/{booking_id}/request-cancel",
            json={"reason": "Need to cancel for approval test"},
            headers={"Authorization": f"Bearer {renter_token}"}
        )
        assert request_response.status_code == 200
        
        # Approve cancellation as owner
        response = self.session.post(
            f"{BASE_URL}/api/bookings/{booking_id}/approve-cancel",
            json={},
            headers={"Authorization": f"Bearer {owner_token}"}
        )
        print(f"Approve cancellation response: {response.status_code}")
        assert response.status_code == 200, f"Failed to approve cancellation: {response.text}"
        print("✓ Owner approved cancellation")
        
        # Verify booking status is now cancelled
        bookings_response = self.session.get(
            f"{BASE_URL}/api/bookings",
            headers={"Authorization": f"Bearer {renter_token}"}
        )
        bookings = bookings_response.json()
        booking = next((b for b in bookings if b['id'] == booking_id), None)
        assert booking is not None
        assert booking['status'] == 'cancelled'
        print(f"✓ Booking status updated to: {booking['status']}")
    
    def test_07_owner_deny_cancellation(self):
        """Test owner can deny cancellation request"""
        owner_token, owner_id = self.get_owner_token()
        renter_token, renter_id = self.get_renter_token()
        assert owner_token, "Failed to get owner token"
        assert renter_token, "Failed to get renter token"
        
        # Get owner's properties
        props_response = self.session.get(f"{BASE_URL}/api/properties?owner_id={owner_id}")
        if props_response.status_code != 200 or len(props_response.json()) == 0:
            props_response = self.session.get(f"{BASE_URL}/api/properties")
        properties = props_response.json()
        
        if len(properties) == 0:
            pytest.skip("No properties available for testing")
        
        property_id = properties[0]['id']
        
        # Create booking as renter
        booking_data = {
            "property_id": property_id,
            "start_date": "2026-06-01",
            "end_date": "2026-06-05",
            "message": "Test booking for deny cancellation"
        }
        
        create_response = self.session.post(
            f"{BASE_URL}/api/bookings",
            json=booking_data,
            headers={"Authorization": f"Bearer {renter_token}"}
        )
        assert create_response.status_code == 200
        booking_id = create_response.json()['id']
        
        # Request cancellation as renter
        request_response = self.session.post(
            f"{BASE_URL}/api/bookings/{booking_id}/request-cancel",
            json={"reason": "Need to cancel for denial test"},
            headers={"Authorization": f"Bearer {renter_token}"}
        )
        assert request_response.status_code == 200
        
        # Deny cancellation as owner
        response = self.session.post(
            f"{BASE_URL}/api/bookings/{booking_id}/deny-cancel",
            json={"denial_reason": "Booking is non-refundable within 7 days"},
            headers={"Authorization": f"Bearer {owner_token}"}
        )
        print(f"Deny cancellation response: {response.status_code}")
        assert response.status_code == 200, f"Failed to deny cancellation: {response.text}"
        print("✓ Owner denied cancellation")
        
        # Verify booking status reverted
        bookings_response = self.session.get(
            f"{BASE_URL}/api/bookings",
            headers={"Authorization": f"Bearer {renter_token}"}
        )
        bookings = bookings_response.json()
        booking = next((b for b in bookings if b['id'] == booking_id), None)
        assert booking is not None
        # Status should revert to previous (pending or confirmed)
        assert booking['status'] in ['pending', 'confirmed']
        assert booking.get('cancellation_denied') == True
        assert booking.get('cancellation_denial_reason') == "Booking is non-refundable within 7 days"
        print(f"✓ Booking status reverted to: {booking['status']}")
        print(f"✓ Denial reason recorded: {booking.get('cancellation_denial_reason')}")
    
    def test_08_owner_direct_cancel(self):
        """Test owner can directly cancel a booking"""
        owner_token, owner_id = self.get_owner_token()
        renter_token, renter_id = self.get_renter_token()
        assert owner_token, "Failed to get owner token"
        assert renter_token, "Failed to get renter token"
        
        # Get owner's properties
        props_response = self.session.get(f"{BASE_URL}/api/properties?owner_id={owner_id}")
        if props_response.status_code != 200 or len(props_response.json()) == 0:
            props_response = self.session.get(f"{BASE_URL}/api/properties")
        properties = props_response.json()
        
        if len(properties) == 0:
            pytest.skip("No properties available for testing")
        
        property_id = properties[0]['id']
        
        # Create booking as renter
        booking_data = {
            "property_id": property_id,
            "start_date": "2026-07-01",
            "end_date": "2026-07-05",
            "message": "Test booking for owner direct cancel"
        }
        
        create_response = self.session.post(
            f"{BASE_URL}/api/bookings",
            json=booking_data,
            headers={"Authorization": f"Bearer {renter_token}"}
        )
        assert create_response.status_code == 200
        booking_id = create_response.json()['id']
        
        # Owner directly cancels
        response = self.session.post(
            f"{BASE_URL}/api/bookings/{booking_id}/cancel",
            json={"reason": "Property no longer available for these dates"},
            headers={"Authorization": f"Bearer {owner_token}"}
        )
        print(f"Owner direct cancel response: {response.status_code}")
        assert response.status_code == 200, f"Failed to cancel booking: {response.text}"
        print("✓ Owner directly cancelled booking")
        
        # Verify booking is cancelled
        bookings_response = self.session.get(
            f"{BASE_URL}/api/bookings",
            headers={"Authorization": f"Bearer {renter_token}"}
        )
        bookings = bookings_response.json()
        booking = next((b for b in bookings if b['id'] == booking_id), None)
        assert booking is not None
        assert booking['status'] == 'cancelled'
        assert booking.get('cancellation_reason') == "Property no longer available for these dates"
        print(f"✓ Booking status: {booking['status']}")
        print(f"✓ Cancellation reason: {booking.get('cancellation_reason')}")
    
    def test_09_renter_cannot_direct_cancel(self):
        """Test renter cannot directly cancel (must request)"""
        renter_token, renter_id = self.get_renter_token()
        assert renter_token, "Failed to get renter token"
        
        # Get a property
        props_response = self.session.get(f"{BASE_URL}/api/properties")
        properties = props_response.json()
        property_id = properties[0]['id']
        
        # Create booking
        booking_data = {
            "property_id": property_id,
            "start_date": "2026-08-01",
            "end_date": "2026-08-05",
            "message": "Test booking for renter direct cancel attempt"
        }
        
        create_response = self.session.post(
            f"{BASE_URL}/api/bookings",
            json=booking_data,
            headers={"Authorization": f"Bearer {renter_token}"}
        )
        assert create_response.status_code == 200
        booking_id = create_response.json()['id']
        
        # Renter tries to directly cancel (should fail)
        response = self.session.post(
            f"{BASE_URL}/api/bookings/{booking_id}/cancel",
            json={"reason": "Renter trying to directly cancel"},
            headers={"Authorization": f"Bearer {renter_token}"}
        )
        print(f"Renter direct cancel response: {response.status_code}")
        assert response.status_code == 403, f"Renter should not be able to directly cancel: {response.text}"
        print("✓ Renter correctly blocked from direct cancellation")
    
    def test_10_cancellation_policy_options(self):
        """Test all cancellation policy options for vacation rentals"""
        owner_token, owner_id = self.get_owner_token()
        assert owner_token, "Failed to get owner token"
        
        policies = ['flexible', 'moderate', 'strict', 'custom']
        
        for policy in policies:
            property_data = {
                "title": f"TEST_Policy_{policy}_{uuid.uuid4().hex[:6]}",
                "description": f"Test property with {policy} cancellation policy",
                "rental_type": "vacation",
                "property_type": "apartment",
                "bedrooms": 1,
                "bathrooms": 1,
                "area": "Jerusalem",
                "nightly_price": 100,
                "currency": "ILS",
                "cancellation_policy": policy,
                "custom_cancellation_policy": "Custom policy text" if policy == 'custom' else None
            }
            
            response = self.session.post(
                f"{BASE_URL}/api/properties",
                json=property_data,
                headers={"Authorization": f"Bearer {owner_token}"}
            )
            assert response.status_code == 200, f"Failed to create property with {policy} policy: {response.text}"
            
            # Verify policy was saved
            prop_id = response.json()['id']
            prop_response = self.session.get(f"{BASE_URL}/api/properties/{prop_id}")
            prop_data = prop_response.json()
            assert prop_data.get('cancellation_policy') == policy
            if policy == 'custom':
                assert prop_data.get('custom_cancellation_policy') == "Custom policy text"
            print(f"✓ Property created with {policy} cancellation policy")


class TestBookingWithoutGuestCount:
    """Test that guest_count is removed from booking flow"""
    
    def test_booking_model_no_guest_count(self):
        """Verify BookingCreate model doesn't require guest_count"""
        session = requests.Session()
        session.headers.update({"Content-Type": "application/json"})
        
        # Login as renter
        response = session.post(f"{BASE_URL}/api/auth/login", json={
            "email": RENTER_EMAIL,
            "password": RENTER_PASSWORD
        })
        assert response.status_code == 200
        token = response.json()['token']
        
        # Get a property
        props_response = session.get(f"{BASE_URL}/api/properties")
        properties = props_response.json()
        property_id = properties[0]['id']
        
        # Create booking with minimal fields (no guest_count)
        booking_data = {
            "property_id": property_id,
            "start_date": "2026-09-01",
            "end_date": "2026-09-05"
        }
        
        response = session.post(
            f"{BASE_URL}/api/bookings",
            json=booking_data,
            headers={"Authorization": f"Bearer {token}"}
        )
        print(f"Booking without guest_count response: {response.status_code}")
        assert response.status_code == 200, f"Booking should work without guest_count: {response.text}"
        print("✓ Booking created successfully without guest_count field")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
