#!/usr/bin/env python3
"""
Specific test for contract management APIs as requested in the review.
Tests all contract endpoints with proper authentication and file handling.
"""

import requests
import json
import io
from reportlab.pdfgen import canvas
from reportlab.lib.pagesizes import letter

class ContractAPITester:
    def __init__(self):
        self.base_url = "https://where-am-i-project.preview.emergentagent.com"
        self.api_url = f"{self.base_url}/api"
        self.token = None
        self.user_id = None
        self.property_id = None
        self.contract_ids = []
        
    def login(self):
        """Login with test credentials"""
        print("🔐 Logging in with test credentials...")
        
        login_data = {
            "email": "owner@test.com",
            "password": "Test1234!"
        }
        
        response = requests.post(f"{self.api_url}/auth/login", json=login_data)
        
        if response.status_code == 200:
            data = response.json()
            self.token = data['token']
            self.user_id = data['user']['id']
            print(f"✅ Login successful - User ID: {self.user_id}")
            return True
        else:
            print(f"❌ Login failed: {response.status_code} - {response.text}")
            return False
    
    def get_property_id(self):
        """Get a property ID for the owner"""
        print("🏠 Getting property ID...")
        
        headers = {'Authorization': f'Bearer {self.token}'}
        response = requests.get(f"{self.api_url}/properties?owner_id={self.user_id}", headers=headers)
        
        if response.status_code == 200:
            properties = response.json()
            if properties:
                self.property_id = properties[0]['id']
                print(f"✅ Found property ID: {self.property_id}")
                return True
            else:
                print("❌ No properties found for this owner")
                return False
        else:
            print(f"❌ Failed to get properties: {response.status_code}")
            return False
    
    def create_test_pdf(self, content="Test Contract Content"):
        """Create a test PDF file"""
        buffer = io.BytesIO()
        p = canvas.Canvas(buffer, pagesize=letter)
        p.drawString(100, 750, "MyIsraelRental.com Contract")
        p.drawString(100, 730, "=" * 40)
        p.drawString(100, 710, content)
        p.drawString(100, 690, "Property Rental Agreement")
        p.drawString(100, 670, "This is a test contract document.")
        p.drawString(100, 650, "Tenant: Test Tenant")
        p.drawString(100, 630, "Property: Test Property")
        p.drawString(100, 610, "Duration: 12 months")
        p.drawString(100, 590, "Monthly Rent: 5000 ILS")
        p.drawString(100, 570, "Security Deposit: 10000 ILS")
        p.showPage()
        p.save()
        buffer.seek(0)
        return buffer
    
    def test_contract_upload(self):
        """Test 1: Contract Upload (POST /api/contracts/upload)"""
        print("\n📤 Test 1: Contract Upload")
        
        if not self.property_id:
            print("❌ No property ID available")
            return False
        
        # Create test PDF
        pdf_buffer = self.create_test_pdf("Contract Upload Test Document")
        
        headers = {'Authorization': f'Bearer {self.token}'}
        files = {
            'file': ('test_contract.pdf', pdf_buffer, 'application/pdf')
        }
        data = {
            'property_id': self.property_id
        }
        
        response = requests.post(f"{self.api_url}/contracts/upload", headers=headers, files=files, data=data)
        
        if response.status_code == 200:
            result = response.json()
            contract_id = result.get('id')
            if contract_id:
                self.contract_ids.append(contract_id)
                print(f"✅ Contract uploaded successfully")
                print(f"   Contract ID: {contract_id}")
                print(f"   Original filename: {result.get('original_filename')}")
                print(f"   File type: {result.get('file_type')}")
                print(f"   Extracted text length: {result.get('extracted_text_length')}")
                return True
            else:
                print("❌ No contract ID in response")
                return False
        else:
            print(f"❌ Upload failed: {response.status_code}")
            try:
                print(f"   Error: {response.json()}")
            except:
                print(f"   Response: {response.text}")
            return False
    
    def test_contract_list(self):
        """Test 2: Contract List (GET /api/contracts)"""
        print("\n📋 Test 2: Contract List")
        
        headers = {'Authorization': f'Bearer {self.token}'}
        response = requests.get(f"{self.api_url}/contracts", headers=headers)
        
        if response.status_code == 200:
            contracts = response.json()
            print(f"✅ Retrieved {len(contracts)} contracts")
            for contract in contracts:
                print(f"   - Contract ID: {contract.get('id')}")
                print(f"     Property ID: {contract.get('property_id')}")
                print(f"     Original filename: {contract.get('original_filename')}")
                print(f"     Created: {contract.get('created_at')}")
            return True
        else:
            print(f"❌ List failed: {response.status_code}")
            return False
    
    def test_contract_get(self):
        """Test 3: Contract Get (GET /api/contracts/{contract_id})"""
        print("\n📄 Test 3: Contract Get")
        
        if not self.contract_ids:
            print("❌ No contract IDs available")
            return False
        
        contract_id = self.contract_ids[0]
        headers = {'Authorization': f'Bearer {self.token}'}
        response = requests.get(f"{self.api_url}/contracts/{contract_id}", headers=headers)
        
        if response.status_code == 200:
            contract = response.json()
            print(f"✅ Retrieved contract details")
            print(f"   Contract ID: {contract.get('id')}")
            print(f"   Property ID: {contract.get('property_id')}")
            print(f"   File type: {contract.get('file_type')}")
            print(f"   File size: {contract.get('file_size')} bytes")
            print(f"   Extracted text length: {len(contract.get('extracted_text', ''))}")
            print(f"   Translation status: {contract.get('translation_status')}")
            print(f"   Signed: {contract.get('signed')}")
            return True
        else:
            print(f"❌ Get failed: {response.status_code}")
            return False
    
    def test_contract_translation(self):
        """Test 4: Contract Translation (POST /api/contracts/{contract_id}/translate)"""
        print("\n🌐 Test 4: Contract Translation")
        
        if not self.contract_ids:
            print("❌ No contract IDs available")
            return False
        
        contract_id = self.contract_ids[0]
        headers = {'Authorization': f'Bearer {self.token}'}
        
        # Test Hebrew to English translation
        data = {'direction': 'he-en'}
        response = requests.post(f"{self.api_url}/contracts/{contract_id}/translate", headers=headers, data=data)
        
        if response.status_code == 200:
            result = response.json()
            print(f"✅ Translation completed")
            print(f"   Direction: {result.get('direction')}")
            print(f"   Status: {result.get('status')}")
            print(f"   Translated text length: {len(result.get('translated_text', ''))}")
            if result.get('translated_text'):
                print(f"   First 100 chars: {result.get('translated_text')[:100]}...")
            return True
        else:
            print(f"❌ Translation failed: {response.status_code}")
            try:
                print(f"   Error: {response.json()}")
            except:
                print(f"   Response: {response.text}")
            return False
    
    def test_contract_sign(self):
        """Test 5: Contract Sign (POST /api/contracts/{contract_id}/sign)"""
        print("\n✍️ Test 5: Contract Sign")
        
        if not self.contract_ids:
            print("❌ No contract IDs available")
            return False
        
        contract_id = self.contract_ids[0]
        headers = {'Authorization': f'Bearer {self.token}', 'Content-Type': 'application/json'}
        
        signature_data = {
            "contract_id": contract_id,
            "signer_name": "Test Owner",
            "signature_data": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=="
        }
        
        response = requests.post(f"{self.api_url}/contracts/{contract_id}/sign", headers=headers, json=signature_data)
        
        if response.status_code == 200:
            result = response.json()
            print(f"✅ Contract signed successfully")
            print(f"   Message: {result.get('message')}")
            print(f"   Signed at: {result.get('signed_at')}")
            return True
        else:
            print(f"❌ Signing failed: {response.status_code}")
            try:
                print(f"   Error: {response.json()}")
            except:
                print(f"   Response: {response.text}")
            return False
    
    def test_contract_download(self):
        """Test 6: Contract Download (GET /api/contracts/download/{contract_id})"""
        print("\n⬇️ Test 6: Contract Download")
        
        if not self.contract_ids:
            print("❌ No contract IDs available")
            return False
        
        contract_id = self.contract_ids[0]
        response = requests.get(f"{self.api_url}/contracts/download/{contract_id}")
        
        if response.status_code == 200:
            print(f"✅ Contract downloaded successfully")
            print(f"   Content type: {response.headers.get('content-type')}")
            print(f"   Content length: {len(response.content)} bytes")
            print(f"   Content disposition: {response.headers.get('content-disposition')}")
            return True
        else:
            print(f"❌ Download failed: {response.status_code}")
            return False
    
    def test_contract_delete(self):
        """Test 7: Contract Delete (DELETE /api/contracts/{contract_id})"""
        print("\n🗑️ Test 7: Contract Delete")
        
        # Upload a new contract for deletion test
        pdf_buffer = self.create_test_pdf("Contract for Deletion Test")
        
        headers = {'Authorization': f'Bearer {self.token}'}
        files = {
            'file': ('delete_test_contract.pdf', pdf_buffer, 'application/pdf')
        }
        data = {
            'property_id': self.property_id
        }
        
        # Upload contract
        response = requests.post(f"{self.api_url}/contracts/upload", headers=headers, files=files, data=data)
        
        if response.status_code == 200:
            result = response.json()
            contract_id = result.get('id')
            print(f"✅ Uploaded contract for deletion: {contract_id}")
            
            # Now delete it
            response = requests.delete(f"{self.api_url}/contracts/{contract_id}", headers=headers)
            
            if response.status_code == 200:
                result = response.json()
                print(f"✅ Contract deleted successfully")
                print(f"   Message: {result.get('message')}")
                return True
            else:
                print(f"❌ Deletion failed: {response.status_code}")
                return False
        else:
            print(f"❌ Failed to upload contract for deletion test: {response.status_code}")
            return False
    
    def run_all_tests(self):
        """Run all contract management tests"""
        print("🚀 Starting Contract Management API Tests")
        print("=" * 60)
        
        # Login first
        if not self.login():
            return False
        
        # Get property ID
        if not self.get_property_id():
            return False
        
        # Run all tests
        tests = [
            self.test_contract_upload,
            self.test_contract_list,
            self.test_contract_get,
            self.test_contract_translation,
            self.test_contract_sign,
            self.test_contract_download,
            self.test_contract_delete
        ]
        
        passed = 0
        total = len(tests)
        
        for test in tests:
            try:
                if test():
                    passed += 1
            except Exception as e:
                print(f"❌ Test failed with exception: {e}")
        
        print("\n" + "=" * 60)
        print(f"📊 FINAL RESULTS:")
        print(f"Tests Run: {total}")
        print(f"Tests Passed: {passed}")
        print(f"Tests Failed: {total - passed}")
        print(f"Success Rate: {(passed / total * 100):.1f}%")
        
        if passed == total:
            print("🎉 All contract management tests passed!")
            return True
        else:
            print("⚠️ Some tests failed. Check the output above for details.")
            return False

if __name__ == "__main__":
    tester = ContractAPITester()
    success = tester.run_all_tests()
    exit(0 if success else 1)