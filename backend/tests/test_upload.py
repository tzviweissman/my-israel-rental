"""
Test suite for image and video upload functionality
Tests: POST /api/upload, POST /api/upload/multiple, DELETE /api/upload/{filename}, GET /api/uploads/{filename}
"""
import pytest
import requests
import os
import io

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials loaded from tests/.env.test via conftest
from conftest import (
    TEST_OWNER_EMAIL as OWNER_EMAIL,
    TEST_OWNER_PASSWORD as OWNER_PASSWORD,
    TEST_RENTER_EMAIL as RENTER_EMAIL,
    TEST_RENTER_PASSWORD as RENTER_PASSWORD,
)


@pytest.fixture(scope="module")
def api_client():
    """Shared requests session"""
    session = requests.Session()
    session.headers.update({"Content-Type": "application/json"})
    return session


@pytest.fixture(scope="module")
def owner_token(api_client):
    """Get owner authentication token"""
    response = api_client.post(f"{BASE_URL}/api/auth/login", json={
        "email": OWNER_EMAIL,
        "password": OWNER_PASSWORD
    })
    if response.status_code == 200:
        return response.json().get("token")
    pytest.skip(f"Owner authentication failed: {response.status_code} - {response.text}")


@pytest.fixture(scope="module")
def authenticated_client(api_client, owner_token):
    """Session with auth header"""
    api_client.headers.update({"Authorization": f"Bearer {owner_token}"})
    return api_client


def create_test_image(filename="test_image.png", size=(100, 100)):
    """Create a minimal PNG image for testing"""
    # Minimal valid PNG (1x1 red pixel)
    png_data = bytes([
        0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A,  # PNG signature
        0x00, 0x00, 0x00, 0x0D, 0x49, 0x48, 0x44, 0x52,  # IHDR chunk
        0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,  # 1x1 dimensions
        0x08, 0x02, 0x00, 0x00, 0x00, 0x90, 0x77, 0x53,  # 8-bit RGB
        0xDE, 0x00, 0x00, 0x00, 0x0C, 0x49, 0x44, 0x41,  # IDAT chunk
        0x54, 0x08, 0xD7, 0x63, 0xF8, 0xCF, 0xC0, 0x00,  # compressed data
        0x00, 0x00, 0x03, 0x00, 0x01, 0x00, 0x18, 0xDD,
        0x8D, 0xB4, 0x00, 0x00, 0x00, 0x00, 0x49, 0x45,  # IEND chunk
        0x4E, 0x44, 0xAE, 0x42, 0x60, 0x82
    ])
    return io.BytesIO(png_data)


