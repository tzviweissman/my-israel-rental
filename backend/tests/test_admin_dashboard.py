"""
Test suite for Admin Dashboard APIs
Tests all admin endpoints: users, properties, chats, document services, settings
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials loaded from tests/.env.test via conftest
from conftest import (
    TEST_ADMIN_EMAIL as ADMIN_EMAIL,
    TEST_ADMIN_PASSWORD as ADMIN_PASSWORD,
    TEST_OWNER_EMAIL as OWNER_EMAIL,
    TEST_OWNER_PASSWORD as OWNER_PASSWORD,
    TEST_RENTER_EMAIL as RENTER_EMAIL,
    TEST_RENTER_PASSWORD as RENTER_PASSWORD,
)


class TestAdminAuth:
    """Test admin authentication and access control"""
    
    def test_admin_login_success(self):
        """Admin can login successfully"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        assert response.status_code == 200, f"Admin login failed: {response.text}"
        data = response.json()
        assert "token" in data
        assert data["user"]["role"] == "admin"
        print(f"✓ Admin login successful, role: {data['user']['role']}")
    
    def test_owner_login_success(self):
        """Owner can login successfully"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": OWNER_EMAIL,
            "password": OWNER_PASSWORD
        })
        assert response.status_code == 200, f"Owner login failed: {response.text}"
        data = response.json()
        assert "token" in data
        assert data["user"]["role"] in ["owner", "manager"]
        print(f"✓ Owner login successful, role: {data['user']['role']}")
    
    def test_renter_login_success(self):
        """Renter can login successfully"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": RENTER_EMAIL,
            "password": RENTER_PASSWORD
        })
        assert response.status_code == 200, f"Renter login failed: {response.text}"
        data = response.json()
        assert "token" in data
        assert data["user"]["role"] == "renter"
        print(f"✓ Renter login successful, role: {data['user']['role']}")


@pytest.fixture
def admin_token():
    """Get admin authentication token"""
    response = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email": ADMIN_EMAIL,
        "password": ADMIN_PASSWORD
    })
    if response.status_code == 200:
        return response.json().get("token")
    pytest.skip("Admin authentication failed")


@pytest.fixture
def owner_token():
    """Get owner authentication token"""
    response = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email": OWNER_EMAIL,
        "password": OWNER_PASSWORD
    })
    if response.status_code == 200:
        return response.json().get("token")
    pytest.skip("Owner authentication failed")


@pytest.fixture
def renter_token():
    """Get renter authentication token"""
    response = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email": RENTER_EMAIL,
        "password": RENTER_PASSWORD
    })
    if response.status_code == 200:
        return response.json().get("token")
    pytest.skip("Renter authentication failed")


class TestAdminDashboard:
    """Test admin dashboard overview endpoint"""
    
    def test_admin_dashboard_access(self, admin_token):
        """Admin can access dashboard"""
        response = requests.get(f"{BASE_URL}/api/admin/dashboard", 
            headers={"Authorization": f"Bearer {admin_token}"})
        assert response.status_code == 200, f"Dashboard access failed: {response.text}"
        data = response.json()
        
        # Verify all required stats are present
        assert "active_listings" in data
        assert "total_views" in data
        assert "total_inquiries" in data
        assert "total_users" in data
        assert "recent_properties" in data
        
        print(f"✓ Dashboard stats: {data['active_listings']} listings, {data['total_users']} users, pending services removed")
    
    def test_dashboard_403_for_owner(self, owner_token):
        """Owner cannot access admin dashboard"""
        response = requests.get(f"{BASE_URL}/api/admin/dashboard",
            headers={"Authorization": f"Bearer {owner_token}"})
        assert response.status_code == 403, f"Expected 403, got {response.status_code}"
        print("✓ Owner correctly denied access to admin dashboard")
    
    def test_dashboard_403_for_renter(self, renter_token):
        """Renter cannot access admin dashboard"""
        response = requests.get(f"{BASE_URL}/api/admin/dashboard",
            headers={"Authorization": f"Bearer {renter_token}"})
        assert response.status_code == 403, f"Expected 403, got {response.status_code}"
        print("✓ Renter correctly denied access to admin dashboard")


