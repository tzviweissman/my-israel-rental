"""Backend tests for the bulk property upload endpoints.

Covers: template download (csv/xlsx), parse (file + paste), commit, images,
role-based 403 denial for renters.
"""
import io
import json
import os
import uuid
import zipfile

import pytest
import requests

from conftest import (
    TEST_OWNER2_EMAIL, TEST_OWNER2_PASSWORD,
    TEST_RENTER2_EMAIL, TEST_RENTER2_PASSWORD,
)

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/") or "http://localhost:8001"
API = f"{BASE_URL}/api"


def _login(email, password):
    r = requests.post(f"{API}/auth/login", json={"email": email, "password": password}, timeout=30)
    assert r.status_code == 200, f"login failed: {r.status_code} {r.text}"
    return r.json()["token"]


@pytest.fixture(scope="module")
def owner_token():
    return _login(TEST_OWNER2_EMAIL, TEST_OWNER2_PASSWORD)


@pytest.fixture(scope="module")
def renter_token():
    return _login(TEST_RENTER2_EMAIL, TEST_RENTER2_PASSWORD)


@pytest.fixture(scope="module")
def owner_headers(owner_token):
    return {"Authorization": f"Bearer {owner_token}"}


@pytest.fixture(scope="module")
def renter_headers(renter_token):
    return {"Authorization": f"Bearer {renter_token}"}


_created_ids = []


@pytest.fixture(scope="module", autouse=True)
def cleanup(owner_headers):
    yield
    for pid in _created_ids:
        try:
            requests.delete(f"{API}/properties/{pid}", headers=owner_headers, timeout=10)
        except Exception:
            pass


# ------------------------ TEMPLATE ------------------------

class TestTemplate:
    def test_csv_template(self):
        r = requests.get(f"{API}/properties/bulk/template?fmt=csv", timeout=15)
        assert r.status_code == 200
        assert "text/csv" in r.headers.get("content-type", "")
        assert "attachment" in r.headers.get("content-disposition", "").lower()
        text = r.text.strip().splitlines()
        assert len(text) >= 2  # header + sample
        header = text[0].lower()
        for col in ("title", "rental_type", "property_type", "bedrooms", "area"):
            assert col in header

    def test_xlsx_template(self):
        r = requests.get(f"{API}/properties/bulk/template?fmt=xlsx", timeout=15)
        assert r.status_code == 200
        assert "spreadsheetml" in r.headers.get("content-type", "")
        # XLSX files are PK zip archives
        assert r.content[:2] == b"PK"

    def test_bad_fmt(self):
        r = requests.get(f"{API}/properties/bulk/template?fmt=pdf", timeout=15)
        assert r.status_code == 400


# ------------------------ PARSE ------------------------

CSV_3_VALID_1_INVALID = (
    "title,rental_type,property_type,bedrooms,area,monthly_price\n"
    "TEST_A,long-term,apartment,2,Jerusalem,6000\n"
    "TEST_B,short-term,apartment,1,Tel Aviv,5000\n"
    "TEST_C,vacation,house,3,Haifa,8000\n"
    "TEST_D,,apartment,2,Eilat,4000\n"  # missing rental_type
)


class TestParse:
    def test_parse_csv(self, owner_headers):
        files = {"file": ("props.csv", CSV_3_VALID_1_INVALID, "text/csv")}
        r = requests.post(f"{API}/properties/bulk/parse", files=files, headers=owner_headers, timeout=30)
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["summary"]["total"] == 4
        assert data["summary"]["valid"] == 3
        assert data["summary"]["invalid"] == 1
        invalid = [r for r in data["rows"] if r["errors"]]
        assert len(invalid) == 1
        assert "rental_type" in invalid[0]["errors"][0].lower()

    def test_parse_xlsx(self, owner_headers):
        from openpyxl import Workbook
        wb = Workbook()
        ws = wb.active
        ws.append(["title", "rental_type", "property_type", "bedrooms", "area"])
        ws.append(["TEST_X1", "long-term", "apartment", 2, "Jerusalem"])
        ws.append(["TEST_X2", "short-term", "house", 1, "Haifa"])
        buf = io.BytesIO()
        wb.save(buf)
        buf.seek(0)
        files = {"file": ("props.xlsx", buf.read(), "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")}
        r = requests.post(f"{API}/properties/bulk/parse", files=files, headers=owner_headers, timeout=30)
        assert r.status_code == 200, r.text
        assert r.json()["summary"]["valid"] == 2

    def test_parse_paste_tab(self, owner_headers):
        text = (
            "title\trental_type\tproperty_type\tbedrooms\tarea\n"
            "TEST_P1\tlong-term\tapartment\t2\tRamat Gan\n"
            "TEST_P2\tshort-term\tapartment\t1\tHerzliya\n"
        )
        r = requests.post(f"{API}/properties/bulk/parse", data={"text": text}, headers=owner_headers, timeout=30)
        assert r.status_code == 200, r.text
        assert r.json()["summary"]["valid"] == 2

    def test_parse_paste_comma(self, owner_headers):
        text = "title,rental_type,property_type,bedrooms,area\nTEST_P3,vacation,house,3,Eilat\n"
        r = requests.post(f"{API}/properties/bulk/parse", data={"text": text}, headers=owner_headers, timeout=30)
        assert r.status_code == 200
        assert r.json()["summary"]["valid"] == 1

    def test_parse_no_input(self, owner_headers):
        r = requests.post(f"{API}/properties/bulk/parse", headers=owner_headers, timeout=30)
        assert r.status_code == 400

    def test_parse_403_for_renter(self, renter_headers):
        files = {"file": ("props.csv", CSV_3_VALID_1_INVALID, "text/csv")}
        r = requests.post(f"{API}/properties/bulk/parse", files=files, headers=renter_headers, timeout=30)
        assert r.status_code == 403