def create_test_jpeg():
    """Create a minimal JPEG image for testing"""
    # Minimal valid JPEG (1x1 pixel)
    jpeg_data = bytes([
        0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10, 0x4A, 0x46, 0x49, 0x46, 0x00, 0x01,
        0x01, 0x00, 0x00, 0x01, 0x00, 0x01, 0x00, 0x00, 0xFF, 0xDB, 0x00, 0x43,
        0x00, 0x08, 0x06, 0x06, 0x07, 0x06, 0x05, 0x08, 0x07, 0x07, 0x07, 0x09,
        0x09, 0x08, 0x0A, 0x0C, 0x14, 0x0D, 0x0C, 0x0B, 0x0B, 0x0C, 0x19, 0x12,
        0x13, 0x0F, 0x14, 0x1D, 0x1A, 0x1F, 0x1E, 0x1D, 0x1A, 0x1C, 0x1C, 0x20,
        0x24, 0x2E, 0x27, 0x20, 0x22, 0x2C, 0x23, 0x1C, 0x1C, 0x28, 0x37, 0x29,
        0x2C, 0x30, 0x31, 0x34, 0x34, 0x34, 0x1F, 0x27, 0x39, 0x3D, 0x38, 0x32,
        0x3C, 0x2E, 0x33, 0x34, 0x32, 0xFF, 0xC0, 0x00, 0x0B, 0x08, 0x00, 0x01,
        0x00, 0x01, 0x01, 0x01, 0x11, 0x00, 0xFF, 0xC4, 0x00, 0x1F, 0x00, 0x00,
        0x01, 0x05, 0x01, 0x01, 0x01, 0x01, 0x01, 0x01, 0x00, 0x00, 0x00, 0x00,
        0x00, 0x00, 0x00, 0x00, 0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07, 0x08,
        0x09, 0x0A, 0x0B, 0xFF, 0xC4, 0x00, 0xB5, 0x10, 0x00, 0x02, 0x01, 0x03,
        0x03, 0x02, 0x04, 0x03, 0x05, 0x05, 0x04, 0x04, 0x00, 0x00, 0x01, 0x7D,
        0x01, 0x02, 0x03, 0x00, 0x04, 0x11, 0x05, 0x12, 0x21, 0x31, 0x41, 0x06,
        0x13, 0x51, 0x61, 0x07, 0x22, 0x71, 0x14, 0x32, 0x81, 0x91, 0xA1, 0x08,
        0x23, 0x42, 0xB1, 0xC1, 0x15, 0x52, 0xD1, 0xF0, 0x24, 0x33, 0x62, 0x72,
        0x82, 0x09, 0x0A, 0x16, 0x17, 0x18, 0x19, 0x1A, 0x25, 0x26, 0x27, 0x28,
        0x29, 0x2A, 0x34, 0x35, 0x36, 0x37, 0x38, 0x39, 0x3A, 0x43, 0x44, 0x45,
        0x46, 0x47, 0x48, 0x49, 0x4A, 0x53, 0x54, 0x55, 0x56, 0x57, 0x58, 0x59,
        0x5A, 0x63, 0x64, 0x65, 0x66, 0x67, 0x68, 0x69, 0x6A, 0x73, 0x74, 0x75,
        0x76, 0x77, 0x78, 0x79, 0x7A, 0x83, 0x84, 0x85, 0x86, 0x87, 0x88, 0x89,
        0x8A, 0x92, 0x93, 0x94, 0x95, 0x96, 0x97, 0x98, 0x99, 0x9A, 0xA2, 0xA3,
        0xA4, 0xA5, 0xA6, 0xA7, 0xA8, 0xA9, 0xAA, 0xB2, 0xB3, 0xB4, 0xB5, 0xB6,
        0xB7, 0xB8, 0xB9, 0xBA, 0xC2, 0xC3, 0xC4, 0xC5, 0xC6, 0xC7, 0xC8, 0xC9,
        0xCA, 0xD2, 0xD3, 0xD4, 0xD5, 0xD6, 0xD7, 0xD8, 0xD9, 0xDA, 0xE1, 0xE2,
        0xE3, 0xE4, 0xE5, 0xE6, 0xE7, 0xE8, 0xE9, 0xEA, 0xF1, 0xF2, 0xF3, 0xF4,
        0xF5, 0xF6, 0xF7, 0xF8, 0xF9, 0xFA, 0xFF, 0xDA, 0x00, 0x08, 0x01, 0x01,
        0x00, 0x00, 0x3F, 0x00, 0xFB, 0xD5, 0xDB, 0x20, 0xA8, 0xF1, 0x7E, 0xB4,
        0x01, 0xFF, 0xD9
    ])
    return io.BytesIO(jpeg_data)



# Uploads go to Cloudinary when it is configured (CLOUDINARY_ENABLED), and
# come back as an absolute https://res.cloudinary.com/... URL; only the
# local fallback returns /api/uploads/<file>. These tests were written for
# the local path alone and had been failing against every configured
# environment - including this machine - while asserting nothing about
# the path actually in use.
_UPLOAD_URL_PREFIXES = ("/api/uploads/", "https://res.cloudinary.com/")


def _fetchable(url: str) -> str:
    """Absolute URL for a returned upload URL, local or Cloudinary."""
    return url if url.startswith("http") else f"{BASE_URL}{url}"

