import requests
import sys
import json
from datetime import datetime

class RentalWebsiteAPITester:
    def __init__(self, base_url="https://listing-manager-pro-2.preview.emergentagent.com"):
        self.base_url = base_url
        self.api_url = f"{base_url}/api"
        self.tokens = {}
        self.users = {}
        self.property_ids = []
        self.booking_ids = []
        self.tests_run = 0
        self.tests_passed = 0

    def run_test(self, name, method, endpoint, expected_status, data=None, token=None):
        """Run a single API test"""
        url = f"{self.api_url}/{endpoint}"
        headers = {'Content-Type': 'application/json'}
        if token:
            headers['Authorization'] = f'Bearer {token}'

        self.tests_run += 1
        print(f"\n🔍 Testing {name}...")
        
        try:
            if method == 'GET':
                response = requests.get(url, headers=headers)
            elif method == 'POST':
                response = requests.post(url, json=data, headers=headers)
            elif method == 'PUT':
                response = requests.put(url, json=data, headers=headers)
            elif method == 'DELETE':
                response = requests.delete(url, headers=headers)

            success = response.status_code == expected_status
            if success:
                self.tests_passed += 1
                print(f"✅ Passed - Status: {response.status_code}")
                try:
                    return success, response.json()
                except:
                    return success, {}
            else:
                print(f"❌ Failed - Expected {expected_status}, got {response.status_code}")
                try:
                    print(f"Response: {response.json()}")
                except:
                    print(f"Response text: {response.text}")
                return False, {}

        except Exception as e:
            print(f"❌ Failed - Error: {str(e)}")
            return False, {}

    def test_user_registration(self):
        """Test user registration for different roles"""
        users_to_register = [
            {"email": "admin@rental.com", "password": "admin123", "name": "Admin User", "role": "admin"},
            {"email": "owner@rental.com", "password": "owner123", "name": "Owner User", "role": "owner"},
            {"email": "renter@rental.com", "password": "renter123", "name": "Renter User", "role": "renter"}
        ]
        
        for user_data in users_to_register:
            success, response = self.run_test(
                f"Register {user_data['role']}",
                "POST",
                "auth/register",
                200,
                data=user_data
            )
            if success and 'token' in response:
                self.tokens[user_data['role']] = response['token']
                self.users[user_data['role']] = response['user']
                print(f"✅ {user_data['role']} registered successfully")
            else:
                print(f"❌ Failed to register {user_data['role']}")

    def test_user_login(self):
        """Test user login"""
        login_credentials = [
            {"email": "admin@rental.com", "password": "admin123", "role": "admin"},
            {"email": "owner@rental.com", "password": "owner123", "role": "owner"},
            {"email": "renter@rental.com", "password": "renter123", "role": "renter"}
        ]
        
        for creds in login_credentials:
            success, response = self.run_test(
                f"Login {creds['role']}",
                "POST",
                "auth/login",
                200,
                data={"email": creds['email'], "password": creds['password']}
            )
            if success and 'token' in response:
                self.tokens[creds['role']] = response['token']
                self.users[creds['role']] = response['user']

    def test_get_current_user(self):
        """Test getting current user info"""
        for role, token in self.tokens.items():
            success, response = self.run_test(
                f"Get current user ({role})",
                "GET",
                "auth/me",
                200,
                token=token
            )

    def test_property_creation(self):
        """Test property creation"""
        if 'owner' not in self.tokens:
            print("❌ No owner token available for property creation")
            return

        property_data = {
            "title": "Beautiful Test Apartment",
            "description": "A lovely apartment for testing purposes",
            "rental_type": "long-term",
            "property_type": "apartment",
            "bedrooms": 2,
            "bathrooms": 1,
            "area": "Tel Aviv",
            "address": "123 Test Street, Tel Aviv",
            "square_meters": 80.0,
            "floor": 3,
            "has_elevator": True,
            "is_shabbat_elevator": False,
            "porches": 1,
            "sukkah_compatible": True,
            "condition": "renovated",
            "furniture_package": False,
            "amenities": ["air_conditioning", "dishwasher"],
            "monthly_price": 5000.0,
            "images": ["https://example.com/image1.jpg"]
        }

        success, response = self.run_test(
            "Create Property",
            "POST",
            "properties",
            200,
            data=property_data,
            token=self.tokens['owner']
        )
        
        if success and 'id' in response:
            self.property_ids.append(response['id'])
            print(f"✅ Property created with ID: {response['id']}")

    def test_get_properties(self):
        """Test getting properties list"""
        success, response = self.run_test(
            "Get Properties",
            "GET",
            "properties",
            200
        )
        
        if success:
            print(f"✅ Retrieved {len(response)} properties")

    def test_get_property_detail(self):
        """Test getting property details"""
        if not self.property_ids:
            print("❌ No property IDs available for detail test")
            return

        property_id = self.property_ids[0]
        success, response = self.run_test(
            "Get Property Detail",
            "GET",
            f"properties/{property_id}",
            200
        )

    def test_property_search_filters(self):
        """Test property search with filters"""
        filters = [
            "properties?rental_type=long-term",
            "properties?min_bedrooms=2",
            "properties?area=Tel Aviv"
        ]
        
        for filter_query in filters:
            success, response = self.run_test(
                f"Search Properties ({filter_query.split('?')[1]})",
                "GET",
                filter_query,
                200
            )

    def test_booking_creation(self):
        """Test booking creation"""
        if 'renter' not in self.tokens or not self.property_ids:
            print("❌ Missing renter token or property ID for booking test")
            return

        booking_data = {
            "property_id": self.property_ids[0],
            "start_date": "2024-02-01",
            "end_date": "2024-02-07",
            "guest_count": 2,
            "message": "Looking forward to staying here!"
        }

        success, response = self.run_test(
            "Create Booking",
            "POST",
            "bookings",
            200,
            data=booking_data,
            token=self.tokens['renter']
        )
        
        if success and 'id' in response:
            self.booking_ids.append(response['id'])

    def test_get_bookings(self):
        """Test getting bookings"""
        for role in ['renter', 'owner']:
            if role in self.tokens:
                success, response = self.run_test(
                    f"Get Bookings ({role})",
                    "GET",
                    "bookings",
                    200,
                    token=self.tokens[role]
                )

    def test_chat_functionality(self):
        """Test chat message sending and retrieval"""
        if 'renter' not in self.tokens or 'owner' not in self.tokens or not self.property_ids:
            print("❌ Missing tokens or property ID for chat test")
            return

        # Send message from renter to owner
        message_data = {
            "property_id": self.property_ids[0],
            "message": "Hello, I'm interested in this property!",
            "receiver_id": self.users['owner']['id']
        }

        success, response = self.run_test(
            "Send Chat Message",
            "POST",
            "chat/messages",
            200,
            data=message_data,
            token=self.tokens['renter']
        )

        # Get messages for the property
        success, response = self.run_test(
            "Get Chat Messages",
            "GET",
            f"chat/messages/{self.property_ids[0]}",
            200,
            token=self.tokens['renter']
        )

        # Get conversations
        success, response = self.run_test(
            "Get Conversations",
            "GET",
            "chat/conversations",
            200,
            token=self.tokens['renter']
        )

    def test_notifications(self):
        """Test notification functionality"""
        if 'renter' not in self.tokens:
            print("❌ No renter token for notification test")
            return

        # Set notification preferences
        prefs_data = {
            "rental_type": "long-term",
            "min_bedrooms": 2,
            "max_price": 6000.0,
            "area": "Tel Aviv"
        }

        success, response = self.run_test(
            "Set Notification Preferences",
            "POST",
            "notifications/preferences",
            200,
            data=prefs_data,
            token=self.tokens['renter']
        )

        # Get notifications
        success, response = self.run_test(
            "Get Notifications",
            "GET",
            "notifications",
            200,
            token=self.tokens['renter']
        )

    def test_translation_service(self):
        """Test translation functionality"""
        translation_data = {
            "text": "Hello, how are you?",
            "from_lang": "english",
            "to_lang": "hebrew"
        }

        success, response = self.run_test(
            "Translation Service",
            "POST",
            "translate",
            200,
            data=translation_data
        )

    def test_document_service(self):
        """Test document service request"""
        if 'renter' not in self.tokens:
            print("❌ No renter token for document service test")
            return

        service_data = {
            "service_type": "arnona",
            "property_address": "123 Test Street, Tel Aviv",
            "tenant_name": "Test Renter",
            "tenant_id": "123456789",
            "additional_info": "Please process quickly"
        }

        success, response = self.run_test(
            "Document Service Request",
            "POST",
            "document-service",
            200,
            data=service_data,
            token=self.tokens['renter']
        )

        # Get document services
        success, response = self.run_test(
            "Get Document Services",
            "GET",
            "document-service",
            200,
            token=self.tokens['renter']
        )

    def test_contact_form(self):
        """Test contact form submission"""
        contact_data = {
            "name": "Test User",
            "email": "test@example.com",
            "phone": "+972501234567",
            "message": "I have a question about your services"
        }

        success, response = self.run_test(
            "Contact Form",
            "POST",
            "contact",
            200,
            data=contact_data
        )

    def test_admin_dashboard(self):
        """Test admin dashboard functionality"""
        if 'admin' not in self.tokens:
            print("❌ No admin token for dashboard test")
            return

        success, response = self.run_test(
            "Admin Dashboard",
            "GET",
            "admin/dashboard",
            200,
            token=self.tokens['admin']
        )

        success, response = self.run_test(
            "Admin All Chats",
            "GET",
            "admin/chats",
            200,
            token=self.tokens['admin']
        )

    def test_manager_page(self):
        """Test manager page functionality"""
        if 'owner' not in self.tokens:
            print("❌ No owner token for manager page test")
            return

        manager_id = self.users['owner']['id']
        success, response = self.run_test(
            "Manager Properties Page",
            "GET",
            f"manager/{manager_id}/properties",
            200
        )

    def test_property_management(self):
        """Test property update and delete"""
        if 'owner' not in self.tokens or not self.property_ids:
            print("❌ Missing owner token or property ID for management test")
            return

        property_id = self.property_ids[0]
        
        # Update property
        update_data = {
            "title": "Updated Beautiful Test Apartment",
            "description": "An updated lovely apartment for testing purposes",
            "rental_type": "long-term",
            "property_type": "apartment",
            "bedrooms": 3,
            "bathrooms": 2,
            "area": "Tel Aviv",
            "address": "123 Test Street, Tel Aviv",
            "square_meters": 90.0,
            "floor": 3,
            "has_elevator": True,
            "is_shabbat_elevator": False,
            "porches": 1,
            "sukkah_compatible": True,
            "condition": "renovated",
            "furniture_package": False,
            "amenities": ["air_conditioning", "dishwasher", "pool"],
            "monthly_price": 5500.0,
            "images": ["https://example.com/image1.jpg"]
        }

        success, response = self.run_test(
            "Update Property",
            "PUT",
            f"properties/{property_id}",
            200,
            data=update_data,
            token=self.tokens['owner']
        )

