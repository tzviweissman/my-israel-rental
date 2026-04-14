#!/usr/bin/env python3
"""
Backend API Testing for MyIsraelRental.com Password Management Endpoints
Testing 3 new password management endpoints:
1. POST /api/auth/forgot-password
2. POST /api/auth/reset-password  
3. POST /api/auth/change-password
"""

import requests
import json
import sys
from datetime import datetime

# Configuration
BASE_URL = "https://where-am-i-project.preview.emergentagent.com/api"
TEST_EMAIL = "owner@test.com"
ORIGINAL_PASSWORD = "Test1234!"

def log_test(test_name, status, details=""):
    """Log test results with timestamp"""
    timestamp = datetime.now().strftime("%H:%M:%S")
    status_symbol = "✅" if status == "PASS" else "❌" if status == "FAIL" else "⚠️"
    print(f"[{timestamp}] {status_symbol} {test_name}")
    if details:
        print(f"    {details}")
    print()

def make_request(method, endpoint, data=None, headers=None, expected_status=None):
    """Make HTTP request with error handling"""
    url = f"{BASE_URL}{endpoint}"
    try:
        if method.upper() == "POST":
            response = requests.post(url, json=data, headers=headers, timeout=30)
        elif method.upper() == "GET":
            response = requests.get(url, headers=headers, timeout=30)
        else:
            raise ValueError(f"Unsupported method: {method}")
        
        print(f"    Request: {method} {endpoint}")
        print(f"    Status: {response.status_code}")
        if data:
            print(f"    Body: {json.dumps(data, indent=2)}")
        
        if expected_status and response.status_code != expected_status:
            print(f"    ❌ Expected status {expected_status}, got {response.status_code}")
            print(f"    Response: {response.text}")
            return None
            
        try:
            return response.json()
        except:
            return {"status_code": response.status_code, "text": response.text}
            
    except requests.exceptions.RequestException as e:
        print(f"    ❌ Request failed: {e}")
        return None

def test_login(email, password):
    """Test login and return auth token"""
    print(f"🔐 Testing login with {email}")
    
    login_data = {
        "email": email,
        "password": password
    }
    
    response = make_request("POST", "/auth/login", login_data, expected_status=200)
    if response and "token" in response:
        log_test(f"Login with {email}", "PASS", f"Token received: {response['token'][:20]}...")
        return response["token"]
    else:
        log_test(f"Login with {email}", "FAIL", f"Login failed: {response}")
        return None

def test_forgot_password():
    """Test forgot password endpoint"""
    print("🔄 Testing Forgot Password Endpoint")
    
    # Test 1: Valid email (existing user)
    print("Test 1: Valid email (existing user)")
    forgot_data = {"email": TEST_EMAIL}
    response = make_request("POST", "/auth/forgot-password", forgot_data, expected_status=200)
    
    if response and "reset_token" in response and response["reset_token"]:
        log_test("Forgot Password - Valid Email", "PASS", 
                f"Reset token received: {response['reset_token'][:20]}...")
        reset_token = response["reset_token"]
    else:
        log_test("Forgot Password - Valid Email", "FAIL", 
                f"No reset token received: {response}")
        return None
    
    # Test 2: Non-existent email
    print("Test 2: Non-existent email")
    forgot_data_invalid = {"email": "nonexistent@test.com"}
    response_invalid = make_request("POST", "/auth/forgot-password", forgot_data_invalid, expected_status=200)
    
    if response_invalid and response_invalid.get("reset_token") is None:
        log_test("Forgot Password - Invalid Email", "PASS", 
                "Correctly returned null reset_token for non-existent email")
    else:
        log_test("Forgot Password - Invalid Email", "FAIL", 
                f"Should return null reset_token for non-existent email: {response_invalid}")
    
    return reset_token

def test_reset_password(reset_token):
    """Test reset password endpoint"""
    print("🔄 Testing Reset Password Endpoint")
    
    if not reset_token:
        log_test("Reset Password", "FAIL", "No reset token available from forgot password test")
        return False
    
    # Test 1: Valid token with new password
    print("Test 1: Valid token with new password")
    new_password = "NewPass123!"
    reset_data = {
        "token": reset_token,
        "new_password": new_password
    }
    
    response = make_request("POST", "/auth/reset-password", reset_data, expected_status=200)
    
    if response and "message" in response and "successfully" in response["message"].lower():
        log_test("Reset Password - Valid Token", "PASS", 
                f"Password reset successful: {response['message']}")
        
        # Test 2: Verify login with new password
        print("Test 2: Verify login with new password")
        token = test_login(TEST_EMAIL, new_password)
        if token:
            log_test("Login After Reset", "PASS", "Successfully logged in with new password")
            
            # Reset password back to original for other tests
            print("Resetting password back to original...")
            forgot_response = make_request("POST", "/auth/forgot-password", {"email": TEST_EMAIL})
            if forgot_response and forgot_response.get("reset_token"):
                restore_data = {
                    "token": forgot_response["reset_token"],
                    "new_password": ORIGINAL_PASSWORD
                }
                restore_response = make_request("POST", "/auth/reset-password", restore_data)
                if restore_response:
                    log_test("Password Restoration", "PASS", "Password restored to original")
                    return True
                else:
                    log_test("Password Restoration", "FAIL", "Failed to restore original password")
                    return False
            else:
                log_test("Password Restoration", "FAIL", "Failed to get reset token for restoration")
                return False
        else:
            log_test("Login After Reset", "FAIL", "Failed to login with new password")
            return False
    else:
        log_test("Reset Password - Valid Token", "FAIL", 
                f"Password reset failed: {response}")
        return False