class TestAdminUsers:
    """Test admin user management endpoints"""
    
    def test_get_all_users(self, admin_token):
        """Admin can get all users without passwords"""
        response = requests.get(f"{BASE_URL}/api/admin/users",
            headers={"Authorization": f"Bearer {admin_token}"})
        assert response.status_code == 200, f"Get users failed: {response.text}"
        users = response.json()
        
        assert isinstance(users, list)
        assert len(users) > 0, "Expected at least one user"
        
        # Verify no passwords are returned
        for user in users:
            assert "password" not in user, "Password should not be returned"
            assert "id" in user
            assert "email" in user
            assert "role" in user
        
        print(f"✓ Retrieved {len(users)} users without passwords")
    
    def test_users_403_for_non_admin(self, owner_token):
        """Non-admin cannot access user list"""
        response = requests.get(f"{BASE_URL}/api/admin/users",
            headers={"Authorization": f"Bearer {owner_token}"})
        assert response.status_code == 403
        print("✓ Non-admin correctly denied access to user list")
    
    def test_toggle_user_status(self, admin_token):
        """Admin can toggle user status (block/unblock)"""
        # First get users to find a non-admin user
        users_response = requests.get(f"{BASE_URL}/api/admin/users",
            headers={"Authorization": f"Bearer {admin_token}"})
        users = users_response.json()
        
        # Find a non-admin user to toggle
        non_admin_user = next((u for u in users if u["role"] != "admin"), None)
        if not non_admin_user:
            pytest.skip("No non-admin user found to test toggle")
        
        user_id = non_admin_user["id"]
        original_status = non_admin_user.get("status", "active")
        
        # Toggle status
        response = requests.put(f"{BASE_URL}/api/admin/users/{user_id}/status",
            headers={"Authorization": f"Bearer {admin_token}"})
        assert response.status_code == 200, f"Toggle status failed: {response.text}"
        data = response.json()
        assert "status" in data
        
        new_status = data["status"]
        expected_status = "blocked" if original_status == "active" else "active"
        assert new_status == expected_status, f"Expected {expected_status}, got {new_status}"
        
        # Toggle back to original
        requests.put(f"{BASE_URL}/api/admin/users/{user_id}/status",
            headers={"Authorization": f"Bearer {admin_token}"})
        
        print(f"✓ User status toggled from {original_status} to {new_status} and back")
    
    def test_delete_user_creates_and_deletes(self, admin_token):
        """Admin can delete a user and their properties"""
        # Create a test user first
        test_email = "TEST_delete_user@test.com"
        register_response = requests.post(f"{BASE_URL}/api/auth/register", json={
            "email": test_email,
            "password": "testpass123",
            "name": "TEST Delete User",
            "role": "renter"
        })
        
        if register_response.status_code == 400:
            # User already exists, try to find and delete
            users_response = requests.get(f"{BASE_URL}/api/admin/users",
                headers={"Authorization": f"Bearer {admin_token}"})
            users = users_response.json()
            test_user = next((u for u in users if u["email"] == test_email), None)
            if test_user:
                user_id = test_user["id"]
            else:
                pytest.skip("Could not create or find test user")
        else:
            assert register_response.status_code == 200, f"Register failed: {register_response.text}"
            user_id = register_response.json()["user"]["id"]
        
        # Delete the user
        delete_response = requests.delete(f"{BASE_URL}/api/admin/users/{user_id}",
            headers={"Authorization": f"Bearer {admin_token}"})
        assert delete_response.status_code == 200, f"Delete failed: {delete_response.text}"
        
        # Verify user is deleted
        users_response = requests.get(f"{BASE_URL}/api/admin/users",
            headers={"Authorization": f"Bearer {admin_token}"})
        users = users_response.json()
        deleted_user = next((u for u in users if u["id"] == user_id), None)
        assert deleted_user is None, "User should be deleted"
        
        print("✓ Test user created and deleted successfully")
    
    def test_cannot_delete_self(self, admin_token):
        """Admin cannot delete their own account"""
        # Get admin user ID
        me_response = requests.get(f"{BASE_URL}/api/auth/me",
            headers={"Authorization": f"Bearer {admin_token}"})
        admin_id = me_response.json()["id"]
        
        # Try to delete self
        delete_response = requests.delete(f"{BASE_URL}/api/admin/users/{admin_id}",
            headers={"Authorization": f"Bearer {admin_token}"})
        assert delete_response.status_code == 400, f"Expected 400, got {delete_response.status_code}"
        
        print("✓ Admin correctly prevented from deleting self")