# ------------------------ COMMIT ------------------------

class TestCommit:
    def test_commit_creates_and_persists(self, owner_headers):
        # Parse first
        files = {"file": ("props.csv", CSV_3_VALID_1_INVALID, "text/csv")}
        parsed = requests.post(f"{API}/properties/bulk/parse", files=files, headers=owner_headers, timeout=30).json()
        valid_rows = [r["normalized"] for r in parsed["rows"] if not r["errors"]]
        assert len(valid_rows) == 3
        # Tag with unique marker so cleanup targets only ours
        marker = f"TEST_BULK_{uuid.uuid4().hex[:6]}"
        for row in valid_rows:
            row["title"] = f"{marker}_{row['title']}"

        r = requests.post(f"{API}/properties/bulk/commit", json={"rows": valid_rows},
                          headers=owner_headers, timeout=30)
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["summary"]["created"] == 3
        assert len(data["created"]) == 3

        for item in data["created"]:
            pid = item["id"]
            _created_ids.append(pid)
            # Verify via GET
            g = requests.get(f"{API}/properties/{pid}", timeout=15)
            assert g.status_code == 200, f"GET failed: {g.status_code}"
            body = g.json()
            assert body["title"].startswith(marker)
            assert body.get("owner_id")

    def test_commit_403_for_renter(self, renter_headers):
        r = requests.post(f"{API}/properties/bulk/commit", json={"rows": []}, headers=renter_headers, timeout=15)
        assert r.status_code == 403

    def test_commit_skips_invalid(self, owner_headers):
        rows = [{"title": "TEST_bad", "rental_type": "badenum", "property_type": "apartment",
                 "bedrooms": "2", "area": "Jerusalem"}]
        r = requests.post(f"{API}/properties/bulk/commit", json={"rows": rows}, headers=owner_headers, timeout=15)
        assert r.status_code == 200
        data = r.json()
        assert data["summary"]["created"] == 0
        assert data["summary"]["skipped"] == 1


# ------------------------ IMAGES ------------------------

class TestImages:
    def test_images_attach(self, owner_headers):
        # Create a property with pending_image_filenames via commit
        row = {
            "title": f"TEST_IMG_{uuid.uuid4().hex[:6]}",
            "rental_type": "long-term",
            "property_type": "apartment",
            "bedrooms": 2,
            "area": "Jerusalem",
            "image_filenames": ["alpha.jpg", "beta.png"],
        }
        r = requests.post(f"{API}/properties/bulk/commit", json={"rows": [row]},
                          headers=owner_headers, timeout=15)
        assert r.status_code == 200
        created = r.json()["created"]
        assert len(created) == 1
        pid = created[0]["id"]
        _created_ids.append(pid)
        assert created[0]["image_filenames"] == ["alpha.jpg", "beta.png"]

        # Build ZIP with subfolder to test base-name matching
        buf = io.BytesIO()
        with zipfile.ZipFile(buf, "w") as zf:
            # PNG magic bytes + minimal content
            zf.writestr("photos/alpha.jpg", b"\xff\xd8\xff\xe0fakejpg")
            zf.writestr("beta.png", b"\x89PNG\r\n\x1a\nfakepng")
        buf.seek(0)
        mapping = json.dumps({pid: ["alpha.jpg", "beta.png", "missing.jpg"]})
        files = {"file": ("imgs.zip", buf.read(), "application/zip")}
        r = requests.post(f"{API}/properties/bulk/images", files=files,
                          data={"mapping": mapping}, headers=owner_headers, timeout=30)
        assert r.status_code == 200, r.text
        data = r.json()
        attached_names = {a["filename"] for a in data["attached"]}
        assert "alpha.jpg" in attached_names
        assert "beta.png" in attached_names
        missing_names = {m["filename"] for m in data["missing"]}
        assert "missing.jpg" in missing_names

        # Verify property.images updated
        g = requests.get(f"{API}/properties/{pid}", timeout=15).json()
        assert len(g.get("images", [])) >= 2

    def test_images_403_for_renter(self, renter_headers):
        buf = io.BytesIO()
        with zipfile.ZipFile(buf, "w") as zf:
            zf.writestr("a.jpg", b"x")
        buf.seek(0)
        files = {"file": ("imgs.zip", buf.read(), "application/zip")}
        r = requests.post(f"{API}/properties/bulk/images", files=files,
                          data={"mapping": "{}"}, headers=renter_headers, timeout=15)
        assert r.status_code == 403

    def test_images_bad_zip(self, owner_headers):
        files = {"file": ("bad.zip", b"not a zip", "application/zip")}
        r = requests.post(f"{API}/properties/bulk/images", files=files,
                          data={"mapping": "{}"}, headers=owner_headers, timeout=15)
        assert r.status_code == 400