def test_change_password():
    """Test change password endpoint (requires authentication)"""
    print("🔄 Testing Change Password Endpoint")
    
    # First, login to get auth token
    token = test_login(TEST_EMAIL, ORIGINAL_PASSWORD)
    if not token:
        log_test("Change Password Setup", "FAIL", "Failed to get auth token")
        return False
    
    headers = {"Authorization": f"Bearer {token}"}
    
    # Test 1: Valid current password
    print("Test 1: Valid current password")
    new_password = "Changed123!"
    change_data = {
        "current_password": ORIGINAL_PASSWORD,
        "new_password": new_password
    }
    
    response = make_request("POST", "/auth/change-password", change_data, headers, expected_status=200)
    
    if response and "message" in response and "successfully" in response["message"].lower():
        log_test("Change Password - Valid Current", "PASS", 
                f"Password changed successfully: {response['message']}")
        
        # Test 2: Verify login with new password
        print("Test 2: Verify login with new password")
        new_token = test_login(TEST_EMAIL, new_password)
        if new_token:
            log_test("Login After Change", "PASS", "Successfully logged in with new password")
            
            # Test 3: Test with wrong current password (should fail)
            print("Test 3: Test with wrong current password")
            headers_new = {"Authorization": f"Bearer {new_token}"}
            wrong_change_data = {
                "current_password": "WrongPassword123!",
                "new_password": "AnotherPass123!"
            }
            
            wrong_response = make_request("POST", "/auth/change-password", wrong_change_data, headers_new, expected_status=400)
            if wrong_response and "incorrect" in str(wrong_response).lower():
                log_test("Change Password - Wrong Current", "PASS", "Correctly rejected wrong current password")
            else:
                log_test("Change Password - Wrong Current", "FAIL", f"Should reject wrong current password: {wrong_response}")
            
            # Change password back to original
            print("Changing password back to original...")
            restore_data = {
                "current_password": new_password,
                "new_password": ORIGINAL_PASSWORD
            }
            restore_response = make_request("POST", "/auth/change-password", restore_data, headers_new)
            if restore_response:
                log_test("Password Restoration via Change", "PASS", "Password restored to original")
                return True
            else:
                log_test("Password Restoration via Change", "FAIL", "Failed to restore original password")
                return False
        else:
            log_test("Login After Change", "FAIL", "Failed to login with new password")
            return False
    else:
        log_test("Change Password - Valid Current", "FAIL", 
                f"Password change failed: {response}")
        return False

def main():
    """Main test execution"""
    print("=" * 80)
    print("🧪 BACKEND API TESTING - PASSWORD MANAGEMENT ENDPOINTS")
    print("=" * 80)
    print(f"Base URL: {BASE_URL}")
    print(f"Test Email: {TEST_EMAIL}")
    print(f"Original Password: {ORIGINAL_PASSWORD}")
    print("=" * 80)
    
    # Test sequence
    test_results = []
    
    # 1. Test Forgot Password
    reset_token = test_forgot_password()
    test_results.append(("Forgot Password", reset_token is not None))
    
    # 2. Test Reset Password
    if reset_token:
        reset_success = test_reset_password(reset_token)
        test_results.append(("Reset Password", reset_success))
    else:
        test_results.append(("Reset Password", False))
        print("⚠️ Skipping Reset Password test due to failed Forgot Password")
    
    # 3. Test Change Password
    change_success = test_change_password()
    test_results.append(("Change Password", change_success))
    
    # Final verification - ensure we can still login with original password
    print("🔍 Final Verification - Login with original password")
    final_token = test_login(TEST_EMAIL, ORIGINAL_PASSWORD)
    if final_token:
        log_test("Final Verification", "PASS", "Can login with original password - all tests completed successfully")
    else:
        log_test("Final Verification", "FAIL", "Cannot login with original password - password may not have been restored")
    
    # Summary
    print("=" * 80)
    print("📊 TEST SUMMARY")
    print("=" * 80)
    
    passed = 0
    total = len(test_results)
    
    for test_name, success in test_results:
        status = "✅ PASS" if success else "❌ FAIL"
        print(f"{status} {test_name}")
        if success:
            passed += 1
    
    print(f"\nOverall: {passed}/{total} tests passed")
    
    if passed == total:
        print("🎉 All password management endpoints are working correctly!")
        return 0
    else:
        print("⚠️ Some tests failed. Check the details above.")
        return 1

if __name__ == "__main__":
    sys.exit(main())