class TestAdminProperties:
    """Test admin property management endpoints"""
    
    def test_get_all_properties_with_owner_info(self, admin_token):
        """Admin can get all properties with owner name and email"""
        response = requests.get(f"{BASE_URL}/api/admin/properties",
            headers={"Authorization": f"Bearer {admin_token}"})
        assert response.status_code == 200, f"Get properties failed: {response.text}"
        properties = response.json()
        
        assert isinstance(properties, list)
        
        if len(properties) > 0:
            prop = properties[0]
            assert "owner_name" in prop, "owner_name should be included"
            assert "owner_email" in prop, "owner_email should be included"
            assert "id" in prop
            assert "title" in prop
            print(f"✓ Retrieved {len(properties)} properties with owner info")
        else:
            print("✓ No properties found (empty list returned)")
    
    def test_properties_403_for_non_admin(self, owner_token):
        """Non-admin cannot access admin properties endpoint"""
        response = requests.get(f"{BASE_URL}/api/admin/properties",
            headers={"Authorization": f"Bearer {owner_token}"})
        assert response.status_code == 403
        print("✓ Non-admin correctly denied access to admin properties")
    
    def test_toggle_property_status(self, admin_token):
        """Admin can toggle property status (active/inactive)"""
        # Get properties
        props_response = requests.get(f"{BASE_URL}/api/admin/properties",
            headers={"Authorization": f"Bearer {admin_token}"})
        properties = props_response.json()
        
        if len(properties) == 0:
            pytest.skip("No properties to test toggle")
        
        prop = properties[0]
        prop_id = prop["id"]
        original_status = prop.get("status", "active")
        
        # Toggle status
        response = requests.put(f"{BASE_URL}/api/admin/properties/{prop_id}/status",
            headers={"Authorization": f"Bearer {admin_token}"})
        assert response.status_code == 200, f"Toggle failed: {response.text}"
        data = response.json()
        
        new_status = data["status"]
        expected_status = "inactive" if original_status == "active" else "active"
        assert new_status == expected_status
        
        # Toggle back
        requests.put(f"{BASE_URL}/api/admin/properties/{prop_id}/status",
            headers={"Authorization": f"Bearer {admin_token}"})
        
        print(f"✓ Property status toggled from {original_status} to {new_status} and back")


class TestAdminChats:
    """Test admin chat viewing endpoint"""
    
    def test_get_all_chats(self, admin_token):
        """Admin can view all chats"""
        response = requests.get(f"{BASE_URL}/api/admin/chats",
            headers={"Authorization": f"Bearer {admin_token}"})
        assert response.status_code == 200, f"Get chats failed: {response.text}"
        chats = response.json()
        
        assert isinstance(chats, list)
        
        if len(chats) > 0:
            chat = chats[0]
            assert "property_id" in chat
            assert "property_title" in chat
            assert "participants" in chat
            assert "messages" in chat
            print(f"✓ Retrieved {len(chats)} chat conversations")
        else:
            print("✓ No chats found (empty list returned)")
    
    def test_chats_403_for_non_admin(self, renter_token):
        """Non-admin cannot access admin chats"""
        response = requests.get(f"{BASE_URL}/api/admin/chats",
            headers={"Authorization": f"Bearer {renter_token}"})
        assert response.status_code == 403
        print("✓ Non-admin correctly denied access to admin chats")


@pytest.mark.skip(reason=(
    "document/government filing services are DISCONTINUED (CLAUDE.md); the API "
    "answers 410 'no longer offered' on purpose. Kept, not deleted, so the "
    "tests come back if DOCUMENT_SERVICES_ENABLED is ever turned on."
))
class TestAdminDocumentServices:
    """Test admin document services endpoints"""
    
    def test_get_all_document_services(self, admin_token):
        """Admin can get all document service requests with user info"""
        response = requests.get(f"{BASE_URL}/api/admin/document-services",
            headers={"Authorization": f"Bearer {admin_token}"})
        assert response.status_code == 200, f"Get services failed: {response.text}"
        services = response.json()
        
        assert isinstance(services, list)
        
        if len(services) > 0:
            svc = services[0]
            assert "user_name" in svc, "user_name should be included"
            assert "user_email" in svc, "user_email should be included"
            assert "status" in svc
            print(f"✓ Retrieved {len(services)} document service requests")
        else:
            print("✓ No document services found (empty list returned)")
    
    def test_services_403_for_non_admin(self, owner_token):
        """Non-admin cannot access admin document services"""
        response = requests.get(f"{BASE_URL}/api/admin/document-services",
            headers={"Authorization": f"Bearer {owner_token}"})
        assert response.status_code == 403
        print("✓ Non-admin correctly denied access to admin document services")
    
    def test_update_service_status(self, admin_token, owner_token):
        """Admin can update document service status"""
        # First create a document service request as owner
        create_response = requests.post(f"{BASE_URL}/api/document-service", json={
            "service_type": "arnona_transfer",
            "property_address": "TEST 123 Test Street",
            "tenant_name": "TEST Tenant",
            "tenant_id": "123456789"
        }, headers={"Authorization": f"Bearer {owner_token}"})
        
        if create_response.status_code != 200:
            pytest.skip(f"Could not create test service: {create_response.text}")
        
        service_id = create_response.json()["id"]
        
        # Update status to in_progress
        response = requests.put(
            f"{BASE_URL}/api/admin/document-services/{service_id}/status?status=in_progress",
            headers={"Authorization": f"Bearer {admin_token}"})
        assert response.status_code == 200, f"Update status failed: {response.text}"
        
        # Update status to completed
        response = requests.put(
            f"{BASE_URL}/api/admin/document-services/{service_id}/status?status=completed",
            headers={"Authorization": f"Bearer {admin_token}"})
        assert response.status_code == 200
        
        print("✓ Document service status updated through all stages")
    
    def test_invalid_status_rejected(self, admin_token, owner_token):
        """Invalid status values are rejected"""
        # Create a service first
        create_response = requests.post(f"{BASE_URL}/api/document-service", json={
            "service_type": "name_change",
            "property_address": "TEST 456 Test Ave",
            "tenant_name": "TEST Tenant 2",
            "tenant_id": "987654321"
        }, headers={"Authorization": f"Bearer {owner_token}"})
        
        if create_response.status_code != 200:
            pytest.skip("Could not create test service")
        
        service_id = create_response.json()["id"]
        
        # Try invalid status
        response = requests.put(
            f"{BASE_URL}/api/admin/document-services/{service_id}/status?status=invalid_status",
            headers={"Authorization": f"Bearer {admin_token}"})
        assert response.status_code == 400, f"Expected 400 for invalid status, got {response.status_code}"
        
        print("✓ Invalid status correctly rejected")


