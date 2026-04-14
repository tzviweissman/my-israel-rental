import requests
import sys
import json
import io
from datetime import datetime
from reportlab.pdfgen import canvas
from reportlab.lib.pagesizes import letter

class RentalWebsiteAPITester:
    def __init__(self, base_url="https://where-am-i-project.preview.emergentagent.com"):
        self.base_url = base_url
        self.api_url = f"{base_url}/api"
        self.tokens = {}
        self.users = {}
        self.property_ids = []
        self.booking_ids = []
        self.contract_ids = []
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

    def create_test_pdf(self):
        """Create a simple test PDF file"""
        buffer = io.BytesIO()
        p = canvas.Canvas(buffer, pagesize=letter)
        p.drawString(100, 750, "Test Contract Document")
        p.drawString(100, 730, "This is a test contract for MyIsraelRental.com")
        p.drawString(100, 710, "Property: Test Apartment")
        p.drawString(100, 690, "Tenant: Test Tenant")
        p.drawString(100, 670, "Duration: 12 months")
        p.drawString(100, 650, "Monthly Rent: 5000 ILS")
        p.showPage()
        p.save()
        buffer.seek(0)
        return buffer

    def test_contract_upload(self):
        """Test contract upload functionality"""
        if 'owner' not in self.tokens:
            print("❌ No owner token available for contract upload")
            return

        # First, get a property ID for the owner
        success, properties = self.run_test(
            "Get Owner Properties for Contract",
            "GET",
            f"properties?owner_id={self.users['owner']['id']}",
            200,
            token=self.tokens['owner']
        )
        
        if not success or not properties:
            print("❌ No properties found for contract upload test")
            return

        property_id = properties[0]['id']
        
        # Create a test PDF
        pdf_buffer = self.create_test_pdf()
        
        # Upload contract
        url = f"{self.api_url}/contracts/upload"
        headers = {'Authorization': f'Bearer {self.tokens["owner"]}'}
        
        files = {
            'file': ('test_contract.pdf', pdf_buffer, 'application/pdf')
        }
        data = {
            'property_id': property_id
        }
        
        self.tests_run += 1
        print(f"\n🔍 Testing Contract Upload...")
        
        try:
            response = requests.post(url, headers=headers, files=files, data=data)
            success = response.status_code == 200
            
            if success:
                self.tests_passed += 1
                print(f"✅ Passed - Status: {response.status_code}")
                response_data = response.json()
                if 'id' in response_data:
                    self.contract_ids.append(response_data['id'])
                    print(f"✅ Contract uploaded with ID: {response_data['id']}")
                return success, response_data
            else:
                print(f"❌ Failed - Expected 200, got {response.status_code}")
                try:
                    print(f"Response: {response.json()}")
                except:
                    print(f"Response text: {response.text}")
                return False, {}
                
        except Exception as e:
            print(f"❌ Failed - Error: {str(e)}")
            return False, {}

    def test_contract_list(self):
        """Test contract listing"""
        if 'owner' not in self.tokens:
            print("❌ No owner token available for contract list")
            return

        success, response = self.run_test(
            "List Contracts",
            "GET",
            "contracts",
            200,
            token=self.tokens['owner']
        )
        
        if success:
            print(f"✅ Retrieved {len(response)} contracts")

    def test_contract_get(self):
        """Test getting individual contract"""
        if 'owner' not in self.tokens or not self.contract_ids:
            print("❌ No owner token or contract ID available for contract get")
            return

        contract_id = self.contract_ids[0]
        success, response = self.run_test(
            "Get Contract Details",
            "GET",
            f"contracts/{contract_id}",
            200,
            token=self.tokens['owner']
        )

    def test_contract_translation(self):
        """Test contract translation"""
        if 'owner' not in self.tokens or not self.contract_ids:
            print("❌ No owner token or contract ID available for translation")
            return

        contract_id = self.contract_ids[0]
        
        # Test translation
        url = f"{self.api_url}/contracts/{contract_id}/translate"
        headers = {'Authorization': f'Bearer {self.tokens["owner"]}'}
        
        data = {
            'direction': 'en-he'
        }
        
        self.tests_run += 1
        print(f"\n🔍 Testing Contract Translation...")
        
        try:
            response = requests.post(url, headers=headers, data=data)
            success = response.status_code == 200
            
            if success:
                self.tests_passed += 1
                print(f"✅ Passed - Status: {response.status_code}")
                response_data = response.json()
                print(f"✅ Translation completed: {response_data.get('status', 'unknown')}")
                return success, response_data
            else:
                print(f"❌ Failed - Expected 200, got {response.status_code}")
                try:
                    print(f"Response: {response.json()}")
                except:
                    print(f"Response text: {response.text}")
                return False, {}
                
        except Exception as e:
            print(f"❌ Failed - Error: {str(e)}")
            return False, {}

    def test_contract_signing(self):
        """Test contract digital signing"""
        if 'owner' not in self.tokens or not self.contract_ids:
            print("❌ No owner token or contract ID available for signing")
            return

        contract_id = self.contract_ids[0]
        
        signature_data = {
            "contract_id": contract_id,
            "signer_name": "Test Owner",
            "signature_data": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=="
        }

        success, response = self.run_test(
            "Sign Contract",
            "POST",
            f"contracts/{contract_id}/sign",
            200,
            data=signature_data,
            token=self.tokens['owner']
        )

    def test_contract_download(self):
        """Test contract download"""
        if not self.contract_ids:
            print("❌ No contract ID available for download")
            return

        contract_id = self.contract_ids[0]
        
        url = f"{self.api_url}/contracts/download/{contract_id}"
        
        self.tests_run += 1
        print(f"\n🔍 Testing Contract Download...")
        
        try:
            response = requests.get(url)
            success = response.status_code == 200
            
            if success:
                self.tests_passed += 1
                print(f"✅ Passed - Status: {response.status_code}")
                print(f"✅ Downloaded file size: {len(response.content)} bytes")
                return success, {}
            else:
                print(f"❌ Failed - Expected 200, got {response.status_code}")
                try:
                    print(f"Response: {response.json()}")
                except:
                    print(f"Response text: {response.text}")
                return False, {}
                
        except Exception as e:
            print(f"❌ Failed - Error: {str(e)}")
            return False, {}

    def test_contract_delete(self):
        """Test contract deletion"""
        if 'owner' not in self.tokens:
            print("❌ No owner token available for contract deletion")
            return

        # Upload another contract for deletion test
        success, properties = self.run_test(
            "Get Owner Properties for Delete Test",
            "GET",
            f"properties?owner_id={self.users['owner']['id']}",
            200,
            token=self.tokens['owner']
        )
        
        if not success or not properties:
            print("❌ No properties found for contract deletion test")
            return

        property_id = properties[0]['id']
        
        # Create and upload a test PDF for deletion
        pdf_buffer = self.create_test_pdf()
        
        url = f"{self.api_url}/contracts/upload"
        headers = {'Authorization': f'Bearer {self.tokens["owner"]}'}
        
        files = {
            'file': ('test_contract_delete.pdf', pdf_buffer, 'application/pdf')
        }
        data = {
            'property_id': property_id
        }
        
        try:
            response = requests.post(url, headers=headers, files=files, data=data)
            if response.status_code == 200:
                contract_data = response.json()
                contract_id = contract_data['id']
                
                # Now delete the contract
                success, response = self.run_test(
                    "Delete Contract",
                    "DELETE",
                    f"contracts/{contract_id}",
                    200,
                    token=self.tokens['owner']
                )
            else:
                print("❌ Failed to upload contract for deletion test")
                
        except Exception as e:
            print(f"❌ Failed to setup contract for deletion: {str(e)}")

    def test_contract_management_flow(self):
        """Test complete contract management workflow"""
        print("\n📄 Testing Contract Management System...")
        
        # Test with existing credentials
        login_success, login_response = self.run_test(
            "Login Owner for Contracts",
            "POST",
            "auth/login",
            200,
            data={"email": "owner@test.com", "password": "Test1234!"}
        )
        
        if login_success and 'token' in login_response:
            self.tokens['owner'] = login_response['token']
            self.users['owner'] = login_response['user']
            print("✅ Logged in with test credentials")
        else:
            print("❌ Failed to login with test credentials")
            return

        self.test_contract_upload()
        self.test_contract_list()
        self.test_contract_get()
        self.test_contract_translation()
        self.test_contract_signing()
        self.test_contract_download()
        self.test_contract_delete()

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
    
    print("\n📄 Testing Contract Management...")
    tester.test_contract_management_flow()
    
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