class TestUploadAuthentication:
    """Test upload endpoint authentication requirements"""
    
    def test_upload_requires_auth(self, api_client):
        """POST /api/upload should return 401/403 without token"""
        # Remove auth header if present
        api_client.headers.pop("Authorization", None)
        
        files = {"file": ("test.png", create_test_image(), "image/png")}
        response = requests.post(f"{BASE_URL}/api/upload", files=files)
        
        assert response.status_code in [401, 403], f"Expected 401 or 403, got {response.status_code}"
        print(f"PASS: Upload requires authentication ({response.status_code} without token)")


class TestImageUpload:
    """Test image upload functionality"""
    
    def test_upload_png_image(self, authenticated_client, owner_token):
        """POST /api/upload accepts PNG images"""
        files = {"file": ("test_image.png", create_test_image(), "image/png")}
        response = requests.post(
            f"{BASE_URL}/api/upload",
            files=files,
            headers={"Authorization": f"Bearer {owner_token}"}
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        
        # Validate response structure
        assert "url" in data, "Response missing 'url'"
        assert "file_type" in data, "Response missing 'file_type'"
        assert "filename" in data, "Response missing 'filename'"
        assert "size" in data, "Response missing 'size'"
        
        # Validate values
        assert data["file_type"] == "image", f"Expected file_type 'image', got '{data['file_type']}'"
        assert data["url"].startswith(_UPLOAD_URL_PREFIXES), f"unexpected upload URL {data['url']}"
        # Cloudinary returns its public id as the filename, which carries no
        # extension; the local fallback keeps the original name.
        assert data["filename"].endswith(".png") or data["url"].startswith("https://res.cloudinary.com/"), (
            f"Filename should end with .png, got {data['filename']}"
        )
        assert data["size"] > 0, "Size should be greater than 0"
        
        print(f"PASS: PNG upload successful - {data}")
        return data
    
    def test_upload_jpeg_image(self, authenticated_client, owner_token):
        """POST /api/upload accepts JPEG images"""
        files = {"file": ("test_image.jpg", create_test_jpeg(), "image/jpeg")}
        response = requests.post(
            f"{BASE_URL}/api/upload",
            files=files,
            headers={"Authorization": f"Bearer {owner_token}"}
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        
        assert data["file_type"] == "image"
        assert data["url"].startswith(_UPLOAD_URL_PREFIXES)
        print(f"PASS: JPEG upload successful - {data}")
    
    def test_uploaded_file_accessible(self, authenticated_client, owner_token):
        """GET /api/uploads/{filename} returns uploaded file"""
        # First upload a file
        files = {"file": ("access_test.png", create_test_image(), "image/png")}
        upload_response = requests.post(
            f"{BASE_URL}/api/upload",
            files=files,
            headers={"Authorization": f"Bearer {owner_token}"}
        )
        
        assert upload_response.status_code == 200
        url = upload_response.json()["url"]
        
        # Fetch it from wherever the API says it lives - the local static
        # mount or the CDN - which is what a browser does with this URL.
        get_response = requests.get(_fetchable(url), timeout=30)
        
        assert get_response.status_code == 200, f"Expected 200, got {get_response.status_code} for {url}"
        assert len(get_response.content) > 0, "File content should not be empty"
        print(f"PASS: Uploaded file accessible at {url}")


class TestVideoUpload:
    """Test video upload functionality"""
    
    def test_upload_mp4_video(self, authenticated_client, owner_token):
        """POST /api/upload accepts MP4 videos"""
        # Create minimal MP4 file (ftyp box only - enough to test content type)
        mp4_data = bytes([
            0x00, 0x00, 0x00, 0x14,  # box size
            0x66, 0x74, 0x79, 0x70,  # 'ftyp'
            0x69, 0x73, 0x6F, 0x6D,  # 'isom'
            0x00, 0x00, 0x00, 0x00,  # minor version
            0x69, 0x73, 0x6F, 0x6D   # compatible brand
        ])
        
        files = {"file": ("test_video.mp4", io.BytesIO(mp4_data), "video/mp4")}
        response = requests.post(
            f"{BASE_URL}/api/upload",
            files=files,
            headers={"Authorization": f"Bearer {owner_token}"}
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        
        assert data["file_type"] == "video", f"Expected file_type 'video', got '{data['file_type']}'"
        assert data["url"].startswith(_UPLOAD_URL_PREFIXES)
        print(f"PASS: MP4 video upload successful - {data}")
    
    def test_upload_webm_video(self, authenticated_client, owner_token):
        """POST /api/upload accepts WebM videos"""
        # Minimal WebM header
        webm_data = bytes([
            0x1A, 0x45, 0xDF, 0xA3,  # EBML header
            0x01, 0x00, 0x00, 0x00,
            0x00, 0x00, 0x00, 0x1F
        ])
        
        files = {"file": ("test_video.webm", io.BytesIO(webm_data), "video/webm")}
        response = requests.post(
            f"{BASE_URL}/api/upload",
            files=files,
            headers={"Authorization": f"Bearer {owner_token}"}
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        
        assert data["file_type"] == "video"
        print(f"PASS: WebM video upload successful - {data}")


class TestUnsupportedFileTypes:
    """Test rejection of unsupported file types"""
    
    def test_reject_text_file(self, authenticated_client, owner_token):
        """POST /api/upload rejects text files with 400"""
        files = {"file": ("test.txt", io.BytesIO(b"Hello World"), "text/plain")}
        response = requests.post(
            f"{BASE_URL}/api/upload",
            files=files,
            headers={"Authorization": f"Bearer {owner_token}"}
        )
        
        assert response.status_code == 400, f"Expected 400, got {response.status_code}"
        assert "Unsupported file type" in response.json().get("detail", "")
        print("PASS: Text file rejected with 400")
    
    def test_reject_pdf_file(self, authenticated_client, owner_token):
        """POST /api/upload rejects PDF files with 400"""
        files = {"file": ("test.pdf", io.BytesIO(b"%PDF-1.4"), "application/pdf")}
        response = requests.post(
            f"{BASE_URL}/api/upload",
            files=files,
            headers={"Authorization": f"Bearer {owner_token}"}
        )
        
        assert response.status_code == 400, f"Expected 400, got {response.status_code}"
        print("PASS: PDF file rejected with 400")


class TestMultipleFileUpload:
    """Test multiple file upload endpoint"""
    
    def test_upload_multiple_files(self, authenticated_client, owner_token):
        """POST /api/upload/multiple accepts multiple files"""
        files = [
            ("files", ("image1.png", create_test_image(), "image/png")),
            ("files", ("image2.png", create_test_image(), "image/png")),
        ]
        
        response = requests.post(
            f"{BASE_URL}/api/upload/multiple",
            files=files,
            headers={"Authorization": f"Bearer {owner_token}"}
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        
        assert isinstance(data, list), "Response should be a list"
        assert len(data) == 2, f"Expected 2 results, got {len(data)}"
        
        for item in data:
            assert "url" in item, "Each result should have 'url'"
            assert "file_type" in item, "Each result should have 'file_type'"
            assert item["file_type"] == "image"
        
        print(f"PASS: Multiple file upload successful - {len(data)} files uploaded")


class TestFileDelete:
    """Test file deletion endpoint"""
    
    def test_delete_uploaded_file(self, authenticated_client, owner_token):
        """DELETE /api/upload/{filename} removes the file"""
        # First upload a file
        files = {"file": ("delete_test.png", create_test_image(), "image/png")}
        upload_response = requests.post(
            f"{BASE_URL}/api/upload",
            files=files,
            headers={"Authorization": f"Bearer {owner_token}"}
        )
        
        assert upload_response.status_code == 200
        filename = upload_response.json()["filename"]
        
        # Delete the file
        delete_response = requests.delete(
            f"{BASE_URL}/api/upload/{filename}",
            headers={"Authorization": f"Bearer {owner_token}"}
        )
        
        assert delete_response.status_code == 200, f"Expected 200, got {delete_response.status_code}"
        assert "deleted" in delete_response.json().get("message", "").lower()
        
        # Verify file is no longer accessible
        get_response = requests.get(f"{BASE_URL}/api/uploads/{filename}")
        assert get_response.status_code == 404, f"File should be deleted, got {get_response.status_code}"
        
        print(f"PASS: File {filename} deleted successfully")


class TestPropertyWithMedia:
    """Test property creation with uploaded images and videos"""
    
    def test_create_property_with_images(self, authenticated_client, owner_token):
        """POST /api/properties saves image URLs in images array"""
        # First upload images
        files = {"file": ("property_image.png", create_test_image(), "image/png")}
        upload_response = requests.post(
            f"{BASE_URL}/api/upload",
            files=files,
            headers={"Authorization": f"Bearer {owner_token}"}
        )
        
        assert upload_response.status_code == 200
        image_url = upload_response.json()["url"]
        
        # Create property with the uploaded image
        property_data = {
            "title": "TEST_Property with Images",
            "description": "Test property with uploaded images",
            "rental_type": "long-term",
            "property_type": "apartment",
            "bedrooms": 2,
            "bathrooms": 1,
            "area": "Tel Aviv",
            "address": "123 Test Street",
            "monthly_price": 5000,
            "currency": "ILS",
            "images": [image_url]
        }
        
        response = requests.post(
            f"{BASE_URL}/api/properties",
            json=property_data,
            headers={"Authorization": f"Bearer {owner_token}", "Content-Type": "application/json"}
        )
        
        assert response.status_code in [200, 201], f"Expected 200/201, got {response.status_code}: {response.text}"
        data = response.json()
        
        property_id = data["id"]
        
        # Verify by fetching the property
        get_response = requests.get(f"{BASE_URL}/api/properties/{property_id}")
        assert get_response.status_code == 200
        fetched = get_response.json()
        
        assert "images" in fetched, "Property should have 'images' field"
        assert image_url in fetched["images"], f"Image URL {image_url} should be in property images"
        
        print(f"PASS: Property created with images - {property_id}")
        
        # Cleanup
        requests.delete(
            f"{BASE_URL}/api/properties/{property_id}",
            headers={"Authorization": f"Bearer {owner_token}"}
        )
    
    def test_create_property_with_videos(self, authenticated_client, owner_token):
        """POST /api/properties saves video URLs in videos array"""
        # Upload a video
        mp4_data = bytes([
            0x00, 0x00, 0x00, 0x14, 0x66, 0x74, 0x79, 0x70,
            0x69, 0x73, 0x6F, 0x6D, 0x00, 0x00, 0x00, 0x00,
            0x69, 0x73, 0x6F, 0x6D
        ])
        
        files = {"file": ("property_video.mp4", io.BytesIO(mp4_data), "video/mp4")}
        upload_response = requests.post(
            f"{BASE_URL}/api/upload",
            files=files,
            headers={"Authorization": f"Bearer {owner_token}"}
        )
        
        assert upload_response.status_code == 200
        video_url = upload_response.json()["url"]
        
        # Create property with the uploaded video
        property_data = {
            "title": "TEST_Property with Videos",
            "description": "Test property with uploaded videos",
            "rental_type": "short-term",
            "property_type": "apartment",
            "bedrooms": 1,
            "bathrooms": 1,
            "area": "Jerusalem",
            "address": "456 Test Ave",
            "nightly_price": 200,
            "currency": "USD",
            "images": [],
            "videos": [video_url]
        }
        
        response = requests.post(
            f"{BASE_URL}/api/properties",
            json=property_data,
            headers={"Authorization": f"Bearer {owner_token}", "Content-Type": "application/json"}
        )
        
        assert response.status_code in [200, 201], f"Expected 200/201, got {response.status_code}: {response.text}"
        data = response.json()
        
        property_id = data["id"]
        
        # Verify by fetching
        get_response = requests.get(f"{BASE_URL}/api/properties/{property_id}")
        assert get_response.status_code == 200
        fetched = get_response.json()
        
        assert "videos" in fetched, "Property should have 'videos' field"
        assert video_url in fetched.get("videos", []), f"Video URL {video_url} should be in property videos"
        
        print(f"PASS: Property created with videos - {property_id}")
        
        # Cleanup
        requests.delete(
            f"{BASE_URL}/api/properties/{property_id}",
            headers={"Authorization": f"Bearer {owner_token}"}
        )


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