def main():
    print("🚀 Starting Rental Website API Testing...")
    print("=" * 60)
    
    tester = RentalWebsiteAPITester()
    
    # Run all tests
    print("\n📝 Testing User Authentication...")
    tester.test_user_registration()
    tester.test_user_login()
    tester.test_get_current_user()
    
    print("\n🏠 Testing Property Management...")
    tester.test_property_creation()
    tester.test_get_properties()
    tester.test_get_property_detail()
    tester.test_property_search_filters()
    tester.test_property_management()
    
    print("\n📅 Testing Booking System...")
    tester.test_booking_creation()
    tester.test_get_bookings()
    
    print("\n💬 Testing Chat System...")
    tester.test_chat_functionality()
    
    print("\n🔔 Testing Notifications...")
    tester.test_notifications()
    
    print("\n🌐 Testing Translation Service...")
    tester.test_translation_service()
    
    print("\n📄 Testing Document Service...")
    tester.test_document_service()
    
    print("\n📞 Testing Contact Form...")
    tester.test_contact_form()
    
    print("\n👑 Testing Admin Features...")
    tester.test_admin_dashboard()
    
    print("\n🏢 Testing Manager Page...")
    tester.test_manager_page()
    
    # Print final results
    print("\n" + "=" * 60)
    print(f"📊 FINAL RESULTS:")
    print(f"Tests Run: {tester.tests_run}")
    print(f"Tests Passed: {tester.tests_passed}")
    print(f"Tests Failed: {tester.tests_run - tester.tests_passed}")
    print(f"Success Rate: {(tester.tests_passed / tester.tests_run * 100):.1f}%")
    
    if tester.tests_passed == tester.tests_run:
        print("🎉 All tests passed!")
        return 0
    else:
        print("⚠️  Some tests failed. Check the output above for details.")
        return 1

if __name__ == "__main__":
    sys.exit(main())