class TestAdminSettings:
    """Test admin site settings endpoints"""
    
    def test_get_site_settings(self, admin_token):
        """Admin can get site settings"""
        response = requests.get(f"{BASE_URL}/api/admin/settings",
            headers={"Authorization": f"Bearer {admin_token}"})
        assert response.status_code == 200, f"Get settings failed: {response.text}"
        settings = response.json()
        
        # Verify expected fields exist (may be empty)
        assert "whatsapp_number" in settings or settings == {}
        assert "contact_email" in settings or settings == {}
        assert "contact_phone" in settings or settings == {}
        assert "featured_property_ids" in settings or settings == {}
        
        print(f"✓ Retrieved site settings: {settings}")
    
    def test_settings_403_for_non_admin(self, owner_token):
        """Non-admin cannot access site settings"""
        response = requests.get(f"{BASE_URL}/api/admin/settings",
            headers={"Authorization": f"Bearer {owner_token}"})
        assert response.status_code == 403
        print("✓ Non-admin correctly denied access to site settings")
    
    def test_update_site_settings(self, admin_token):
        """Admin can update site settings"""
        # Get current settings
        get_response = requests.get(f"{BASE_URL}/api/admin/settings",
            headers={"Authorization": f"Bearer {admin_token}"})
        original_settings = get_response.json()
        
        # Update settings
        new_settings = {
            "whatsapp_number": "+972-55-TEST-1234",
            "contact_email": "test@myisraelrental.com",
            "contact_phone": "+972-55-TEST-5678",
            "featured_property_ids": ["test-id-1", "test-id-2"]
        }
        
        response = requests.put(f"{BASE_URL}/api/admin/settings", json=new_settings,
            headers={"Authorization": f"Bearer {admin_token}"})
        assert response.status_code == 200, f"Update settings failed: {response.text}"
        
        # Verify settings were saved
        verify_response = requests.get(f"{BASE_URL}/api/admin/settings",
            headers={"Authorization": f"Bearer {admin_token}"})
        saved_settings = verify_response.json()
        
        assert saved_settings["whatsapp_number"] == new_settings["whatsapp_number"]
        assert saved_settings["contact_email"] == new_settings["contact_email"]
        assert saved_settings["contact_phone"] == new_settings["contact_phone"]
        assert saved_settings["featured_property_ids"] == new_settings["featured_property_ids"]
        
        # Restore original settings if they existed
        if original_settings and original_settings.get("whatsapp_number"):
            requests.put(f"{BASE_URL}/api/admin/settings", json=original_settings,
                headers={"Authorization": f"Bearer {admin_token}"})
        
        print("✓ Site settings updated and verified")
    
    def test_update_settings_403_for_non_admin(self, owner_token):
        """Non-admin cannot update site settings"""
        response = requests.put(f"{BASE_URL}/api/admin/settings", json={
            "whatsapp_number": "+972-55-HACK-1234"
        }, headers={"Authorization": f"Bearer {owner_token}"})
        assert response.status_code == 403
        print("✓ Non-admin correctly denied from updating site settings")


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
